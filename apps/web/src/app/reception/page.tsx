import Link from 'next/link';
import { RECEPTION_INFO, RECEPTION_PROGRAM } from '@/lib/reception/event';

// 식순 — 사장 견본 그림(금빛 제목 · 흰 글씨 순서 · 반짝이는 금빛 구분선) 그대로를 글자로 다시 짰다(화면 폭마다 또렷하게).
// 1부 · 2부 사이는 견본처럼 빈 칸으로만 나눈다. 순서마다 아래에서 차례로 떠오른다(rc-rise, --i).
export default function ReceptionProgramPage() {
  const parts = [1, 2].map((part) => RECEPTION_PROGRAM.filter((p) => p.part === part));
  let i = 0;
  return (
    <div className="rc-page rc-program">
      <header className="rc-hero">
        <img src="/reception/title.webp" alt="Freetiful & WMAK 2026 Year-End RECEPTION" className="rc-title-img rc-rise" width={1080} height={296} />
        <div className="rc-info rc-rise" style={{ '--i': 1 } as React.CSSProperties}>
          <p className="rc-info-date">{RECEPTION_INFO.date}<span>{RECEPTION_INFO.time}</span></p>
          <p className="rc-info-place">{RECEPTION_INFO.place}</p>
          <p className="rc-dress">
            <span className="rc-dress-label">Dress Code</span>
            <span className="rc-dress-navy">Navy</span>
            <span className="rc-dress-amp">&amp;</span>
            <span className="rc-dress-pink">Baby Pink</span>
          </p>
        </div>
      </header>

      <section aria-label="식순" className="rc-program-list">
        {parts.map((items, pi) => (
          <ol key={pi} className="rc-program-part" start={pi === 0 ? 1 : RECEPTION_PROGRAM.filter((p) => p.part === 1).length + 1}>
            {items.map((item) => {
              const n = i++;
              return (
                <li key={item.title} className="rc-program-row rc-rise" style={{ '--i': n + 2 } as React.CSSProperties}>
                  <span className="rc-program-title">{item.title}</span>
                  <img src="/reception/divider.webp" alt="" aria-hidden="true" className="rc-divider" width={830} height={99} />
                </li>
              );
            })}
          </ol>
        ))}
      </section>

      <div className="rc-program-cta rc-rise" style={{ '--i': RECEPTION_PROGRAM.length + 3 } as React.CSSProperties}>
        <Link href="/reception/seat" className="rc-btn-gold">내 자리 확인하기</Link>
        <Link href="/reception/event" className="rc-btn-line">포토 이벤트 참여하기</Link>
      </div>
    </div>
  );
}
