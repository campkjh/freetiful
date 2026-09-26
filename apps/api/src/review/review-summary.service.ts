import { Injectable, Logger } from '@nestjs/common';
import { GoogleGenerativeAI } from '@google/generative-ai';
import { PrismaService } from '../prisma/prisma.service';

/**
 * 사회자 리뷰 요약 — '이 사회자의 스타일을 소개합니다'(260926 사장, 목록 리뷰 시트 맨 위 카드).
 *  · 실제 리뷰 본문만 Gemini 에 넘겨 '~해요' 두 문장 + 특징 3개. 리뷰에 없는 사실(경력·가격·수상 등)은 못 쓰게 막는다.
 *  · 사회자마다 (리뷰 수 + 가장 최근 리뷰 시각) 서명으로 하루 기억 — 리뷰가 새로 달리면 다시 만든다. 같은 사회자 동시 요청은 한 번만.
 *  · AI 가 없거나 실패하면 리뷰에 실제로 나온 표현만 모아 한 문장(source 'rule'), 그것도 없으면 null(카드 안 띄움).
 */
export type ReviewSummary = { summary: string; keywords: string[]; source: 'ai' | 'rule'; reviewCount: number };

const TTL = 24 * 60 * 60 * 1000;

// 규칙 요약 — 리뷰 본문에 실제로 나온 말만(없으면 안 만든다)
const KEYWORD_RULES: { label: string; pattern: RegExp }[] = [
  { label: '편안한 진행', pattern: /편안|편하게|차분|안정/ },
  { label: '매끄러운 진행', pattern: /매끄|깔끔|능숙|자연스럽/ },
  { label: '센스 있는 멘트', pattern: /센스|위트|유쾌|재미|웃음|웃겨|웃었/ },
  { label: '좋은 목소리', pattern: /목소리|발성|딕션|전달력/ },
  { label: '꼼꼼한 준비', pattern: /준비|대본|꼼꼼|미팅|리허설/ },
  { label: '친절한 소통', pattern: /친절|소통|응답|답장|상담/ },
  { label: '하객 반응', pattern: /하객|부모님|어른/ },
];

@Injectable()
export class ReviewSummaryService {
  private readonly logger = new Logger(ReviewSummaryService.name);
  private readonly client: GoogleGenerativeAI | null;
  private readonly cache = new Map<string, { at: number; sig: string; value: ReviewSummary | null }>();
  private readonly inflight = new Map<string, Promise<ReviewSummary | null>>();

  constructor(private readonly prisma: PrismaService) {
    const key = process.env.GEMINI_API_KEY || process.env.GEMINI_AI_KEY || process.env.GOOGLE_API_KEY || '';
    this.client = key ? new GoogleGenerativeAI(key) : null;
  }

  async summarize(proProfileId: string): Promise<ReviewSummary | null> {
    const profile = await this.prisma.proProfile.findFirst({
      where: { OR: [{ id: proProfileId }, { userId: proProfileId }] },
      select: { id: true },
    });
    const ids = Array.from(new Set([proProfileId, profile?.id].filter(Boolean) as string[]));
    const rows = await this.prisma.review.findMany({
      where: { proProfileId: ids.length > 1 ? { in: ids } : ids[0], isVisible: true },
      select: { comment: true, createdAt: true },
      orderBy: { createdAt: 'desc' },
      take: 60,
    });
    const texts = rows
      .map((r) => String(r.comment || '').replace(/\s+/g, ' ').trim())
      .filter((t) => t.length >= 6);
    if (texts.length < 2) return null;

    const key = profile?.id || proProfileId;
    const sig = `${texts.length}:${rows[0]?.createdAt?.toISOString() || ''}`;
    const hit = this.cache.get(key);
    if (hit && hit.sig === sig && Date.now() - hit.at < TTL) return hit.value;

    const running = this.inflight.get(key);
    if (running) return running;
    const job = (async () => {
      const ai = await this.withAi(texts).catch((error) => {
        this.logger.warn(`review summary AI failed: ${String((error as any)?.message || error).slice(0, 120)}`);
        return null;
      });
      const value: ReviewSummary | null = ai
        ? { ...ai, source: 'ai', reviewCount: texts.length }
        : this.withRules(texts);
      // AI 가 잠깐 실패한 규칙 결과는 10분만 기억(곧 다시 AI 로)
      this.cache.set(key, { at: ai ? Date.now() : Date.now() - TTL + 10 * 60 * 1000, sig, value });
      return value;
    })().finally(() => this.inflight.delete(key));
    this.inflight.set(key, job);
    return job;
  }

