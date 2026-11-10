'use client';

// 5,000원 받기 — 연락처 · 은행 · 계좌번호 · 예금주(+ 개인정보 수집·이용 동의). 모달 공통 .ft-* 시트.
import { useState } from 'react';
import { AnimatePresence, motion } from 'framer-motion';
import { useBodyScrollLock } from '@/lib/hooks/useBodyScrollLock';
import { missionApi, type WelcomeMissionStatus } from '@/lib/api/mission.api';

const BANKS = ['국민은행', '신한은행', '우리은행', '하나은행', 'NH농협', 'IBK기업', '카카오뱅크', '토스뱅크', '케이뱅크', 'SC제일', '새마을금고', '우체국', '수협', '신협', '대구은행', '부산은행', '경남은행', '광주은행', '전북은행', '제주은행'];

const phoneView = (d: string) => (d.length < 4 ? d : d.length < 8 ? `${d.slice(0, 3)}-${d.slice(3)}` : `${d.slice(0, 3)}-${d.slice(3, d.length - 4)}-${d.slice(-4)}`);

export default function MissionClaimSheet({ open, status, onClose, onDone }: {
  open: boolean;
  status: WelcomeMissionStatus;
  onClose: () => void;
  onDone: (next: WelcomeMissionStatus) => void;
}) {
  useBodyScrollLock(open);
  return (
    <AnimatePresence>
      {open && <Sheet key="ms-claim" status={status} onClose={onClose} onDone={onDone} />}
    </AnimatePresence>
  );
}

function Sheet({ status, onClose, onDone }: { status: WelcomeMissionStatus; onClose: () => void; onDone: (next: WelcomeMissionStatus) => void }) {
  const [phone, setPhone] = useState(() => (status.phone || '').replace(/\D/g, '').slice(0, 11));
  const [bank, setBank] = useState('');
  const [account, setAccount] = useState('');
  const [holder, setHolder] = useState(() => status.name || '');
  const [agree, setAgree] = useState(false);
  const [showTerms, setShowTerms] = useState(false);
  const [allBanks, setAllBanks] = useState(false);
  const [busy, setBusy] = useState(false);
  const [err, setErr] = useState('');

  const phoneOk = /^01\d{8,9}$/.test(phone);
  const accountOk = account.length >= 8 && account.length <= 20;
  const ready = phoneOk && !!bank && accountOk && holder.trim().length > 0 && agree;

  const submit = async () => {
    if (!ready || busy) return;
    setBusy(true);
    setErr('');
    try {
      const next = await missionApi.claim({ phone, bankName: bank, accountNumber: account, accountHolder: holder.trim() });
      onDone(next);
    } catch (e: any) {
      const m = e?.response?.data?.message;
      setErr((Array.isArray(m) ? m[0] : m) || '신청하지 못했어요. 잠시 뒤 다시 해 주세요.');
    } finally {
      setBusy(false);
    }
  };

  return (
    <motion.div className="ft-scrim" style={{ animation: 'none' }} initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }} transition={{ duration: 0.22 }} onClick={onClose}>
      <motion.div
        className="ft-sheet"
        style={{ animation: 'none' }}
        initial={{ y: '100%' }}
        animate={{ y: 0 }}
        exit={{ y: '100%' }}
        transition={{ type: 'spring', stiffness: 380, damping: 36 }}
        onClick={(e) => e.stopPropagation()}
        role="dialog"
        aria-modal="true"
        aria-label="5,000원 받을 계좌"
      >
        <div className="ft-grab" />
        <h2 className="ft-title">5,000원 받을 계좌를{'\n'}알려주세요</h2>
        <p className="ft-desc">운영팀이 확인한 뒤 이 계좌로 보내드려요.</p>

        <div className="ms-form">
          <label className="ms-field">
            <span>연락처</span>
            <input className="ft-input" inputMode="numeric" autoComplete="tel" placeholder="010-0000-0000" value={phoneView(phone)} onChange={(e) => setPhone(e.target.value.replace(/\D/g, '').slice(0, 11))} />
            {phone.length >= 10 && !phoneOk && <em>휴대폰 번호를 확인해 주세요</em>}
          </label>

          <div className="ms-field">
            <span>은행</span>
            <div className="ms-banks" role="radiogroup" aria-label="은행">
              {(allBanks ? BANKS : BANKS.slice(0, 8)).map((b) => (
                <button key={b} type="button" role="radio" aria-checked={bank === b} className={bank === b ? 'on' : ''} onClick={() => setBank(b)}>{b}</button>
              ))}
              {!allBanks && (
                <button type="button" className="more" onClick={() => setAllBanks(true)}>더 보기</button>
              )}
            </div>
          </div>

          <label className="ms-field">
            <span>계좌번호</span>
            <input className="ft-input" inputMode="numeric" placeholder="- 없이 숫자만" value={account} onChange={(e) => setAccount(e.target.value.replace(/\D/g, '').slice(0, 20))} />
            {account.length > 0 && account.length < 8 && <em>계좌번호를 끝까지 넣어 주세요</em>}
          </label>

          <label className="ms-field">
            <span>예금주</span>
            <input className="ft-input" autoComplete="name" placeholder="통장에 적힌 이름" value={holder} maxLength={20} onChange={(e) => setHolder(e.target.value)} />
          </label>

          <div className="ms-agree">
            <label>
              <input type="checkbox" checked={agree} onChange={(e) => setAgree(e.target.checked)} />
              <span><b>[필수]</b> 개인정보 수집·이용 동의</span>
            </label>
            <button type="button" onClick={() => setShowTerms((v) => !v)}>{showTerms ? '접기' : '보기'}</button>
          </div>
          {showTerms && (
            <div className="ms-terms">
              <p><b>수집 항목</b> 연락처, 은행명, 계좌번호, 예금주</p>
              <p><b>이용 목적</b> 신규 가입 미션 상금 지급, 중복 참여 확인</p>
              <p><b>보유 기간</b> 회원 탈퇴 시 또는 서비스 종료 시까지 보유하며, 관련 법령에 따라 일정 기간 보관될 수 있어요.</p>
              <p>동의하지 않을 수 있지만, 그러면 상금을 받을 수 없어요.</p>
            </div>
          )}
          {err && <p className="ms-err">{err}</p>}
        </div>

        <div className="ft-actions">
          <button type="button" className="ft-btn primary" disabled={!ready || busy} onClick={submit}>{busy ? '신청하는 중…' : '5,000원 받기'}</button>
        </div>
      </motion.div>
    </motion.div>
  );
}
