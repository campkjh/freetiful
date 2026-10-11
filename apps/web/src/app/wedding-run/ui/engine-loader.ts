'use client';

// 웨딩런 엔진 불러오기(261011 사장 사양서 [12] — Phaser 3 는 /wedding-run 에서만 dynamic import, SSR 에서 import 금지)
//  · 화면은 이 함수로만 엔진을 받는다 → Phaser 는 이 화면에 들어온 뒤 따로 받는 청크(다른 화면 번들 영향 0).
//  · 개발 서버에서만: window.__WR_FAKE_ENGINE__ 가 있으면 그것을 쓴다(헤드리스 흐름 확인용 — 종료·도착을 바로 만들 때).
//    운영 빌드에선 NODE_ENV 비교가 상수로 접혀 이 분기째 빠진다.
import type { WRCreateGame } from './types';

export async function loadEngine(): Promise<WRCreateGame> {
  if (process.env.NODE_ENV !== 'production' && typeof window !== 'undefined') {
    const fake = (window as unknown as { __WR_FAKE_ENGINE__?: { createWeddingRunGame?: WRCreateGame } }).__WR_FAKE_ENGINE__;
    if (fake && typeof fake.createWeddingRunGame === 'function') return fake.createWeddingRunGame;
  }
  const m = await import('../game');
  return m.createWeddingRunGame;
}
