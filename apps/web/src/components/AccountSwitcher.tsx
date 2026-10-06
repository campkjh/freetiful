'use client';

import { useCallback, useEffect, useRef, useState } from 'react';
import { usePathname, useRouter } from 'next/navigation';
import { AnimatePresence, MotionConfig, motion, type Transition, type Variants } from 'framer-motion';
import toast from 'react-hot-toast';
import { useAuthStore } from '@/lib/store/auth.store';
import {
  MAX_SAVED_ACCOUNTS,
  accountSubLabel,
  markAddingAccount,
  rememberCurrentAccount,
  removeSavedAccount,
  settleAddingAccount,
  switchAccount,
  useAccountsStore,
  type SavedAccount,
  type SwitchResult,
} from '@/lib/store/accounts.store';
import { getProfileImageUrl } from '@/lib/default-profile';
import { useBodyScrollLock } from '@/lib/hooks/useBodyScrollLock';

/* ─────────────────────────────────────────────────────────────
 * 계정 전환 시트 — 마이 탭을 두 번 누르면(261006 사장 '원라인 일반바 계정 연결처럼 왔다 갔다').
 *  · 이 기기에 저장된 계정 줄(지금 계정 = 파란 체크) → 누르면 그 계정으로 바뀌고 /my 가 새로 열린다.
 *  · '계정 추가' = 이메일 가입만(261006 사장) — 퀵매칭 같은 /email/signup 화면으로 넘어가 새 계정을 만든다.
 *    지금 계정은 로그인된 채로 두고(취소하면 그대로) 새 계정이 들어오면 둘 다 목록에 남는다.
 *  · 줄 오른쪽 × → '빼기'(한 번 더 눌러야 빠진다) — 그 계정의 서버 세션도 끊는다. 지금 계정은 마이 > 로그아웃으로.
 *  · 두 번 누름 감지: 웹 하단 탭·PC 머리줄은 클릭(noteTabTap), iOS 네이티브 탭바는
 *    다른 탭→마이 = __freetifulNavigate('/my'), 마이에서 다시 누름 = scrollTo({top:0, behavior:'smooth'}) 로 들어온다
 *    (ViewController.liquidGlassNavigationBar didSelect — 그 스크립트를 바꾸면 여기도).
 *  · 모양 = 공통 시트(.ft-*) + AiQuoteFab 어법(뒤 잠금 · 스프링 · 줄 차례 등장 · 빠질 땐 접힘).
 * ──────────────────────────────────────────────────────────── */

const OPEN_EVENT = 'freetiful:open-account-switcher';
const SWITCHED_KEY = 'freetiful-accounts-switched';
const DOUBLE_TAP_MS = 500;

