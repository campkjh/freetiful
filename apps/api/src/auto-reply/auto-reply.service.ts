import { ForbiddenException, Injectable, Logger, NotFoundException } from '@nestjs/common';
import { PrismaService } from '../prisma/prisma.service';
import { AutoReplyAiService } from './auto-reply-ai.service';
import {
  AI_BLOCKING_RISKS,
  CALL_LABELS,
  DEFAULT_PERSONA,
  LENGTH_MAX_CHARS,
  Persona,
  PersonaGuard,
  RiskFlag,
  SIGNATURE_PRESETS,
  isTrivialMessage,
  screenRisks,
  stableKeyOf,
  validateOutgoing,
  validateAdapted,
  validatePersonaInput,
} from './auto-reply-ai';

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

type AutoReplyRow = {
  id: string;
  kind: string;
  question: string | null;
  answer: string;
  keywords: string | null;
  amount: number | null;
  displayOrder: number;
};

export interface DecidedReply {
  /** 안정 키 — 'quote' | 'qa:<8hex>'. row.id(uuid)를 쓰면 저장할 때마다 바뀐다 */
  key: string;
  kind: string;
  why: string;
  answer: string;
  amount: number | null;
  risks: RiskFlag[];
  /** true 면 발송하지 않고 사회자에게 알린다 */
  needsHuman: boolean;
  unknownParts: string[];
}

@Injectable()
export class AutoReplyService {
  private readonly logger = new Logger(AutoReplyService.name);
  constructor(private prisma: PrismaService, private ai: AutoReplyAiService) {}

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
    const autoApproveRow = rows.find((row) => row.kind === 'autoapprove');
    const items = rows.filter((row) => row.kind === 'qa');

