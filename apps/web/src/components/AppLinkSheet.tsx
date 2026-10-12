'use client';

/**
 * 안드로이드 앱(2.0.6) 안에서 전화·메일·카카오톡 링크가 '웹페이지를 사용할 수 없음' 오류 화면을 띄우지 않게 길을 바꾼다
 * (261012 사장 '마이페이지 - 고객센터 - 전화문의/이메일문의/카카오톡문의 누르면 웹페이지 사용할수없음(갤럭시 발생함)').
 * 까닭·판별은 lib/app-links.ts 머리 주석.
 *
 *  · 전화 → 시트(‘02-765-8882로 전화할까요?’ · [번호 복사 | 전화 걸기]). 전화 걸기 = intent:// DIAL(지금 앱이 넘겨 주는 유일한 꼴).
 *    삼성 전화 앱에서 번호가 바르게 뜨는지 실기기 확인 전이라 바로 쏘지 않고 '번호 복사'를 곁에 둔다 — 어떤 경우에도 오류 화면은 없다.
 *  · 메일 → 시트(주소 · [닫기 | 주소 복사]). intent:// 로는 data 가 'mailto://주소' 가 돼 메일 앱이 받는 사람을 비워 버려서 복사가 최선
 *    (메일 앱 바로 열기는 다음 안드 빌드 — MainActivity 가 mailto 를 ACTION_SENDTO 로 넘기게 고친 뒤).
 *  · 카카오톡 채널(pf.kakao.com/_xxx) → https://pf.kakao.com/_xxx/chat 로 이 화면에서 이동(Kakao 페이지가 intent:// 로 카카오톡을 연다).
 *    그 밖의 평문 http:// → https:// 로 바꿔 이동(앱은 평문을 막고, 새 창도 없어 어차피 이 화면에서 열린다).
 *  · 앱이 아니면(아이폰 앱·브라우저) 아무것도 안 건드린다 — tel:/mailto:/새 창 그대로.
 *  · 다음 안드 빌드(2.0.7~, window.Android.supportsExternalSchemes())는 tel:/mailto: 를 앱이 직접 넘기므로 시트 없이 평범한 링크로
 *    (needsAndroidSchemeWorkaround). 카카오 채팅 주소·https 바꾸기는 새 창이 없는 안드 앱 전부에 그대로 쓴다.
 *
 * 쓰는 법: <a href="tel:..." onClick={handleAppLinkClick}> · 감싼 칸에 onClickCapture={handleAppLinkClick} ·
 *         JS 로 거는 전화는 openPhoneCall(번호) · 서버 컴포넌트(Footer)는 <AppSafeLink>.
 * 시트는 따로 띄우는 루트(createRoot)에 그려서 화면마다 자리를 마련할 필요가 없다.
 */

import { useEffect, useRef, useState, type AnchorHTMLAttributes, type MouseEvent as ReactMouseEvent } from 'react';
import { createRoot, type Root } from 'react-dom/client';
import { AnimatePresence, MotionConfig, motion, type Transition } from 'framer-motion';
import toast from 'react-hot-toast';
import { useBodyScrollLock } from '@/lib/hooks/useBodyScrollLock';
import {
  androidDialIntentUrl,
  copyText,
  formatPhoneKr,
  isAndroidAppShell,
  kakaoChannelChatUrl,
  mailtoAddress,
  needsAndroidSchemeWorkaround,
  phoneDigits,
  phoneJosaRo,
} from '@/lib/app-links';

type SheetRequest = { kind: 'tel'; phone: string } | { kind: 'mailto'; email: string };

// AiQuoteFab 과 같은 스프링(웨딩숲 시트 톤 — 사장 '뚝 생기지 않게')
const SHEET_SPRING: Transition = { type: 'spring', stiffness: 380, damping: 36, mass: 0.9 };

