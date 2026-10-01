'use client';

// 3D 게임은 브라우저에서만(WebGL·localStorage·IndexedDB) — 서버 렌더 없이 불러온다.
import dynamic from 'next/dynamic';

const ForestGame = dynamic(() => import('@/game/forest/ForestGame'), {
  ssr: false,
  loading: () => (
    <div style={{ position: 'fixed', inset: 0, background: '#1c2b23', color: '#fff', display: 'flex', alignItems: 'center', justifyContent: 'center', fontFamily: 'Pretendard, sans-serif', fontWeight: 800, fontSize: 22 }}>결혼의 숲을 불러오는 중…</div>
  ),
});

export default function ForestClient() {
  return <ForestGame />;
}
