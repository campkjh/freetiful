import { Injectable, Logger } from '@nestjs/common';
import { GoogleGenerativeAI } from '@google/generative-ai';
import {
  AiRouteResult,
  Persona,
  ROUTER_SYSTEM_INSTRUCTION,
  RouterPromptInput,
  buildPersonaDraftPrompt,
  buildRewritePrompt,
  buildRouterUserContent,
  LENGTH_MAX_CHARS,
  TONE_LABELS,
  CALL_LABELS,
  LENGTH_LABELS,
  EMOJI_LABELS,
} from './auto-reply-ai';

/**
 * 자동응답 AI 호출 담당.
 *
 * 채팅 경로는 사람이 기다리는 자리라 generateProfile 의 5모델 사다리(20초 초과)를
 * 절대 재사용하지 않는다. 단일 경량 모델 + 과부하일 때만 1홉, 하드 타임아웃 2.5초.
 * 실패하면 전부 null 이고 호출부는 기존 규칙 매칭으로 떨어진다.
 */
@Injectable()
export class AutoReplyAiService {
  private readonly logger = new Logger(AutoReplyAiService.name);
  private readonly client: GoogleGenerativeAI | null;

  /** 방·사회자별 호출 횟수 — '발송' 이 아니라 '호출' 을 센다.
   *  발송 여부로 세면 needsHuman 이 계속 나올 때 카운터가 영원히 0 이라
   *  고객이 '?' 를 500번 보내면 무제한 호출된다. */
  private roomCalls = new Map<string, number>();
  private proCalls = new Map<string, { day: string; n: number }>();
  private inflight = 0;

  constructor() {
    const key =
      process.env.GEMINI_API_KEY ||
      process.env.GEMINI_AI_KEY ||
      process.env.GOOGLE_API_KEY ||
      process.env.GOOGLE_GENERATIVE_AI_API_KEY;
    this.client = key ? new GoogleGenerativeAI(key) : null;
    if (!this.client) this.logger.warn('GEMINI key 없음 — 자동응답 AI 경로 비활성');
  }

  isEnabled() {
    return this.client !== null && (process.env.AI_AUTOREPLY_MODE || 'on') !== 'off';
  }

  private minConfidence() {
    const v = Number(process.env.AI_AUTOREPLY_MIN_CONFIDENCE);
    return Number.isFinite(v) && v > 0 && v < 1 ? v : 0.62;
  }

  /** 호출 한도 — 방 6회 / 사회자 하루 100회 / 전역 동시 20 */
  private takeQuota(roomId: string, proProfileId: string) {
    if (this.inflight >= 20) return false;
    const roomN = this.roomCalls.get(roomId) || 0;
    if (roomN >= 6) return false;
    const today = new Date().toISOString().slice(0, 10);
    const pro = this.proCalls.get(proProfileId);
    const proN = pro && pro.day === today ? pro.n : 0;
    if (proN >= 100) return false;
    this.roomCalls.set(roomId, roomN + 1);
    this.proCalls.set(proProfileId, { day: today, n: proN + 1 });
    return true;
  }

  private async generateJson(prompt: string, opts: {
    systemInstruction?: string;
    temperature?: number;
    maxOutputTokens?: number;
    timeoutMs?: number;
  } = {}): Promise<any | null> {
    if (!this.client) return null;
    const timeoutMs = opts.timeoutMs ?? 2500;
    // 과부하일 때만 한 홉. 사다리를 길게 두면 채팅에서 체감 지연이 폭발한다.
    const models = ['gemini-2.5-flash-lite', 'gemini-2.5-flash'];

    for (let i = 0; i < models.length; i++) {
      try {
        const model = this.client.getGenerativeModel({
          model: models[i],
          ...(opts.systemInstruction ? { systemInstruction: opts.systemInstruction } : {}),
          generationConfig: {
            temperature: opts.temperature ?? 0.25,
            topP: 0.8,
            maxOutputTokens: opts.maxOutputTokens ?? 520,
            responseMimeType: 'application/json',
            thinkingConfig: { thinkingBudget: 0 },
          } as any,
        });
        const result: any = await Promise.race([
          model.generateContent(prompt),
          new Promise((_, rej) => setTimeout(() => rej(new Error('timeout')), timeoutMs)),
        ]);
        const text = result?.response?.text?.();
        if (!text) return null;
        return JSON.parse(text);
      } catch (e: any) {
        const msg = String(e?.message || e);
        this.logger.warn(`[${models[i]}] ${msg.slice(0, 120)}`);
        // 과부하가 아니면 다음 모델로 넘어가 봐야 똑같이 실패한다
        if (!/503|429|504|UNAVAILABLE|overloaded|high demand/i.test(msg)) return null;
      }
    }
    return null;
  }

