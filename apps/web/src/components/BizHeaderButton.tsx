'use client';

import { useEffect, useLayoutEffect, useRef, useState, type CSSProperties } from 'react';
import Link from 'next/link';
import { usePathname, useRouter } from 'next/navigation';
import { QuickMatchBubbleGlass } from '@/components/home/TossBubble';

/*
 * PC 머리줄 '프리티풀 비즈' 버튼 + 첫 진입 말풍선(261007 사장 'PC 상단 헤더 홈 옆에 프리티풀 비즈 버튼 따로,
 * 첫 진입 때 모바일 퀵매칭 말풍선처럼 — 애니메이션·디자인 완전 그대로, 아이콘이랑 색상만 바꿔서').
 *  · 말풍선 = 홈 퀵매칭 말풍선(globals .qm-bubble*, 바탕 유리 TossBubble)과 같은 칸·같은 움직임. 색만 .qm-bubble.biz 로 덧칠.
 *  · 아이콘 = 사장이 준 파란 폴더(261007 '하단 메뉴(카테고리 비즈 = 가죽 가방)는 그대로, 헤더 아이콘이랑 말풍선만 이걸로') —
 *    흰 바탕을 걷어낸 투명 PNG(폴더 안 흰 종이는 그대로). 버튼·말풍선 색도 폴더 하늘색 결로(처음 가방 때는 캐러멜).
 *  · 꼬리 끝 = 버튼 아래 5 · 버튼 가운데(모바일과 같은 간격). 첫 진입(페이지를 새로 열 때), 첫 화면 창들이 닫힌 뒤 — 머리줄은 화면을 옮겨도 그대로라
 *    한 번 뜬 뒤 다른 화면으로 가면 접는다. × = 30분 숨김(모바일과 같은 규칙), 말풍선·버튼을 누르면 /biz 로 가며 같이 숨김.
 *  · 머리줄 자체가 PC 전용(lg)이라 모바일엔 없다 — 넓은 화면일 때만 띄운다.
 */
const BIZ_BUBBLE_HIDE_KEY = 'ft-pc-biz-bubble-hide-until';
const BIZ_BUBBLE_HIDE_MS = 30 * 60 * 1000;
const BIZ_BUBBLE_GAP = 5;
/** 말풍선 왼쪽에서 꼬리 끝까지 — 버튼 가운데에 꼬리가 오도록 말풍선을 이만큼 왼쪽으로 */
const BIZ_BUBBLE_TAIL_X = 64;
/**
 * 말풍선 폭 — 글자 폭에 맞춘다(max-content), 이 값은 최소 폭. 예전엔 352 고정이라 제목 '기업 행사도 웨딩홀도 프리티풀 비즈로.'가
 * 글씨 칸(352 − 아이콘 64 − × 42)보다 길어 말줄임(…)으로 잘렸다(261009 검증). 홈 첫 진입 왼쪽 꼬리 판(BizSwipeHint)도 같은 max-content
 */
const BIZ_BUBBLE_WIDTH = 352;
const BIZ_BUBBLE_MAX_WIDTH = 460;
const BIZ_ICON = '/images/icons/biz-folder.png';

