import { Injectable, Logger } from '@nestjs/common';
import { Cron } from '@nestjs/schedule';
import { GoogleGenerativeAI } from '@google/generative-ai';
import { PrismaService } from '../prisma/prisma.service';
import { noteGeminiError, noteGeminiOk } from '../ai/ai-health';
import type { Prisma } from '@prisma/client';

const HOUR = 3_600_000;
const KST = 9 * HOUR;
type Metrics = { revenue: number; payments: number; requests: number; connected: number; visits: number; signups: number; inquiries: number; unresponded: number };
export interface DailyBriefing {
  date: string; generatedAt: string; expiresAt: string; source: 'ai' | 'rule';
  summary: string; insights: string[]; today: Metrics; previous: Metrics;
  pendingInquiries: number; pendingPros: number;
}

export function briefingWindow(now: Date) {
  const local = new Date(now.getTime() + KST);
  const date = local.toISOString().slice(0, 10);
  const slotHour = Math.floor(local.getUTCHours() / 2) * 2;
  const start = new Date(`${date}T00:00:00+09:00`);
  const expiresAt = new Date(start.getTime() + (slotHour + 2) * HOUR);
  return { date, slotKey: `${date}:${String(slotHour).padStart(2, '0')}`, start, expiresAt };
}

@Injectable()
export class AdminDailyBriefingService {
  private readonly logger = new Logger(AdminDailyBriefingService.name);
  private readonly client: GoogleGenerativeAI | null;
  private readonly inflight = new Map<string, Promise<DailyBriefing>>();
  constructor(private prisma: PrismaService) {
    const key = process.env.GEMINI_API_KEY || process.env.GEMINI_AI_KEY || process.env.GOOGLE_API_KEY || '';
    this.client = key ? new GoogleGenerativeAI(key) : null;
  }

  @Cron('0 0 */2 * * *', { timeZone: 'Asia/Seoul' })
  async refreshScheduled() {
    await this.get().catch((error) => this.logger.warn(`Daily briefing refresh failed: ${error?.message}`));
  }

  get(now = new Date()): Promise<DailyBriefing> {
    const window = briefingWindow(now);
    const running = this.inflight.get(window.slotKey);
    if (running) return running;
    const job = this.load(now, window).finally(() => this.inflight.delete(window.slotKey));
    this.inflight.set(window.slotKey, job);
    return job;
  }

  private async load(now: Date, window: ReturnType<typeof briefingWindow>): Promise<DailyBriefing> {
    const saved = await this.prisma.adminDailyBriefing.findUnique({ where: { slotKey: window.slotKey } });
    if (saved && saved.expiresAt > now) return saved.payload as unknown as DailyBriefing;
    const yesterday = new Date(window.start.getTime() - 24 * HOUR);
    const previousCutoff = new Date(now.getTime() - 24 * HOUR);
    const rows = await this.prisma.$queryRaw<Array<{ bucket: string; revenue: bigint; payments: number; requests: number; connected: number; visits: number; signups: number; inquiries: number; unresponded: number }>>`
      WITH ranges AS (
        SELECT 'today' AS bucket, ${window.start}::timestamp AS a, ${now}::timestamp AS b
        UNION ALL SELECT 'previous', ${yesterday}::timestamp, ${previousCutoff}::timestamp
      )
      SELECT w.bucket,
        (SELECT COALESCE(sum(p.amount), 0)::bigint FROM payments p WHERE p."createdAt" >= w.a AND p."createdAt" <= w.b AND p.status = 'completed' AND p.method IS DISTINCT FROM 'admin_review') AS revenue,
        (SELECT count(*)::int FROM payments p WHERE p."createdAt" >= w.a AND p."createdAt" <= w.b AND p.status = 'completed' AND p.method IS DISTINCT FROM 'admin_review') AS payments,
        (SELECT count(*)::int FROM match_requests r WHERE r."createdAt" >= w.a AND r."createdAt" <= w.b AND COALESCE(r."rawUserInput"->>'suppressedAsTestLead', 'false') <> 'true') AS requests,
        (SELECT count(*)::int FROM match_requests r WHERE r."createdAt" >= w.a AND r."createdAt" <= w.b AND COALESCE(r."rawUserInput"->>'suppressedAsTestLead', 'false') <> 'true' AND (EXISTS (SELECT 1 FROM chat_rooms c WHERE c."matchRequestId" = r.id) OR EXISTS (SELECT 1 FROM match_deliveries d WHERE d."matchRequestId" = r.id AND d.status = 'replied'))) AS connected,
        (SELECT count(DISTINCT v."sessionKey")::int FROM page_views v WHERE v."createdAt" >= w.a AND v."createdAt" <= w.b) AS visits,
        (SELECT count(*)::int FROM users u WHERE u."createdAt" >= w.a AND u."createdAt" <= w.b) AS signups,
        (SELECT count(*)::int FROM business_inquiries i WHERE i."createdAt" >= w.a AND i."createdAt" <= w.b) AS inquiries,
        (SELECT count(*)::int FROM match_requests r WHERE r."createdAt" >= w.a AND r."createdAt" <= w.b AND r.status = 'open' AND COALESCE(r."rawUserInput"->>'suppressedAsTestLead', 'false') <> 'true' AND NOT EXISTS (SELECT 1 FROM match_deliveries d WHERE d."matchRequestId" = r.id AND d.status = 'replied')) AS unresponded
      FROM ranges w`;
    if (!rows.some((row) => row.bucket === 'today')) throw new Error('Daily metrics unavailable');
    const metrics = (bucket: string): Metrics => {
      const row = rows.find((item) => item.bucket === bucket);
      return Object.fromEntries(['revenue', 'payments', 'requests', 'connected', 'visits', 'signups', 'inquiries', 'unresponded'].map((key) => [key, Number(row?.[key as keyof typeof row] || 0)])) as Metrics;
    };
    const [pendingInquiries, pendingPros] = await Promise.all([
      this.prisma.businessInquiry.count({ where: { status: 'new' } }),
      this.prisma.proProfile.count({ where: { status: 'pending' } }),
    ]);
    const today = metrics('today');
    const previous = metrics('previous');
    const fallback = {
      summary: `오늘 완료 매출은 ${today.revenue.toLocaleString('ko-KR')}원, 결제는 ${today.payments}건이에요. 견적 의뢰 ${today.requests}건 중 ${today.connected}건에서 사회자 연결이 확인됐어요.`,
      insights: [
        previous.revenue > 0 ? `어제 같은 시각보다 완료 매출이 ${Math.abs(today.revenue - previous.revenue).toLocaleString('ko-KR')}원 ${today.revenue >= previous.revenue ? '많아요' : '적어요'}.` : '어제 같은 시각의 매출이 없어 증감률은 계산하지 않았어요.',
        today.unresponded ? `오늘 접수한 의뢰 중 응답 대기 ${today.unresponded}건을 확인해주세요.` : '오늘 접수한 의뢰에 사회자 응답 대기 건이 없어요.',
        `미처리 비즈 문의 ${pendingInquiries}건, 승인 대기 사회자 ${pendingPros}명이 있어요.`,
      ],
    };
    const ai = await this.analyze({ today, previous, pendingInquiries, pendingPros });
    const report: DailyBriefing = {
      date: window.date, generatedAt: now.toISOString(), expiresAt: window.expiresAt.toISOString(),
      source: ai ? 'ai' : 'rule', ...(ai || fallback), today, previous, pendingInquiries, pendingPros,
    };
    await this.prisma.adminDailyBriefing.upsert({
      where: { slotKey: window.slotKey },
      create: { slotKey: window.slotKey, payload: report as unknown as Prisma.InputJsonValue, generatedAt: now, expiresAt: window.expiresAt },
      update: { payload: report as unknown as Prisma.InputJsonValue, generatedAt: now, expiresAt: window.expiresAt },
    });
    await this.prisma.adminDailyBriefing.deleteMany({ where: { expiresAt: { lt: new Date(now.getTime() - 7 * 24 * HOUR) } } }).catch(() => {});
    return report;
  }

