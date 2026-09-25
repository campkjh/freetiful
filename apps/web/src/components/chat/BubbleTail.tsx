/**
 * 말풍선 꼬리 — 사장이 준 도형(Downloads/Bubble/1 line/Vector.svg · 16×18, 2026-09-25) 그대로.
 *  · 묶음(같은 사람이 연달아 보낸 말)의 **마지막 말풍선** 아래 바깥 모서리에만 붙인다(iMessage 어법).
 *  · 색은 말풍선 바탕색으로 칠한다(currentColor) — 이음새가 안 보이게.
 *  · 맞물림(헤드리스 확대 실측으로 고름): 꼬리의 세로 줄기 바깥선(x=6)이 말풍선 옆선, y=14 가 말풍선 아랫선.
 *    꼬리 끝은 아랫선보다 3px 남짓 아래로 내려온다. 말풍선의 그 모서리는 TAIL_CORNER(8)로 줄여야
 *    꼬리 안에 완전히 덮인다(20 그대로면 꼬리와 모서리 사이에 흰 틈이 생긴다).
 *  · 내 말풍선(오른쪽)은 같은 도형을 좌우 반전(사장이 준 파란 파일과 같은 모양).
 *  · 새 말풍선이 튀어나올 때(bubblePop)는 말풍선 모서리 점을 기준으로 같이 커져 한 덩어리로 보인다.
 */
const TAIL_PATH =
  'M1.18357 17.3377C-0.111638 17.3377 -0.464878 15.7977 0.736136 15.3694C3.85642 14.2679 5.97645 11.5755 6 8.60767V0H8.41321V0.90768C8.41321 5.50727 10.827 9.74992 14.8539 12.4424C15.1601 12.6463 15.3367 12.9727 15.3014 13.3092C15.2778 13.6458 15.0659 13.9518 14.7244 14.1251C10.7093 16.1751 5.97586 17.3173 1.18357 17.3377Z';

/** 꼬리가 붙는 모서리의 둥글기 — 이보다 크면 꼬리 밖으로 삐져나온다 */
export const TAIL_CORNER_CLASS = { mine: 'rounded-br-[8px]', other: 'rounded-bl-[8px]' } as const;

export default function BubbleTail({
  mine,
  color,
  pop,
  dim,
}: {
  mine: boolean;
  /** 말풍선 바탕색 */
  color: string;
  /** 새 말풍선 튀어나오는 애니메이션을 같이 탄다 */
  pop?: boolean;
  /** 말풍선이 흐리게(만료 파일 등) 그려질 때 같이 흐리게 */
  dim?: boolean;
}) {
  return (
    <svg
      aria-hidden="true"
      width="16"
      height="18"
      viewBox="0 0 16 18"
      className={`pointer-events-none absolute bottom-[-4px] ${mine ? 'right-[-6px]' : 'left-[-6px]'} ${
        pop ? 'animate-[bubblePop_0.5s_cubic-bezier(0.34,1.56,0.64,1)]' : ''
      }`}
      // 말풍선 아래 바깥 모서리 = 꼬리 좌표 (6,14) · 반전하면 (10,14)
      style={{ color, opacity: dim ? 0.6 : undefined, transformOrigin: mine ? '10px 14px' : '6px 14px' }}
    >
      <path d={TAIL_PATH} fill="currentColor" transform={mine ? 'matrix(-1 0 0 1 16 0)' : undefined} />
    </svg>
  );
}
