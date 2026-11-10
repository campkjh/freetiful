'use client';

/* 신규 가입 5,000원 미션(261110 사장 '출석체크 2번 + 웨딩숲 1회 작성 + 견적 1회 전송 → 연락처·계좌번호·예금주·은행명 넣으면 5,000원').
 *  · 인터랙션 = 사장 녹화(토스 출석 화면) 프레임 분석 그대로(components/mission), 색은 프리티풀 파랑. 산 그림·길 노드는 사장 지시로 뺐다.
 *  · 들어오면 출석 1번(서버 POST checkin, 하루 1번). 오늘 처음이면 출석 오버레이 → [확인했어요] → 본문 차례 등장.
 *    홈도 그날 첫 방문에 출석 + 같은 오버레이(홈 판, main/page.tsx)를 띄우고 여기로 보낸다 — 그때는 이미 출석이라 본문만 등장.
 *  · 판정·중복 막기는 전부 서버(apps/api/src/mission). 지급은 운영팀이 어드민 /admin/welcome-mission 에서 손으로. */
import '@/components/mission/mission.css';
import { useEffect, useRef, useState } from 'react';
import { useRouter } from 'next/navigation';
import toast from 'react-hot-toast';
import { useAuthStore } from '@/lib/store/auth.store';
import { missionApi, type WelcomeMissionStatus } from '@/lib/api/mission.api';
import CheckinOverlay from '@/components/mission/CheckinOverlay';
import MissionClaimSheet from '@/components/mission/MissionClaimSheet';
import { IcBack, IcChevron, IcHelp } from '@/components/mission/icons';

const won = (n: number) => n.toLocaleString('ko-KR');
const kstDate = (iso: string | null | undefined) => {
  if (!iso) return '';
  const d = new Date(new Date(iso).getTime() + 9 * 3600000);
  return `${d.getUTCMonth() + 1}월 ${d.getUTCDate()}일`;
};
const TOSS = (n: string) => `/icons/toss/${n}.svg`;

