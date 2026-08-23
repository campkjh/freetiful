/**
 * 채팅이 비었을 때 나오는 말풍선 두 개.
 *
 * 참고한 화면처럼 두 말풍선이 서로 자리를 바꾼다 — 하나가 내려가면 다른 하나가
 * 올라오고, 바뀌는 순간 살짝 흐려졌다가 앞뒤(z) 도 함께 뒤집힌다.
 * 색은 초록 대신 앱 키컬러(남색 + 파랑)로 맞췄다.
 */
function Bubble({ color, tail }: { color: string; tail: 'left' | 'right' }) {
  return (
    <svg viewBox="0 0 100 54" fill="none" className="block w-full">
      <rect x="0" y="0" width="100" height="42" rx="14" fill={color} />
      {tail === 'left' ? (
        <path d="M13 38 L13 53 Q13 54 14 53 L29 40 Z" fill={color} />
      ) : (
        <path d="M87 38 L87 53 Q87 54 86 53 L71 40 Z" fill={color} />
      )}
      <circle cx="32" cy="21" r="5" fill="#fff" />
      <circle cx="50" cy="21" r="5" fill="#fff" />
      <circle cx="68" cy="21" r="5" fill="#fff" />
    </svg>
  );
}

export default function ChatEmptyBubbles({ size = 168, className = '' }: { size?: number; className?: string }) {
  const bubbleW = size * 0.64;
  const bubbleH = bubbleW * 0.54;
  const shift = bubbleH * 0.55; // 두 말풍선이 겹치는 정도 = 자리를 바꿀 때 움직이는 거리

  return (
    <div
      className={`chat-empty-bubbles relative ${className}`}
      style={{ width: size, height: bubbleH + shift, ['--ceb-shift' as string]: `${shift}px` }}
      aria-hidden="true"
    >
      <span className="ceb ceb-a" style={{ width: bubbleW, top: 0, left: 0 }}>
        <Bubble color="#2B313D" tail="left" />
      </span>
      <span className="ceb ceb-b" style={{ width: bubbleW, top: shift, right: 0 }}>
        <Bubble color="#3180F7" tail="right" />
      </span>
    </div>
  );
}
