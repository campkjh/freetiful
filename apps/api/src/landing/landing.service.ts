import { Injectable } from '@nestjs/common';
import { Prisma } from '@prisma/client';
import { PrismaService } from '../prisma/prisma.service';

export interface VisitInput {
  page: string;
  sessionKey: string;
  utm_source?: string;
  utm_medium?: string;
  utm_campaign?: string;
  utm_term?: string;
  utm_content?: string;
  referrer?: string;
  landingPath?: string;
  /** web | ios-app | android-app (261005) */
  platform?: string;
}

const clip = (v?: string, n = 300) => (v ? String(v).slice(0, n) : null);

/** 페이지 조회 1건(261007 페이지별 인사이트) — 화면을 열 때 브라우저가 보낸다 */
export interface PageViewInput {
  id: string;
  path: string;
  visitorId: string;
  sessionKey: string;
  platform?: string;
  device?: string;
  entry?: boolean;
  referrer?: string;
}

const UUID_RE = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;
/** 검색·미리보기 로봇과 헤드리스 브라우저는 세지 않는다(카카오톡 인앱 브라우저 'KAKAOTALK' 은 사람이라 kakaotalk-scrap 만) */
const BOT_RE = /bot|crawl|spider|slurp|headless|lighthouse|pingdom|facebookexternalhit|kakaotalk-scrap|yeti|daumoa|bingpreview|petalbot|semrush|ahrefs/i;
/** 체류시간 상한 — 탭을 열어 두고 자리를 비운 시간까지 세지 않게 */
const MAX_DWELL_MS = 30 * 60 * 1000;

/**
 * 실제 주소 → 경로 틀. 아이디 칸(uuid·숫자·긴 무작위 값)은 :id 로 묶는다(/pros/3f… → /pros/:id).
 * 관리자·로그인 콜백·루트(바로 /main 으로 넘어감)는 세지 않는다(null).
 */
