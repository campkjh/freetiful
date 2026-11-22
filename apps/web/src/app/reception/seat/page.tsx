'use client';

// 자리 — 처음엔 이름 입력(사장 '처음에 거기 클릭하면 이름 입력 → 본인 자리'), 입력하면 자리 배치도에서 내 테이블·좌석을 빛낸다.
// 자리 = 어드민 '자리 명단'이 있으면 명단(서버 PUT /guest 가 찾아 줌), 명단이 비어 있으면 이름으로 정한 임시 자리(lib/reception/event.ts seatFor).
// 럭키드로우 응모권은 이 탭에선 안 보인다(261122 사장 '앱에서 자리, 퀴즈 이부분에는 럭키드로우권 안보여도 됨') — 이벤트 탭에만.
//  · 그래도 이 탭의 useReceptionMe(PUT /guest, 15초마다)는 그대로 돈다 — 자리를 받으면서 응모권 발급(= 도착 기록)도 서버에서 같이 일어나고,
//    출력 연출·진동은 이벤트 탭에서 처음 볼 때 난다(components/reception/LuckyTicket).
// 자리 카드(TABLE N · N번 테이블 · N번 좌석)를 누르면 아래 배치도로 내려가며 내 테이블 쪽으로 크게 보기(261122 사장 '크게보기를 클릭하지 않아도
//  그 자리 ui를 누르면 크게 보기') — HallMap ref 손잡이 zoomMine() + 가벼운 진동. 명단에 없음 · 동명이인 고르기 화면은 해당 없음.
// 상자 없이 배경 위에 그냥 풀어 놓는다(261108 사장 '자리 ui도 풀어줘'). 배치도 = 받은 도면 그대로(261116, components/reception/HallMap).
// 동명이인(명단에 같은 이름이 두 테이블 — 261122 배정표 김현우 님)은 함께 앉는 분 이름을 보고 내 자리를 고른다(고른 것은 기기에 남음, '다시 고르기').
import { useRef, useState } from 'react';
import HallMap, { type HallMapHandle } from '@/components/reception/HallMap';
import { NameGateInline } from '@/components/reception/NameGate';
import { PencilIcon } from '@/components/reception/ReceptionIcons';
import { haptic } from '@/lib/haptics';
import { useReceptionGuest } from '@/lib/reception/guest';
import { resolveSeat, useReceptionMe } from '@/lib/reception/me';
import '@/components/reception/reception-seat-tap.css';

const POLL_MS = 15000;

/** 함께 앉는 분 — 넷까지 이름, 나머지는 '외 n명' */
const matesText = (mates: string[]) =>
  mates.length ? `${mates.slice(0, 4).join(' · ')}${mates.length > 4 ? ` 외 ${mates.length - 4}명` : ''}` : '함께 앉는 분이 아직 없어요';

export default function ReceptionSeatPage() {
  const guest = useReceptionGuest();
  const [editing, setEditing] = useState(false);
  const hall = useRef<HallMapHandle>(null);
  const name = guest?.name || '';
  const { me, status, reload, choose } = useReceptionMe(guest, POLL_MS);
  const seat = resolveSeat(me, name);

  if (!guest) return <div className="rc-page" />;

  if (!name || editing) {
    return (
      <div className="rc-page rc-seat-page">
        <NameGateInline
          initial={name}
          cta="내 자리 확인"
          hint="입력한 성함으로 자리를 찾고 럭키드로우 응모권(이벤트 탭)을 드려요. 베스트드레서 어워즈·설문에도 이 이름이 쓰여요."
          onDone={() => setEditing(false)}
          onClose={name ? () => setEditing(false) : undefined}
        />
      </div>
    );
  }

  const found = seat && (seat.kind === 'listed' || seat.kind === 'temp') ? seat : null;
  const table = found ? found.table : null;
  const seatNo = found ? found.seat : null;

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
        ) : seat.kind === 'choose' ? (
          <div className="rc-seat-missing">
            <p>같은 이름이 {seat.choices.length}분 계세요.</p>
            <p className="rc-seat-note">함께 앉는 분을 보고 내 자리를 골라 주세요.</p>
            <ul className="rc-seat-choices">
              {seat.choices.map((c) => (
                <li key={c.table}>
                  <button type="button" className="rc-seat-choice" onClick={() => choose(c.table)}>
                    <b className="rc-gold-text">TABLE {c.table}</b>
                    <span>{matesText(c.mates)}</span>
                  </button>
                </li>
              ))}
            </ul>
          </div>
        ) : (
          <>
            {/* 누르면 배치도에서 크게 보기 — 단추 안이라 p 대신 span(block) */}
            <button
              type="button"
              className="rc-seat-tap"
              onClick={() => { haptic('light'); hall.current?.zoomMine(); }}
            >
              <span className="rc-seat-table rc-gold-text">TABLE {seat.table}</span>
              <span className="rc-seat-detail">{seat.table}번 테이블{seat.seat ? ` · ${seat.seat}번 좌석` : ''}</span>
              <span className="rc-seat-tap-hint">
                배치도에서 크게 보기
                <svg width="12" height="12" viewBox="0 0 12 12" fill="none" aria-hidden="true">
                  <path d="M2.5 4.5 6 8l3.5-3.5" stroke="currentColor" strokeWidth="1.6" strokeLinecap="round" strokeLinejoin="round" />
                </svg>
              </span>
            </button>
            {seat.kind === 'temp' && <p className="rc-seat-note">좌석은 현장 사정에 따라 바뀔 수 있어요.</p>}
            {seat.kind === 'listed' && !seat.seat && <p className="rc-seat-note">테이블 안에서는 편한 자리에 앉아 주세요.</p>}
            {seat.kind === 'listed' && me?.sameName && (
              <button type="button" className="rc-text-btn rc-seat-repick" onClick={() => choose(null)}>
                같은 이름 다른 자리였나요? 다시 고르기
              </button>
            )}
          </>
        )}
        <img src="/reception/divider.webp" alt="" aria-hidden="true" className="rc-divider" width={830} height={99} />
      </section>

      {seat && (
        <section className="rc-rise" style={{ '--i': 1 } as React.CSSProperties} aria-label="자리 배치도">
          <HallMap ref={hall} table={table} seat={seatNo} />
        </section>
      )}
    </div>
  );
}
