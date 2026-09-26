import { Injectable, Logger } from '@nestjs/common';
import { GoogleGenerativeAI } from '@google/generative-ai';

/**
 * 채팅 답장 추천(당근 '추천 답장' 어법, 2026-09-25 사장 지시).
 *  · 상대가 마지막으로 한 말을 AI 가 읽고, **내 역할(고객/사회자)** 로 바로 보낼 만한 짧은 답장 3개.
 *  · 대화가 없거나 내가 마지막에 말했으면 역할별 기본 문구(고객: "견적은 얼마 정도 되나요?" / 사회자: "안녕하세요, 반갑습니다!").
 *  · AI 가 없거나 느리면(3.5초) 규칙(견적·가능·영상·감사 키워드)으로 — 화면은 절대 비지 않는다.
 *  · 가격·날짜 같은 사실은 지어내지 않게 프롬프트로 막고, 연락처·외부결제 유도 문구는 걸러낸다.
 */

export type ReplyRole = 'customer' | 'pro';
export type ReplyTurn = { mine: boolean; text: string };

const PRESETS: Record<ReplyRole, string[]> = {
  customer: ['안녕하세요 ☺️', '견적은 얼마 정도 되나요?', '해당 날짜에 진행 가능하신가요?', '진행 영상 볼 수 있을까요?'],
  pro: ['안녕하세요, 반갑습니다!', '문의 주셔서 감사합니다 ☺️', '행사 날짜와 장소를 알려주시겠어요?', '견적서 바로 보내드릴게요!'],
};

// 상대 말의 의도 → 내 역할별 답장(AI 가 없을 때)
const RULES: { test: RegExp; customer: string[]; pro: string[] }[] = [
  {
    test: /견적|가격|비용|금액|얼마|페이|단가/,
    customer: ['견적서 확인했어요!', '조금 조정 가능할까요?', '검토해보고 연락드릴게요.'],
    pro: ['행사 날짜와 시간을 알려주시면 견적 드릴게요!', '견적서 바로 보내드릴게요.', '원하시는 진행 스타일이 있으신가요?'],
  },
  {
    test: /가능|되나요|될까요|일정|날짜|시간|언제/,
    customer: ['네, 그날로 부탁드려요!', '시간 조율 가능할까요?', '확인 감사합니다 ☺️'],
    pro: ['네, 그날 진행 가능해요!', '일정 확인하고 바로 알려드릴게요.', '행사 시간도 알려주시겠어요?'],
  },
  {
    test: /영상|샘플|포트폴리오|진행.*(보|볼)/,
    customer: ['영상 잘 봤어요!', '다른 영상도 볼 수 있을까요?', '분위기가 좋네요 ☺️'],
    pro: ['진행 영상 보내드릴게요!', '프로필에서 영상 보실 수 있어요 ☺️', '원하시는 분위기를 알려주세요.'],
  },
  {
    test: /감사|고맙|고마워|좋아요|좋습니다/,
    customer: ['저도 감사합니다 ☺️', '잘 부탁드려요!', '궁금한 게 생기면 연락드릴게요.'],
    pro: ['저도 감사합니다 ☺️', '편하게 연락 주세요!', '좋은 행사 만들어 드릴게요.'],
  },
  {
    test: /안녕|반갑|처음/,
    customer: ['안녕하세요 ☺️', '견적은 얼마 정도 되나요?', '해당 날짜에 가능하신가요?'],
    pro: ['안녕하세요, 반갑습니다!', '어떤 행사 준비하고 계세요?', '행사 날짜를 알려주시겠어요?'],
  },
];

// 추천에 나오면 안 되는 말 — 개인 연락처·외부 결제 유도
const BLOCK = /(\d{2,3}-?\d{3,4}-?\d{4})|카톡\s*아이디|오픈\s*채팅|계좌\s*(로|번호)|현금\s*으로|직거래|수수료\s*없이|@[a-z0-9_.]{3,}/i;

// ─── 사회자 거절 사유 추천(260926 사장 "거절 사유도 AI 가 거절 멘트 추려서 프리셋 — 스케줄 안 됨, 선약 있음 등") ───
export type DeclineInfo = { date?: string | null; time?: string | null; location?: string | null; kind?: string | null; parts?: string | null };
export type DeclineItem = { label: string; text: string };

