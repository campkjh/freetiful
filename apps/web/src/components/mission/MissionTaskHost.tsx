'use client';

// 첫 글·첫 견적 오버레이를 그리는 곳 — 루트(providers)에 하나. 글 · 견적 신호(lib/mission-sent) → lib/mission-task.ts 판정 → 이벤트.
// 오버레이는 홈과 같은 그라데이션 판(CheckinOverlay variant='home'), 숫자 = 미션 칸 완료 수(N/4), 채워지는 칸 = 이번 칸.
import dynamic from 'next/dynamic';
import { useEffect, useState } from 'react';
import { useRouter } from 'next/navigation';
import { MISSION_TASK_EVENT, celebrateMissionTask, type MissionTaskDetail } from '@/lib/mission-task';
import { MISSION_SENT_EVENT, type MissionSentKind } from '@/lib/mission-sent';

const CheckinOverlay = dynamic(() => import('./CheckinOverlay'), { ssr: false });

export default function MissionTaskHost() {
  const router = useRouter();
  const [task, setTask] = useState<MissionTaskDetail | null>(null);

  useEffect(() => {
    const on = (e: Event) => setTask((cur) => cur ?? (e as CustomEvent<MissionTaskDetail>).detail);
    // 글 · 견적이 서버에 들어감(apiClient · cfetch 길목) → 첫 번째인지 확인 → 맞으면 위 이벤트가 온다
    const sent = (e: Event) => celebrateMissionTask((e as CustomEvent<MissionSentKind>).detail);
    window.addEventListener(MISSION_TASK_EVENT, on);
    window.addEventListener(MISSION_SENT_EVENT, sent);
    return () => {
      window.removeEventListener(MISSION_TASK_EVENT, on);
      window.removeEventListener(MISSION_SENT_EVENT, sent);
    };
  }, []);

  if (!task) return null;
  const { kind, status: st } = task;
  const att = st.attendance;
  const postDone = st.post.count >= st.post.required;
  const quoteDone = st.quote.count >= st.quote.required;
  const steps = Math.min(att.count, att.required) + (postDone ? 1 : 0) + (quoteDone ? 1 : 0);
  const what = kind === 'post' ? '웨딩숲 글쓰기' : st.role === 'pro' ? '견적서 보내기' : '견적 요청';
  const reward = `${st.reward.toLocaleString('ko-KR')}원`;

  return (
    <CheckinOverlay
      variant="home"
      focus={kind}
      prevCount={Math.max(0, steps - 1)}
      count={steps}
      unit={`/${att.required + 2}`}
      attCount={att.count}
      required={att.required}
      postDone={postDone}
      quoteDone={quoteDone}
      sub={st.completed ? `미션 완료! ${reward} 받을 수 있어요` : `${what} 미션 완료`}
      cta="확인"
      progressLabel={st.completed ? `${reward} 받기` : '진행상황'}
      onDone={(choice) => {
        setTask(null);
        if (choice === 'progress') router.push('/my/mission');
      }}
    />
  );
}
