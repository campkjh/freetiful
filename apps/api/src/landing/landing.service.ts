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
      select: { page: true, utmSource: true, utmMedium: true, utmCampaign: true, referrer: true, converted: true },
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

    return { pages: pages.map(build), totalVisits: rows.length, totalConversions: rows.filter((r) => r.converted).length };
  }
}
