/**
 * 바깥 앱으로 넘기는 링크(전화·메일·카카오톡) — 안드로이드 앱 우회 도우미
 * (261012 사장 '고객센터 전화문의/이메일문의/카카오톡문의 누르면 웹페이지 사용할수없음(갤럭시)').
 *
 *  · 안드로이드 앱(2.0.6) 웹뷰는 MainActivity.shouldOverrideUrlLoading 에서 'intent://' 와 play.google.com 만
 *    바깥 앱으로 넘기고 나머지는 웹뷰가 직접 연다 → tel:·mailto: 는 ERR_UNKNOWN_URL_SCHEME,
 *    평문 http:// 는 targetSdk 36 기본 차단(ERR_CLEARTEXT_NOT_PERMITTED) → 둘 다 '웹페이지를 사용할 수 없음' 오류 화면.
 *  · 손에 깔린 앱은 오늘 바꿀 수 없으니 웹이 **앱 안에서만** 길을 바꾼다. 아이폰 앱·브라우저(갤럭시 크롬 포함)는 예전 그대로.
 *  · 화면(시트)은 components/AppLinkSheet.tsx — 여기는 판별·주소 만들기·복사만(React 없음).
 */

/**
 * 프리티풀 안드로이드 앱 웹뷰인가 — window.Android(MainActivity addJavascriptInterface(..., "Android")) 로만 판별.
 * ⚠ html[data-platform=android]·UA 로 고르면 갤럭시 크롬 브라우저까지 걸려 멀쩡한 tel: 이 시트로 바뀐다.
 *   앱 빌드에서 JS 인터페이스 이름을 바꾸면 여기도 같이 바꿀 것(채팅 첨부 열기 chat/[id]/page.tsx 도 같은 판별).
 */
export function isAndroidAppShell(): boolean {
  if (typeof window === 'undefined') return false;
  return !!(window as unknown as { Android?: unknown }).Android;
}

/**
 * tel:·mailto: 를 웹이 대신 받아야 하는 앱인가 — 안드 앱이면서 다음 빌드(2.0.7~)의 신호
 * window.Android.supportsExternalSchemes() 가 없을 때(= 2.0.6 이하). 신호가 있는 빌드는 MainActivity 가
 * tel:→전화(DIAL)·mailto:→메일 쓰기(SENDTO)로 직접 넘기므로 평범한 링크 그대로 둔다.
 */
export function needsAndroidSchemeWorkaround(): boolean {
  if (!isAndroidAppShell()) return false;
  const bridge = (window as unknown as { Android?: { supportsExternalSchemes?: () => unknown } }).Android;
  try {
    if (typeof bridge?.supportsExternalSchemes === 'function' && bridge.supportsExternalSchemes() === true) return false;
  } catch {
    /* 신호를 못 읽으면 옛 앱으로 보고 우회 */
  }
  return true;
}

/** 전화번호에서 숫자(+국가번호 앞의 + 하나)만 남긴다 — '02-765-8882' → '027658882' */
export function phoneDigits(raw: string): string {
  const s = String(raw || '').trim();
  const digits = s.replace(/\D/g, '');
  return s.startsWith('+') && digits ? `+${digits}` : digits;
}

/** 보기 좋은 국내 번호 — 02-765-8882 · 010-1234-5678 · 031-123-4567 · 1588-1234. 모르는 꼴은 숫자 그대로 */
export function formatPhoneKr(raw: string): string {
  const d = phoneDigits(raw);
  if (d.startsWith('+')) return d;
  if (d.startsWith('02') && (d.length === 9 || d.length === 10)) {
    return `02-${d.slice(2, d.length - 4)}-${d.slice(-4)}`;
  }
  if (d.startsWith('0') && (d.length === 10 || d.length === 11)) {
    return `${d.slice(0, 3)}-${d.slice(3, d.length - 4)}-${d.slice(-4)}`;
  }
  if (/^1[5-9]\d{6}$/.test(d)) return `${d.slice(0, 4)}-${d.slice(4)}`;
  return d || String(raw || '');
}

