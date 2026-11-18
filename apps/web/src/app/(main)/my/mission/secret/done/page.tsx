'use client';

/* 시크릿 미션 응모 완료(261118 사장 '완료를 하면 완료페이지로 바로 이동하게끔 자동으로') — 응모 화면이 성공하면 replace 로 여기 온다.
 * 서버 상태로 그린다(응모 안 했으면 응모 화면으로). 파란 원 + 체크 그리기 + 물결 2번(biz/complete 와 같은 어법). */
import '@/components/mission/mission.css';
import '@/components/mission/secret-mission.css';
import { useEffect, useState } from 'react';
import { useRouter } from 'next/navigation';
import { useAuthStore } from '@/lib/store/auth.store';
import { missionApi, type WelcomeMissionStatus } from '@/lib/api/mission.api';
import { haptic } from '@/lib/haptics';
import { SECRET_PRIZE } from '@/lib/secret-mission';

const kstDate = (iso: string) => {
  const d = new Date(new Date(iso).getTime() + 9 * 3600000);
  return `${d.getUTCMonth() + 1}월 ${d.getUTCDate()}일`;
};

export default function SecretMissionDonePage() {
  const router = useRouter();
  const { user, hasHydrated } = useAuthStore();
  const [entry, setEntry] = useState<NonNullable<NonNullable<WelcomeMissionStatus['secret']>['entry']> | null>(null);

  useEffect(() => {
    if (!hasHydrated) return;
    if (!user) {
      router.replace('/my/mission');
      return;
    }
    missionApi
      .status()
      .then((s) => {
        const e = s.secret?.entry;
        if (!e || e.status === 'rejected') {
          router.replace('/my/mission/secret');
          return;
        }
        setEntry(e);
        haptic('success');
      })
      .catch(() => router.replace('/my/mission'));
  }, [hasHydrated, user, router]);

  if (!entry) return <div className="smd" />;
  const won = entry.status === 'won';
  return (
    <div className="smd">
      <div className="smd-main">
        <div className="smd-badge" aria-hidden="true">
          <b />
          <i />
          <svg viewBox="0 0 88 88">
            <path d="M28 45l11 11 22-23" fill="none" stroke="#fff" strokeWidth="6" strokeLinecap="round" strokeLinejoin="round" />
          </svg>
        </div>
        <h1>{won ? '당첨됐어요!' : '응모 완료!'}</h1>
        <p className="smd-sub">
          {won
            ? `${SECRET_PRIZE}를 보내드릴게요.\n받으실 곳은 따로 연락드려요.`
            : `${SECRET_PRIZE} 추첨 결과는\n알림으로 알려드릴게요.`}
        </p>
        <dl className="smd-info">
          <div><dt>인스타그램</dt><dd>@{entry.instagramId}</dd></div>
          <div><dt>응모한 날</dt><dd>{kstDate(entry.createdAt)}</dd></div>
          <div><dt>경품</dt><dd>{SECRET_PRIZE}</dd></div>
        </dl>
      </div>
      <button type="button" className="ft-btn primary" onClick={() => router.replace('/my/mission')}>
        확인
      </button>
    </div>
  );
}
