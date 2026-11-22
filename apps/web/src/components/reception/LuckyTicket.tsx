'use client';

// 럭키드로우 응모권(261122 사장 '이름을 입력하면 자동으로 자리를 알려주고 럭키드로우가 출력되게끔') — 자리 탭 자리 카드 아래.
// 용지 = GPT 로 만든 그림(/reception/lucky-ticket.webp, 1536×1024 = 3:2) — 왼쪽 큰 판에 번호 · 이름, 오른쪽 떼는 칸 네모에 테이블. 그림이 없으면 남색 판.
// 처음 받는 번호는 '출력' 연출 — 얇은 슬롯(단색 선) 아래로 응모권이 위에서 스르륵 밀려 나온다 + 진동. 본 번호는 기기에 기억해 다음부턴 바로 보인다.
// 당첨되면 응모권 위에 단색 띠 '당첨! 경품' + 진동 한 번(당첨마다 한 번).
// 이벤트 탭 맨 위에도 같은 응모권(261122 사장 '럭키드로우권이 앱에서 발급이 되고 그 앱에서 이벤트 페이지에서 확인 · 당첨이 되면 푸시 알람') — place='event'.
//  · 출력 연출·당첨 진동은 기기에 한 번만 기억하니 자리 탭에서 본 번호는 이벤트 탭에서 다시 출력되지 않는다.
//  · 이벤트 탭엔 자리 카드가 없어 동명이인 안내는 '자리 탭에서 고르기'로, 이름이 없으면 이름 카드 여는 단추(onNeedName).
import { useEffect, useLayoutEffect, useState } from 'react';
import Link from 'next/link';
import { haptic } from '@/lib/haptics';
import type { ReceptionTicket } from '@/lib/reception/api';
import { RECEPTION_EVENT_KEY } from '@/lib/reception/event';
import { TicketIcon } from './ReceptionIcons';

const SEEN_KEY = `freetiful-reception-${RECEPTION_EVENT_KEY}-ticket-seen`;
const WIN_KEY = `freetiful-reception-${RECEPTION_EVENT_KEY}-win-seen`;

function readKey(k: string) {
  try { return localStorage.getItem(k) || ''; } catch { return ''; }
}
function writeKey(k: string, v: string) {
  try { localStorage.setItem(k, v); } catch {}
}

export const ticketNo = (n: number) => String(n).padStart(3, '0');

// 서버 렌더에선 layout effect 가 안 도니 그냥 effect(경고 피하기) — 브라우저에선 칠하기 전에 돈다
const useIsoLayoutEffect = typeof window === 'undefined' ? useEffect : useLayoutEffect;

type Props = {
  ticket: ReceptionTicket | null;
  ticketsOpen: boolean;
  table: number | null;
  /** 첫 응답 기다리는 중 · 못 받음 — 받아 둔 응모권이 있으면 그대로 보인다 */
  status: 'idle' | 'loading' | 'ready' | 'error';
  /** 동명이인이라 아직 자리를 안 골랐음 — 고르면 응모권이 나온다 */
  needsPick?: boolean;
  /** 어느 탭에 놓였나 — 자리 탭(기본, 위에 자리 카드) · 이벤트 탭(자리 고르기는 자리 탭으로 안내) */
  place?: 'seat' | 'event';
  /** 아직 이름을 안 넣은 손님 — 주면 응모권 대신 '성함 입력하기' 단추(이름 카드는 부르는 쪽이 띄움) */
  onNeedName?: () => void;
};