let lastMyTap = 0;
/** 탭 한 번 — 마이를 500ms 안에 두 번 누르면 시트를 연다(열었으면 true). 다른 탭을 누르면 초기화. */
export function noteTabTap(path: string) {
  const clean = (path.split(/[?#]/)[0] || '/').replace(/\/+$/, '') || '/';
  if (clean !== '/my') { lastMyTap = 0; return false; }
  const now = Date.now();
  if (now - lastMyTap < DOUBLE_TAP_MS) {
    lastMyTap = 0;
    window.dispatchEvent(new Event(OPEN_EVENT));
    return true;
  }
  lastMyTap = now;
  return false;
}

/* iOS 네이티브 탭바 — 다른 탭에서 마이를 누르면 경로가 바뀌기 전에 두 번째 누름(scrollTo)이 올 수 있어 직전 이동 목적지를 기억 */
let nativeNavTarget = '';
let nativeNavAt = 0;
export function noteNativeNavigate(path: string) {
  nativeNavTarget = path;
  nativeNavAt = Date.now();
  noteTabTap(path);
}

function hookNativeSameTabTap() {
  const w = window as unknown as {
    webkit?: { messageHandlers?: Record<string, unknown> };
    __freetifulTabTapHooked?: boolean;
  };
  // 웹 전용 iOS 앱(네이티브 탭바)에서만 — 브라우저·안드로이드는 웹 하단 탭 클릭으로 센다
  if (!w.webkit?.messageHandlers?.nativeNavState || w.__freetifulTabTapHooked) return;
  w.__freetifulTabTapHooked = true;
  const original = window.scrollTo;
  window.scrollTo = function scrollToWithTabTap(this: Window, ...args: unknown[]) {
    const opt = args[0] as { top?: unknown; behavior?: unknown } | undefined;
    if (args.length === 1 && opt && typeof opt === 'object' && opt.top === 0 && opt.behavior === 'smooth' && Object.keys(opt).length === 2) {
      noteTabTap(Date.now() - nativeNavAt < 2000 ? nativeNavTarget : window.location.pathname);
    }
    return (original as (...a: unknown[]) => void).apply(this, args);
  } as typeof window.scrollTo;
}

const SHEET_SPRING: Transition = { type: 'spring', stiffness: 380, damping: 36, mass: 0.9 };
const listVariants: Variants = { hidden: {}, show: { transition: { staggerChildren: 0.045, delayChildren: 0.06 } } };
const itemVariants: Variants = {
  hidden: { opacity: 0, y: 12, filter: 'blur(4px)' },
  show: { opacity: 1, y: 0, filter: 'blur(0px)', transition: { type: 'spring', stiffness: 420, damping: 36 }, transitionEnd: { filter: 'none' } },
};

function switchFailMessage(result: SwitchResult) {
  if (result === 'expired') return '로그인이 만료돼 목록에서 뺐어요';
  if (result === 'offline') return '연결이 불안정해요. 잠시 후 다시 시도해 주세요';
  if (result === 'missing') return '저장된 계정을 찾지 못했어요';
  return '';
}

function Avatar({ account, size = 44 }: { account: SavedAccount; size?: number }) {
  const src = getProfileImageUrl(account.user.profileImageUrl, account.user.id || account.user.email || account.user.name);
  return (
    <span className="block shrink-0 overflow-hidden rounded-full bg-[#F2F4F6]" style={{ width: size, height: size }}>
      {/* eslint-disable-next-line @next/next/no-img-element */}
      <img src={src} alt="" width={size} height={size} className="h-full w-full object-cover" draggable={false} />
    </span>
  );
}

function Spinner() {
  return <span aria-hidden="true" className="block h-5 w-5 animate-spin rounded-full border-2 border-[#D1D6DB] border-t-[#3182F6]" />;
}

function CheckBadge() {
  return (
    <svg width="24" height="24" viewBox="0 0 24 24" fill="none" role="img" aria-label="지금 계정">
      <circle cx="12" cy="12" r="12" fill="#3182F6" />
      <path d="M7 12.4l3.2 3.1L17 8.8" stroke="#fff" strokeWidth="2.2" strokeLinecap="round" strokeLinejoin="round" />
    </svg>
  );
}

/** 계정 줄 — 왼쪽(사진·이름)은 바꾸기, 오른쪽은 지금 계정 체크 / 바꾸는 중 / 빼기 */
function AccountRow({
  account,
  current,
  busy,
  disabled,
  onPick,
  onRemove,
}: {
  account: SavedAccount;
  current: boolean;
  busy: boolean;
  disabled: boolean;
  onPick: () => void;
  onRemove?: () => void;
}) {
  const [confirming, setConfirming] = useState(false);
  useEffect(() => {
    if (!confirming) return;
    const t = window.setTimeout(() => setConfirming(false), 3000);
    return () => window.clearTimeout(t);
  }, [confirming]);

  return (
    <div className="flex items-center gap-1">
      <button
        type="button"
        onClick={onPick}
        disabled={disabled && !current}
        aria-current={current ? 'true' : undefined}
        className="flex min-w-0 flex-1 items-center gap-3 rounded-[16px] py-2.5 pl-2 text-left transition-colors active:bg-[#F2F4F6] disabled:opacity-60"
      >
        <Avatar account={account} />
        <span className="min-w-0 flex-1">
          <span className="block truncate text-[17px] font-semibold leading-[1.35] tracking-[-0.3px] text-[#191F28]">
            {account.user.name || '이름 없음'}
          </span>
          <span className="mt-0.5 block truncate text-[13px] leading-[1.35] tracking-[-0.2px] text-[#8B95A1]">
            {accountSubLabel(account.user)}
          </span>
        </span>
      </button>
      <span className="flex h-11 min-w-[44px] shrink-0 items-center justify-center pr-2">
        {current ? (
          <CheckBadge />
        ) : busy ? (
          <Spinner />
        ) : onRemove ? (
          confirming ? (
            <button
              type="button"
              onClick={onRemove}
              disabled={disabled}
              className="h-8 rounded-full bg-[#FFEEEE] px-3 text-[14px] font-semibold text-[#F04452] transition-transform active:scale-95"
            >
              빼기
            </button>
          ) : (
            <button
              type="button"
              onClick={() => setConfirming(true)}
              disabled={disabled}
              aria-label={`${account.user.name || '이 계정'} 이 기기에서 빼기`}
              className="flex h-9 w-9 items-center justify-center rounded-full text-[#B0B8C1] transition-colors active:bg-[#F2F4F6]"
            >
              <svg width="18" height="18" viewBox="0 0 24 24" fill="none" aria-hidden="true">
                <path d="M6 6l12 12M18 6L6 18" stroke="currentColor" strokeWidth="2.2" strokeLinecap="round" />
              </svg>
            </button>
          )
        ) : null}
      </span>
    </div>
  );
}

/** 로그인 창(로그아웃 상태)에 붙는 '저장된 계정으로 계속' — 누르면 바로 그 계정으로 */
export function SavedAccountsQuickList({ onDone, to }: { onDone?: () => void; to?: () => string }) {
  const accounts = useAccountsStore((s) => s.accounts);
  const hydrated = useAccountsStore((s) => s.hasHydrated);
  const [busyId, setBusyId] = useState<string | null>(null);
  if (!hydrated || accounts.length === 0) return null;
  const sorted = [...accounts].sort((a, b) => b.lastUsedAt - a.lastUsedAt);
  const pick = async (id: string) => {
    if (busyId) return;
    setBusyId(id);
    const result = await switchAccount(id, { to: to?.() });
    if (result === 'ok') {
      onDone?.();
      return;
    }
    setBusyId(null);
    const msg = switchFailMessage(result);
    if (msg) toast.error(msg);
  };
  return (
    <div className="mb-1 mt-5">
      <p className="mb-1 px-2 text-[13px] font-semibold tracking-[-0.2px] text-[#8B95A1]">저장된 계정으로 계속</p>
      {sorted.map((account) => (
        <AccountRow
          key={account.id}
          account={account}
          current={false}
          busy={busyId === account.id}
          disabled={!!busyId}
          onPick={() => pick(account.id)}
        />
      ))}
    </div>
  );
}

export default function AccountSwitcher() {
  const pathname = usePathname();
  const router = useRouter();
  const authUser = useAuthStore((s) => s.user);
  const accessToken = useAuthStore((s) => s.accessToken);
  const refreshToken = useAuthStore((s) => s.refreshToken);
  const authHydrated = useAuthStore((s) => s.hasHydrated);
  const accounts = useAccountsStore((s) => s.accounts);
  const accountsHydrated = useAccountsStore((s) => s.hasHydrated);
  const ready = authHydrated && accountsHydrated;

  const [open, setOpen] = useState(false);
  const [centered, setCentered] = useState(false);
  const [busyId, setBusyId] = useState<string | null>(null);
  const openRef = useRef(false);
  openRef.current = open;
  useBodyScrollLock(open);

  // 로그인해 있는 계정을 목록에 반영(로그인 · 토큰 회전 · 프로필 갱신마다)
  useEffect(() => {
    if (ready) rememberCurrentAccount();
  }, [ready, authUser, accessToken, refreshToken]);

  // 계정 추가 마무리(로그인 다녀온 뒤) · 바꾼 뒤 새로 열린 화면에서 한마디
  useEffect(() => {
    if (!ready) return;
    const settled = settleAddingAccount();
    if (settled?.result === 'added') toast.success(`${settled.name || '새'} 계정을 추가했어요`);
    else if (settled?.result === 'same') toast('이미 이 기기에 저장된 계정이에요');
    try {
      const switched = sessionStorage.getItem(SWITCHED_KEY);
      if (switched && authUser) {
        sessionStorage.removeItem(SWITCHED_KEY);
        toast.success(`${authUser.name || switched} 계정으로 바꿨어요`);
      }
    } catch {}
  }, [ready, authUser?.id, accessToken, pathname]); // eslint-disable-line react-hooks/exhaustive-deps

  // 두 번 누름 → 열기(로그인해 있을 때만) · iOS 네이티브 탭바 같은 탭 다시 누름 감지
  useEffect(() => {
    hookNativeSameTabTap();
    const onOpen = () => {
      if (!useAuthStore.getState().user || openRef.current) return;
      setCentered(window.matchMedia('(min-width: 640px)').matches);
      setBusyId(null);
      setOpen(true);
    };
    window.addEventListener(OPEN_EVENT, onOpen);
    return () => window.removeEventListener(OPEN_EVENT, onOpen);
  }, []);

  const close = useCallback(() => { if (!busyId) setOpen(false); }, [busyId]);

  useEffect(() => {
    if (!open) return;
    const onKey = (e: KeyboardEvent) => { if (e.key === 'Escape') close(); };
    window.addEventListener('keydown', onKey);
    return () => window.removeEventListener('keydown', onKey);
  }, [open, close]);

  // 로그아웃되면(만료 등) 닫는다
  useEffect(() => { if (!authUser) setOpen(false); }, [authUser]);

  const sorted = [...accounts].sort((a, b) => a.addedAt - b.addedAt);
  const currentId = authUser?.id;
  const full = accounts.length >= MAX_SAVED_ACCOUNTS;

  const pick = async (account: SavedAccount) => {
    if (busyId) return;
    if (account.id === currentId) { setOpen(false); return; }
    setBusyId(account.id);
    const result = await switchAccount(account.id, { to: '/my' });
    if (result === 'ok') {
      try { sessionStorage.setItem(SWITCHED_KEY, account.user.name || '새'); } catch {}
      return; // 곧 새로 열린다 — 도는 표시 그대로
    }
    setBusyId(null);
    const msg = switchFailMessage(result);
    if (msg) toast.error(msg);
  };

  const add = () => {
    if (busyId) return;
    if (full) { toast(`계정은 ${MAX_SAVED_ACCOUNTS}개까지 저장돼요. 하나를 빼고 추가해 주세요`); return; }
    rememberCurrentAccount();
    markAddingAccount();
    setOpen(false);
    // 시트가 내려간 뒤 이메일 가입 화면(퀵매칭 어법) — 소셜 로그인은 계정 추가에 안 쓴다(카카오톡 계정 하나뿐이라 새 계정이 안 생김)
    window.setTimeout(() => router.push('/email/signup'), 200);
  };

  const remove = (account: SavedAccount) => {
    removeSavedAccount(account.id);
    toast(`${account.user.name ? `${account.user.name} 계정을` : '계정을'} 이 기기에서 뺐어요`);
  };

  return (
    <MotionConfig reducedMotion="user">
      <AnimatePresence>
        {open && (
          <motion.div
            key="account-switcher-scrim"
            className="ft-scrim"
            style={{ animation: 'none' }}
            initial={{ backgroundColor: 'rgba(0, 0, 0, 0)' }}
            animate={{ backgroundColor: 'rgba(0, 0, 0, 0.4)' }}
            exit={{ backgroundColor: 'rgba(0, 0, 0, 0)' }}
            transition={{ duration: 0.26, ease: [0.22, 1, 0.36, 1] }}
            onClick={close}
          >
            <motion.div
              className="ft-sheet"
              role="dialog"
              aria-modal="true"
              aria-label="계정 전환"
              style={{ animation: 'none', overscrollBehavior: 'contain' }}
              initial={centered ? { opacity: 0, y: 18, scale: 0.97 } : { y: '100%' }}
              animate={centered ? { opacity: 1, y: 0, scale: 1 } : { y: 0 }}
              exit={centered ? { opacity: 0, y: 12, scale: 0.98, transition: { duration: 0.18 } } : { y: '100%', transition: { duration: 0.26, ease: [0.4, 0, 1, 1] } }}
              transition={SHEET_SPRING}
              onClick={(e) => e.stopPropagation()}
            >
              <div className="ft-grab" aria-hidden="true" />
              <h2 className="ft-title">계정 전환</h2>
              <p className="ft-desc">
                {accounts.length > 1 ? '이 기기에 저장된 계정끼리 바로 바꿔요' : '계정을 추가하면 마이를 두 번 눌러\n바로 바꿀 수 있어요'}
              </p>

              <motion.div className="-mx-2 mt-5" variants={listVariants} initial="hidden" animate="show">
                <AnimatePresence initial={false}>
                  {sorted.map((account) => (
                    <motion.div
                      key={account.id}
                      variants={itemVariants}
                      exit={{ opacity: 0, height: 0, transition: { duration: 0.22, ease: [0.4, 0, 0.2, 1] } }}
                      style={{ overflow: 'hidden' }}
                    >
                      <AccountRow
                        account={account}
                        current={account.id === currentId}
                        busy={busyId === account.id}
                        disabled={!!busyId}
                        onPick={() => pick(account)}
                        onRemove={account.id === currentId ? undefined : () => remove(account)}
                      />
                    </motion.div>
                  ))}
                </AnimatePresence>
                <motion.div variants={itemVariants}>
                  <button
                    type="button"
                    onClick={add}
                    disabled={!!busyId}
                    className="flex w-full items-center gap-3 rounded-[16px] py-2.5 pl-2 text-left transition-colors active:bg-[#F2F4F6] disabled:opacity-60"
                  >
                    <span className="flex h-11 w-11 shrink-0 items-center justify-center rounded-full bg-[#F2F4F6] text-[#4E5968]">
                      <svg width="20" height="20" viewBox="0 0 24 24" fill="none" aria-hidden="true">
                        <path d="M12 5v14M5 12h14" stroke="currentColor" strokeWidth="2.2" strokeLinecap="round" />
                      </svg>
                    </span>
                    <span className="text-[17px] font-medium tracking-[-0.3px] text-[#4E5968]">계정 추가</span>
                  </button>
                </motion.div>
              </motion.div>

              <div className="ft-actions">
                <button type="button" className="ft-btn secondary" onClick={close} disabled={!!busyId}>
                  닫기
                </button>
              </div>
            </motion.div>
          </motion.div>
        )}
      </AnimatePresence>
    </MotionConfig>
  );
}
