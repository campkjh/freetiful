import { ForbiddenException, Injectable, NotFoundException } from '@nestjs/common';
import { PrismaService } from '../prisma/prisma.service';

/**
 * 사회자 자동응답.
 *
 * 고객이 문의를 열면 사회자가 미리 적어 둔 인사말이 먼저 나가고, 자주 묻는 질문은
 * 고객이 눌러서 바로 답을 받는다. 사회자가 아무것도 안 적었어도 인사말은 기본 문구로 나간다
 * (첫 문의에 몇 시간씩 답이 없는 게 이탈의 가장 큰 이유였다).
 */

/** 사회자가 인사말을 안 적었을 때 나가는 기본 문구 */
export function defaultGreeting(proName?: string | null) {
  const name = (proName || '').trim();
  return [
    `안녕하세요. 프리티풀 ${name || ''} 사회자입니다.`.replace('  ', ' '),
    '',
    '저희 프리티풀을 통해 여러분의 특별하고 소중한 날에 함께할 수 있게 되어 진심으로 기쁘게 생각합니다.',
    '',
    '한 번뿐인 소중한 순간이 오래도록 좋은 기억으로 남을 수 있도록, 행사 하나하나의 분위기와 흐름을 세심하게 살피며 정성을 다해 진행하겠습니다.',
  ].join('\n');
}

/**
 * 추천 질문 — 실제 고객 문의 689건을 훑어 많이 나온 순서대로 뽑았다.
 * (견적 165 · 추가금/옵션 105 · 진행 방식 100 · 일정 83 · 포트폴리오 52 · 대본 33)
 */
export const SUGGESTED_QUESTIONS = [
  '견적이 어떻게 되나요?',
  '그 날짜에 진행 가능하신가요?',
  '출장비나 추가 비용이 있나요?',
  '진행 영상이나 포트폴리오를 볼 수 있을까요?',
  '대본이나 멘트는 어떻게 준비되나요?',
  '사전 미팅은 어떻게 진행되나요?',
  '1부만 진행하면 금액이 달라지나요?',
  '예약은 어떻게 확정되나요?',
];

/**
 * 고객이 실제로 쓰는 말 → 어떤 답을 보낼지.
 * 문의 689건을 훑어 많이 나온 순서로 정리했고, 사회자가 키워드를 따로 적으면 그게 우선한다.
 */
export const INTENTS: { key: string; label: string; pattern: RegExp }[] = [
  { key: 'quote', label: '견적·비용', pattern: /견적|비용|가격|금액|얼마|페이|사례비|출장비|추가금|얼마나\s*하|단가/ },
  { key: 'schedule', label: '일정 가능 여부', pattern: /일정|가능하|가능할|가능한가|스케줄|날짜|비어|예약\s*(가능|되)/ },
  { key: 'portfolio', label: '진행 영상·포트폴리오', pattern: /영상|포트폴리오|인스타|유튜브|sns|후기|리뷰|볼\s*수\s*있/i },
  { key: 'script', label: '대본·멘트 준비', pattern: /대본|멘트|식순|리허설|사전\s*미팅|미팅|준비\s*해|준비되/ },
  { key: 'process', label: '진행 방식', pattern: /진행\s*(방식|스타일|은|이|어떻)|어떻게\s*진행|스타일/ },
];

/** 고객 이름을 넣을 자리 — 사회자가 {고객명} 이라고 쓰면 치환한다 */
function fillName(text: string, customerName?: string | null) {
  const name = (customerName || '').trim();
  return text.replace(/\{고객명\}/g, name || '고객');
}

type Item = { id?: string; question: string; answer: string };

@Injectable()
export class AutoReplyService {
  constructor(private prisma: PrismaService) {}

  private async proProfileIdOf(userId: string) {
    const pro = await this.prisma.proProfile.findFirst({
      where: { userId },
      select: { id: true },
    });
    if (!pro) throw new ForbiddenException('사회자 프로필이 없습니다');
    return pro.id;
  }

