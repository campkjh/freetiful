'use client';

// 첫 웨딩숲 글(신규가입 미션 글쓰기 칸이 아직 빈 사람) 쓰는 동안 — 261111 사장
//  '첫 글 쓸 때 글쓰기 인풋을 쓸 때 리워드 지급 룰이 나오는 모달 · 첫 글 쓸 때만 30자, 조금만 더 써주세요! 다 왔어요 — 빨강 주황 초록 느낌'.
//  · useMissionFirstPost: 서버 미션 상태로 '첫 글 대상'인지 본다. 입력칸을 처음 누르면(계정 · 기기마다 하루 한 번) 규칙 시트 → 닫으면 입력칸으로 돌아간다.
//  · <MissionPostMeter>: 입력칸 아래 글자 수 줄 — 서버와 같은 계산(missionPostCheck), 빨강 → 주황 → 초록(261113 바탕 없이 선·글자 색만).
//  · <MissionRulesSheet>: .ft-* 시트(웨딩숲 톤) · framer 스프링 · 뒤 잠금 — 작성 모달(z 1200) 위에 뜨게 body 로 portal.
import { useCallback, useEffect, useRef, useState, type FocusEvent } from 'react';
import { createPortal } from 'react-dom';
import { AnimatePresence, MotionConfig, motion, type Transition } from 'framer-motion';
import { useAuthStore } from '@/lib/store/auth.store';
import { missionApi, missionLocalKey, missionPostCheck } from '@/lib/api/mission.api';
import { useBodyScrollLock } from '@/lib/hooks/useBodyScrollLock';
import { IcCheck } from './icons';
import './mission-post.css';

const SHEET_SPRING: Transition = { type: 'spring', stiffness: 380, damping: 36, mass: 0.9 };
const kstToday = () => new Date(Date.now() + 9 * 3600_000).toISOString().slice(0, 10);

export type MissionFirstPost = {
  active: boolean;
  reward: number;
  minChars: number;
  rulesOpen: boolean;
  onInputFocus: (e: FocusEvent<HTMLElement>) => void;
  closeRules: () => void;
};

export function useMissionFirstPost(): MissionFirstPost {
  const userId = useAuthStore((s) => s.user?.id);
  const role = useAuthStore((s) => s.user?.role);
  const [info, setInfo] = useState<{ reward: number; minChars: number } | null>(null);
  const [rulesOpen, setRulesOpen] = useState(false);
  const inputEl = useRef<HTMLElement | null>(null);

  useEffect(() => {
    setInfo(null);
    if (!userId || role === 'admin') return;
    let off = false;
    missionApi
      .status()
      .then((st) => {
        if (off || !st.eligible || st.post.count >= st.post.required) return;
        if (st.claim && st.claim.status !== 'rejected') return;
        setInfo({ reward: st.reward, minChars: st.post.minChars ?? 30 });
      })
      .catch(() => undefined);
    return () => { off = true; };
  }, [userId, role]);

  const showRules = useCallback(
    (el: HTMLElement) => {
      if (!userId) return;
      const key = missionLocalKey('rules', userId);
      try {
        if (localStorage.getItem(key) === kstToday()) return;
        localStorage.setItem(key, kstToday());
      } catch {}
      // 키보드가 올라온 채로 시트가 뜨면 안드 웹뷰에선 시트가 키보드 뒤로 숨는다 — 잠깐 내렸다가 닫을 때 다시 올린다
      el.blur();
      setRulesOpen(true);
    },
    [userId],
  );

  const onInputFocus = useCallback(
    (e: FocusEvent<HTMLElement>) => {
      inputEl.current = e.currentTarget;
      if (info) showRules(e.currentTarget);
    },
    [info, showRules],
  );

  // 작성 창이 열리자마자 입력칸에 들어가 있으면(autoFocus) 상태를 받기 전에 focus 가 지나간다 — 받은 뒤 아직 그 칸이면 그때 띄운다
  useEffect(() => {
    const el = inputEl.current;
    if (info && el && document.activeElement === el) showRules(el);
  }, [info, showRules]);

  const closeRules = useCallback(() => {
    setRulesOpen(false);
    const el = inputEl.current;
    if (el) window.setTimeout(() => el.focus({ preventScroll: true }), 280);
  }, []);

  return { active: !!info, reward: info?.reward ?? 5000, minChars: info?.minChars ?? 30, rulesOpen, onInputFocus, closeRules };
}

