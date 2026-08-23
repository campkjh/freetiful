/**
 * 채팅이 비었을 때 나오는 말풍선 두 개.
 *
 * 참고 영상을 프레임 단위로 뜯어 보니 두 말풍선이 그냥 위아래로 오가는 게 아니라,
 * **올라가는 쪽은 미끄러지듯 이동하고, 내려가는 쪽은 제자리에서 사라지며
 * 아래에서 다시 나타난다**(크로스페이드). 그래서 말풍선마다 본체와 잔상 두 겹을 두고,
 * 본체는 안 보이는 순간에 자리를 옮긴다.
 *
 * 측정값(30fps 기준): 한 바퀴 ≈ 52프레임(1.73초), 전환 ≈ 7프레임(0.23초),
 * 이동 거리 ≈ 말풍선 높이의 0.66배. 모양만 각진 사각형 대신 타원형으로 바꿨다.
 */
function Bubble({ color, tail }: { color: string; tail: 'left' | 'right' }) {
  return (
    <svg viewBox="0 0 100 56" fill="none" className="block w-full">
      <ellipse cx="50" cy="21" rx="50" ry="21" fill={color} />
      {tail === 'left' ? (
        <path d="M24 34 C20 44 15 50 10 54 C20 53 29 47 34 39 Z" fill={color} />
      ) : (
        <path d="M76 34 C80 44 85 50 90 54 C80 53 71 47 66 39 Z" fill={color} />
      )}
      <circle cx="31" cy="21" r="5" fill="#fff" />
      <circle cx="50" cy="21" r="5" fill="#fff" />
      <circle cx="69" cy="21" r="5" fill="#fff" />
    </svg>
  );
}

export default function ChatEmptyBubbles({ size = 168, className = '' }: { size?: number; className?: string }) {
  const bubbleW = size * 0.62;
  const bubbleH = bubbleW * 0.56;
  const shift = bubbleH * 0.66; // 영상에서 잰 이동 거리

  return (
    <div
      className={`chat-empty-bubbles relative ${className}`}
      style={{ width: size, height: bubbleH + shift, ['--ceb-shift' as string]: `${shift}px` }}
      aria-hidden="true"
    >
      {/* 남색 — 위에서 시작해 크로스페이드로 내려갔다가, 미끄러지며 올라온다 */}
      <span className="ceb ceb-dark-ghost" style={{ width: bubbleW, top: 0, left: 0 }}>
        <Bubble color="#2B313D" tail="left" />
      </span>
      <span className="ceb ceb-dark" style={{ width: bubbleW, top: 0, left: 0 }}>
        <Bubble color="#2B313D" tail="left" />
      </span>

      {/* 파랑 — 아래에서 시작해 미끄러지며 올라갔다가, 크로스페이드로 내려온다 */}
      <span className="ceb ceb-blue-ghost" style={{ width: bubbleW, top: shift, right: 0 }}>
        <Bubble color="#3180F7" tail="right" />
      </span>
      <span className="ceb ceb-blue" style={{ width: bubbleW, top: shift, right: 0 }}>
        <Bubble color="#3180F7" tail="right" />
      </span>
    </div>
  );
}