export default function WelcomeMissionPage() {
  const router = useRouter();
  const { user, hasHydrated } = useAuthStore();
  const [st, setSt] = useState<WelcomeMissionStatus | null>(null);
  const [err, setErr] = useState('');
  const [overlay, setOverlay] = useState<{ prev: number; count: number } | null>(null);
  const [shown, setShown] = useState(false);
  const [sheet, setSheet] = useState(false);
  const notesRef = useRef<HTMLDivElement>(null);
  const req = useRef<ReturnType<typeof missionApi.checkin> | null>(null);

  // 출석 — 같은 요청을 두 번 보내지 않게 한 번만(두 번째는 '이미 출석'이라 오버레이가 안 뜬다)
  useEffect(() => {
    if (!hasHydrated || !user) return;
    req.current ??= missionApi.checkin();
    req.current
      .then(({ justCheckedIn, ...s }) => {
        setSt(s);
        // 출석 칸(1·2일차)이 남아 있을 때만 — 3일째부터는 채울 칸이 없어 본문만
        if (justCheckedIn && s.eligible && s.attendance.count <= s.attendance.required) setOverlay({ prev: Math.max(0, s.attendance.count - 1), count: s.attendance.count });
        else setShown(true);
      })
      .catch(() => setErr('미션을 불러오지 못했어요. 잠시 뒤 다시 들어와 주세요.'));
  }, [hasHydrated, user]);

  const isPro = st?.role === 'pro';
  const att = st?.attendance;
  const postDone = !!st && st.post.count >= st.post.required;
  const quoteDone = !!st && st.quote.count >= st.quote.required;
  const attDone = !!att && att.count >= att.required;
  const claim = st?.claim || null;
  const canClaim = !!st?.eligible && !!st.completed && (!claim || claim.status === 'rejected');
  const doneCount = (attDone ? 1 : 0) + (postDone ? 1 : 0) + (quoteDone ? 1 : 0);
  const quoteHref = isPro ? '/chat' : '/quick-match';

  const statsSub = !st
    ? ''
    : !st.eligible
      ? '신규 가입자 미션'
      : claim?.status === 'paid'
        ? '받은 상금'
        : claim?.status === 'pending'
          ? '보내드릴 상금 · 확인 중'
          : st.completed
            ? '미션 완료! 받을 상금'
            : `미션 ${doneCount}/3 완료`;

  const pct = att ? Math.min(att.count, att.required) / att.required : 0;

  return (
    <div className={`ms-page${shown ? ' is-shown' : ''}`}>
      <header className="ms-head" data-native-back-header>
        <button type="button" className="ms-head-btn" aria-label="뒤로가기" onClick={() => (window.history.length > 1 ? router.back() : router.push('/my'))}>
          <IcBack className="h-6 w-6" />
        </button>
        <button type="button" className="ms-head-btn help" aria-label="유의사항" onClick={() => notesRef.current?.scrollIntoView({ behavior: 'smooth', block: 'start' })}>
          <IcHelp className="h-[26px] w-[26px]" />
        </button>
      </header>

      {st && (
        <section className="ms-top ms-rise" style={{ ['--d' as string]: '0.02s' }}>
          <p className="ms-stats-sub">{statsSub}</p>
          <p className="ms-stats-big"><b>{won(st.reward)}</b><span>원</span></p>
          {st.eligible && <p className="ms-top-desc">출석 2번 · 웨딩숲 글 1번 · 견적 1번이면 받아요</p>}
        </section>
      )}

      <div className="ms-body">
        {err && <div className="ms-card ms-closed"><p>{err}</p></div>}

        {st && !st.eligible && (
          <div className="ms-card ms-closed ms-rise" style={{ ['--d' as string]: '0.12s' }}>
            <p>이 미션은 2026년 11월 10일부터{'\n'}가입한 분만 참여할 수 있어요.</p>
          </div>
        )}

        {st?.eligible && att && (
          <>
            <div className="ms-card ms-att ms-rise" style={{ ['--d' as string]: '0.12s' }}>
              <p className="ms-att-title">출석 <b>{att.count}일째</b></p>
              <div className="ms-att-track">
                <span className="ms-att-bar" style={{ width: shown ? `${pct * 100}%` : 0 }} />
                {pct < 1 && (
                  <span className="ms-att-dots" style={{ left: `calc(${pct * 100}% + 22px)` }}>
                    {Array.from({ length: 4 }, (_, i) => <i key={i} />)}
                  </span>
                )}
                <span className="ms-att-icon" style={{ left: shown ? `${pct * 100}%` : 0 }}>
                  <svg viewBox="0 0 26 26" aria-hidden="true">
                    <circle cx="13" cy="13" r="12" fill="currentColor" />
                    <path d="M7.6 13.4l3.6 3.6 7.2-7.4" fill="none" stroke="#fff" strokeWidth="2.6" strokeLinecap="round" strokeLinejoin="round" />
                  </svg>
                </span>
              </div>
            </div>

            <div className="ms-card ms-rows ms-rise" style={{ ['--d' as string]: '0.19s' }}>
              <div className="ms-row" role="group">
                <img className="ms-row-icon" src={TOSS('calendar-check')} alt="" />
                <span className="ms-row-text">
                  <span className="ms-row-title">출석 체크 2번</span>
                  <span className="ms-row-desc">서로 다른 날 이 화면에 들어오면 돼요</span>
                </span>
                <span className={`ms-row-right${attDone ? ' done' : ''}`}>{attDone ? '완료' : `${att.count}/${att.required}`}</span>
              </div>
              <button type="button" className="ms-row" disabled={postDone} onClick={() => router.push('/community/write')}>
                <img className="ms-row-icon" src={TOSS('pencil')} alt="" />
                <span className="ms-row-text">
                  <span className="ms-row-title">웨딩숲에 글 1번 쓰기</span>
                  <span className="ms-row-desc">가입 후 쓴 공개 글이면 돼요</span>
                </span>
                {postDone ? <span className="ms-row-right done">완료</span> : <span className="ms-row-right go">쓰러 가기<IcChevron /></span>}
              </button>
              <button type="button" className="ms-row" disabled={quoteDone} onClick={() => router.push(quoteHref)}>
                <img className="ms-row-icon" src={TOSS('document')} alt="" />
                <span className="ms-row-text">
                  <span className="ms-row-title">{isPro ? '견적서 1번 보내기' : '견적 요청 1번 보내기'}</span>
                  <span className="ms-row-desc">{isPro ? '채팅에서 고객에게 견적서를 보내면 돼요' : '퀵매칭으로 사회자에게 견적을 요청하면 돼요'}</span>
                </span>
                {quoteDone ? <span className="ms-row-right done">완료</span> : <span className="ms-row-right go">보내러 가기<IcChevron /></span>}
              </button>
            </div>

            <div className="ms-card ms-reward ms-rise" style={{ ['--d' as string]: '0.26s' }}>
              {claim?.status === 'paid' ? (
                <h2 className="ms-reward-title"><em>{won(st.reward)}원</em>을 보내드렸어요</h2>
              ) : st.completed ? (
                <h2 className="ms-reward-title">미션 완료! <em>{won(st.reward)}원</em> 받아요</h2>
              ) : (
                <h2 className="ms-reward-title">미션 3개 하면 <em>{won(st.reward)}원</em> 받아요</h2>
              )}
              <p className="ms-reward-sub">{st.name ? `${st.name}님을 위한 ` : ''}신규 가입 혜택이에요</p>

              {claim && (
                <div className="ms-claim-box">
                  <p className={`ms-claim-state ${claim.status}`}>
                    <i />
                    {claim.status === 'paid' ? '입금 완료' : claim.status === 'pending' ? '확인 중 · 곧 보내드려요' : '다시 신청해 주세요'}
                  </p>
                  <p className="ms-claim-meta">
                    {claim.status === 'rejected'
                      ? claim.adminNote || '입력한 정보를 확인할 수 없었어요.'
                      : `${claim.bankName} ${claim.account} · ${claim.accountHolder}\n${claim.status === 'paid' ? `${kstDate(claim.paidAt)} 입금` : `${kstDate(claim.createdAt)} 신청`}`}
                  </p>
                </div>
              )}

              {(!claim || claim.status === 'rejected') && (
                <button type="button" className="ft-btn primary" disabled={!canClaim} onClick={() => setSheet(true)}>
                  {claim?.status === 'rejected' ? '다시 신청하기' : st.completed ? `${won(st.reward)}원 받기` : `미션 ${doneCount}/3 완료`}
                </button>
              )}
            </div>
          </>
        )}

        {st && (
          <div ref={notesRef} className="ms-card ms-notes ms-rise" style={{ ['--d' as string]: '0.33s', scrollMarginTop: 72 }}>
            <h3>유의사항</h3>
            <ul>
              <li>2026년 11월 10일부터 가입한 회원만 참여할 수 있어요.</li>
              <li>출석은 이 화면에 들어온 날 하루 한 번 기록돼요. 서로 다른 날 2번이면 돼요.</li>
              <li>웨딩숲 글은 가입 후 쓴 글 중 공개된 글만 인정돼요.</li>
              <li>{isPro ? '견적은 가입 후 채팅에서 보낸 견적서만 인정돼요.' : '견적은 가입 후 보낸 견적 요청만 인정돼요.'}</li>
              <li>상금은 한 계정에 한 번, 같은 연락처·계좌로도 한 번만 받을 수 있어요.</li>
              <li>신청하면 운영팀이 확인한 뒤 입력한 계좌로 보내드려요.</li>
              <li>부정한 방법으로 참여하면 지급이 취소될 수 있어요.</li>
            </ul>
          </div>
        )}
      </div>

      {overlay && st && (
        <CheckinOverlay
          prevCount={overlay.prev}
          count={overlay.count}
          required={st.attendance.required}
          postDone={postDone}
          quoteDone={quoteDone}
          onDone={() => {
            setOverlay(null);
            setShown(true);
          }}
        />
      )}

      {st && (
        <MissionClaimSheet
          open={sheet}
          status={st}
          onClose={() => setSheet(false)}
          onDone={(nextSt) => {
            setSt(nextSt);
            setSheet(false);
            toast.success('신청했어요. 확인하고 보내드릴게요.');
          }}
        />
      )}
    </div>
  );
}
