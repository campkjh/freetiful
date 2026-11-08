import Link from 'next/link';
import { RECEPTION_INFO, RECEPTION_PROGRAM } from '@/lib/reception/event';

// 식순 — 사장 견본 그림(금빛 제목 · 반짝이는 금빛 구분선)의 톤으로 사장 식순표(1부 · 2부 · 시각)를 짰다.
// 상자 없이 배경 위에 그냥 풀어 놓는다(사장 '그냥 풀어주라고' — 한 장 상자 · 카드 둘 다 아님): 왼쪽 시각(Pretendard) | 순서, 줄 사이 옅은 금빛 선.
// 시각 없는 순서는 표처럼 시각 칸을 비운다. 줄마다 아래에서 차례로 떠오른다(rc-rise, --i).
const PART_LABEL = { 1: 'Part I', 2: 'Part II' } as const;

export default function ReceptionProgramPage() {
  const parts = ([1, 2] as const).map((part) => ({ part, items: RECEPTION_PROGRAM.filter((p) => p.part === part) }));
  let i = 2;
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
        {parts.map(({ part, items }) => (
          <div key={part} className="rc-program-part">
            <h2 className="rc-part-head rc-rise" style={{ '--i': i++ } as React.CSSProperties}>
              <span className="rc-part-eyebrow">{PART_LABEL[part]}</span>
              <span className="rc-part-title">{part}부</span>
              <img src="/reception/divider.webp" alt="" aria-hidden="true" className="rc-divider" width={830} height={99} />
            </h2>
            <ol className="rc-program-rows">
              {items.map((item, k) => (
                <li key={k} className="rc-prow rc-rise" style={{ '--i': i++ } as React.CSSProperties}>
                  <span className="rc-tl-time">{item.time && <time>{item.time}</time>}</span>
                  <div className="rc-tl-body">
                    <p className="rc-tl-title">
                      {item.title}
                      {item.tag && <span className="rc-tl-tag">{item.tag}</span>}
                    </p>
                    {item.note && <p className="rc-tl-note">{item.note}</p>}
                    {item.sub && (
                      <ul className="rc-tl-sub">
                        {item.sub.map((s) => <li key={s}>{s}</li>)}
                      </ul>
                    )}
                  </div>
                </li>
              ))}
            </ol>
          </div>
        ))}
      </section>

      <div className="rc-program-cta rc-rise" style={{ '--i': i } as React.CSSProperties}>
        <Link href="/reception/seat" className="rc-btn-gold">내 자리 확인하기</Link>
        <Link href="/reception/event" className="rc-btn-line">포토 이벤트 참여하기</Link>
      </div>
    </div>
  );
}
