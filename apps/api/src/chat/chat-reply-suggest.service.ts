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