function AppLinkSheetView({ req, onExited }: { req: SheetRequest; onExited: () => void }) {
  const [open, setOpen] = useState(true);
  // PC 폭(태블릿 가로 등 640 이상)은 가운데 카드, 폰은 아래에서 올라오는 시트(.ft-sheet 규칙과 같게)
  const [centered] = useState(() => typeof window !== 'undefined' && window.matchMedia('(min-width: 640px)').matches);
  const [busy, setBusy] = useState(false);
  const closedRef = useRef(false);
  // 시트용으로 쌓아 둔 히스토리 항목이 아직 남아 있는지
  const pushedRef = useRef(false);
  useBodyScrollLock(open);

  const close = () => {
    if (closedRef.current) return;
    closedRef.current = true;
    setOpen(false);
    // 버튼·바깥 누르기·전화 앱으로 가려짐으로 닫혔으면 쌓아 둔 항목을 되돌린다(뒤로가기로 닫혔으면 이미 빠졌다)
    if (pushedRef.current) {
      pushedRef.current = false;
      try {
        if ((window.history.state as { ftSheet?: boolean } | null)?.ftSheet) window.history.back();
      } catch { /* 히스토리를 못 건드려도 시트는 닫힌다 */ }
    }
  };

  // 안드로이드 '뒤로'(앱은 webView.goBack = history.back)는 시트만 닫아야 한다 — 그냥 두면 화면만 이전 페이지로 넘어가고
  // 따로 띄운 이 시트(와 스크롤 잠금)는 그 위에 남았다(261012 리뷰). ChatExtras 첨부 시트와 같은 방식:
  // 항목을 하나 쌓고(Next 가 pushState 를 감싸 라우터 상태를 복사해 주므로 되돌아갈 때 같은 화면 복원) popstate 에서 닫는다.
  useEffect(() => {
    try {
      // 앞 시트가 남긴 항목 위면(새 시트를 바로 이어 연 경우) 그 항목을 이어 쓴다 — 뒤로가기 한 번에 닫히게
      if (!(window.history.state as { ftSheet?: boolean } | null)?.ftSheet) window.history.pushState({ ftSheet: true }, '');
      pushedRef.current = true;
    } catch { /* 못 쌓으면 예전처럼 버튼·바깥 누르기로만 닫힌다 */ }
    const onPop = () => {
      pushedRef.current = false;
      close();
    };
    window.addEventListener('popstate', onPop);
    return () => window.removeEventListener('popstate', onPop);
    // close 는 ref·setState 만 쓰므로 첫 렌더 것으로 충분하다
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  // 전화 앱으로 넘어가 화면이 가려지면(visibilitychange) 시트를 닫아 둔다 — 돌아왔을 때 남아 있지 않게.
  // 웹뷰가 이 신호를 안 주면 시트가 그대로 남을 뿐(닫기는 바깥 누르기)이라 해는 없다.
  const closeOnLeaveRef = useRef<(() => void) | null>(null);
  useEffect(() => () => {
    if (closeOnLeaveRef.current) document.removeEventListener('visibilitychange', closeOnLeaveRef.current);
  }, []);

  const dial = () => {
    if (req.kind !== 'tel') return;
    if (!closeOnLeaveRef.current) {
      const onLeave = () => {
        if (document.visibilityState === 'hidden') close();
      };
      closeOnLeaveRef.current = onLeave;
      document.addEventListener('visibilitychange', onLeave);
    }
    window.location.href = androidDialIntentUrl(req.phone);
  };

  const copy = async () => {
    if (busy) return;
    setBusy(true);
    const text = req.kind === 'tel' ? phoneDigits(req.phone) : req.email;
    const ok = await copyText(text);
    setBusy(false);
    if (ok) {
      toast.success(req.kind === 'tel' ? '번호를 복사했어요' : '이메일 주소를 복사했어요');
      close();
    } else {
      toast.error(req.kind === 'tel' ? '복사하지 못했어요. 번호를 보고 직접 걸어 주세요' : '복사하지 못했어요. 주소를 보고 직접 적어 주세요');
    }
  };

  const shownPhone = req.kind === 'tel' ? formatPhoneKr(req.phone) : '';

  return (
    // 동작 줄이기 설정이면 움직임은 빼고 옅어짐만
    <MotionConfig reducedMotion="user">
      <AnimatePresence onExitComplete={onExited}>
        {open && (
          <motion.div
            key="app-link-scrim"
            className="ft-scrim"
            // CSS 등장(ftFade)은 끄고 여기서 — 닫을 때도 옅어지며 사라지게
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
              aria-label={req.kind === 'tel' ? '전화 걸기' : '이메일 문의'}
              style={{ animation: 'none', overscrollBehavior: 'contain' }}
              initial={centered ? { opacity: 0, y: 18, scale: 0.97 } : { y: '100%' }}
              animate={centered ? { opacity: 1, y: 0, scale: 1 } : { y: 0 }}
              exit={centered ? { opacity: 0, y: 12, scale: 0.98, transition: { duration: 0.18 } } : { y: '100%', transition: { duration: 0.26, ease: [0.4, 0, 1, 1] } }}
              transition={SHEET_SPRING}
              onClick={(e) => e.stopPropagation()}
            >
              <div className="ft-grab" aria-hidden="true" />
              {req.kind === 'tel' ? (
                <>
                  <h2 className="ft-title tabular-nums">{`${shownPhone}${phoneJosaRo(req.phone)} 전화할까요?`}</h2>
                  <p className="ft-desc">전화 앱이 열리지 않으면 번호를 복사해서 걸어 주세요.</p>
                  <div className="ft-actions">
                    <button type="button" className="ft-btn secondary" onClick={copy} disabled={busy}>번호 복사</button>
                    <button type="button" className="ft-btn primary" onClick={dial}>전화 걸기</button>
                  </div>
                </>
              ) : (
                <>
                  <h2 className="ft-title break-all">{req.email}</h2>
                  <p className="ft-desc">{'앱에서는 메일 앱을 바로 열 수 없어요.\n주소를 복사해서 메일 앱에 붙여 넣어 주세요.'}</p>
                  <div className="ft-actions">
                    <button type="button" className="ft-btn secondary" onClick={close}>닫기</button>
                    <button type="button" className="ft-btn primary" onClick={copy} disabled={busy}>주소 복사</button>
                  </div>
                </>
              )}
            </motion.div>
          </motion.div>
        )}
      </AnimatePresence>
    </MotionConfig>
  );
}

// 한 번에 시트 하나 — 새로 열면 앞의 것은 바로 걷는다
let current: { root: Root; host: HTMLElement } | null = null;

function disposeCurrent() {
  const c = current;
  current = null;
  if (!c) return;
  c.root.unmount();
  c.host.remove();
}

function openAppLinkSheet(req: SheetRequest) {
  if (typeof document === 'undefined') return;
  disposeCurrent();
  const host = document.createElement('div');
  host.setAttribute('data-app-link-sheet', '');
  document.body.appendChild(host);
  const root = createRoot(host);
  const mine = { root, host };
  current = mine;
  // 닫힘 애니메이션이 끝나면 걷는다(그리는 도중 unmount 경고가 나지 않게 다음 틱에)
  const onExited = () => {
    window.setTimeout(() => {
      if (current === mine) disposeCurrent();
    }, 0);
  };
  root.render(<AppLinkSheetView req={req} onExited={onExited} />);
}

/**
 * 전화 걸기 — JS 로 바로 거는 곳(채팅 머리 고객 번호 칩 등)용.
 * 옛 안드로이드 앱(2.0.6 이하)이면 시트, 아니면 예전처럼 tel: 로 이동.
 */
export function openPhoneCall(phone: string) {
  const digits = phoneDigits(phone);
  if (!digits) return;
  if (needsAndroidSchemeWorkaround()) {
    openAppLinkSheet({ kind: 'tel', phone: digits });
    return;
  }
  window.location.href = `tel:${digits}`;
}

/**
 * <a> 누름 처리 — 링크에 onClick 으로, 또는 감싼 칸에 onClickCapture 로 붙인다(눌린 곳에서 가장 가까운 a[href] 를 본다).
 * 안드로이드 앱이 아니거나, 이미 다른 처리가 막은 누름이면 그대로 둔다.
 */
export function handleAppLinkClick(e: ReactMouseEvent<HTMLElement> | MouseEvent) {
  if (e.defaultPrevented || !isAndroidAppShell()) return;
  const target = e.target as Element | null;
  const a = target && typeof target.closest === 'function' ? (target.closest('a[href]') as HTMLAnchorElement | null) : null;
  if (!a) return;
  const href = (a.getAttribute('href') || '').trim();

  if (/^tel:/i.test(href)) {
    if (!needsAndroidSchemeWorkaround()) return;
    const digits = phoneDigits(href.replace(/^tel:/i, ''));
    if (!digits) return;
    e.preventDefault();
    openAppLinkSheet({ kind: 'tel', phone: digits });
    return;
  }
  if (/^mailto:/i.test(href)) {
    if (!needsAndroidSchemeWorkaround()) return;
    const email = mailtoAddress(href);
    if (!email) return;
    e.preventDefault();
    openAppLinkSheet({ kind: 'mailto', email });
    return;
  }
  const kakaoChat = kakaoChannelChatUrl(href);
  if (kakaoChat) {
    e.preventDefault();
    window.location.href = kakaoChat;
    return;
  }
  if (/^http:\/\//i.test(href)) {
    e.preventDefault();
    window.location.href = href.replace(/^http:/i, 'https:');
  }
}

/** 서버 컴포넌트(Footer 등)에서 쓰는 전화·메일 링크 — 앱 밖에선 그냥 <a> 와 똑같다 */
export function AppSafeLink({ onClick, ...props }: AnchorHTMLAttributes<HTMLAnchorElement>) {
  return (
    <a
      {...props}
      onClick={(e) => {
        onClick?.(e);
        handleAppLinkClick(e);
      }}
    />
  );
}
