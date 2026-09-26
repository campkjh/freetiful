// 홈 헤더 종·돋보기 — 사장 시안(260926, 3배 캔버스)을 픽셀로 재서 좌표를 그대로 옮겼다.
//  · 한 칸 = 132×132(시안 px) = 44pt. 종 몸통 가운데 (110, 86.5), 돋보기 가운데 (242, 86) — 두 칸을 붙이면 시안 간격(44pt) 그대로.
//  · 선 = #191F28, 종 6 · 돋보기 6.8(시안 실측). 빨간 점 #EC6964 은 종과 떨어져 오른쪽 위 — 안 읽은 알림 있을 때만.
const INK = '#191F28';

export function HeaderBellIcon({ dot = false, size = 44 }: { dot?: boolean; size?: number }) {
  return (
    <svg width={size} height={size} viewBox="44 20.5 132 132" fill="none" aria-hidden="true" className="shrink-0">
      <path
        d="M83 88V78A27 27 0 0 1 137 78V88L141.3 95C143 97.8 141.5 105 137 105H83C78.5 105 77 97.8 78.7 95Z"
        stroke={INK}
        strokeWidth="6"
        strokeLinejoin="round"
      />
      <path d="M97 105V109A13 13 0 0 0 123 109V105" stroke={INK} strokeWidth="6" strokeLinejoin="round" />
      {dot && <circle cx="148" cy="47.5" r="10.75" fill="#EC6964" />}
    </svg>
  );
}

export function HeaderSearchIcon({ size = 44 }: { size?: number }) {
  return (
    <svg width={size} height={size} viewBox="176 20 132 132" fill="none" aria-hidden="true" className="shrink-0">
      <circle cx="236" cy="80" r="26.5" stroke={INK} strokeWidth="6.8" />
      <path d="M254.7 98.7L274.1 118.1" stroke={INK} strokeWidth="6.8" strokeLinecap="round" />
    </svg>
  );
}

/** 검색을 닫을 때 돋보기 자리에 오는 X — 돋보기와 같은 굵기(6.8/132 → 44px 에서 약 2.3px) */
export function HeaderCloseIcon({ size = 44 }: { size?: number }) {
  return (
    <svg width={size} height={size} viewBox="0 0 132 132" fill="none" aria-hidden="true" className="shrink-0">
      <path d="M43 43L89 89M89 43L43 89" stroke={INK} strokeWidth="6.8" strokeLinecap="round" />
    </svg>
  );
}