  private withRules(texts: string[]): ReviewSummary | null {
    const source = texts.join(' ');
    const keywords = KEYWORD_RULES.filter((rule) => rule.pattern.test(source)).map((rule) => rule.label).slice(0, 3);
    if (keywords.length === 0) return null;
    const summary = keywords.length === 1
      ? `고객 리뷰에서 ${keywords[0]} 이야기가 많아요.`
      : `고객 리뷰에서 ${keywords.slice(0, -1).join(', ')}과 ${keywords[keywords.length - 1]} 이야기가 많아요.`;
    return { summary, keywords, source: 'rule', reviewCount: texts.length };
  }

  private async withAi(texts: string[]): Promise<{ summary: string; keywords: string[] } | null> {
    if (!this.client) return null;
    const list = texts.slice(0, 40).map((t) => `- ${t.slice(0, 220)}`).join('\n');
    const prompt = [
      "너는 결혼식·행사 사회자 섭외 앱 '프리티풀'에서, 고객들이 실제로 남긴 리뷰를 읽고 이 사회자의 진행 스타일을 소개한다.",
      '규칙:',
      "- summary: 정확히 2문장, 합쳐서 110자 이내, '~해요' 체. 여러 리뷰에 반복해서 나온 특징을 중심으로 어떤 스타일의 사회자인지.",
      '- 리뷰에 없는 사실(경력 연수·가격·수상·학력·방송 출연·인원 수 등)은 절대 쓰지 마라. 추측·과장 금지(최고·완벽·무조건 같은 말 쓰지 마라).',
      '- 사회자 이름·고객 이름·특정 날짜·장소는 쓰지 마라. 이모지 쓰지 마라.',
      '- keywords: 리뷰에서 나온 특징 3개, 각 2~7자 명사구(예: 편안한 진행, 센스 있는 멘트, 꼼꼼한 준비).',
      '출력: JSON 객체만. 예) {"summary":"하객까지 편안하게 만드는 차분한 진행이 돋보여요. 순간순간 센스 있는 멘트로 분위기를 부드럽게 이끌어요.","keywords":["편안한 진행","센스 있는 멘트","꼼꼼한 준비"]}',
      '',
      `리뷰 ${texts.length}개(최근순):`,
      list,
    ].join('\n');

    const models = [process.env.GEMINI_MODEL, 'gemini-flash-lite-latest', 'gemini-2.5-flash', 'gemini-flash-latest'].filter(
      (m, i, arr): m is string => !!m && arr.indexOf(m) === i,
    );
    const deadline = Date.now() + 8000;
    for (const name of models) {
      const left = deadline - Date.now();
      if (left < 400) break;
      try {
        const generationConfig: any = { temperature: 0.4, maxOutputTokens: 300 };
        if (name === 'gemini-2.5-flash') generationConfig.thinkingConfig = { thinkingBudget: 0 };
        const model = this.client.getGenerativeModel({ model: name, generationConfig });
        const result: any = await Promise.race([
          model.generateContent(prompt),
          new Promise((_, reject) => setTimeout(() => reject(new Error('timeout')), left)),
        ]);
        const parsed = this.parse(String(result?.response?.text?.() || ''));
        if (parsed) return parsed;
      } catch (error: any) {
        this.logger.warn(`review summary model ${name} failed: ${String(error?.message || error).slice(0, 100)}`);
      }
    }
    return null;
  }

  private parse(text: string): { summary: string; keywords: string[] } | null {
    const m = text.match(/\{[\s\S]*\}/);
    if (!m) return null;
    try {
      const obj = JSON.parse(m[0]);
      const summary = String(obj?.summary || '').replace(/\s+/g, ' ').trim();
      if (summary.length < 10 || summary.length > 200) return null;
      // 지어내기 쉬운 숫자 사실(연차·가격·명수)이 섞이면 버린다
      if (/\d+\s*(년|원|만원|명|회|번째)/.test(summary)) return null;
      const keywords = (Array.isArray(obj?.keywords) ? obj.keywords : [])
        .map((k: unknown) => String(k || '').trim())
        .filter((k: string) => k.length >= 2 && k.length <= 12)
        .slice(0, 3);
      return { summary, keywords };
    } catch {
      return null;
    }
  }
}