  /**
   * 고객 메시지 → 사회자가 써 둔 후보 중 하나 고르기.
   * 실패·타임아웃·한도초과는 전부 null → 호출부가 기존 규칙 매칭으로 떨어진다.
   */
  async route(
    input: RouterPromptInput & { roomId: string; proProfileId: string; maxChars: number },
  ): Promise<AiRouteResult | null> {
    if (!this.isEnabled()) return null;
    if (!this.takeQuota(input.roomId, input.proProfileId)) {
      this.logger.warn(`자동응답 AI 한도 초과 room=${input.roomId}`);
      return null;
    }
    this.inflight++;
    const started = Date.now();
    try {
      const system = ROUTER_SYSTEM_INSTRUCTION.replace('{{MAX_CHARS}}', String(input.maxChars));
      const parsed = await this.generateJson(buildRouterUserContent(input), {
        systemInstruction: system,
        temperature: 0.25,
        maxOutputTokens: 520,
        timeoutMs: 2500,
      });
      if (!parsed || typeof parsed !== 'object') return null;

      const out: AiRouteResult = {
        action: parsed.action === 'match' ? 'match' : 'none',
        matchedKey: typeof parsed.matchedKey === 'string' ? parsed.matchedKey : null,
        mode: parsed.mode === 'adapted' ? 'adapted' : 'verbatim',
        renderedText: typeof parsed.renderedText === 'string' ? parsed.renderedText : '',
        confidence: Number.isFinite(Number(parsed.confidence)) ? Number(parsed.confidence) : 0,
        intent: typeof parsed.intent === 'string' ? parsed.intent : 'etc',
        unknownParts: Array.isArray(parsed.unknownParts)
          ? parsed.unknownParts.filter((v: any) => typeof v === 'string').slice(0, 5)
          : [],
        needsHuman: parsed.needsHuman === true,
        reason: typeof parsed.reason === 'string' ? parsed.reason.slice(0, 300) : '',
        riskFlags: Array.isArray(parsed.riskFlags)
          ? parsed.riskFlags.filter((v: any) => typeof v === 'string').slice(0, 10)
          : [],
      };
      this.logger.log(
        `route ${Date.now() - started}ms action=${out.action} key=${out.matchedKey} conf=${out.confidence} human=${out.needsHuman}`,
      );
      return out;
    } finally {
      this.inflight--;
    }
  }

  /** 발송/미발송 문턱. 금전·일정 게이트에는 쓰지 않는다(모델 자기신고라 적대적 입력의 영향권) */
  passesConfidence(v: number) {
    return v >= this.minConfidence();
  }

  /** 설정 화면 '내 말투로 다듬기' — 사람이 읽고 저장하므로 런타임 위험 없음 */
  async rewrite(proName: string, persona: Persona, sourceText: string) {
    if (!this.client) return null;
    const parsed = await this.generateJson(buildRewritePrompt({ proName, persona, sourceText }), {
      temperature: 0.6,
      maxOutputTokens: 700,
      timeoutMs: 12000,
    });
    const text = typeof parsed?.text === 'string' ? parsed.text.trim() : '';
    if (!text) return null;
    return {
      text: text.slice(0, LENGTH_MAX_CHARS[persona.length] * 2),
      droppedFacts: Array.isArray(parsed?.droppedFacts)
        ? parsed.droppedFacts.filter((v: any) => typeof v === 'string').slice(0, 5)
        : [],
    };
  }

  /** 자아 초안 — 프로필을 재료로 자동 작성 */
  async draftPersona(profile: Parameters<typeof buildPersonaDraftPrompt>[0]) {
    if (!this.client) return null;
    const parsed = await this.generateJson(buildPersonaDraftPrompt(profile), {
      temperature: 0.85,
      maxOutputTokens: 600,
      timeoutMs: 12000,
    });
    const personaText = typeof parsed?.personaText === 'string' ? parsed.personaText.trim() : '';
    if (!personaText) return null;
    return {
      personaText: personaText.slice(0, 600),
      tone: ['warm', 'trust', 'bright', 'plain'].includes(parsed?.tone) ? parsed.tone : 'trust',
      length: ['short', 'normal', 'long'].includes(parsed?.length) ? parsed.length : 'short',
      signatures: Array.isArray(parsed?.signatures)
        ? parsed.signatures.filter((v: any) => typeof v === 'string' && v.length <= 30).slice(0, 3)
        : [],
    };
  }

  /** 프롬프트에 넣을 말투 한 줄 */
  personaLine(p: Persona) {
    return [
      `말투: ${TONE_LABELS[p.tone]}`,
      `길이: ${LENGTH_LABELS[p.length]}`,
      `이모지: ${EMOJI_LABELS[p.emoji]}`,
      `호칭: ${CALL_LABELS[p.call]}`,
      p.signatures.length ? `자주 쓰는 말: ${p.signatures.join(' / ')}` : '',
      p.banPhrases ? `안 쓰는 말: ${p.banPhrases}` : '',
      p.personaText ? `소개: ${p.personaText}` : '',
    ]
      .filter(Boolean)
      .join(' · ');
  }
}