/** 입력칸 아래 글자 수 줄 — 첫 글 대상일 때만 */
export function MissionPostMeter({ mission, content, className }: { mission: MissionFirstPost; content: string; className?: string }) {
  if (!mission.active) return null;
  return <MeterLine minChars={mission.minChars} content={content} className={className} />;
}

// 261113 사장 '글이 너무 많고 바탕 없애고 글자 색·선으로만, 인터랙션' — 바탕 상자 없이 얇은 선이 차오르고 밑에 짧은 한 줄.
//  · 쓰는 동안: '미션까지 N자' — 남은 숫자만 톡 바뀐다. 선·글자 색 = 빨강 → 주황(절반) → 초록(완료).
//  · 다 채우는 순간: 선에 빛이 한 번 지나가고 굵어졌다 돌아오며, 체크가 튀어나온다(폰은 짧게 진동).
const METER_SPRING: Transition = { type: 'spring', stiffness: 260, damping: 30 };

function MeterLine({ minChars, content, className }: { minChars: number; content: string; className?: string }) {
  const { length, ok, spam } = missionPostCheck(content, minChars);
  const p = spam ? 1 : Math.min(1, length / minChars);
  const done = ok && !spam;
  const tone = spam ? 'red' : done ? 'green' : p >= 0.5 ? 'orange' : 'red';
  const left = Math.max(1, minChars - length);

  const [burst, setBurst] = useState(0);
  const wasDone = useRef(done);
  useEffect(() => {
    if (done && !wasDone.current) {
      setBurst((n) => n + 1);
      try { navigator.vibrate?.(12); } catch {}
    }
    wasDone.current = done;
  }, [done]);

  return (
    <MotionConfig reducedMotion="user">
      <div className={`ms-line is-${tone}${className ? ` ${className}` : ''}`} role="status" aria-live="polite">
        <motion.div
          className="ms-line-track"
          animate={burst ? { scaleY: [1, 2.2, 1] } : undefined}
          transition={{ duration: 0.5, ease: [0.22, 1, 0.36, 1] }}
          key={`track-${burst}`}
        >
          <motion.div className="ms-line-fill" initial={false} animate={{ scaleX: p }} transition={METER_SPRING} />
          {burst > 0 && (
            <motion.i
              key={burst}
              className="ms-line-shine"
              initial={{ x: '-100%' }}
              animate={{ x: '260%' }}
              transition={{ duration: 0.8, ease: [0.4, 0, 0.2, 1] }}
            />
          )}
        </motion.div>
        <AnimatePresence mode="wait" initial={false}>
          <motion.p
            key={spam ? 'spam' : done ? 'done' : 'left'}
            className="ms-line-text"
            initial={{ opacity: 0, y: 6 }}
            animate={{ opacity: 1, y: 0 }}
            exit={{ opacity: 0, y: -6 }}
            transition={{ duration: 0.22, ease: [0.22, 1, 0.36, 1] }}
          >
            {spam ? (
              '같은 글자 반복은 인정되지 않아요'
            ) : done ? (
              <>
                <motion.span
                  className="ms-line-ic"
                  initial={{ scale: 0, rotate: -30 }}
                  animate={{ scale: 1, rotate: 0 }}
                  transition={{ type: 'spring', stiffness: 520, damping: 18, delay: 0.05 }}
                >
                  <IcCheck />
                </motion.span>
                미션 완료
              </>
            ) : (
              <>
                미션까지{' '}
                <span className="ms-line-num">
                  <AnimatePresence mode="popLayout" initial={false}>
                    <motion.b
                      key={left}
                      initial={{ y: -8, opacity: 0 }}
                      animate={{ y: 0, opacity: 1 }}
                      exit={{ y: 8, opacity: 0 }}
                      transition={{ type: 'spring', stiffness: 600, damping: 34 }}
                    >
                      {left}
                    </motion.b>
                  </AnimatePresence>
                </span>
                자
              </>
            )}
          </motion.p>
        </AnimatePresence>
      </div>
    </MotionConfig>
  );
}