export default function BizHeaderButton() {
  const router = useRouter();
  const pathname = usePathname();
  const btnRef = useRef<HTMLAnchorElement>(null);
  const firstPath = useRef(pathname);
  const [phase, setPhase] = useState<'hidden' | 'in' | 'out'>('hidden');
  const [left, setLeft] = useState<number | null>(null);
  const [top, setTop] = useState(0);

  // 첫 진입 — 첫 화면 창(빌라드지디·가입 5천원 팝업 등 aria-modal 창)이 떠 있으면 다 닫히고 1.2초 조용할 때 띄운다
  // (같이 뜨면 말풍선이 팝업 뒤 어두운 바탕에 묻혀 등장 애니메이션을 못 본다). 창이 없으면 첫 진입 약 1.2초 뒤.
  useEffect(() => {
    if (!window.matchMedia?.('(min-width: 1024px)').matches) return;
    try { if (Number(localStorage.getItem(BIZ_BUBBLE_HIDE_KEY) || 0) > Date.now()) return; } catch { /* 저장소 막힘 — 그냥 띄운다 */ }
    const start = Date.now();
    let quietSince = 0;
    let timer = 0;
    const tick = () => {
      const now = Date.now();
      if (document.querySelector('[role="dialog"][aria-modal="true"]')) quietSince = 0;
      else if (!quietSince) quietSince = now;
      if (now - start >= 850 && quietSince && now - quietSince >= 1200) {
        setPhase((p) => (p === 'hidden' ? 'in' : p));
        return;
      }
      if (now - start > 120_000) return; // 2분 넘게 창이 떠 있으면 이번엔 쉰다
      timer = window.setTimeout(tick, 200);
    };
    timer = window.setTimeout(tick, 200);
    return () => window.clearTimeout(timer);
  }, []);

  useLayoutEffect(() => {
    if (phase === 'hidden') return;
    const btn = btnRef.current;
    if (!btn) return;
    const measure = () => {
      setTop(btn.offsetHeight + BIZ_BUBBLE_GAP);
      setLeft(Math.round(btn.offsetWidth / 2 - BIZ_BUBBLE_TAIL_X));
    };
    measure();
    const ro = new ResizeObserver(measure);
    ro.observe(btn);
    return () => ro.disconnect();
  }, [phase]);

  const fold = (remember: boolean) => {
    if (remember) {
      try { localStorage.setItem(BIZ_BUBBLE_HIDE_KEY, String(Date.now() + BIZ_BUBBLE_HIDE_MS)); } catch { /* 이번만 닫힘 */ }
    }
    setPhase((p) => (p === 'in' ? 'out' : p));
    window.setTimeout(() => setPhase('hidden'), 200);
  };

  // 다른 화면으로 옮기면 접는다(머리줄은 그대로 남아 있어서)
  useEffect(() => {
    if (pathname !== firstPath.current && phase === 'in') fold(false);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [pathname]);

  const go = () => {
    fold(true);
    router.push('/biz');
  };
  const close = (e: React.MouseEvent) => {
    e.stopPropagation();
    fold(true);
  };
  const active = pathname === '/biz' || pathname.startsWith('/biz/');

  return (
    <div className="relative">
      <Link
        ref={btnRef}
        href="/biz"
        onClick={() => { if (phase === 'in') fold(true); }}
        className={`flex h-[38px] items-center gap-1.5 whitespace-nowrap rounded-[14px] pl-2.5 pr-3.5 text-[13px] font-bold tracking-[-0.2px] text-[#1B6FD1] transition-colors duration-200 ${
          active ? 'bg-[#D3E8FD]' : 'bg-[#EAF4FE] hover:bg-[#DDEEFD]'
        }`}
      >
        {/* eslint-disable-next-line @next/next/no-img-element -- public 정적 아이콘 */}
        <img src={BIZ_ICON} alt="" width={22} height={22} className="h-[22px] w-[22px] shrink-0 object-contain" />
        프리티풀 비즈
      </Link>
      {phase !== 'hidden' && left !== null && (
        <div
          className={`qm-bubble biz${phase === 'out' ? ' is-out' : ''}`}
          style={{ top, left, width: 'max-content', minWidth: BIZ_BUBBLE_WIDTH, maxWidth: BIZ_BUBBLE_MAX_WIDTH, '--tail-x': `${BIZ_BUBBLE_TAIL_X}px` } as CSSProperties}
          role="link"
          tabIndex={0}
          aria-label="기업 행사도 웨딩홀도 프리티풀 비즈로. 기업행사 MC · 웨딩홀 전속 사회자 섭외"
          onClick={go}
          onKeyDown={(e) => { if (e.key === 'Enter') go(); }}
        >
          {/* 그림자 → 유리(꼬리+몸통 한 장) → 글씨 — 홈 퀵매칭 말풍선과 같은 칸 */}
          <span className="qm-bubble-shadow" aria-hidden="true" />
          <QuickMatchBubbleGlass tailX={BIZ_BUBBLE_TAIL_X} />
          <div className="qm-bubble-body">
            <span className="qm-bubble-ic" aria-hidden="true">
              {/* eslint-disable-next-line @next/next/no-img-element -- 사장이 준 파란 폴더 */}
              <img src={BIZ_ICON} alt="" width={28} height={28} />
            </span>
            <p className="qm-bubble-title">기업 행사도 웨딩홀도 프리티풀 비즈로.</p>
            <p className="qm-bubble-sub">기업행사 MC · 웨딩홀 전속 사회자 섭외</p>
            <button type="button" className="qm-bubble-x" aria-label="말풍선 닫기" onClick={close}>
              <svg width="8" height="8" viewBox="0 0 8 8" fill="none" aria-hidden="true">
                <path d="M1 1l6 6M7 1L1 7" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" />
              </svg>
            </button>
          </div>
        </div>
      )}
    </div>
  );
}
