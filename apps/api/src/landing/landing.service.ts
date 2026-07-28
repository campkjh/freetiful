import { Injectable } from '@nestjs/common';
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
}

const clip = (v?: string, n = 300) => (v ? String(v).slice(0, n) : null);

@Injectable()
export class LandingService {
  constructor(private prisma: PrismaService) {}

  /** 방문 기록(세션·페이지당 1행, 중복은 upsert 로 무해하게 갱신). */
  async recordVisit(input: VisitInput) {
    const page = input.page === 'corporate-mc' ? 'corporate-mc' : 'wedding-mc';
    const sessionKey = clip(input.sessionKey, 80) || 'anon';
    const data = {
      utmSource: clip(input.utm_source, 120),
      utmMedium: clip(input.utm_medium, 120),
      utmCampaign: clip(input.utm_campaign, 200),
      utmTerm: clip(input.utm_term, 200),
      utmContent: clip(input.utm_content, 200),
      referrer: clip(input.referrer, 400),
      landingPath: clip(input.landingPath, 400),
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
    const p = page === 'corporate-mc' ? 'corporate-mc' : 'wedding-mc';
    await this.prisma.landingVisit.updateMany({
      where: { page: p, sessionKey: clip(sessionKey, 80) || 'anon', converted: false },
      data: { converted: true, convertedAt: new Date() },
    });
    return { ok: true };
  }

  /** 어드민 집계 — 페이지별 방문/전환 + 소스/매체/캠페인 상위 분해. */
  async analytics(fromISO?: string, toISO?: string) {
    const where: any = {};
    if (fromISO || toISO) {
      where.createdAt = {};
      if (fromISO) where.createdAt.gte = new Date(fromISO);
      if (toISO) where.createdAt.lte = new Date(toISO);
    }
    const rows = await this.prisma.landingVisit.findMany({
      where,
      select: { page: true, utmSource: true, utmMedium: true, utmCampaign: true, referrer: true, converted: true, createdAt: true },
    });

    const pages = ['wedding-mc', 'corporate-mc'] as const;
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
  async recentVisits(limit = 100) {
    const rows = await this.prisma.landingVisit.findMany({
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
}
