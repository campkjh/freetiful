'use client';

// 자리 — 처음엔 이름 입력(사장 '처음에 거기 클릭하면 이름 입력 → 본인 자리'), 입력하면 자리 배치도에서 내 테이블·좌석을 빛낸다.
// 자리 = 어드민 '자리 명단'이 있으면 명단(서버 PUT /guest 가 찾아 줌), 명단이 비어 있으면 이름으로 정한 임시 자리(lib/reception/event.ts seatFor).
// 자리 카드 바로 아래 럭키드로우 응모권(261122 사장 '이름 입력하면 자리 알려주고 럭키드로우가 출력되게끔') — 15초마다 다시 받아 발급·당첨을 갱신.
// 상자 없이 배경 위에 그냥 풀어 놓는다(261108 사장 '자리 ui도 풀어줘'). 배치도 = 받은 도면 그대로(261116, components/reception/HallMap).
import { useState } from 'react';
import HallMap from '@/components/reception/HallMap';
import LuckyTicket from '@/components/reception/LuckyTicket';
import { NameGateInline } from '@/components/reception/NameGate';
import { PencilIcon } from '@/components/reception/ReceptionIcons';
import { useReceptionGuest } from '@/lib/reception/guest';
import { resolveSeat, useReceptionMe } from '@/lib/reception/me';

const POLL_MS = 15000;

export default function ReceptionSeatPage() {
  const guest = useReceptionGuest();
  const [editing, setEditing] = useState(false);
  const name = guest?.name || '';
  const { me, status, reload } = useReceptionMe(guest, POLL_MS);
  const seat = resolveSeat(me, name);

  if (!guest) return <div className="rc-page" />;

  if (!name || editing) {
    return (
      <div className="rc-page rc-seat-page">
        <NameGateInline
          initial={name}
          cta="내 자리 확인"
          hint="입력한 성함으로 자리를 찾고 럭키드로우 응모권을 드려요. 베스트드레서 어워즈·설문에도 이 이름이 쓰여요."
          onDone={() => setEditing(false)}
          onClose={name ? () => setEditing(false) : undefined}
        />
      </div>
    );
  }

  const table = seat && seat.kind !== 'missing' ? seat.table : null;
  const seatNo = seat && seat.kind !== 'missing' ? seat.seat : null;

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
        {!seat ? (
          status === 'error' ? (
            <div className="rc-seat-missing">
              <p>자리를 불러오지 못했어요.</p>
              <button type="button" className="rc-btn-line sm" onClick={() => reload()}>다시 불러오기</button>
            </div>
          ) : (
            <p className="rc-seat-wait" aria-busy="true">자리를 찾고 있어요</p>
          )
        ) : seat.kind === 'missing' ? (
          <div className="rc-seat-missing">
            <p>명단에서 성함을 찾지 못했어요.<br />입구 안내 데스크에 말씀해 주세요.</p>
            <p className="rc-seat-note">명단과 다른 이름으로 넣었다면 이름을 바꿔 보세요.</p>
          </div>
        ) : (
          <>
            <p className="rc-seat-table rc-gold-text">TABLE {seat.table}</p>
            <p className="rc-seat-detail">{seat.table}번 테이블{seat.seat ? ` · ${seat.seat}번 좌석` : ''}</p>
            {seat.kind === 'temp' && <p className="rc-seat-note">좌석은 현장 사정에 따라 바뀔 수 있어요.</p>}
            {seat.kind === 'listed' && !seat.seat && <p className="rc-seat-note">테이블 안에서는 편한 자리에 앉아 주세요.</p>}
          </>
        )}
        <img src="/reception/divider.webp" alt="" aria-hidden="true" className="rc-divider" width={830} height={99} />
      </section>

      <div className="rc-rise" style={{ '--i': 1 } as React.CSSProperties}>
        <LuckyTicket ticket={me?.ticket ?? null} ticketsOpen={!!me?.ticketsOpen} table={table} status={status} />
      </div>

      {seat && (
        <section className="rc-rise" style={{ '--i': 2 } as React.CSSProperties} aria-label="자리 배치도">
          <HallMap table={table} seat={seatNo} />
        </section>
      )}
    </div>
  );
}