export default function LuckyTicket({ ticket, ticketsOpen, table, status, needsPick, place = 'seat', onNeedName }: Props) {
  const [printing, setPrinting] = useState(false);
  const number = ticket?.number ?? null;
  const win = ticket?.win ?? null;
  const winKey = ticket && win ? `${ticket.number}:${win.prize}:${win.at}` : '';

  // 처음 보는 번호만 출력 연출 — 끝나는 순간(animationend) 진동. 움직임 줄이기 설정이면 연출 없이 진동만
  // layout effect = 칠하기 전에 printing 을 켠다(그냥 effect 면 완성된 응모권이 한 프레임 번쩍 보였다 사라진다)
  useIsoLayoutEffect(() => {
    if (number === null) return;
    const id = String(number);
    if (readKey(SEEN_KEY) === id) return;
    writeKey(SEEN_KEY, id);
    if (window.matchMedia?.('(prefers-reduced-motion: reduce)').matches) { haptic('success'); return; }
    setPrinting(true);
  }, [number]);

  useEffect(() => {
    if (!winKey || readKey(WIN_KEY) === winKey) return;
    writeKey(WIN_KEY, winKey);
    haptic('success');
  }, [winKey]);

  const onPrinted = (e: React.AnimationEvent<HTMLDivElement>) => {
    if (e.target !== e.currentTarget || e.animationName !== 'rc-ticket-print') return;
    setPrinting(false);
    haptic('success');
  };

  let empty: string | null = null;
  let action: React.ReactNode = null;
  const waiting = !ticket && !onNeedName && (status === 'loading' || status === 'idle');
  if (!ticket) {
    if (onNeedName) {
      empty = '성함을 입력하면 내 자리를 찾고 럭키드로우 응모권을 드려요';
      action = <button type="button" className="rc-btn-line sm" onClick={onNeedName}>성함 입력하기</button>;
    } else if (status === 'loading' || status === 'idle') empty = '응모권을 확인하고 있어요';
    else if (status === 'error') empty = '응모권을 불러오지 못했어요. 잠시 후 다시 보여 드릴게요.';
    else if (ticketsOpen && needsPick && place === 'event') {
      empty = '같은 이름이 여러 분 계세요. 자리 탭에서 내 자리를 고르면 응모권이 나와요';
      action = <Link href="/reception/seat" className="rc-btn-line sm" scroll={false}>내 자리 고르기</Link>;
    } else if (ticketsOpen && needsPick) empty = '위에서 내 자리를 고르면 응모권이 나와요';
    else if (ticketsOpen) empty = '응모권을 준비하고 있어요. 잠시만 기다려 주세요.';
    else empty = '럭키드로우 응모권은 행사 당일 입장하면 자동으로 나와요';
  }

  return (
    <section className="rc-lucky" aria-label="럭키드로우 응모권">
      <div className="rc-lucky-head">
        <p className="rc-eyebrow">Lucky Draw</p>
        <h2 className="rc-lucky-title">럭키드로우 응모권</h2>
      </div>

      {ticket ? (
        <div className="rc-ticket-printer">
          <div className="rc-ticket-slot" aria-hidden="true" />
          <div className="rc-ticket-feed">
            <div
              className={`rc-ticket ${printing ? 'printing' : ''}`}
              role="img"
              aria-label={`럭키드로우 응모권 ${ticket.number}번, ${ticket.name}${table ? `, ${table}번 테이블` : ''}${win ? `, ${win.prize} 당첨` : ''}`}
              onAnimationEnd={onPrinted}
            >
              <div className="rc-ticket-face" aria-hidden="true">
                <span className="rc-ticket-no"><small>No.</small>{ticketNo(ticket.number)}</span>
                <span className="rc-ticket-name">{ticket.name}</span>
              </div>
              {table !== null && (
                <div className="rc-ticket-stub" aria-hidden="true">
                  <small>TABLE</small>
                  <b>{table}</b>
                </div>
              )}
              {win && <div className="rc-ticket-win" aria-hidden="true">당첨! {win.prize}</div>}
            </div>
          </div>
        </div>
      ) : (
        <div className={`rc-ticket-empty ${waiting ? 'wait' : ''}`} aria-live="polite">
          <TicketIcon size={30} />
          <p>{empty}</p>
          {action}
        </div>
      )}

      <p className="rc-lucky-note">응모권은 한 사람 한 장이에요. 당첨되면 푸시 알림으로 알려 드려요. 경품 추첨 때 이 화면을 보여 주세요.</p>
    </section>
  );
}