  /** 사회자 본인 설정 — 인사말 + 질문/답변 (꺼둔 것도 함께) */
  async getMine(userId: string) {
    const proProfileId = await this.proProfileIdOf(userId);
    const [rows, faqs, user] = await Promise.all([
      this.prisma.proAutoReply.findMany({
        where: { proProfileId },
        orderBy: [{ kind: 'asc' }, { displayOrder: 'asc' }],
      }),
      this.prisma.proFaq.findMany({
        where: { proProfileId },
        orderBy: { displayOrder: 'asc' },
        select: { question: true, answer: true },
      }),
      this.prisma.user.findUnique({ where: { id: userId }, select: { name: true } }),
    ]);

    const greetingRow = rows.find((row) => row.kind === 'greeting');
    const quoteRow = rows.find((row) => row.kind === 'quote');
    const items = rows.filter((row) => row.kind === 'qa');

    return {
      greeting: greetingRow?.answer ?? '',
      greetingEnabled: greetingRow ? greetingRow.isEnabled : true,
      defaultGreeting: defaultGreeting(user?.name),
      quoteReply: quoteRow?.answer ?? '',
      quoteAmount: quoteRow?.amount ?? null,
      quoteEnabled: quoteRow ? quoteRow.isEnabled : true,
      items: items.map((row) => ({
        id: row.id,
        question: row.question ?? '',
        answer: row.answer,
        keywords: row.keywords ?? '',
        isEnabled: row.isEnabled,
      })),
      // 아직 자동응답을 안 만든 사회자에게는 이미 써 둔 프로필 FAQ 를 그대로 제안한다
      faqSuggestions: items.length === 0 ? faqs : [],
      suggestedQuestions: SUGGESTED_QUESTIONS,
    };
  }

  /** 사회자 본인 설정 저장 — 통째로 교체 */
  async saveMine(
    userId: string,
    body: { greeting?: string; greetingEnabled?: boolean; items?: Item[] },
  ) {
    const proProfileId = await this.proProfileIdOf(userId);
    const greeting = String(body.greeting ?? '').trim().slice(0, 2000);
    const greetingEnabled = body.greetingEnabled !== false;
    const items = (Array.isArray(body.items) ? body.items : [])
      .map((item: any) => ({
        question: String(item?.question ?? '').trim().slice(0, 120),
        answer: String(item?.answer ?? '').trim().slice(0, 2000),
        keywords: String(item?.keywords ?? '').trim().slice(0, 200) || null,
      }))
      .filter((item) => item.question && item.answer)
      .slice(0, 20);
    const quoteReply = String((body as any).quoteReply ?? '').trim().slice(0, 2000);
    const quoteAmountRaw = Number((body as any).quoteAmount);
    const quoteAmount = Number.isFinite(quoteAmountRaw) && quoteAmountRaw > 0 ? Math.round(quoteAmountRaw) : null;
    const quoteEnabled = (body as any).quoteEnabled !== false;

    await this.prisma.$transaction([
      this.prisma.proAutoReply.deleteMany({ where: { proProfileId } }),
      this.prisma.proAutoReply.createMany({
        data: [
          ...(greeting
            ? [{ proProfileId, kind: 'greeting', answer: greeting, isEnabled: greetingEnabled, displayOrder: 0 }]
            : []),
          ...items.map((item, index) => ({
            proProfileId,
            kind: 'qa',
            question: item.question,
            answer: item.answer,
            keywords: item.keywords,
            displayOrder: index,
            isEnabled: true,
          })),
          ...(quoteReply
            ? [{
                proProfileId,
                kind: 'quote',
                question: '견적 문의',
                answer: quoteReply,
                amount: quoteAmount,
                isEnabled: quoteEnabled,
                displayOrder: 0,
              }]
            : []),
        ],
      }),
    ]);

    return this.getMine(userId);
  }

