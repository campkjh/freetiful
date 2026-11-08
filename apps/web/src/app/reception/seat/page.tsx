'use client';

// 자리 — 처음엔 이름 입력(사장 '처음에 거기 클릭하면 이름 입력 → 본인 자리'), 입력하면 자리 배치표에서 내 테이블·좌석을 빛낸다.
// 자리는 지금 임시 배정(lib/reception/event.ts seatFor — 같은 이름은 어느 폰에서든 같은 자리). 실제 배정표가 오면 SEAT_ASSIGNMENTS 만 채우면 된다.
// 상자 없이 배경 위에 그냥 풀어 놓는다(261108 사장 '자리 ui도 풀어줘'). 테이블은 원탁, 좌석은 의자 모양 — 등받이가 바깥, 앉는 쪽이 테이블을 본다.
import { useEffect, useRef, useState } from 'react';
import { NameGateInline } from '@/components/reception/NameGate';
import { PencilIcon } from '@/components/reception/ReceptionIcons';
import { SEATS_PER_TABLE, TABLES_PER_ROW, TABLE_COUNT, seatFor } from '@/lib/reception/event';
import { useReceptionGuest } from '@/lib/reception/guest';

/** 의자(위에서 본 팔걸이 의자) — 위쪽이 등받이, 아래쪽(방석)이 테이블 쪽. 자리마다 돌려서 놓는다 */
function Chair() {
  return (
    <svg viewBox="0 0 24 24" aria-hidden="true">
      <path d="M3 6.2C3 3.9 4.9 2 7.2 2h9.6C19.1 2 21 3.9 21 6.2V8H3z" />
      <rect x="2" y="6.5" width="4.4" height="14" rx="2.2" />
      <rect x="17.6" y="6.5" width="4.4" height="14" rx="2.2" />
      <rect x="7.2" y="8.6" width="9.6" height="12.4" rx="2.6" className="rc-chair-seat" />
    </svg>
  );
}

function Table({ n, mine, seat }: { n: number; mine: boolean; seat: number }) {
  return (
    <div className={`rc-table ${mine ? 'mine' : ''}`} data-table={n} aria-label={`${n}번 테이블${mine ? ' — 내 테이블' : ''}`}>
      {Array.from({ length: SEATS_PER_TABLE }, (_, s) => {
        const a = (s / SEATS_PER_TABLE) * Math.PI * 2 - Math.PI / 2;
        const me = mine && s + 1 === seat;
        return (
          <span
            key={s}
            className={`rc-seat ${me ? 'me' : ''}`}
            style={{ left: `${50 + Math.cos(a) * 42}%`, top: `${50 + Math.sin(a) * 42}%`, '--rot': `${(a + Math.PI / 2) * (180 / Math.PI)}deg` } as React.CSSProperties}
            aria-hidden="true"
          >
            <Chair />
          </span>
        );
      })}
      <span className="rc-table-top">
        <span className="rc-table-no">{n}</span>
      </span>
    </div>
  );
}

export default function ReceptionSeatPage() {
  const guest = useReceptionGuest();
  const [editing, setEditing] = useState(false);
  const map = useRef<HTMLDivElement>(null);
  const name = guest?.name || '';
  const seat = name ? seatFor(name) : null;

  // 내 테이블이 화면에 들어오게
  useEffect(() => {
    if (!seat || editing) return;
    const t = setTimeout(() => {
      map.current?.querySelector(`[data-table="${seat.table}"]`)?.scrollIntoView({ behavior: 'smooth', block: 'center' });
    }, 700);
    return () => clearTimeout(t);
  }, [seat?.table, editing]); // eslint-disable-line react-hooks/exhaustive-deps

  if (!guest) return <div className="rc-page" />;

  if (!name || editing) {
    return (
      <div className="rc-page rc-seat-page">
        <NameGateInline
          initial={name}
          cta="내 자리 확인"
          hint="입력한 성함으로 자리를 찾아 드려요. 포토 이벤트·설문에도 이 이름이 쓰여요."
          onDone={() => setEditing(false)}
          onClose={name ? () => setEditing(false) : undefined}
        />
      </div>
    );
  }

  const rows = Math.ceil(TABLE_COUNT / TABLES_PER_ROW);
  return (
    <div className="rc-page rc-seat-page">
      <section className="rc-seat-card rc-rise" aria-live="polite">
        <p className="rc-eyebrow">Your Seat</p>
        <p className="rc-seat-who">
          <b>{name}</b> 님의 자리
          <button type="button" className="rc-text-btn" onClick={() => setEditing(true)}>
            <PencilIcon size={14} />이름 바꾸기
          </button>
        </p>
        <p className="rc-seat-table rc-gold-text">TABLE {seat!.table}</p>
        <p className="rc-seat-detail">{seat!.table}번 테이블 · {seat!.seat}번 좌석</p>
        {!seat!.assigned && <p className="rc-seat-note">좌석은 현장 사정에 따라 바뀔 수 있어요.</p>}
        <img src="/reception/divider.webp" alt="" aria-hidden="true" className="rc-divider" width={830} height={99} />
      </section>

      <section className="rc-hall rc-rise" style={{ '--i': 1 } as React.CSSProperties} aria-label="자리 배치표">
        <div className="rc-stage"><span>STAGE</span></div>
        <div className="rc-tables" ref={map} style={{ gridTemplateColumns: `repeat(${TABLES_PER_ROW}, 1fr)` }}>
          {Array.from({ length: rows * TABLES_PER_ROW }, (_, i) => i + 1).map((n) =>
            n <= TABLE_COUNT ? <Table key={n} n={n} mine={n === seat!.table} seat={seat!.seat} /> : <span key={n} />,
          )}
        </div>
        <div className="rc-entrance"><span>입구</span></div>
      </section>
    </div>
  );
}
