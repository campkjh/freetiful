'use client';

/* 시크릿 미션 열림 모달(261118 사장 '5000원 미션 완료하면 신규미션 — 내가 올린 영상 분석해서 저런식으로, 애니메이션 100% 일치하게' + '뜰 때 진동도').
 * 사장 녹화(토스 쿠폰 모달, 60fps · 440×956)를 1/60초 단위로 잰 값 그대로 — 시작 0 = 제목 움직임 시작:
 *  · 제목: 80px 아래 → 제자리 712ms cubic-bezier(.176,.907,.277,1) + 투명 → 보임 697ms (.175,1.006,.283,.985). 크기 변화 없음.
 *  · 흰 막: 화면에 고정된 흰 그라데이션(제목 위 242px 에서 0 → 18px 위에서 불투명, α=(y/224)^1.3)이 120ms 뒤부터 480ms 동안 진해진다(잰 곡선 linear()).
 *    뒤 화면은 움직이지 않고 흐림도 없다. 맨 위(머리줄)는 그대로 보인다.
 *  · 카드: 101ms 뒤, 크기 0.8 · 100px 아래 · 투명 → 제자리. 튕김 없는 임계 감쇠 스프링(ω0 14.35 — 강성 206 · 감쇠 28.7) 650ms. 속 글자 · 버튼은 카드와 한 덩어리.
 *  · '나중에': 제목과 같은 움직임을 250ms 늦게.
 *  · 진동: 카드가 올라오기 시작할 때(lib/haptics).
 *  · 배치: 제목 26/35 굵게 → 40 → 카드 320×330(모서리 30, 안쪽 위 32 · 옆 30) → 17 → '나중에' 48 칸, 그 아래 75px + 홈 표시줄.
 * 숫자를 바꾸려면 secret-mission.css 만. */
import './secret-mission.css';
import { useEffect, useRef, useState } from 'react';
import { createPortal } from 'react-dom';
import { useBodyScrollLock } from '@/lib/hooks/useBodyScrollLock';
import { haptic } from '@/lib/haptics';
import { SECRET_PATTERN_ICONS } from './icons';

export default function SecretMissionReveal({ onGo, onClose }: { onGo: () => void; onClose: () => void }) {
  const [out, setOut] = useState(false);
  const done = useRef(false);
  useBodyScrollLock(true);

  useEffect(() => {
    // 카드가 올라오기 시작하는 때(101ms)에 맞춰 진동
    const t = window.setTimeout(() => haptic('success'), 100);
    const key = (e: KeyboardEvent) => e.key === 'Escape' && leave(onClose);
    window.addEventListener('keydown', key);
    return () => {
      window.clearTimeout(t);
      window.removeEventListener('keydown', key);
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  const leave = (then: () => void) => {
    if (done.current) return;
    done.current = true;
    setOut(true);
    window.setTimeout(then, 200);
  };

  if (typeof document === 'undefined') return null;
  return createPortal(
    // role=alertdialog — iOS 앱 네이티브 탭바는 role=dialog/aria-modal 에서만 숨는다. 녹화처럼 탭바는 막 위에 그대로 둔다
    <div className={`smr${out ? ' is-out' : ''}`} role="alertdialog" aria-labelledby="smr-title" aria-describedby="smr-desc">
      <div className="smr-stack">
        <div className="smr-veil" aria-hidden="true" />
        <h2 id="smr-title" className="smr-title">
          5,000원 미션 완료!
          <br />
          <em>시크릿 미션</em>이 열렸어요
        </h2>
        <div className="smr-card">
          <svg className="smr-pattern" aria-hidden="true">
            <defs>
              <pattern id="smr-pat" width="160" height="80" patternUnits="userSpaceOnUse" patternTransform="rotate(-22)">
                {SECRET_PATTERN_ICONS.map((d, i) => (
                  <g key={i} transform={`translate(${(i % 4) * 40 + (i >= 4 ? 20 : 0)} ${i >= 4 ? 48 : 8})`}>
                    {d.map((p) => <path key={p} d={p} fillRule="evenodd" clipRule="evenodd" />)}
                  </g>
                ))}
              </pattern>
            </defs>
            <rect width="100%" height="100%" fill="url(#smr-pat)" />
          </svg>
          <p className="smr-card-head">화장품 세트</p>
          <p id="smr-desc" className="smr-card-sub">
            4만원 상당 · 추첨으로 드려요
            <br />
            인스타 스토리에 태그만 하면 돼요
          </p>
          <button type="button" className="smr-card-btn" onClick={() => leave(onGo)}>
            참여하기
          </button>
        </div>
        <button type="button" className="smr-later" onClick={() => leave(onClose)}>
          나중에
        </button>
      </div>
    </div>,
    document.body,
  );
}
