/**
 * Gemini 상태 — 크레딧 소진(402) 같은 사고를 어드민에서 바로 보이게(261006 사장 '크레딧 떨어지면 어드민에서 확인, 유저는 못 보게').
 *
 *  · 모든 Gemini 호출 자리(자동응답·답장 추천·리뷰 요약·웨딩숲 AI·맞춤법/상세페이지)가 성공·실패를 여기에 알린다(noteGeminiOk/Error).
 *  · 어드민이 볼 때는 checkGeminiHealth() — 최근 실제 호출 결과 + 10분마다 한 번 아주 짧은 확인 호출(출력 1토큰, 비용 거의 0).
 *    실제 호출이 뜸해도(밤·주말) 충전이 끝났는지·바닥났는지 바로 안다.
 *  · 402 = AI Studio 선불 크레딧 소진 — 모델을 바꿔도 같은 키라 똑같이 막힌다(isCreditsError 면 다음 모델로 넘어가지 말 것).
 * 서버 한 대 메모리 기준이다(재배포하면 처음부터 다시 잰다 — 확인 호출이 바로 채운다).
 */
export type GeminiStatus = 'ok' | 'credits' | 'error' | 'nokey' | 'unknown';

const state = {
  lastOkAt: 0,
  lastOkService: '',
  lastErrorAt: 0,
  lastErrorCode: 0,
  lastErrorService: '',
  lastErrorMessage: '',
};
let probe: { at: number; status: GeminiStatus; code: number; message: string } | null = null;
let probing: Promise<void> | null = null;
const PROBE_TTL_MS = 10 * 60 * 1000;

function geminiKey() {
  return process.env.GEMINI_API_KEY || process.env.GEMINI_AI_KEY || process.env.GOOGLE_API_KEY || process.env.GOOGLE_GENERATIVE_AI_API_KEY || '';
}

function messageOf(err: unknown) {
  return String((err as any)?.message || err || '').replace(/AIza[\w-]+/g, '[key]');
}

function codeOf(msg: string) {
  const m = msg.match(/\[(\d{3})[\s\]]/) || msg.match(/\b(4\d\d|5\d\d)\b/);
  return m ? Number(m[1]) : 0;
}

/** 크레딧 소진(402)인가 — 이 오류면 다른 모델을 시도해도 소용없다 */
export function isCreditsError(err: unknown) {
  return /\b402\b|Payment Required|prepayment credits/i.test(messageOf(err));
}

export function noteGeminiOk(service: string) {
  state.lastOkAt = Date.now();
  state.lastOkService = service;
}

export function noteGeminiError(service: string, err: unknown) {
  const msg = messageOf(err);
  // 시간 초과는 우리 쪽 대기 한도 — 상태 판단에서 뺀다
  if (/^timeout$/i.test(msg.trim())) return;
  state.lastErrorAt = Date.now();
  state.lastErrorService = service;
  state.lastErrorCode = isCreditsError(msg) ? 402 : codeOf(msg);
  state.lastErrorMessage = msg.slice(0, 240);
}

async function runProbe() {
  const key = geminiKey();
  if (!key) {
    probe = { at: Date.now(), status: 'nokey', code: 0, message: 'GEMINI 키 없음' };
    return;
  }
  try {
    const res = await fetch('https://generativelanguage.googleapis.com/v1beta/models/gemini-flash-lite-latest:generateContent', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json', 'x-goog-api-key': key },
      body: JSON.stringify({ contents: [{ parts: [{ text: 'ping' }] }], generationConfig: { maxOutputTokens: 1 } }),
      signal: AbortSignal.timeout(8000),
    });
    if (res.ok) {
      probe = { at: Date.now(), status: 'ok', code: 200, message: '' };
      noteGeminiOk('health-probe');
      return;
    }
    const body = (await res.text().catch(() => '')).replace(/AIza[\w-]+/g, '[key]');
    const credits = res.status === 402 || /prepayment credits/i.test(body);
    probe = { at: Date.now(), status: credits ? 'credits' : 'error', code: res.status, message: body.slice(0, 240) };
    noteGeminiError('health-probe', `[${res.status}] ${body.slice(0, 200)}`);
  } catch (e) {
    // 네트워크 문제 — 상태를 바꾸지 않고 다음에 다시
    probe = { at: Date.now(), status: 'unknown', code: 0, message: messageOf(e).slice(0, 160) };
  }
}

/** 어드민용 — 10분 안에 확인했으면 그 결과, 아니면 확인 호출 한 번(동시에 여러 번 부르지 않는다) */
export async function checkGeminiHealth(force = false) {
  if (force || !probe || Date.now() - probe.at > PROBE_TTL_MS) {
    if (!probing) probing = runProbe().finally(() => { probing = null; });
    await probing;
  }
  const p = probe!;
  // 확인 호출보다 나중에 실제 호출이 성공/실패했으면 그게 더 새 소식
  let status: GeminiStatus = p.status;
  if (state.lastOkAt > p.at && state.lastOkAt >= state.lastErrorAt) status = 'ok';
  else if (state.lastErrorAt > p.at && state.lastErrorCode === 402) status = 'credits';
  return {
    status,
    checkedAt: new Date(p.at).toISOString(),
    probe: { status: p.status, code: p.code, message: p.message },
    lastOk: state.lastOkAt ? { at: new Date(state.lastOkAt).toISOString(), service: state.lastOkService } : null,
    lastError: state.lastErrorAt
      ? { at: new Date(state.lastErrorAt).toISOString(), service: state.lastErrorService, code: state.lastErrorCode, message: state.lastErrorMessage }
      : null,
  };
}