    return {
      greeting: greetingRow?.answer ?? '',
      greetingEnabled: greetingRow ? greetingRow.isEnabled : true,
      defaultGreeting: defaultGreeting(user?.name),
      autoApprove: Boolean(autoApproveRow?.isEnabled),
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
    const autoApprove = (body as any).autoApprove === true;

    // ★ kind 를 좁혀 지운다. 예전엔 proProfileId 로만 지워서 persona/ai/autoapprove 가
    // '저장' 한 번에 통째로 날아갔다. 안드로이드는 캐시된 웹뷰라 persona 를 모르는
    // 구버전 번들이 PUT 하기만 해도 자아가 사라진다.
    await this.prisma.$transaction([
      this.prisma.proAutoReply.deleteMany({
        where: { proProfileId, kind: { in: ['greeting', 'qa', 'quote'] } },
      }),
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

    // autoapprove 는 body 에 키가 있을 때만 반영한다(없으면 기존 설정 유지)
    if ('autoApprove' in (body as any)) {
      await this.prisma.proAutoReply.deleteMany({ where: { proProfileId, kind: 'autoapprove' } });
      if (autoApprove) {
        await this.prisma.proAutoReply.create({
          data: { proProfileId, kind: 'autoapprove', answer: 'on', isEnabled: true, displayOrder: 0 },
        });
      }
    }

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

  /** 자동응답 후보 행 — 켜져 있는 견적/QA */
  private async candidateRows(proProfileId: string) {
    return this.prisma.proAutoReply.findMany({
      where: { proProfileId, isEnabled: true, kind: { in: ['qa', 'quote'] } },
      orderBy: { displayOrder: 'asc' },
    });
  }

  /**
   * ① 사회자가 직접 적은 키워드 — 확률 모델이 절대 뒤집으면 안 되는 명시적 지시다.
   * (뒤집히면 사회자가 설정 화면을 신뢰하지 않게 되고 기능 전체가 죽는다)
   */
  private matchByKeyword(rows: AutoReplyRow[], body: string) {
    for (const row of rows) {
      const words = (row.keywords || '')
        .split(/[,\n]/)
        .map((word) => word.trim())
        .filter((word) => word.length >= 2);
      if (words.some((word) => body.includes(word))) return row;
    }
    return null;
  }

  /** ② 질문 토큰 겹침 ③ 기본 인텐트 — AI 가 없거나 실패했을 때의 기존 동작 */
  private matchByHeuristic(rows: AutoReplyRow[], body: string) {
    for (const row of rows) {
      const tokens = (row.question || '')
        .replace(/[?!.,]/g, ' ')
        .split(/\s+/)
        .map((token) => token.replace(/(이|가|은|는|을|를|에|의|도|으로|로|요)$/, ''))
        .filter((token) => token.length >= 2);
      if (tokens.length > 0 && tokens.some((token) => body.includes(token))) {
        return { row, why: 'question' };
      }
    }
    for (const intent of INTENTS) {
      if (!intent.pattern.test(body)) continue;
      if (intent.key === 'quote') {
        const quoteRow = rows.find((row) => row.kind === 'quote');
        if (quoteRow) return { row: quoteRow, why: 'intent:quote' };
      }
      const hit = rows.find((row) => row.kind === 'qa' && intent.pattern.test(row.question || ''));
      if (hit) return { row: hit, why: `intent:${intent.key}` };
    }
    return null;
  }

  /**
   * 고객이 보낸 말에 맞는 자동응답 찾기(규칙 전용).
   * AI 를 쓰지 않는 경로이며 decideReply 의 폴백이기도 하다.
   */
  async matchFor(proProfileId: string, text: string, customerName?: string | null) {
    const body = (text || '').trim();
    if (body.length < 2 || body.length > 300) return null;
    const rows = await this.candidateRows(proProfileId);
    if (rows.length === 0) return null;

    const pick = (row: AutoReplyRow, why: string) => ({
      id: row.id,
      key: stableKeyOf(row),
      kind: row.kind,
      why,
      answer: fillName(row.answer, customerName),
      amount: row.amount ?? null,
    });

    const kw = this.matchByKeyword(rows, body);
    if (kw) return pick(kw, 'keyword');
    const h = this.matchByHeuristic(rows, body);
    if (h) return pick(h.row, h.why);
    return null;
  }

  /**
   * 자동응답 결정 — 규칙과 AI 를 합친 단일 진입점.
   *
   * 순서가 곧 안전장치다.
   *   0. 단답·이모지면 아무것도 안 한다(토큰 0)
   *   1. 위험 스크리너(코드 정규식) — 금액 제시·일정·계약·정체질문이면 AI 경로를 끈다
   *   2. 사회자가 지정한 키워드 — 히트하면 AI 를 아예 호출하지 않는다
   *   3. AI 라우터 — 사회자가 써 둔 답 중 '같은 뜻' 을 고른다(글을 쓰지 않는다)
   *   4. 실패하면 기존 휴리스틱 — GEMINI 키가 없으면 오늘 동작과 동일
   *   5. 발송 직전 최종 검사(verbatim 에도 적용)
   */
  async decideReply(ctx: {
    proProfileId: string;
    proName?: string | null;
    roomId: string;
    customerName?: string | null;
    text: string;
    history?: string;
    alreadySentKeys?: string[];
    alreadySentSummary?: string;
    eventInfo?: string;
    eventCategoryName?: string | null;
  }): Promise<DecidedReply | null> {
    const body = (ctx.text || '').trim();
    if (!body || isTrivialMessage(body)) return null;

    const rows = await this.candidateRows(ctx.proProfileId);
    // 근거가 0건이면 AI 도 규칙도 할 게 없다. 근거 없는 생성은 곧 환각이다.
    if (rows.length === 0) return null;

    const persona = await this.getPersona(ctx.proProfileId);
    const risks = screenRisks(body);
    const used = new Set(ctx.alreadySentKeys || []);

    const finish = (row: AutoReplyRow, why: string, opts: {
      text?: string;
      needsHuman?: boolean;
      unknownParts?: string[];
    } = {}): DecidedReply | null => {
      const key = stableKeyOf(row);
      if (used.has(key)) return null;
      const answer = opts.text ?? fillName(row.answer, ctx.customerName);
      const bad = validateOutgoing(answer, { risks, guards: persona.guards });
      if (bad) {
        this.logger.warn(`자동응답 차단(${bad}) room=${ctx.roomId} key=${key}`);
        return null;
      }
      return {
        key,
        kind: row.kind,
        why,
        answer,
        amount: row.amount ?? null,
        risks,
        needsHuman: opts.needsHuman === true,
        unknownParts: opts.unknownParts || [],
      };
    };

    // ── 2. 사회자가 지정한 키워드가 최우선 (AI 호출 0) ──
    const kw = this.matchByKeyword(rows, body);
    if (kw) return finish(kw, 'keyword');

    // ── 1+3. 위험이 없고 사회자가 켜 뒀을 때만 AI ──
    const aiBlocked = risks.some((r) => AI_BLOCKING_RISKS.includes(r));
    const canUseAi =
      persona.aiEnabled && this.ai.isEnabled() && !aiBlocked && body.length <= 1200;

    if (canUseAi) {
      const candidateKeys = new Set(rows.map((r) => stableKeyOf(r)));
      const routed = await this.ai.route({
        roomId: ctx.roomId,
        proProfileId: ctx.proProfileId,
        maxChars: LENGTH_MAX_CHARS[persona.length],
        proName: ctx.proName || '',
        callName: this.callNameFor(persona, ctx.customerName, ctx.eventCategoryName),
        adaptAllowed: persona.aiAdaptEnabled,
        personaLine: this.ai.personaLine(persona),
        styleSamples: await this.styleSamples(ctx.proProfileId),
        candidates: this.renderCandidates(rows),
        eventInfo: ctx.eventInfo || '',
        history: ctx.history || '',
        alreadySent: ctx.alreadySentSummary || '',
        customerMessage: body,
      });

      if (routed) {
        // P1 사람이 봐야 하는 건 절대 보내지 않는다
        if (routed.needsHuman || routed.action !== 'match') {
          return routed.needsHuman
            ? { key: `human:${routed.intent}`, kind: 'none', why: 'needsHuman', answer: '',
                amount: null, risks, needsHuman: true, unknownParts: routed.unknownParts }
            : null;
        }
        // P2 후보 집합에 없는 키 = 환각이거나 인젝션 성공. candidateKeys 는 DB 에서 만든다.
        const row = routed.matchedKey && candidateKeys.has(routed.matchedKey)
          ? rows.find((r) => stableKeyOf(r) === routed.matchedKey) || null
          : null;
        if (!row) {
          this.logger.warn(`AI 가 없는 후보를 지목 key=${routed.matchedKey} room=${ctx.roomId}`);
          return null;
        }
        // P3 문턱 미달이면 보내지 않는다
        if (!this.ai.passesConfidence(routed.confidence)) return null;

        // P5 본문 확정 — 기본은 사회자 원문 그대로
        const baseText = fillName(row.answer, ctx.customerName);
        let text = baseText;
        if (routed.mode === 'adapted' && persona.aiAdaptEnabled && routed.renderedText) {
          const bad = validateAdapted(routed.renderedText, baseText);
          // 실패하면 폐기가 아니라 원문으로 강등한다. 사회자 원문은 언제나 안전하다.
          if (!bad) text = routed.renderedText;
          else this.logger.warn(`adapted 강등(${bad}) room=${ctx.roomId}`);
        }
        return finish(row, `ai:${routed.intent}`, { text, unknownParts: routed.unknownParts });
      }
    }

    // ── 4. 폴백 — 오늘과 동일한 동작 ──
    const h = this.matchByHeuristic(rows, body);
    if (h) return finish(h.row, h.why);
    return null;
  }

  /** 호칭 — 잘못 부르면 첫 문장에서 자동응답임이 드러난다 */
  private callNameFor(persona: Persona, customerName?: string | null, eventCategoryName?: string | null) {
    if (persona.call === 'couple') {
      // 기업행사 담당자에게 '신랑신부님' 은 사고다
      const wedding = /결혼|웨딩|예식/.test(eventCategoryName || '');
      return wedding ? '신랑신부님' : '고객님';
    }
    if (persona.call === 'name') {
      const n = (customerName || '').trim();
      // 카카오 닉네임·영문 ID 면 이름으로 부르면 안 된다
      return /^[가-힣]{2,4}$/.test(n) ? `${n}님` : '고객님';
    }
    return CALL_LABELS.customer;
  }

  /** 후보 목록 — 답변은 전문을 넣는다.
   *  앞부분만 주면 뒤에 숨은 조건절("단, 성수기는 50만원")이 라우터 눈에 안 보인 채로 나간다. */
  private renderCandidates(rows: AutoReplyRow[]) {
    return rows
      .slice(0, 9)
      .map((row, i) => {
        const kw = (row.keywords || '').trim();
        return [
          `[C${i + 1}] key=${stableKeyOf(row)}`,
          kw ? ` | 사회자 지정 키워드: ${kw}` : '',
          row.question ? ` | 질문: ${row.question}` : '',
          `\n 답변 원문: "${(row.answer || '').slice(0, 600)}"`,
        ].join('');
      })
      .join('\n');
  }

  /** 말투 표본 — 사회자가 설정 화면에 저장한 원문만 쓴다.
   *  다른 방에서 보낸 실제 메시지를 긁어오면 타 고객의 이름·예식장·협상 금액이
   *  새 고객 방 프롬프트로 흘러간다(개인정보 제3자 노출). 절대 하지 않는다. */
  private async styleSamples(proProfileId: string) {
    const rows = await this.prisma.proAutoReply.findMany({
      where: { proProfileId, kind: { in: ['greeting', 'quote', 'qa'] } },
      orderBy: { displayOrder: 'asc' },
      take: 3,
      select: { answer: true },
    });
    return rows.map((r) => `- ${(r.answer || '').slice(0, 200)}`).join('\n');
  }

  // ─── 자아(페르소나) ────────────────────────────────────────────────────────

  /** 저장은 ProAutoReply 의 kind 를 하나 더 쓴다 — 컬럼 추가/마이그레이션 없음 */
  async getPersona(proProfileId: string): Promise<Persona> {
    const rows = await this.prisma.proAutoReply.findMany({
      where: { proProfileId, kind: { in: ['persona', 'ai'] } },
    });
    const pRow = rows.find((r) => r.kind === 'persona');
    const aiRow = rows.find((r) => r.kind === 'ai');
    const meta = new Map(
      (pRow?.keywords || '')
        .split(',')
        .map((s) => s.trim())
        .filter(Boolean)
        .map((s) => {
          const i = s.indexOf(':');
          return [s.slice(0, i), s.slice(i + 1)] as [string, string];
        }),
    );
    const guards = (pRow?.keywords || '')
      .split(',')
      .map((s) => s.trim())
      .filter((s) => s.startsWith('guard:'))
      .map((s) => s.slice(6) as PersonaGuard);

    return {
      // ★ 행이 없으면 꺼짐. (row ? row.isEnabled : true) 로 쓰면 안 켠 사회자가 조용히 켜진다
      aiEnabled: Boolean(aiRow?.isEnabled),
      aiAdaptEnabled: (aiRow?.keywords || '').includes('adapt:on'),
      personaText: pRow?.answer && pRow.answer !== '-' ? pRow.answer : '',
      tone: (meta.get('tone') as Persona['tone']) || DEFAULT_PERSONA.tone,
      call: (meta.get('call') as Persona['call']) || DEFAULT_PERSONA.call,
      length: (meta.get('len') as Persona['length']) || DEFAULT_PERSONA.length,
      emoji: (meta.get('emoji') as Persona['emoji']) || DEFAULT_PERSONA.emoji,
      signatures: (pRow?.question || '').split('|').map((s) => s.trim()).filter(Boolean),
      banPhrases: meta.get('ban') || '',
      guards: pRow ? guards : DEFAULT_PERSONA.guards,
    };
  }

  async savePersona(userId: string, body: Partial<Persona>) {
    const proProfileId = await this.proProfileIdOf(userId);
    const cur = await this.getPersona(proProfileId);
    const next: Persona = { ...cur, ...body };

    // 사회자 자유입력은 프롬프트의 '지시 영역' 에 들어가므로 고객 인젝션보다 상위 벡터다
    for (const field of [next.personaText, next.banPhrases, ...next.signatures]) {
      const why = validatePersonaInput(field);
      if (why) throw new ForbiddenException(why);
    }

    const personaText = String(next.personaText || '').trim().slice(0, 600);
    const signatures = (next.signatures || [])
      .map((s) => String(s).trim())
      .filter((s) => s.length >= 2 && s.length <= 30)
      .slice(0, 3);
    const guards = (next.guards || []).filter((g) =>
      ['price', 'date', 'promise', 'other'].includes(g),
    );
    const keywords = [
      `tone:${next.tone}`,
      `call:${next.call}`,
      `len:${next.length}`,
      `emoji:${next.emoji}`,
      next.banPhrases ? `ban:${String(next.banPhrases).slice(0, 60)}` : '',
      ...guards.map((g) => `guard:${g}`),
    ]
      .filter(Boolean)
      .join(',')
      .slice(0, 200);

    await this.prisma.proAutoReply.deleteMany({
      where: { proProfileId, kind: { in: ['persona', 'ai'] } },
    });
    await this.prisma.proAutoReply.createMany({
      data: [
        {
          proProfileId,
          kind: 'persona',
          // answer 는 NOT NULL 이라 비어 있으면 자리표시자를 넣는다
          answer: personaText || '-',
          question: signatures.join(' | ').slice(0, 120) || null,
          keywords,
          isEnabled: true,
          displayOrder: 0,
        },
        {
          proProfileId,
          kind: 'ai',
          answer: 'on',
          keywords: next.aiAdaptEnabled ? 'adapt:on' : 'adapt:off',
          isEnabled: Boolean(next.aiEnabled),
          displayOrder: 0,
        },
      ],
    });
    return this.getPersona(proProfileId);
  }

  async getMyPersona(userId: string) {
    const proProfileId = await this.proProfileIdOf(userId);
    const persona = await this.getPersona(proProfileId);
    return {
      ...persona,
      aiAvailable: this.ai.isEnabled(),
      signaturePresets: SIGNATURE_PRESETS,
    };
  }

  /**
   * 자아 초안 — 빈 칸을 먼저 보여주지 않는다.
   * 사회자 대부분이 긴 글 쓰기를 싫어해서, 빈 textarea 하나만 주면 아무도 안 쓴다.
   * AI 가 안 되면 프로필로 조립한 문장이라도 반드시 채워 준다.
   */
  async draftPersonaForMe(userId: string) {
    const proProfileId = await this.proProfileIdOf(userId);
    const pro = await this.prisma.proProfile.findUnique({
      where: { id: proProfileId },
      select: {
        careerYears: true,
        shortIntro: true,
        mainExperience: true,
        tags: true,
        user: { select: { name: true } },
        categories: { select: { category: { select: { name: true } } } },
        regions: { select: { region: { select: { name: true } } } },
      },
    });
    const name = pro?.user?.name || '';
    const categories = (pro?.categories || []).map((c: any) => c.category?.name).filter(Boolean);
    const regions = (pro?.regions || []).map((r: any) => r.region?.name).filter(Boolean);
    const tags = pro?.tags || [];

    // 프로필이 텅 비어 있으면 쓰레기 초안을 만드는 것보다 채우라고 안내하는 게 낫다
    if (!pro?.shortIntro && !pro?.mainExperience && categories.length === 0) {
      return {
        personaText: '',
        needsProfile: true,
        message: '프로필을 먼저 채우면 훨씬 나은 자아가 만들어져요.',
      };
    }

    const drafted = await this.ai.draftPersona({
      name,
      careerYears: pro?.careerYears ?? null,
      categories,
      regions,
      tags,
      shortIntro: pro?.shortIntro,
      mainExperience: pro?.mainExperience,
    });
    if (drafted) return { ...drafted, needsProfile: false };

    // AI 실패 폴백 — 절대 빈 화면으로 끝내지 않는다
    const parts = [
      `${name ? `${name} ` : ''}사회자입니다.`,
      pro?.careerYears ? `${pro.careerYears}년째 ${categories.slice(0, 2).join('·') || '행사'}를 진행하고 있습니다.` : '',
      tags.length ? `${tags.slice(0, 2).join(', ')}이 강점입니다.` : '',
      (pro?.shortIntro || '').split(/[.\n]/)[0]?.trim(),
    ].filter(Boolean);
    return {
      personaText: parts.join(' ').slice(0, 600),
      tone: DEFAULT_PERSONA.tone,
      length: DEFAULT_PERSONA.length,
      signatures: [],
      needsProfile: false,
    };
  }

  /**
   * '내 말투로 다듬기' — 자아가 실제로 고객에게 닿는 주 경로.
   * 결과는 폼에만 반영되고 사회자가 저장을 눌러야 DB 로 간다. 사람 검토가 반드시 끼므로
   * 런타임 환각·인젝션 위험이 구조적으로 없다.
   */
  async rewriteForMe(userId: string, text: string) {
    const proProfileId = await this.proProfileIdOf(userId);
    const source = String(text || '').trim();
    if (!source) return { text: '', changed: false, reason: '다듬을 문구가 없어요' };
    const [persona, user] = await Promise.all([
      this.getPersona(proProfileId),
      this.prisma.user.findUnique({ where: { id: userId }, select: { name: true } }),
    ]);
    const out = await this.ai.rewrite(user?.name || '', persona, source);
    if (!out) return { text: source, changed: false, reason: 'AI 다듬기에 실패했어요. 잠시 후 다시 시도해주세요.' };

    // 다듬은 결과라도 원문의 사실을 벗어나면 쓰지 않는다
    const bad = validateAdapted(out.text, source);
    if (bad) {
      this.logger.warn(`rewrite 폐기(${bad}) pro=${proProfileId}`);
      return { text: source, changed: false, reason: '원문의 금액·조건이 바뀔 뻔해서 되돌렸어요.' };
    }
    return { text: out.text, changed: out.text !== source, droppedFacts: out.droppedFacts };
  }

  /**
   * 미리보기 — "이렇게 물어보면 뭐라고 답하나요?"
   * 사회자가 자기 설정을 신뢰하려면 즉시 확인할 수 있어야 한다.
   */
  async previewForMe(userId: string, text: string) {
    const proProfileId = await this.proProfileIdOf(userId);
    const body = String(text || '').trim();
    if (!body) return { willReply: false, reason: '질문을 입력해주세요' };

    const [user, persona] = await Promise.all([
      this.prisma.user.findUnique({ where: { id: userId }, select: { name: true } }),
      this.getPersona(proProfileId),
    ]);
    const risks = screenRisks(body);
    const decided = await this.decideReply({
      proProfileId,
      proName: user?.name,
      roomId: `preview:${proProfileId}`,
      customerName: '홍길동',
      text: body,
    });

    if (!decided) {
      return {
        willReply: false,
        risks,
        reason: isTrivialMessage(body)
          ? '짧은 인사나 단답에는 답하지 않아요'
          : risks.length
            ? '민감한 내용이라 자동으로 답하지 않고 사회자님께 알려드려요'
            : '맞는 답변을 못 찾았어요. 자주 묻는 질문에 추가해보세요',
      };
    }
    if (decided.needsHuman) {
      return { willReply: false, risks, reason: '사회자님이 직접 답해야 하는 내용이라 알림만 보내드려요' };
    }
    return {
      willReply: true,
      answer: decided.answer,
      why: decided.why,
      risks,
      aiUsed: decided.why.startsWith('ai:'),
      persona: { tone: persona.tone, call: persona.call },
    };
  }

  /** 자동 승인 — 켜 두면 섭외 요청이 오는 즉시 방을 열고 인사말을 보낸다 */
  async autoApproveEnabled(proProfileId: string) {
    const row = await this.prisma.proAutoReply.findFirst({
      where: { proProfileId, kind: 'autoapprove' },
      select: { isEnabled: true },
    });
    return Boolean(row?.isEnabled);
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
