/**
 * 채팅이 비었을 때 나오는 말풍선 두 개.
 *
 * 참고 영상을 30fps 로 뜯어 보니 두 말풍선이 위아래로 오가는 게 아니라
 * **말풍선이 앞(아래)에서 새로 생기고, 원래 앞에 있던 건 뒤(위)로 밀려 올라가고,
 * 뒤에 있던 건 그 자리에서 사라진다.** 대화가 쌓이는 모습 그대로다.
 * 새로 생길 때는 살짝 기울어진 채 튀어오르듯 들어온다.
 *
 * 측정값: 한 바퀴 ≈ 1.73초(→1.8초), 전환 ≈ 0.23초(13%),
 * 밀려 올라가는 거리 ≈ 말풍선 높이의 0.55배.
 * 모양은 토스 문의 아이콘 형태의 둥근 말풍선.
 */
const BUBBLE_PATH =
  'M12 2.259C6.589 2.259 2.186 6.261 2.186 11.181C2.186 13.287 3.077 16.153 5.557 18.002L5.265 21.058' +
  'C5.243 21.287 5.349 21.509 5.541 21.637C5.645 21.707 5.766 21.741 5.886 21.741C5.988 21.741 6.089 21.716 6.182 21.667' +
  'L9.365 19.956C9.762 19.995 10.925 20.103 12.001 20.103C17.412 20.103 21.815 16.101 21.815 11.181' +
  'C21.814 6.261 17.411 2.259 12 2.259Z';

function Bubble({ color, flip = false }: { color: string; flip?: boolean }) {
  return (
    <svg viewBox="0 0 24 24" fill="none" className="block w-full">
      <g transform={flip ? 'translate(24,0) scale(-1,1)' : undefined}>
        <path d={BUBBLE_PATH} fill={color} />
        <circle cx="7.532" cy="11.19" r="1.24" fill="#fff" />
        <circle cx="11.998" cy="11.19" r="1.24" fill="#fff" />
        <circle cx="16.461" cy="11.19" r="1.24" fill="#fff" />
      </g>
    </svg>
  );
}

export default function ChatEmptyBubbles({ size = 168, className = '' }: { size?: number; className?: string }) {
  const bubble = size * 0.64; // 아이콘이 정사각이라 가로=세로
  const shift = bubble * 0.44; // 뒤로 밀려 올라가는 거리 — 두 말풍선이 살짝 겹치도록

  return (
    <div
      className={`chat-empty-bubbles relative ${className}`}
      style={{ width: size, height: bubble + shift, ['--ceb-shift' as string]: `${shift}px` }}
      aria-hidden="true"
    >
      {/* 남색 — 뒤에서 사라지는 잔상 */}
      <span className="ceb ceb-dark-ghost" style={{ width: bubble, top: 0, left: 0 }}>
        <Bubble color="#2B313D" />
      </span>
      {/* 남색 — 앞에서 튀어 들어와 뒤로 밀려 올라간다 */}
      <span className="ceb ceb-dark" style={{ width: bubble, top: 0, left: 0 }}>
        <Bubble color="#2B313D" />
      </span>

      {/* 파랑 */}
      <span className="ceb ceb-blue-ghost" style={{ width: bubble, top: shift, right: 0 }}>
        <Bubble color="#3180F7" flip />
      </span>
      <span className="ceb ceb-blue" style={{ width: bubble, top: shift, right: 0 }}>
        <Bubble color="#3180F7" flip />
      </span>
    </div>
  );
}