/** 번호 끝자리 읽는 소리에 맞춘 조사 — 0(영)·3(삼)·6(육)은 '으로', 나머지는 '로' */
export function phoneJosaRo(raw: string): string {
  const last = phoneDigits(raw).slice(-1);
  return /[036]/.test(last) ? '으로' : '로';
}

/**
 * 지금 앱(2.0.6)이 바깥으로 넘겨 주는 유일한 꼴(intent://)로 만든 '전화 앱 열기' 주소.
 *  · 앱은 Intent.parseUri(url, URI_INTENT_SCHEME) → startActivity 만 한다 → ACTION_DIAL + data 'tel://번호'.
 *    ('intent://' 로 시작해야 앱이 가로채므로 data 에 '//' 가 붙는 건 피할 수 없다 — AOSP 전화 앱은
 *    getSchemeSpecificPart + extractNetworkPortion 으로 걸러 낸다. 삼성 전화 앱은 실기기 확인 전이라 시트에 '번호 복사'를 같이 둔다)
 *  · 전화 앱이 없으면(태블릿) 앱이 예외를 삼키고 화면은 그대로 — 오류 화면은 안 뜬다.
 */
export function androidDialIntentUrl(raw: string): string {
  const d = phoneDigits(raw);
  return `intent://${d}#Intent;scheme=tel;action=android.intent.action.DIAL;end`;
}

/** mailto: 주소에서 받는 사람만 — 'mailto:a@b.com?subject=..' → 'a@b.com' */
export function mailtoAddress(href: string): string {
  const rest = String(href || '').replace(/^mailto:/i, '');
  const addr = rest.split('?')[0];
  try {
    return decodeURIComponent(addr).trim();
  } catch {
    return addr.trim();
  }
}

/**
 * 카카오톡 채널 홈 주소(pf.kakao.com/_xxx)를 1:1 채팅 주소(https://pf.kakao.com/_xxx/chat)로.
 * 채팅 주소는 모바일에서 열리자마자 Kakao 페이지가 스스로 'intent://plusfriend/chat/_xxx#Intent;scheme=kakaoplus;package=com.kakao.talk;end'
 * 로 넘긴다(헤드리스 크롬 안드 웹뷰 UA 로 확인, scratchpad/kakaopf/probe.mjs) → 지금 앱도 intent:// 는 카카오톡으로 넘긴다.
 * 카카오톡이 없으면 Kakao 안내 화면(설치 버튼 = play.google.com → 앱이 스토어로)이 남고, 뒤로가기로 돌아온다 — 오류 화면 없음.
 * 채널 홈 주소가 아니면 null.
 */
export function kakaoChannelChatUrl(href: string): string | null {
  const m = /^(?:https?:)?\/\/pf\.kakao\.com\/(_[A-Za-z0-9]+)\/?(?:[?#].*)?$/i.exec(String(href || '').trim());
  return m ? `https://pf.kakao.com/${m[1]}/chat` : null;
}

/**
 * 글자 복사 — clipboard API 가 막히면(웹뷰·http) 옛 방식(execCommand)으로.
 * (wedding-run/share.ts copyText 와 같은 방식 — 그쪽은 웨딩런 담당이라 따로 둔다)
 */
export async function copyText(text: string): Promise<boolean> {
  try {
    if (navigator.clipboard?.writeText) {
      await navigator.clipboard.writeText(text);
      return true;
    }
  } catch {
    /* 아래 옛 방식 */
  }
  try {
    const ta = document.createElement('textarea');
    ta.value = text;
    ta.setAttribute('readonly', '');
    ta.style.position = 'fixed';
    ta.style.top = '-1000px';
    ta.style.opacity = '0';
    // 앱이 문서 전체에 user-select:none 을 걸어 둬서(MainActivity onPageFinished) 이 칸만 풀어 준다
    ta.style.userSelect = 'text';
    ta.style.webkitUserSelect = 'text';
    document.body.appendChild(ta);
    ta.select();
    ta.setSelectionRange(0, text.length);
    const ok = document.execCommand('copy');
    document.body.removeChild(ta);
    return ok;
  } catch {
    return false;
  }
}
