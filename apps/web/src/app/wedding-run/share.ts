'use client';

// 웨딩런 공유(261011 사장 사양서 [11])
//  · 종료 결과에 따라 문구를 바꾼다 — 신랑 합류 전 / 발리(신혼여행) 구간 / 신혼집 도착 / 최고기록 경신 + 그 밖의 경우 한 줄.
//  · 공유 내용 = 문구 + 도달 구간 + 점수 + 게임 링크.
//  · Web Share API 가 있으면 쓰고(취소=조용히, 실패=링크 복사로), 없으면 링크 복사. 복사도 안 되면 화면이 주소를 직접 보여 준다.
//  · 링크에 목표 점수를 담는다: 서버가 검증한 기록이면 ?c=<기록 id>(서버에서 다시 읽어 '검증된 기록'으로),
//    아니면 ?t=<점수>&n=<닉네임>(누구나 만들 수 있는 값 — 화면은 '친구가 보낸 목표'로만 보여 주고 검증된 기록처럼 다루지 않는다).
// 링크의 닉네임은 '모양'만 본다 — 대부분 게스트의 이름이 기본 '꾸밈말 동물'이라 그 모양도 받아야 한다(261011 통합)
import { nicknameShapeError, normalizeNickname } from './ranking';
import { GROOM_STAGE, HONEYMOON_FROM, clampSegment, fmtScore, reachShort } from './ui/text';

export type ShareCase = 'arrived' | 'new-best' | 'honeymoon' | 'before-groom' | 'together';

export const SHARE_COPY: Record<ShareCase, string> = {
  'before-groom': '신랑 만나기도 전에 넘어짐… 예랑아 네가 해봐😂',
  honeymoon: '신혼여행까진 갔는데 집에는 못 감ㅋㅋ',
  arrived: '우리 신혼집 입주 완료🏡 너는 몇 점?',
  'new-best': '결혼 준비보다 이 기록 깨는 데 더 진심임',
  // 사양서 4종에 안 걸리는 경우(신랑 합류 뒤 ~ 비행기 전, 최고기록 아님)
  together: '신랑이랑 손잡고 달렸는데 여기까지… 너는 몇 점?',
};

/**
 * 우선순위: 신혼집 도착 > 최고기록 경신(첫 판 제외 — 이전 기록이 있을 때만) > 신혼여행 구간(비행기·발리·신혼집 앞) > 신랑 합류 전 > 그 밖
 */
export function shareCase(r: { stage: number; segment: number; arrived: boolean; score: number; prevBest: number }): ShareCase {
  if (r.arrived) return 'arrived';
  if (r.prevBest > 0 && r.score > r.prevBest) return 'new-best';
  if (clampSegment(r.segment) >= HONEYMOON_FROM) return 'honeymoon';
  if (r.stage < GROOM_STAGE) return 'before-groom';
  return 'together';
}

// ── 도전 링크 ──

export const MAX_LINK_SCORE = 9_999_999;

export type Challenge =
  /** 서버가 검증한 기록(?c=) */
  | { kind: 'verified'; id: string; nickname: string; score: number; stage: number; segment: number; arrived: boolean }
  /** 링크에 적힌 값(?t=&n=) — 검증 안 됨 */
  | { kind: 'link'; score: number; nickname: string | null };

const UUID_RE = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;

export function isScoreId(v: unknown): v is string {
  return typeof v === 'string' && UUID_RE.test(v);
}

/** ?t=&n= 읽기 — 숫자만·상한, 닉네임은 규칙에 맞을 때만(아니면 이름 없이 점수만) */
export function parseLinkChallenge(t: string | null | undefined, n: string | null | undefined): Challenge | null {
  if (!t || !/^\d{1,8}$/.test(t)) return null;
  const score = Math.min(MAX_LINK_SCORE, parseInt(t, 10));
  if (!(score > 0)) return null;
  const nick = n ? normalizeNickname(n.slice(0, 40)) : '';
  return { kind: 'link', score, nickname: nick && !nicknameShapeError(nick) ? nick : null };
}

function gameUrl(): string {
  try {
    return `${window.location.origin}/wedding-run`;
  } catch {
    return 'https://freetiful.com/wedding-run';
  }
}

/** 공유 링크 — 검증 기록 id 가 있으면 ?c=, 없으면 ?t=&n= */
export function challengeLink(opts: { scoreId?: string | null; score: number; nickname: string }): string {
  const base = gameUrl();
  if (opts.scoreId && isScoreId(opts.scoreId)) return `${base}?c=${encodeURIComponent(opts.scoreId)}`;
  const s = Math.max(0, Math.min(MAX_LINK_SCORE, Math.floor(opts.score)));
  if (s <= 0) return base;
  const p = new URLSearchParams({ t: String(s) });
  const nick = normalizeNickname(opts.nickname);
  if (nick && !nicknameShapeError(nick)) p.set('n', nick);
  return `${base}?${p.toString()}`;
}

export type SharePayload = { title: string; text: string; url: string; copyCase: ShareCase };

export function buildShare(r: {
  score: number;
  stage: number;
  segment: number;
  arrived: boolean;
  laps: number;
  prevBest: number;
  nickname: string;
  scoreId?: string | null;
}): SharePayload {
  const c = shareCase(r);
  const reach = reachShort({ arrived: r.arrived, segment: r.segment, laps: r.laps });
  const url = challengeLink({ scoreId: r.scoreId, score: r.score, nickname: r.nickname });
  return {
    title: '웨딩런: 신혼집까지 달려!',
    text: `${SHARE_COPY[c]}\n[웨딩런] ${r.arrived ? reach : `${reach}까지`} · ${fmtScore(r.score)}점 — 이 기록 넘어 볼래?`,
    url,
    copyCase: c,
  };
}

export type ShareResult = 'shared' | 'copied' | 'cancelled' | 'failed';

/**
 * 공유 실행 — 버튼 누른 그 자리에서 불러야 한다(사파리는 사용자 동작 직후가 아니면 share 를 막음).
 * Web Share → (없거나 실패) 링크 복사 → (복사도 실패) 'failed' = 화면이 주소를 직접 보여 준다.
 */
export async function shareRecord(p: SharePayload): Promise<ShareResult> {
  const nav = typeof navigator !== 'undefined' ? (navigator as Navigator & { share?: (d: ShareData) => Promise<void> }) : null;
  if (nav && typeof nav.share === 'function') {
    try {
      await nav.share({ title: p.title, text: p.text, url: p.url });
      return 'shared';
    } catch (e) {
      const name = (e as { name?: string } | null)?.name;
      if (name === 'AbortError') return 'cancelled';
      // NotAllowedError(사용자 동작 만료)·기타 실패 → 링크 복사로
    }
  }
  return (await copyText(`${p.text}\n${p.url}`)) ? 'copied' : 'failed';
}

export async function copyText(text: string): Promise<boolean> {
  try {
    if (navigator.clipboard?.writeText) {
      await navigator.clipboard.writeText(text);
      return true;
    }
  } catch {
    /* 아래 옛 방식 */
  }
  try {
    const ta = document.createElement('textarea');
    ta.value = text;
    ta.setAttribute('readonly', '');
    ta.style.position = 'fixed';
    ta.style.top = '-1000px';
    ta.style.opacity = '0';
    document.body.appendChild(ta);
    ta.select();
    ta.setSelectionRange(0, text.length);
    const ok = document.execCommand('copy');
    document.body.removeChild(ta);
    return ok;
  } catch {
    return false;
  }
}