  /** 고객 화면용 — 켜져 있는 질문만. 없으면 사회자 프로필 FAQ 로 대체한다 */
  async getPublic(proProfileId: string) {
    const rows = await this.prisma.proAutoReply.findMany({
      where: { proProfileId, kind: 'qa', isEnabled: true },
      orderBy: { displayOrder: 'asc' },
      select: { id: true, question: true, answer: true },
    });
    if (rows.length > 0) {
      return { items: rows.map((row) => ({ id: row.id, question: row.question ?? '' })) };
    }
    const faqs = await this.prisma.proFaq.findMany({
      where: { proProfileId },
      orderBy: { displayOrder: 'asc' },
      take: 8,
      select: { id: true, question: true },
    });
    return { items: faqs.map((faq) => ({ id: `faq:${faq.id}`, question: faq.question })) };
  }

  /** 질문 하나의 답변 본문 — 자동응답 행이거나(id) 프로필 FAQ(faq:id) */
  async answerOf(proProfileId: string, itemId: string) {
    if (itemId.startsWith('faq:')) {
      const faq = await this.prisma.proFaq.findFirst({
        where: { id: itemId.slice(4), proProfileId },
        select: { question: true, answer: true },
      });
      if (!faq) throw new NotFoundException('질문을 찾을 수 없습니다');
      return faq;
    }
    const row = await this.prisma.proAutoReply.findFirst({
      where: { id: itemId, proProfileId, kind: 'qa', isEnabled: true },
      select: { question: true, answer: true },
    });
    if (!row) throw new NotFoundException('질문을 찾을 수 없습니다');
    return { question: row.question ?? '', answer: row.answer };
  }

  /**
   * 고객이 보낸 말에 맞는 자동응답 찾기.
   * ① 사회자가 적은 키워드 ② 질문 문장과 겹치는 말 ③ 기본 인텐트 순으로 본다.
   */
  async matchFor(proProfileId: string, text: string, customerName?: string | null) {
    const body = (text || '').trim();
    if (body.length < 2 || body.length > 300) return null;

    const rows = await this.prisma.proAutoReply.findMany({
      where: { proProfileId, isEnabled: true, kind: { in: ['qa', 'quote'] } },
      orderBy: { displayOrder: 'asc' },
    });
    if (rows.length === 0) return null;

    const pick = (row: (typeof rows)[number], why: string) => ({
      id: row.id,
      kind: row.kind,
      why,
      answer: fillName(row.answer, customerName),
      amount: row.amount ?? null,
    });

    // ① 사회자가 직접 적은 키워드
    for (const row of rows) {
      const words = (row.keywords || '')
        .split(/[,\n]/)
        .map((word) => word.trim())
        .filter((word) => word.length >= 2);
      if (words.some((word) => body.includes(word))) return pick(row, 'keyword');
    }

    // ② 질문 문장에서 두 글자 이상 겹치는 말
    for (const row of rows) {
      const tokens = (row.question || '')
        .replace(/[?!.,]/g, ' ')
        .split(/\s+/)
        .map((token) => token.replace(/(이|가|은|는|을|를|에|의|도|으로|로|요)$/, ''))
        .filter((token) => token.length >= 2);
      if (tokens.length > 0 && tokens.some((token) => body.includes(token))) return pick(row, 'question');
    }

    // ③ 기본 인텐트 — '견적' 은 견적 자동응답, 나머지는 같은 뜻의 질문이 있으면 그 답
    for (const intent of INTENTS) {
      if (!intent.pattern.test(body)) continue;
      if (intent.key === 'quote') {
        const quoteRow = rows.find((row) => row.kind === 'quote');
        if (quoteRow) return pick(quoteRow, 'intent:quote');
      }
      const hit = rows.find((row) => row.kind === 'qa' && intent.pattern.test(row.question || ''));
      if (hit) return pick(hit, `intent:${intent.key}`);
    }
    return null;
  }

  /** 방이 열릴 때 내보낼 인사말 — 꺼져 있으면 null */
  async greetingFor(proProfileId: string, proName?: string | null) {
    const row = await this.prisma.proAutoReply.findFirst({
      where: { proProfileId, kind: 'greeting' },
      select: { answer: true, isEnabled: true },
    });
    if (row && !row.isEnabled) return null;
    const text = row?.answer?.trim();
    return text || defaultGreeting(proName);
  }
}
