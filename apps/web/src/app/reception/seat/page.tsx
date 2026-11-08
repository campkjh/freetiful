'use client';

// 자리 — 처음엔 이름 입력(사장 '처음에 거기 클릭하면 이름 입력 → 본인 자리'), 입력하면 자리 배치표에서 내 테이블·좌석을 빛낸다.
// 자리는 지금 임시 배정(lib/reception/event.ts seatFor — 같은 이름은 어느 폰에서든 같은 자리). 실제 배정표가 오면 SEAT_ASSIGNMENTS 만 채우면 된다.
import { useEffect, useRef, useState } from 'react';
import { NameGateInline } from '@/components/reception/NameGate';
import { PencilIcon } from '@/components/reception/ReceptionIcons';
import { SEATS_PER_TABLE, TABLES_PER_ROW, TABLE_COUNT, seatFor } from '@/lib/reception/event';
import { useReceptionGuest } from '@/lib/reception/guest';

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
            style={{ left: `${50 + Math.cos(a) * 46}%`, top: `${50 + Math.sin(a) * 46}%` }}
            aria-hidden="true"
          />
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
      <section className="rc-glass rc-seat-card rc-rise" aria-live="polite">
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
      </section>

      <section className="rc-glass rc-hall rc-rise" style={{ '--i': 1 } as React.CSSProperties} aria-label="자리 배치표">
        <div className="rc-stage"><span>STAGE</span></div>
        <div className="rc-tables" ref={map} style={{ gridTemplateColumns: `repeat(${TABLES_PER_ROW}, 1fr)` }}>
          {Array.from({ length: rows * TABLES_PER_ROW }, (_, i) => i + 1).map((n) =>
            n <= TABLE_COUNT ? <Table key={n} n={n} mine={n === seat!.table} seat={seat!.seat} /> : <span key={n} />,
          )}
        </div>
        <div className="rc-entrance"><span>입구</span></div>
        <p className="rc-legend"><span className="rc-legend-dot" />내 좌석</p>
      </section>
    </div>
  );
}
