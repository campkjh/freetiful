'use client';

import type { ReactNode } from 'react';
import { useCallback, useEffect, useRef, useState } from 'react';
import { useRouter } from 'next/navigation';
import { QdBackIcon } from '../my/_components/detail-ui';

const PARTNER_ACCESS_KEY = 'freetiful-partner-apply-access';
const PARTNER_ACCESS_PASSWORD = '1234';
const MAX_LEN = 12;

/** 0~9 섞기 — 3×4 판: 앞 9개 + [확인, 10번째, ←] (유앤미 키패드와 같은 배치) */
function shuffledDigits(): string[] {
  const d = ['0', '1', '2', '3', '4', '5', '6', '7', '8', '9'];
  for (let i = d.length - 1; i > 0; i--) {
    const j = Math.floor(Math.random() * (i + 1));
    [d[i], d[j]] = [d[j], d[i]];
  }
  return d;
}

/**
 * 파트너 신청 입구 — 승인된 비밀번호를 눌러야 신청 단계로 들어간다(한 번 열면 이 탭에선 다시 안 묻는다).
 * 260928 사장 '유앤미 비번 입력하는 것처럼': 유앤미 키패드판(onelinesolution KeypadDialog) 그대로 —
 * 숫자는 열 때마다·틀릴 때마다 섞이고, 점은 자릿수만(최소 6, 값은 어디에도 안 보임), 틀리면 판이 흔들리며 점이 빨개진다.
 * 키보드로도 입력(숫자·Backspace·Enter, Esc = 뒤로). 맞으면 판이 옅어지며 약관 단계가 떠오른다.
 */
function PartnerKeypadGate({ onUnlock }: { onUnlock: () => void }) {
  const router = useRouter();
  const [entry, setEntry] = useState('');
  const [keys, setKeys] = useState<string[]>(() => shuffledDigits());
  const [error, setError] = useState('');
  const [shake, setShake] = useState(false);
  const [leaving, setLeaving] = useState(false);
  const padRef = useRef<HTMLDivElement>(null);

  useEffect(() => { padRef.current?.focus(); }, []);

  const press = useCallback((ch: string) => {
    if (leaving) return;
    setError('');
    setEntry((s) => (s.length >= MAX_LEN ? s : s + ch));
  }, [leaving]);

  const backspace = useCallback(() => {
    if (leaving) return;
    setError('');
    setEntry((s) => s.slice(0, -1));
  }, [leaving]);

  const submit = useCallback(() => {
    if (!entry || leaving) return;
    if (entry.normalize('NFC') !== PARTNER_ACCESS_PASSWORD) {
      setError('비밀번호가 일치하지 않아요');
      setEntry('');
      setKeys(shuffledDigits());
      setShake(true);
      window.setTimeout(() => setShake(false), 450);
      return;
    }
    try { sessionStorage.setItem(PARTNER_ACCESS_KEY, '1'); } catch { /* 이번만 */ }
    setLeaving(true);
    window.setTimeout(onUnlock, 260);
  }, [entry, leaving, onUnlock]);

  // 키보드 — 숫자·지우기·확인, Esc 는 뒤로
  useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      if (e.key === 'Escape') { router.back(); return; }
      if (e.key === 'Backspace') { e.preventDefault(); backspace(); return; }
      if (e.key === 'Enter') { e.preventDefault(); submit(); return; }
      if (e.ctrlKey || e.metaKey || e.altKey || e.isComposing) return;
      if (/^[0-9]$/.test(e.key)) { e.preventDefault(); press(e.key); }
    };
    window.addEventListener('keydown', onKey);
    return () => window.removeEventListener('keydown', onKey);
  }, [press, backspace, submit, router]);

  const dotCount = Math.max(6, entry.length);
  return (
    <div className={`pk${leaving ? ' is-leaving is-busy' : ''}`} role="dialog" aria-modal="true" aria-label="파트너 신청 비밀번호 입력">
      <button type="button" onClick={() => router.back()} aria-label="뒤로가기" className="qd-back pk-back">
        <QdBackIcon />
      </button>
      <div ref={padRef} tabIndex={-1} className={`pk-pad${shake ? ' is-shake' : ''}`}>
        <div className="pk-context">파트너스 신청</div>
        <div className="pk-title">비밀번호를 눌러주세요</div>
        <p className="pk-sub">승인된 비밀번호를 입력하면 신청을 시작할 수 있어요</p>

        {/* 값은 화면에 노출하지 않는다 — 점은 자릿수만 */}
        <div className={`pk-dots${error ? ' is-err' : ''}${leaving ? ' is-ok' : ''}`} aria-hidden="true">
          {Array.from({ length: dotCount }, (_, i) => (
            <span key={i} className={`pk-dot${i < entry.length ? ' on' : ''}`} />
          ))}
        </div>
        <div className="pk-sr" role="status">{entry.length ? `${entry.length}자 입력됨` : '입력 없음'}</div>
        {error && <div className="pk-error" role="alert">{error}</div>}

        <div className="pk-keys">
          {keys.slice(0, 9).map((d) => (
            <button key={d} type="button" className="pk-key" onClick={() => press(d)}>{d}</button>
          ))}
          <button type="button" className="pk-key pk-key-ok" disabled={!entry || leaving} onClick={submit}>확인</button>
          <button type="button" className="pk-key" onClick={() => press(keys[9])}>{keys[9]}</button>
          <button type="button" className="pk-key pk-key-back" aria-label="지우기" onClick={backspace}>
            <svg width="26" height="26" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.6" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
              <path d="M9 5h9a2 2 0 0 1 2 2v10a2 2 0 0 1-2 2H9l-5-7 5-7Z" />
              <path d="m12.5 9.5 5 5M17.5 9.5l-5 5" />
            </svg>
          </button>
        </div>
        <div className="pk-hint">키보드로도 입력할 수 있어요 · Enter 확인</div>
      </div>
    </div>
  );
}

export default function ProRegisterLayout({ children }: { children: ReactNode }) {
  const [checking, setChecking] = useState(true);
  const [unlocked, setUnlocked] = useState(false);

  useEffect(() => {
    try {
      setUnlocked(sessionStorage.getItem(PARTNER_ACCESS_KEY) === '1');
    } catch {
      setUnlocked(false);
    } finally {
      setChecking(false);
    }
  }, []);

  if (checking) return <div className="min-h-[100dvh] bg-white" />;
  if (unlocked) return <>{children}</>;
  return <PartnerKeypadGate onUnlock={() => setUnlocked(true)} />;
}
