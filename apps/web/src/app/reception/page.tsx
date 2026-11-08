import Link from 'next/link';
import { RECEPTION_INFO, RECEPTION_PROGRAM } from '@/lib/reception/event';
import ProgramTimeline from '@/components/reception/ProgramTimeline';

// 식순 — 사장 견본 그림(금빛 제목 · 반짝이는 금빛 구분선)의 톤으로 사장 식순표(1부 · 2부 · 시각)를 짰다.
// 상자 없이 배경 위에 그냥 풀어 놓는다(사장 '그냥 풀어주라고' — 한 장 상자 · 카드 둘 다 아님): 왼쪽 시각(Pretendard) | 순서, 줄 사이 옅은 금빛 선.
// 시각 없는 순서는 표처럼 시각 칸을 비운다. 줄마다 아래에서 차례로 떠오른다(rc-rise, --i). 행사 날엔 지금 순서를 짚는다(ProgramTimeline).
// 제목 그림의 별빛 자리(1080×296 기준 좌표)에 진짜로 반짝이는 별을 얹는다(261108 사장 'Freetiful WMAK 빛나는 거 실제로 반짝이게') —
// 글로우 금지 규칙의 예외는 이 별뿐.
const SPARKLES: Array<[x: number, y: number, size: number, delay: number, dur: number]> = [
  [77, 59, 7, 0, 3.2],
  [758, 63, 6.4, 1.1, 2.8],
  [1045, 165, 4.6, 2.0, 3.4],
  [726, 166, 3.4, 0.6, 2.6],
  [75, 167, 3.2, 1.7, 3.0],
  [1005, 260, 3.4, 2.6, 2.9],
  [517, 125, 2.8, 0.3, 3.6],
];

function Sparkle() {
  return (
    <svg viewBox="0 0 24 24" aria-hidden="true">
      <path d="M12 0C12.5 7.6 13.4 10.6 24 12 13.4 13.4 12.5 16.4 12 24 11.5 16.4 10.6 13.4 0 12 10.6 10.6 11.5 7.6 12 0Z" />
      <circle cx="12" cy="12" r="1.6" className="rc-sparkle-core" />
    </svg>
  );
}

export default function ReceptionProgramPage() {
  return (
    <div className="rc-page rc-program">
      <header className="rc-hero">
        <div className="rc-title rc-rise">
          <img src="/reception/title.webp" alt="Freetiful & WMAK 2026 Year-End RECEPTION" className="rc-title-img" width={1080} height={296} />
          {SPARKLES.map(([x, y, size, delay, dur], k) => (
            <span
              key={k}
              className="rc-sparkle"
              style={{ left: `${(x / 1080) * 100}%`, top: `${(y / 296) * 100}%`, width: `${size}%`, animationDelay: `${delay}s`, animationDuration: `${dur}s` } as React.CSSProperties}
            >
              <Sparkle />
            </span>
          ))}
        </div>
        <div className="rc-info rc-rise" style={{ '--i': 1 } as React.CSSProperties}>
          <p className="rc-info-date">{RECEPTION_INFO.date}<span>{RECEPTION_INFO.time}</span></p>
          <p className="rc-info-place">{RECEPTION_INFO.place}</p>
        </div>
      </header>

      <ProgramTimeline startIndex={2} />

      <div className="rc-program-cta rc-rise" style={{ '--i': 4 + RECEPTION_PROGRAM.length } as React.CSSProperties}>
        <Link href="/reception/seat" className="rc-btn-gold">내 자리 확인하기</Link>
        <Link href="/reception/event" className="rc-btn-line">베스트드레서 어워즈 참여하기</Link>
      </div>
    </div>
  );
}
