'use client';

import { useEffect, useRef, useState } from 'react';

/**
 * 사회자 상세 '1:1 문의' 시트(261112 사장 '모달이 이상함') — 공통 .ft-* 시트 + 퀵매칭 날짜 칸 모양.
 * 날짜·시간은 휴대폰 기본 칸('연도. 월. 일.' · '-- --:--')을 그대로 보이지 않고, 투명하게 덮어 탭하면 기본 선택기만 뜬다.
 * 다 비워도 보낼 수 있다 — 보내면 바로 채팅방이 열리고 사회자가 먼저 인사한다(정하지 못한 건 채팅에서).
 */
export default function InquirySheet({
  proName,
  proImage,
  proIntro,
  sending,
  onClose,
  onSubmit,
}: {
  proName: string;
  proImage?: string | null;
  proIntro?: string | null;
  sending: boolean;
  onClose: () => void;
  onSubmit: (value: { date: string; time: string; location: string }) => void;
}) {
  const [date, setDate] = useState('');
  const [time, setTime] = useState('');
  const [location, setLocation] = useState('');
  const [today] = useState(() => {
    const d = new Date();
    return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')}`;
  });

  // 닫힐 때도 스르르(뚝 금지)
  const [out, setOut] = useState(false);
  const closing = useRef(false);
  const close = () => {
    if (closing.current || sending) return;
    closing.current = true;
    setOut(true);
    window.setTimeout(onClose, 240);
  };
  const closeRef = useRef(close);
  closeRef.current = close;
  useEffect(() => {
    const onKey = (e: KeyboardEvent) => { if (e.key === 'Escape') closeRef.current(); };
    window.addEventListener('keydown', onKey);
    return () => window.removeEventListener('keydown', onKey);
  }, []);

  return (
    <div className={`ft-scrim ft-sheet-scrim ${out ? 'out' : ''}`} onClick={close}>
      <div className="ft-sheet iq-sheet" role="dialog" aria-modal="true" aria-label={`${proName} 사회자에게 1:1 문의`} onClick={(e) => e.stopPropagation()}>
        <div className="ft-grab" aria-hidden="true" />
        <div className="iq-pro">
          {proImage ? <img src={proImage} alt="" className="iq-avatar" /> : <span className="iq-avatar" aria-hidden="true" />}
          <div className="min-w-0">
            <b>{proName}</b>
            {proIntro ? <span>{proIntro}</span> : null}
          </div>
        </div>
        <h3 className="ft-title">1:1 문의</h3>
        <p className="ft-desc">보내면 바로 채팅방이 열리고{'\n'}{proName} 사회자가 먼저 인사드려요.</p>

        <div className="iq-fields">
          <label className="iq-field">
            <i aria-hidden="true" className="iq-ic" style={{ WebkitMaskImage: 'url(/quick-match/icons/calendar.svg)', maskImage: 'url(/quick-match/icons/calendar.svg)', color: date ? '#3182F6' : '#8B95A1' }} />
            <span className={date ? 'val' : 'ph'}>{date ? formatDate(date) : '행사 날짜'}</span>
            <input
              type="date"
              min={today}
              value={date}
              disabled={sending}
              aria-label="행사 날짜"
              onChange={(e) => setDate(e.target.value)}
              onClick={openPicker}
            />
          </label>
          <label className="iq-field">
            <i aria-hidden="true" className="iq-ic" style={{ WebkitMaskImage: 'url(/quick-match/icons/clock.svg)', maskImage: 'url(/quick-match/icons/clock.svg)', color: time ? '#3182F6' : '#8B95A1' }} />
            <span className={time ? 'val' : 'ph'}>{time ? formatTime(time) : '시작 시간'}</span>
            <input
              type="time"
              step={600}
              value={time}
              disabled={sending}
              aria-label="시작 시간"
              onChange={(e) => setTime(e.target.value)}
              onClick={openPicker}
            />
          </label>
          <label className="iq-field text">
            <i aria-hidden="true" className="iq-ic" style={{ WebkitMaskImage: 'url(/quick-match/icons/pin.svg)', maskImage: 'url(/quick-match/icons/pin.svg)', color: location.trim() ? '#3182F6' : '#8B95A1' }} />
            <input
              value={location}
              disabled={sending}
              maxLength={80}
              placeholder="행사 장소 (예: 서울 강남구)"
              onChange={(e) => setLocation(e.target.value)}
              onKeyDown={(e) => { if (e.key === 'Enter') (e.target as HTMLInputElement).blur(); }}
            />
          </label>
        </div>
        <p className="iq-hint">아직 정하지 않았다면 비워 두고 채팅에서 이야기해도 돼요.</p>

        <div className="ft-actions col">
          <button
            type="button"
            className="ft-btn primary"
            disabled={sending}
            onClick={() => onSubmit({ date, time, location: location.trim() })}
          >
            {sending && <span className="h-4 w-4 rounded-full border-2 border-white/80 border-t-transparent animate-spin" />}
            채팅으로 문의하기
          </button>
        </div>
      </div>
    </div>
  );
}

/** PC 브라우저는 칸을 눌러도 달력이 안 뜨는 경우가 있어 직접 연다(휴대폰은 탭이면 기본 선택기가 뜬다) */
function openPicker(e: React.MouseEvent<HTMLInputElement>) {
  try { e.currentTarget.showPicker?.(); } catch { /* 지원 안 하면 기본 동작 */ }
}

function formatDate(v: string) {
  const [y, m, d] = v.split('-').map(Number);
  const wd = ['일', '월', '화', '수', '목', '금', '토'][new Date(y, m - 1, d).getDay()];
  return `${y}년 ${m}월 ${d}일 (${wd})`;
}

function formatTime(v: string) {
  const [h, m] = v.split(':').map(Number);
  const h12 = h % 12 === 0 ? 12 : h % 12;
  return `${h < 12 ? '오전' : '오후'} ${h12}:${String(m).padStart(2, '0')}`;
}
