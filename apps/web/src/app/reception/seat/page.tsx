'use client';

// 자리 — 처음엔 이름 입력(사장 '처음에 거기 클릭하면 이름 입력 → 본인 자리'), 입력하면 자리 배치도에서 내 테이블·좌석을 빛낸다.
// 자리는 지금 임시 배정(lib/reception/event.ts seatFor — 같은 이름은 어느 폰에서든 같은 자리). 실제 배정표가 오면 SEAT_ASSIGNMENTS 만 채우면 된다.
// 상자 없이 배경 위에 그냥 풀어 놓는다(261108 사장 '자리 ui도 풀어줘'). 배치도 = 받은 도면 그대로(261116, components/reception/HallMap).
import { useState } from 'react';
import HallMap from '@/components/reception/HallMap';
import { NameGateInline } from '@/components/reception/NameGate';
import { PencilIcon } from '@/components/reception/ReceptionIcons';
import { seatFor } from '@/lib/reception/event';
import { useReceptionGuest } from '@/lib/reception/guest';

export default function ReceptionSeatPage() {
  const guest = useReceptionGuest();
  const [editing, setEditing] = useState(false);
  const name = guest?.name || '';
  const seat = name ? seatFor(name) : null;

  if (!guest) return <div className="rc-page" />;

  if (!name || editing) {
    return (
      <div className="rc-page rc-seat-page">
        <NameGateInline
          initial={name}
          cta="내 자리 확인"
          hint="입력한 성함으로 자리를 찾아 드려요. 베스트드레서 어워즈·설문에도 이 이름이 쓰여요."
          onDone={() => setEditing(false)}
          onClose={name ? () => setEditing(false) : undefined}
        />
      </div>
    );
  }

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

      <section className="rc-rise" style={{ '--i': 1 } as React.CSSProperties} aria-label="자리 배치도">
        <HallMap table={seat!.table} seat={seat!.seat} />
      </section>
    </div>
  );
}