/** 규칙 프리셋 — AI 가 없거나 늦어도 늘 나온다. 요청에 적힌 날짜·지역·시간만 쓴다 */
export function declineRules(info: DeclineInfo): DeclineItem[] {
  const region = (info.location || '').trim().split(/\s+/)[0] || '';
  const items: DeclineItem[] = [
    {
      label: '스케줄 안 됨',
      text: info.date
        ? `${info.date}에는 이미 다른 행사 일정이 있어 진행이 어려워요. 문의 주셔서 감사합니다.`
        : '요청하신 날짜에 이미 다른 행사 일정이 있어 진행이 어려워요. 문의 주셔서 감사합니다.',
    },
    { label: '선약 있음', text: '선약이 있어 이번 행사는 진행이 어려워요. 좋은 사회자님 만나시길 바랄게요.' },
  ];
  if (region) items.push({ label: '지역이 멀어요', text: `요청하신 지역(${region})은 이동이 어려워 진행이 힘들어요. 양해 부탁드려요.` });
  if (info.time && /\d{1,2}:\d{2}/.test(info.time)) {
    items.push({ label: '시간 안 맞음', text: `${info.time} 전후로 다른 일정이 있어 시간을 맞추기 어려워요. 문의 감사합니다.` });
  }
  items.push({ label: '행사 성격', text: '요청하신 행사와 제 진행 스타일이 잘 맞지 않을 것 같아 정중히 사양할게요. 감사합니다.' });
  items.push({ label: '개인 사정', text: '개인 사정으로 이번 행사는 진행이 어려워요. 이해해 주셔서 감사합니다.' });
  return items;
}

@Injectable()
export class ChatReplySuggestService {
  private readonly logger = new Logger(ChatReplySuggestService.name);
  private readonly client: GoogleGenerativeAI | null;
  private readonly cache = new Map<string, { at: number; value: string[]; source: 'ai' | 'rule' | 'preset' }>();

  constructor() {
    const key = process.env.GEMINI_API_KEY || process.env.GEMINI_AI_KEY || process.env.GOOGLE_API_KEY || '';
    this.client = key ? new GoogleGenerativeAI(key) : null;
  }

  /** 대화(오래된→최근)와 내 역할로 답장 3개 */
  async suggest(
    cacheKey: string,
    role: ReplyRole,
    turns: ReplyTurn[],
    options: { refresh?: boolean } = {},
  ): Promise<{ suggestions: string[]; source: 'ai' | 'rule' | 'preset' }> {
    const last = turns[turns.length - 1];
    // 대화가 없거나 내가 마지막에 말했으면 — 기본 문구
    if (!last || last.mine) {
      const base = turns.some((t) => !t.mine) ? this.ruleFor(role, turns) : PRESETS[role];
      return { suggestions: base.slice(0, 4), source: 'preset' };
    }

    const hit = this.cache.get(cacheKey);
    if (!options.refresh && hit && Date.now() - hit.at < 10 * 60_000) return { suggestions: hit.value, source: hit.source };

    let value: string[] | null = null;
    let source: 'ai' | 'rule' = 'rule';
    if (this.client) {
      value = await this.suggestWithAi(role, turns, options.refresh === true).catch((e) => {
        this.logger.warn(`reply suggest AI failed: ${String(e?.message || e).slice(0, 120)}`);
        return null;
      });
      if (value && value.length) source = 'ai';
    }
    if (!value || !value.length) value = this.ruleFor(role, turns);
    this.cache.set(cacheKey, { at: Date.now(), value, source });
    if (this.cache.size > 2000) {
      const oldest = [...this.cache.entries()].sort((a, b) => a[1].at - b[1].at).slice(0, 500);
      oldest.forEach(([k]) => this.cache.delete(k));
    }
    return { suggestions: value, source };
  }

  private ruleFor(role: ReplyRole, turns: ReplyTurn[]): string[] {
    const lastOther = [...turns].reverse().find((t) => !t.mine)?.text || '';
    const rule = RULES.find((r) => r.test.test(lastOther));
    return rule ? rule[role] : PRESETS[role].slice(0, 3);
  }