  private async analyze(facts: { today: Metrics; previous: Metrics; pendingInquiries: number; pendingPros: number }) {
    if (!this.client) return null;
    try {
      const model = this.client.getGenerativeModel({ model: process.env.GEMINI_MODEL || 'gemini-flash-lite-latest', generationConfig: { temperature: 0.2, maxOutputTokens: 700, responseMimeType: 'application/json' } });
      // Only aggregate counters leave the server; no member names, messages, or contact details.
      const result = await model.generateContent([
        '프리티풀 운영 대시보드의 오늘 현황을 한국어 해요체로 분석하세요.',
        'today는 한국시간 오늘 자정부터 집계시각까지, previous는 어제 같은 시간까지의 수치입니다.',
        'revenue/payments는 실제 완료 결제(관리자 리뷰용 결제 제외). connected는 오늘 의뢰 중 사회자 응답 또는 채팅방 생성이 있는 건수이며 예약확정을 뜻하지 않습니다.',
        'visits는 페이지 조회가 기록된 방문 세션이며 사람 수/회원 수가 아닙니다. pending은 현재 전체 대기 건수입니다.',
        '주어진 수치만 근거로 쓰세요. 매출 변화 원인, 미래 매출, 전환율, 광고 성과를 추측하지 마세요. 0인 기준값으로 증감률을 계산하지 마세요.',
        '숫자/금액은 UI에 별도 표시하므로 문장에는 숫자를 쓰지 마세요. 간결한 현황 2문장 summary(180자 이내), 유의미한 변화나 확인할 업무 insights 3개(각 100자 이내)를 JSON으로 반환하세요. 이모지/HTML/링크/과장 없이.',
        JSON.stringify(facts),
      ].join('\n'), { timeout: 8_000 });
      const value = JSON.parse(result.response.text());
      const text = (v: unknown, max: number) => typeof v === 'string' && v.trim().length >= 8 && v.length <= max && !/[<>\d]|https?:/i.test(v);
      if (!text(value.summary, 220) || !Array.isArray(value.insights) || value.insights.length !== 3 || !value.insights.every((item: unknown) => text(item, 140))) return null;
      noteGeminiOk('admin-daily-briefing');
      return { summary: value.summary.trim() as string, insights: value.insights.map((item: string) => item.trim()) as string[] };
    } catch (error) {
      noteGeminiError('admin-daily-briefing', error);
      this.logger.warn('Daily AI analysis unavailable; using verified metric summary');
      return null;
    }
  }
}