export function normalizePagePath(raw?: string): string | null {
  if (!raw) return null;
  let p = String(raw).split(/[?#]/)[0].trim();
  try { p = decodeURIComponent(p); } catch { /* 깨진 인코딩 — 그대로 */ }
  if (!p.startsWith('/')) return null;
  p = p.replace(/\/{2,}/g, '/');
  if (p.length > 1) p = p.replace(/\/+$/, '');
  p = p
    .split('/')
    .map((seg, i) => {
      if (i === 0 || !seg) return seg;
      if (UUID_RE.test(seg) || /^[0-9a-f]{24}$/i.test(seg) || /^\d+$/.test(seg)) return ':id';
      if (seg.length >= 20 && /\d/.test(seg) && /^[\w-]+$/.test(seg)) return ':id';
      return seg;
    })
    .join('/')
    .slice(0, 120);
  if (p === '/' || /^\/(admin|api|auth|_next)(\/|$)/.test(p)) return null;
  return p;
}

/** 방문을 기록하는 페이지 — 랜딩 2개(유입 분석) + 홈·퀵매칭(전환 퍼널) */
const TRACKED_PAGES = ['wedding-mc', 'corporate-mc', 'home', 'quick-match'] as const;
const LANDING_PAGES = ['wedding-mc', 'corporate-mc'];
/** 페이지별 유입 분석(261005 사장 '퀵매칭 · 웨딩MC · 비즈MC 나눠서') — page 를 주면 그 페이지만, 안 주면 예전처럼 랜딩 2개 */
const ANALYTICS_PAGES = ['quick-match', 'wedding-mc', 'corporate-mc'];
const pagesFor = (page?: string) => (page && ANALYTICS_PAGES.includes(page) ? [page] : LANDING_PAGES);

@Injectable()
export class LandingService {
  constructor(private prisma: PrismaService) {}

  /** 방문 기록(세션·페이지당 1행, 중복은 upsert 로 무해하게 갱신). */
  async recordVisit(input: VisitInput) {
    // 홈·퀵매칭 방문도 같은 표에(261005 — 홈 '전환 퍼널' 첫 두 단계). 모르는 값은 예전처럼 wedding-mc
    const page = (TRACKED_PAGES as readonly string[]).includes(input.page) ? input.page : 'wedding-mc';
    const sessionKey = clip(input.sessionKey, 80) || 'anon';
    const data = {
      utmSource: clip(input.utm_source, 120),
      utmMedium: clip(input.utm_medium, 120),
      utmCampaign: clip(input.utm_campaign, 200),
      utmTerm: clip(input.utm_term, 200),
      utmContent: clip(input.utm_content, 200),
      referrer: clip(input.referrer, 400),
      landingPath: clip(input.landingPath, 400),
      platform: ['web', 'ios-app', 'android-app'].includes(String(input.platform)) ? String(input.platform) : null,
    };
    await this.prisma.landingVisit.upsert({
      where: { sessionKey_page: { sessionKey, page } },
      create: { page, sessionKey, ...data },
      update: {}, // 최초 방문 값 유지(재방문으로 소스 덮어쓰지 않음)
    });
    return { ok: true };
  }

  /** 폼 제출 성공 → 해당 세션 방문을 전환으로 표시. */
  async markConverted(page: string, sessionKey: string) {
    // 퀵매칭 = 견적 요청을 보내면 전환(261005 — 페이지별 유입 분석에 퀵매칭 칸)
    const p = page === 'corporate-mc' || page === 'quick-match' ? page : 'wedding-mc';
    await this.prisma.landingVisit.updateMany({
      where: { page: p, sessionKey: clip(sessionKey, 80) || 'anon', converted: false },
      data: { converted: true, convertedAt: new Date() },
    });
    return { ok: true };
  }

  /** 어드민 집계 — 페이지별 방문/전환 + 소스/매체/캠페인 상위 분해. */
  async analytics(fromISO?: string, toISO?: string, page?: string) {
    // page 없으면 두 랜딩만 — 홈 방문(전환 퍼널용)은 어느 쪽에도 섞이지 않는다
    const pages = pagesFor(page);
    const where: any = { page: { in: pages } };
    if (fromISO || toISO) {
      where.createdAt = {};
      if (fromISO) where.createdAt.gte = new Date(fromISO);
      if (toISO) where.createdAt.lte = new Date(toISO);
    }
    const rows = await this.prisma.landingVisit.findMany({
      where,
      select: { page: true, utmSource: true, utmMedium: true, utmCampaign: true, referrer: true, converted: true, createdAt: true },
    });

    const norm = (v?: string | null) => (v && v.trim() ? v.trim() : null);
    // referrer 호스트로 소스 추정(utm 없을 때)
    const inferSource = (r?: string | null): string => {
      if (!r) return '직접/기타';
      try {
        const h = new URL(r).hostname.replace(/^www\./, '').toLowerCase();
        if (h.includes('instagram')) return 'instagram';
        if (h.includes('threads')) return 'threads';
        if (h.includes('youtube') || h.includes('youtu.be')) return 'youtube';
        if (h.includes('tiktok')) return 'tiktok';
        if (h.includes('facebook') || h === 'l.facebook.com') return 'facebook';
        if (h.includes('naver')) return 'naver';
        if (h.includes('google')) return 'google';
        if (h.includes('kakao')) return 'kakao';
        if (h.includes('daum')) return 'daum';
        return h;
      } catch { return '직접/기타'; }
    };

    const build = (page: string) => {
      const pr = rows.filter((r) => r.page === page);
      const visits = pr.length;
      const conversions = pr.filter((r) => r.converted).length;
      const bucket = (key: (r: typeof pr[number]) => string) => {
        const m = new Map<string, { visits: number; conversions: number }>();
        for (const r of pr) {
          const k = key(r);
          const e = m.get(k) || { visits: 0, conversions: 0 };
          e.visits += 1; if (r.converted) e.conversions += 1;
          m.set(k, e);
        }
        return Array.from(m.entries())
          .map(([k, v]) => ({ key: k, visits: v.visits, conversions: v.conversions, rate: v.visits ? v.conversions / v.visits : 0 }))
          .sort((a, b) => b.visits - a.visits);
      };
      return {
        page,
        visits,
        conversions,
        rate: visits ? conversions / visits : 0,
        bySource: bucket((r) => norm(r.utmSource) || inferSource(r.referrer)),
        byMedium: bucket((r) => norm(r.utmMedium) || '(없음)'),
        byCampaign: bucket((r) => norm(r.utmCampaign) || '(없음)'),
      };
    };

    // ── 일별 방문/견적(전환) — KST 기준 ──
    const kstDate = (d: Date) => new Date(d.getTime() + 9 * 3600 * 1000).toISOString().slice(0, 10);
    const dayMap = new Map<string, { visits: number; conversions: number }>();
    for (const r of rows) {
      const day = kstDate(r.createdAt);
      const e = dayMap.get(day) || { visits: 0, conversions: 0 };
      e.visits += 1; if (r.converted) e.conversions += 1;
      dayMap.set(day, e);
    }
    const daily = Array.from(dayMap.entries())
      .map(([date, v]) => ({ date, visits: v.visits, conversions: v.conversions }))
      .sort((a, b) => (a.date < b.date ? 1 : -1)); // 최신일 먼저

    const todayStr = kstDate(new Date());
    const today = dayMap.get(todayStr) || { visits: 0, conversions: 0 };

    return {
      pages: pages.map(build),
      totalVisits: rows.length,
      totalConversions: rows.filter((r) => r.converted).length,
      daily,
      today: { date: todayStr, visits: today.visits, conversions: today.conversions },
    };
  }

  /**
   * 광고 집행비 — 채널별·월별. 어드민이 직접 입력한 금액을 그대로 돌려준다.
   * yearMonth: "2026-07" (KST 기준)
   */
  async getAdSpend(yearMonth: string) {
    const ym = /^\d{4}-\d{2}$/.test(yearMonth || '') ? yearMonth : '';
    if (!ym) return { yearMonth: '', items: [] };
    const rows = await this.prisma.adSpend.findMany({
      where: { yearMonth: ym },
      select: { channel: true, amount: true },
      orderBy: { channel: 'asc' },
    });
    return { yearMonth: ym, items: rows };
  }

  /** 채널 금액 저장(upsert). amount=0 이면 0원으로 기록(삭제 아님 — 입력했다는 사실은 유지). */
  async setAdSpend(yearMonth: string, channel: string, amount: number) {
    const ym = /^\d{4}-\d{2}$/.test(yearMonth || '') ? yearMonth : '';
    const ch = String(channel || '').trim().slice(0, 40);
    const amt = Math.max(0, Math.round(Number(amount) || 0));
    if (!ym || !ch) return { ok: false, reason: 'invalid_params' };
    await this.prisma.adSpend.upsert({
      where: { yearMonth_channel: { yearMonth: ym, channel: ch } },
      create: { yearMonth: ym, channel: ch, amount: amt },
      update: { amount: amt },
    });
    return { ok: true, yearMonth: ym, channel: ch, amount: amt };
  }

  // 최근 방문 리스트(어떤 유입으로 들어왔는지) — 어드민 하단 표.
  async recentVisits(limit = 100, page?: string) {
    const rows = await this.prisma.landingVisit.findMany({
      where: { page: { in: pagesFor(page) } },
      orderBy: { createdAt: 'desc' },
      take: Math.max(1, Math.min(300, limit)),
      select: { page: true, utmSource: true, utmMedium: true, utmCampaign: true, referrer: true, converted: true, convertedAt: true, createdAt: true },
    });
    const host = (r?: string | null) => { if (!r) return null; try { return new URL(r).hostname.replace(/^www\./, ''); } catch { return r.slice(0, 40); } };
    return {
      data: rows.map((r) => ({
        page: r.page,
        source: (r.utmSource && r.utmSource.trim()) || null,
        medium: (r.utmMedium && r.utmMedium.trim()) || null,
        campaign: (r.utmCampaign && r.utmCampaign.trim()) || null,
        referrerHost: host(r.referrer),
        referrer: r.referrer || null,
        converted: r.converted,
        createdAt: r.createdAt,
      })),
    };
  }

  // ───────────────────────── 페이지별 인사이트(261007) ─────────────────────────

  /** 화면을 열 때 1행. 로봇·이상한 값은 조용히 버린다(공개 엔드포인트라 받은 값을 믿지 않는다). */
  async recordPageView(input: PageViewInput, userAgent?: string) {
    if (userAgent && BOT_RE.test(userAgent)) return { ok: false };
    const id = String(input?.id || '');
    const path = normalizePagePath(input?.path);
    const visitorId = clip(input?.visitorId, 80);
    const sessionKey = clip(input?.sessionKey, 80);
    if (!UUID_RE.test(id) || !path || !visitorId || !sessionKey) return { ok: false };
    const entry = input.entry === true;
    let referrerHost: string | null = null;
    if (entry && input.referrer) {
      try {
        const h = new URL(String(input.referrer)).hostname.replace(/^www\./, '').toLowerCase();
        if (h && !h.endsWith('freetiful.com')) referrerHost = h.slice(0, 120);
      } catch { /* 주소가 아닌 리퍼러 — 버린다 */ }
    }
    await this.prisma.pageView.createMany({
      data: [{
        id,
        path,
        visitorId,
        sessionKey,
        platform: ['web', 'ios-app', 'android-app'].includes(String(input.platform)) ? String(input.platform) : null,
        device: ['mobile', 'desktop'].includes(String(input.device)) ? String(input.device) : null,
        entry,
        referrerHost,
      }],
      skipDuplicates: true,
    });
    return { ok: true };
  }

  /** 떠날 때 체류시간(누적 ms) — 같은 화면에서 여러 번 와도(탭 숨김→다시) 큰 값만 남긴다. 12시간 지난 행은 손대지 않는다. */
  async updatePageViewDuration(id: string, ms: number) {
    if (!UUID_RE.test(String(id || ''))) return { ok: false };
    const v = Math.max(0, Math.min(MAX_DWELL_MS, Math.round(Number(ms) || 0)));
    if (!v) return { ok: false };
    await this.prisma.pageView.updateMany({
      where: { id, durationMs: { lt: v }, createdAt: { gte: new Date(Date.now() - 12 * 3600 * 1000) } },
      data: { durationMs: v },
    });
    return { ok: true };
  }

  /**
   * 어드민 집계 — 기간 안 페이지(경로 틀)마다 방문자(기기 수)·조회·체류시간·바로 나감 + 같은 길이 앞 기간 비교 + 시간/날짜 흐름.
   * 체류시간 평균·중앙값은 체류시간이 잡힌 조회만(앱을 강제로 닫아 못 보낸 조회는 빼고), 30분 상한.
   */
  async pageInsights(fromISO?: string, toISO?: string) {
    const parse = (v?: string) => {
      if (!v) return null;
      const d = new Date(v);
      return Number.isNaN(d.getTime()) ? null : d;
    };
    const firstRow = await this.prisma.pageView.findFirst({ orderBy: { createdAt: 'asc' }, select: { createdAt: true } });
    const since = firstRow?.createdAt ?? null;
    const to = parse(toISO) ?? new Date();
    const from = parse(fromISO) ?? since ?? new Date(to.getTime() - 30 * 86400000);
    const span = Math.max(60000, to.getTime() - from.getTime());
    const prevFrom = new Date(from.getTime() - span);
    const prevTo = new Date(from.getTime() - 1);
    const range = (a: Date, b: Date) => Prisma.sql`"createdAt" >= ${a} AND "createdAt" <= ${b}`;
    const cur = range(from, to);
    const hourly = span <= 2 * 86400000;

    type PageRow = { path: string; views: number; visitors: number; sessions: number; entries: number; timed: number; avgMs: number; medianMs: number; mobile: number; app: number };
    const [pages, bounces, totals, singles, prevTotals, prevPages, series] = await Promise.all([
      this.prisma.$queryRaw<PageRow[]>`
        SELECT path,
          count(*)::int AS views,
          count(DISTINCT "visitorId")::int AS visitors,
          count(DISTINCT "sessionKey")::int AS sessions,
          count(*) FILTER (WHERE entry)::int AS entries,
          count(*) FILTER (WHERE "durationMs" > 0)::int AS timed,
          COALESCE(avg(LEAST("durationMs", 1800000)) FILTER (WHERE "durationMs" > 0), 0)::float AS "avgMs",
          COALESCE(percentile_cont(0.5) WITHIN GROUP (ORDER BY LEAST("durationMs", 1800000)) FILTER (WHERE "durationMs" > 0), 0)::float AS "medianMs",
          count(*) FILTER (WHERE device = 'mobile')::int AS mobile,
          count(*) FILTER (WHERE platform IN ('ios-app', 'android-app'))::int AS app
        FROM page_views WHERE ${cur}
        GROUP BY path ORDER BY visitors DESC, views DESC LIMIT 300`,
      // 바로 나감 = 그 화면으로 들어와 그 화면만 보고 끝난 세션
      this.prisma.$queryRaw<{ path: string; bounces: number }[]>`
        SELECT p.path, count(*)::int AS bounces
        FROM page_views p
        JOIN (SELECT "sessionKey" FROM page_views WHERE ${cur} GROUP BY "sessionKey" HAVING count(*) = 1) s ON s."sessionKey" = p."sessionKey"
        WHERE p.entry AND p."createdAt" >= ${from} AND p."createdAt" <= ${to}
        GROUP BY p.path`,
      this.prisma.$queryRaw<{ views: number; visitors: number; sessions: number; avgMs: number; mobile: number; app: number }[]>`
        SELECT count(*)::int AS views,
          count(DISTINCT "visitorId")::int AS visitors,
          count(DISTINCT "sessionKey")::int AS sessions,
          COALESCE(avg(LEAST("durationMs", 1800000)) FILTER (WHERE "durationMs" > 0), 0)::float AS "avgMs",
          count(*) FILTER (WHERE device = 'mobile')::int AS mobile,
          count(*) FILTER (WHERE platform IN ('ios-app', 'android-app'))::int AS app
        FROM page_views WHERE ${cur}`,
      this.prisma.$queryRaw<{ n: number }[]>`
        SELECT count(*)::int AS n FROM (SELECT "sessionKey" FROM page_views WHERE ${cur} GROUP BY "sessionKey" HAVING count(*) = 1) s`,
      this.prisma.$queryRaw<{ views: number; visitors: number; avgMs: number }[]>`
        SELECT count(*)::int AS views,
          count(DISTINCT "visitorId")::int AS visitors,
          COALESCE(avg(LEAST("durationMs", 1800000)) FILTER (WHERE "durationMs" > 0), 0)::float AS "avgMs"
        FROM page_views WHERE ${range(prevFrom, prevTo)}`,
      this.prisma.$queryRaw<{ path: string; visitors: number }[]>`
        SELECT path, count(DISTINCT "visitorId")::int AS visitors FROM page_views WHERE ${range(prevFrom, prevTo)} GROUP BY path`,
      // 흐름 — 이틀 이하면 시간마다, 아니면 날마다(KST)
      hourly
        ? this.prisma.$queryRaw<{ t: string; visitors: number; views: number }[]>`
            SELECT to_char(date_trunc('hour', "createdAt" + interval '9 hours'), 'YYYY-MM-DD"T"HH24') AS t,
              count(DISTINCT "visitorId")::int AS visitors, count(*)::int AS views
            FROM page_views WHERE ${cur} GROUP BY 1 ORDER BY 1`
        : this.prisma.$queryRaw<{ t: string; visitors: number; views: number }[]>`
            SELECT to_char(("createdAt" + interval '9 hours')::date, 'YYYY-MM-DD') AS t,
              count(DISTINCT "visitorId")::int AS visitors, count(*)::int AS views
            FROM page_views WHERE ${cur} GROUP BY 1 ORDER BY 1`,
    ]);

    const bounceOf = new Map(bounces.map((b) => [b.path, b.bounces]));
    const prevOf = new Map(prevPages.map((p) => [p.path, p.visitors]));
    const t = totals[0] || { views: 0, visitors: 0, sessions: 0, avgMs: 0, mobile: 0, app: 0 };
    const pt = prevTotals[0] || { views: 0, visitors: 0, avgMs: 0 };
    // 앞 기간이 기록 시작보다 앞이면 비교하지 않는다(늘 '처음'으로 크게 늘어 보인다)
    const prevComparable = !!since && prevFrom.getTime() >= since.getTime();
    return {
      since,
      range: { from, to, bucket: hourly ? 'hour' : 'day' },
      totals: {
        views: t.views,
        visitors: t.visitors,
        sessions: t.sessions,
        avgMs: Math.round(t.avgMs),
        bounceRate: t.sessions ? (singles[0]?.n || 0) / t.sessions : 0,
        mobile: t.mobile,
        app: t.app,
      },
      prev: prevComparable ? { views: pt.views, visitors: pt.visitors, avgMs: Math.round(pt.avgMs) } : null,
      series,
      pages: pages.map((p) => ({
        ...p,
        avgMs: Math.round(p.avgMs),
        medianMs: Math.round(p.medianMs),
        bounces: bounceOf.get(p.path) || 0,
        prevVisitors: prevComparable ? prevOf.get(p.path) || 0 : null,
      })),
    };
  }
}