  private async suggestWithAi(role: ReplyRole, turns: ReplyTurn[], varied: boolean): Promise<string[] | null> {
    if (!this.client) return null;
    const me = role === 'pro' ? '사회자(행사를 진행하는 사람)' : '고객(행사를 준비하며 사회자를 찾는 사람)';
    const other = role === 'pro' ? '고객' : '사회자';
    const dialog = turns
      .slice(-10)
      .map((t) => `${t.mine ? '나' : other}: ${t.text.replace(/\s+/g, ' ').slice(0, 200)}`)
      .join('\n');
    const prompt = [
      "너는 결혼식·행사 사회자 매칭 앱 '프리티풀'의 채팅 답장 추천기다.",
      `나는 이 대화에서 ${me}이다. 상대는 ${other}다.`,
      '아래 최근 대화를 읽고, 상대의 마지막 말에 내가 지금 바로 보낼 만한 짧은 답장 3개를 추천해라.',
      '규칙:',
      '- 각 답장은 25자 안팎, 자연스러운 존댓말, 이모지는 최대 1개.',
      '- 가격·날짜·시간·장소 같은 구체적인 사실은 대화에 나온 것만 쓰고 절대 지어내지 마라. 모르면 되묻는 답장으로.',
      '- 세 답장은 서로 다른 방향(수락·질문·감사 등)으로.',
      '- 전화번호·카톡 아이디·계좌·외부 결제 유도는 쓰지 마라.',
      varied ? '- 흔한 인사말 말고 조금 다른 표현으로.' : '',
      '출력: JSON 문자열 배열만. 예) ["네, 가능합니다!", "행사 시간은 언제인가요?", "감사합니다 ☺️"]',
      '',
      '대화(오래된→최근):',
      dialog,
    ]
      .filter(Boolean)
      .join('\n');

    const models = [process.env.GEMINI_MODEL, 'gemini-flash-lite-latest', 'gemini-2.5-flash', 'gemini-flash-latest'].filter(
      (m, i, arr): m is string => !!m && arr.indexOf(m) === i,
    );
    const deadline = Date.now() + 3500;
    for (const name of models) {
      const left = deadline - Date.now();
      if (left < 300) break;
      try {
        const generationConfig: any = { temperature: varied ? 0.9 : 0.6, maxOutputTokens: 200 };
        if (name === 'gemini-2.5-flash') generationConfig.thinkingConfig = { thinkingBudget: 0 };
        const model = this.client.getGenerativeModel({ model: name, generationConfig });
        const result: any = await Promise.race([
          model.generateContent(prompt),
          new Promise((_, reject) => setTimeout(() => reject(new Error('timeout')), left)),
        ]);
        const text: string = result?.response?.text?.() || '';
        const parsed = this.parse(text);
        if (parsed.length) return parsed;
      } catch (e: any) {
        this.logger.warn(`reply suggest model ${name} failed: ${String(e?.message || e).slice(0, 100)}`);
      }
    }
    return null;
  }

  /** 거절 사유 추천 — AI 가 요청에 맞춰 4개(이름표+보낼 문장), 규칙 프리셋을 뒤에 붙여 최대 6개 */
  async suggestDecline(info: DeclineInfo): Promise<{ items: DeclineItem[]; source: 'ai' | 'rule' }> {
    const rules = declineRules(info);
    if (!this.client) return { items: rules, source: 'rule' };
    const ai = await this.declineWithAi(info).catch((e) => {
      this.logger.warn(`decline suggest AI failed: ${String(e?.message || e).slice(0, 120)}`);
      return null;
    });
    if (!ai || !ai.length) return { items: rules, source: 'rule' };
    const seen = new Set(ai.map((item) => item.label));
    return { items: [...ai, ...rules.filter((item) => !seen.has(item.label))].slice(0, 6), source: 'ai' };
  }

