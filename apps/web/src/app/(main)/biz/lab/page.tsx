'use client';

import { notFound, useSearchParams } from 'next/navigation';
import { Suspense } from 'react';
import { SmoothScroll } from '@/components/biz/toss/scene';
import { BizFooter, BizNav, DockIndicator } from '@/components/biz/toss/TossChrome';
import SceneIntro from '@/components/biz/toss/SceneIntro';
import SceneMatch from '@/components/biz/toss/SceneMatch';
import SceneCareer from '@/components/biz/toss/SceneCareer';
import SceneDoor from '@/components/biz/toss/SceneDoor';
import SceneBook from '@/components/biz/toss/SceneBook';
import SceneEvents from '@/components/biz/toss/SceneEvents';
import SceneScale from '@/components/biz/toss/SceneScale';
import SceneClients from '@/components/biz/toss/SceneClients';
import SceneStage from '@/components/biz/toss/SceneStage';
import SceneMoments from '@/components/biz/toss/SceneMoments';

/*
 * 개발용 장면 실험실 — /biz/lab?scene=Intro 처럼 한 장면만(앞뒤 여백 포함) 띄워 토스 프레임과 견준다. 운영에선 404.
 * scene=all 이면 전부 차례로.
 */
const SCENES: Record<string, React.ComponentType> = {
  Intro: SceneIntro, Match: SceneMatch, Career: SceneCareer, Door: SceneDoor, Book: SceneBook,
  Events: SceneEvents, Scale: SceneScale, Clients: SceneClients, Stage: SceneStage, Moments: SceneMoments,
};

function Lab() {
  const sp = useSearchParams();
  const name = sp.get('scene') || 'all';
  const list = name === 'all' ? Object.values(SCENES) : [SCENES[name]].filter(Boolean);
  const chrome = sp.get('chrome') === '1';
  return (
    <div className="relative min-h-screen overflow-x-clip bg-white">
      <SmoothScroll />
      {chrome && <BizNav items={[{ id: 'a', label: '회사소개' }, { id: 'b', label: '핵심서비스' }]} onNavigate={() => {}} ctaLabel="문의하기" onCta={() => {}} />}
      {chrome && <DockIndicator />}
      {name !== 'Intro' && name !== 'all' && <div style={{ height: '60vh' }} />}
      {list.map((S, i) => <S key={i} />)}
      <div style={{ height: '100vh' }} />
      {chrome && <BizFooter links={[{ label: '연혁', href: '/biz/history' }]} company={['프리티풀']} />}
    </div>
  );
}

export default function LabPage() {
  if (process.env.NODE_ENV === 'production') notFound();
  return <Suspense fallback={null}><Lab /></Suspense>;
}