/** 첫 글 리워드 규칙 시트 */
export function MissionRulesSheet({ mission }: { mission: MissionFirstPost }) {
  const open = mission.rulesOpen;
  const [centered, setCentered] = useState(false);
  const [mounted, setMounted] = useState(false);
  useBodyScrollLock(open);
  useEffect(() => {
    setMounted(true);
    const mq = window.matchMedia('(min-width: 640px)');
    const sync = () => setCentered(mq.matches);
    sync();
    mq.addEventListener('change', sync);
    return () => mq.removeEventListener('change', sync);
  }, []);
  if (!mounted) return null;
  const reward = `${mission.reward.toLocaleString('ko-KR')}원`;
  const rules = [
    `띄어쓰기 포함 ${mission.minChars}자 이상 써 주세요. 문장부호 · 이모지 · ㅋㅋ 같은 글자는 세지 않아요.`,
    '같은 글자를 되풀이하거나 뜻 없는 글은 인정되지 않아요.',
    '공개된 글만 인정돼요. 숨겨지거나 블라인드된 글은 빠져요.',
    '미션으로 인정된 글은 삭제할 수 없어요.',
    `출석 2번 · 웨딩숲 글 1번 · 견적 1번을 마치면 계좌로 ${reward}을 보내 드려요.`,
  ];

  return createPortal(
    <MotionConfig reducedMotion="user">
      <AnimatePresence>
        {open && (
          <motion.div
            key="ms-rules-scrim"
            className="ft-scrim"
            style={{ animation: 'none', zIndex: 1300, alignItems: centered ? 'center' : undefined }}
            initial={{ backgroundColor: 'rgba(0, 0, 0, 0)' }}
            animate={{ backgroundColor: 'rgba(0, 0, 0, 0.4)' }}
            exit={{ backgroundColor: 'rgba(0, 0, 0, 0)' }}
            transition={{ duration: 0.26, ease: [0.22, 1, 0.36, 1] }}
            onClick={mission.closeRules}
          >
            <motion.div
              className="ft-sheet"
              role="dialog"
              aria-modal="true"
              aria-labelledby="ms-rules-title"
              style={{ animation: 'none', overscrollBehavior: 'contain', borderRadius: centered ? 24 : undefined }}
              initial={centered ? { opacity: 0, y: 18, scale: 0.97 } : { y: '100%' }}
              animate={centered ? { opacity: 1, y: 0, scale: 1 } : { y: 0 }}
              exit={centered ? { opacity: 0, y: 12, scale: 0.98, transition: { duration: 0.18 } } : { y: '100%', transition: { duration: 0.26, ease: [0.4, 0, 1, 1] } }}
              transition={SHEET_SPRING}
              onClick={(e) => e.stopPropagation()}
            >
              <div className="ft-grab" aria-hidden="true" />
              <h2 id="ms-rules-title" className="ft-title">{`첫 글 쓰고\n${reward} 받아요`}</h2>
              <p className="ft-desc">이렇게 쓰면 미션으로 인정돼요.</p>
              <ul className="ms-rules">
                {rules.map((r, i) => (
                  <motion.li
                    key={r}
                    initial={{ opacity: 0, y: 10 }}
                    animate={{ opacity: 1, y: 0 }}
                    transition={{ type: 'spring', stiffness: 420, damping: 36, delay: 0.08 + i * 0.045 }}
                  >
                    <span className="ms-rules-num">{i + 1}</span>
                    <span>{r}</span>
                  </motion.li>
                ))}
              </ul>
              <div className="ft-actions">
                <button type="button" className="ft-btn primary" onClick={mission.closeRules}>
                  확인했어요
                </button>
              </div>
            </motion.div>
          </motion.div>
        )}
      </AnimatePresence>
    </MotionConfig>,
    document.body,
  );
}