  private async declineWithAi(info: DeclineInfo): Promise<DeclineItem[] | null> {
    if (!this.client) return null;
    const facts = [
      info.date ? `- 행사일: ${info.date}` : '- 행사일: (없음)',
      info.time ? `- 시간: ${info.time}` : '',
      info.location ? `- 장소: ${info.location.slice(0, 60)}` : '',
      info.kind ? `- 행사 종류: ${info.kind.slice(0, 30)}` : '',
      info.parts ? `- 진행 부: ${info.parts.slice(0, 30)}` : '',
    ].filter(Boolean).join('\n');
    const prompt = [
      "너는 결혼식·행사 사회자 섭외 앱 '프리티풀'에서, 사회자가 고객의 섭외 요청을 정중히 거절할 때 고를 멘트를 추천한다.",
      '아래 요청 정보를 보고 서로 다른 거절 사유 4개를 만들어라(일정·선약·지역/이동·행사 성격·개인 사정 중에서).',
      '규칙:',
      '- label: 버튼에 들어갈 8자 이내 짧은 이름(예: 스케줄 안 됨, 선약 있음, 지역이 멀어요).',
      '- text: 고객에게 그대로 보낼 정중한 존댓말 1~2문장, 70자 이내, 끝에 감사나 응원 한마디.',
      '- 요청 정보에 있는 날짜·지역만 쓸 수 있다. 가격·새 날짜·연락처·다른 사회자 추천·외부 연락 유도는 절대 쓰지 마라.',
      '- 고객을 탓하거나 변명이 길지 않게.',
      '출력: JSON 배열만. 예) [{"label":"스케줄 안 됨","text":"그날은 이미 다른 행사가 있어 진행이 어려워요. 문의 감사합니다."}]',
      '',
      '요청 정보:',
      facts,
    ].join('\n');

    const models = [process.env.GEMINI_MODEL, 'gemini-flash-lite-latest', 'gemini-2.5-flash', 'gemini-flash-latest'].filter(
      (m, i, arr): m is string => !!m && arr.indexOf(m) === i,
    );
    const deadline = Date.now() + 3500;
    for (const name of models) {
      const left = deadline - Date.now();
      if (left < 300) break;
      try {
        const generationConfig: any = { temperature: 0.7, maxOutputTokens: 400 };
        if (name === 'gemini-2.5-flash') generationConfig.thinkingConfig = { thinkingBudget: 0 };
        const model = this.client.getGenerativeModel({ model: name, generationConfig });
        const result: any = await Promise.race([
          model.generateContent(prompt),
          new Promise((_, reject) => setTimeout(() => reject(new Error('timeout')), left)),
        ]);
        const parsed = this.parseDecline(result?.response?.text?.() || '');
        if (parsed.length) return parsed;
      } catch (e: any) {
        this.logger.warn(`decline suggest model ${name} failed: ${String(e?.message || e).slice(0, 100)}`);
      }
    }
    return null;
  }

  private parseDecline(text: string): DeclineItem[] {
    const m = text.match(/\[[\s\S]*\]/);
    if (!m) return [];
    try {
      const arr = JSON.parse(m[0]);
      if (!Array.isArray(arr)) return [];
      const out: DeclineItem[] = [];
      for (const row of arr) {
        const label = String(row?.label || '').replace(/\s+/g, ' ').trim();
        const body = String(row?.text || '').replace(/\s+/g, ' ').trim();
        if (label.length < 2 || label.length > 10 || body.length < 8 || body.length > 90) continue;
        // 가격·연락처·외부 유도는 버린다(모델이 규칙을 어겨도 여기서 막는다)
        if (BLOCK.test(body) || /\d[\d,]*\s*(만원|만|원)/.test(body)) continue;
        if (out.some((item) => item.label === label || item.text === body)) continue;
        out.push({ label, text: body });
        if (out.length >= 4) break;
      }
      return out;
    } catch {
      return [];
    }
  }

  private parse(text: string): string[] {
    const m = text.match(/\[[\s\S]*\]/);
    if (!m) return [];
    try {
      const arr = JSON.parse(m[0]);
      if (!Array.isArray(arr)) return [];
      return arr
        .filter((s): s is string => typeof s === 'string')
        .map((s) => s.replace(/\s+/g, ' ').trim())
        .filter((s) => s.length >= 2 && s.length <= 40 && !BLOCK.test(s))
        .filter((s, i, a) => a.indexOf(s) === i)
        .slice(0, 3);
    } catch {
      return [];
    }
  }
}
