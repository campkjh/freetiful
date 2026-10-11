// 웨딩런: 신혼집까지 달려!(261011 사장 — 프리티풀 모바일 웹게임, 2D 횡스크롤 러너, 휴대폰 가로 우선 + PC)
//  · 서버 컴포넌트: 공유 링크면 링크 미리보기·도전 배너를 만든다.
//    - ?c=<기록 id>  서버가 검증한 기록 → 운영 API 에서 다시 읽어 '○○님의 N점에 도전!'(검증된 기록)
//    - ?t=<점수>&n=<닉네임>  링크에 적힌 값(누구나 만들 수 있음) → 화면엔 '친구가 보낸 목표'로만, 미리보기 문구는 기본값
//  · 게임 화면은 ui/WeddingRunScreen(클라이언트) — 엔진(Phaser 3)은 그 안에서 dynamic import, SSR 에서 import 하지 않는다.
//  · (main) 레이아웃 밖 전체 화면.
import type { Metadata } from 'next';
import { headers } from 'next/headers';
import WeddingRunScreen from './ui/WeddingRunScreen';
import { clientIpFrom, fetchPublicScore, isScoreIdServer } from './ui/score-server';
import { fmtScore, reachShort } from './ui/text';
import type { Challenge } from './share';

type SP = { [k: string]: string | string[] | undefined };
type Props = { searchParams: SP };

function one(sp: SP, k: string): string | null {
  const v = sp?.[k];
  const s = Array.isArray(v) ? v[0] : v;
  return typeof s === 'string' ? s : null;
}

function pickC(sp: SP) {
  const c = one(sp, 'c');
  return isScoreIdServer(c) ? c : null;
}

/** ?t=&n= — 숫자·길이만 거른다(닉네임 규칙 검사는 화면 쪽 share.ts parseLinkChallenge 가 한 번 더) */
function pickLink(sp: SP): { t: string; n: string | null } | null {
  const t = one(sp, 't');
  if (!t || !/^\d{1,8}$/.test(t) || !(parseInt(t, 10) > 0)) return null;
  const n = one(sp, 'n');
  return { t, n: n ? n.slice(0, 40) : null };
}

export async function generateMetadata({ searchParams }: Props): Promise<Metadata> {
  const c = pickC(searchParams);
  if (!c) return {};
  const s = await fetchPublicScore(c, clientIpFrom(headers()));
  if (!s) return {};
  const title = `${s.nickname}님의 ${fmtScore(s.score)}점에 도전! — 웨딩런`;
  const description = `${reachShort(s)}까지 달린 기록이에요. 드레스 입고 서울에서 출발해 신랑과 손잡고 신혼집까지 — 이 기록을 넘어 보세요!`;
  const image = `/api/wedding-run/og?c=${encodeURIComponent(c)}`;
  return {
    title,
    description,
    alternates: { canonical: '/wedding-run' },
    openGraph: { title, description, url: `/wedding-run?c=${encodeURIComponent(c)}`, siteName: '프리티풀', locale: 'ko_KR', type: 'website', images: [{ url: image, width: 1200, height: 630, alt: title }] },
    twitter: { card: 'summary_large_image', title, description, images: [image] },
  };
}

export default async function WeddingRunPage({ searchParams }: Props) {
  const c = pickC(searchParams);
  let challenge: Challenge | null = null;
  if (c) {
    const s = await fetchPublicScore(c, clientIpFrom(headers()));
    if (s) challenge = { kind: 'verified', id: s.id, nickname: s.nickname, score: s.score, stage: s.stage, segment: s.segment, arrived: s.arrived };
  }
  const link = challenge ? null : pickLink(searchParams);
  return <WeddingRunScreen challenge={challenge} linkChallenge={link} />;
}
