"use client";

// 웨딩숲 목록 → 글 상세 → 돌아오기: 목록 자리 그대로(261008 사장 "상세 눌렀다가 돌아가면 맨 위로 올라가는데, 그 위치에 있게끔").
//  · 떠날 때 '상단 바 바로 아래 보이던 글 id + 그 카드 화면 위치'를 기억 → 돌아오면 그 글을 같은 화면 위치에 맞춘다.
//    (scrollY 만 기억하면 이미지가 늦게 뜨거나 새 글이 위에 붙을 때 다른 글로 어긋난다)
//  · 정렬·카테고리·태그·검색어·내 글/내 댓글·그려 둔 글 수도 같이 기억해 같은 목록을 같은 길이로 다시 그린다.
//  · 메모리(앱 안 이동) + sessionStorage(상세에서 새로고침한 뒤 뒤로가기) 두 곳. 30분 지나면 버린다.
//  · '돌아올 때'(뒤로가기 = popstate, 또는 뒤로가기로 문서를 새로 받은 경우)만 쓴다. 하단 탭·링크·유니버설 링크·푸시로
//    새로 들어오면 맨 위·등장 애니 그대로 — 남아 있던 기억이 새 진입을 가로채던 것(261008).
//  · 맞추는 동안은 html 의 scroll-behavior:smooth 를 잠깐 끈다 — 맨 위에서부터 굴러 내려오던 것(복원 중 손대면 멈춤).

export interface FeedSnap {
  /** 떠날 때 scrollY(기준 글을 못 찾을 때 대비) */
  y: number;
  /** 상단 바 바로 아래 보이던 글 id */
  anchorId: string | null;
  /** 그 글 카드의 화면 위치(뷰포트 top) */
  anchorTop: number;
  groupId: string;
  tagId: string;
  sort: "popular" | "latest";
  q: string;
  /** 주간 인기글 옆 '내 글 / 내 댓글' 필터 */
  mine?: "" | "posts" | "comments";
  /** 그려 두었던 글 수 */
  renderCount: number;
  /** 열었던 글 */
  postId: string;
  at: number;
}

const SNAP_KEY = "community-feed-snap";
const FROM_KEY = "community-from-feed";
const MAX_AGE_MS = 30 * 60_000;
/** popstate 뒤 목록이 그려지기까지(느린 망에서 RSC 받기 포함) 이 안이면 '돌아온 것' — 그 사이 다른 화면으로 popstate 하면 바로 지운다 */
const RETURN_WINDOW_MS = 60_000;

let memSnap: FeedSnap | null = null;

// ── 돌아오는 중인지(뒤로가기) — 목록이 떠 있지 않을 때 /community 로 popstate 가 오면 표시 ──
let feedMounted = 0;
let popToFeedAt = 0;
let docReturnUsed = false;
const isFeedPath = (p: string) => /^\/community\/?$/.test(p);
if (typeof window !== "undefined") {
  window.addEventListener("popstate", () => {
    if (feedMounted) return;
    popToFeedAt = isFeedPath(window.location.pathname) ? Date.now() : 0;
  });
}

/** 문서를 뒤로가기로 새로 받아 /community 가 열렸는지(사파리 등 — 새로고침한 상세에서 뒤로) */
function docLoadedByBack(): boolean {
  if (docReturnUsed) return false;
  try {
    const nav = performance.getEntriesByType("navigation")[0] as PerformanceNavigationTiming | undefined;
    return !!nav && nav.type === "back_forward" && isFeedPath(new URL(nav.name).pathname);
  } catch {
    return false;
  }
}

/** 지금 목록에 들어오는 게 '뒤로가기로 돌아온 것'인지 — 렌더 중에 읽어도 된다(바꾸지 않음) */
export function isFeedReturn(): boolean {
  if (typeof window === "undefined") return false;
  return (popToFeedAt > 0 && Date.now() - popToFeedAt < RETURN_WINDOW_MS) || docLoadedByBack();
}

/** 목록이 마운트될 때 한 번 — 돌아온 것인지 알려 주고 표시는 지운다 */
export function consumeFeedReturn(): boolean {
  const r = isFeedReturn();
  popToFeedAt = 0;
  docReturnUsed = true;
  return r;
}

/** 목록이 떠 있는 동안 1(그동안 오는 popstate 는 '돌아옴'이 아니다) — 해제 함수를 돌려준다 */
export function noteFeedMounted(): () => void {
  feedMounted += 1;
  return () => {
    feedMounted = Math.max(0, feedMounted - 1);
  };
}

function fresh(s: FeedSnap | null): FeedSnap | null {
  if (!s || typeof s.y !== "number" || Date.now() - (s.at || 0) > MAX_AGE_MS) return null;
  return s;
}

export function saveFeedSnap(s: FeedSnap) {
  memSnap = s;
  try {
    sessionStorage.setItem(SNAP_KEY, JSON.stringify(s));
    sessionStorage.setItem(FROM_KEY, s.postId);
  } catch { /* 저장 불가(사파리 사생활 보호 등)는 메모리만 */ }
}

/** 앱 안 이동으로 돌아온 경우만(메모리) — 첫 로드 하이드레이션과 어긋나지 않게 useState 초기값엔 이것만 쓴다 */
export function peekFeedSnap(): FeedSnap | null {
  memSnap = fresh(memSnap);
  return memSnap;
}

/** 새로고침 뒤 돌아온 경우까지(sessionStorage) — 마운트 뒤에 읽는다 */
export function readFeedSnap(): FeedSnap | null {
  const m = peekFeedSnap();
  if (m) return m;
  try {
    const raw = sessionStorage.getItem(SNAP_KEY);
    return raw ? fresh(JSON.parse(raw) as FeedSnap) : null;
  } catch {
    return null;
  }
}

/** 기억이 있었는데 30분이 지나 버려졌는지(있었으면 지운다) — 그때는 새로 들어온 것처럼 맨 위에서 */
export function takeExpiredFeedSnap(): boolean {
  try {
    const raw = sessionStorage.getItem(SNAP_KEY);
    if (!raw) return false;
    const s = JSON.parse(raw) as FeedSnap;
    if (fresh(s)) return false;
    sessionStorage.removeItem(SNAP_KEY);
    return true;
  } catch {
    return false;
  }
}

export function clearFeedSnap() {
  memSnap = null;
  try { sessionStorage.removeItem(SNAP_KEY); } catch { /* ignore */ }
}

/** 이 글을 웨딩숲 목록에서 눌러 들어왔는지 — 그렇다면 '뒤로'는 새 이동 대신 history 뒤로(목록 자리 유지) */
export function cameFromFeed(postId: string): boolean {
  try { return sessionStorage.getItem(FROM_KEY) === postId; } catch { return false; }
}

export function clearCameFromFeed() {
  try { sessionStorage.removeItem(FROM_KEY); } catch { /* ignore */ }
}

/** 화면에 그려진 카드 중 상단 바(barBottom) 바로 아래 걸친 첫 글 — data-feed-post 속성으로 찾는다 */
export function findFeedAnchor(barBottom: number): { id: string | null; top: number } {
  const cards = document.querySelectorAll<HTMLElement>("[data-feed-post]");
  for (const c of Array.from(cards)) {
    const r = c.getBoundingClientRect();
    if (r.bottom > barBottom + 1) return { id: c.dataset.feedPost || null, top: Math.round(r.top) };
  }
  return { id: null, top: 0 };
}

export interface FeedRestoreCtl {
  /** 즉시 멈춤 */
  cancel: () => void;
  /** 목록 재검증(서버 새 목록)이 들어왔다 — 이제 자리 잡히면 끝내도 된다 */
  release: () => void;
}

/** 기억해 둔 자리로 맞춘다. 이미지·늦게 오는 새 목록(맨 위에 새 글이 붙는 등)으로 높이가 바뀌어도 그 글을 따라간다.
 *  hold=true 면 release() 가 올 때까지(새 목록 대기, 최대 8초) 끝내지 않는다 — 사파리는 스크롤 앵커링이 없어 새 글만큼 밀렸다.
 *  자리 잡혀 0.4초 그대로면 끝(최대 4초). 사용자가 화면을 만지면 즉시 멈춘다.
 *  터치 없는 '맨 위로'(iOS 앱 같은 탭 다시 누르기 = window.scrollTo, 상태바 탭)도 사용자 동작으로 보고 멈춘다. */
export function restoreFeedScroll(snap: FeedSnap, { hold = false, onDone }: { hold?: boolean; onDone?: () => void } = {}): FeedRestoreCtl {
  const html = document.documentElement;
  const prevBehavior = html.style.scrollBehavior;
  html.style.scrollBehavior = "auto";
  let t0 = performance.now();
  let held = hold;
  let raf = 0;
  let stopped = false;
  let stableSince = 0;
  let lastTarget = Number.NaN;
  let lastSet = Number.NaN; // 직전에 우리가 맞춘 뒤의 scrollY
  let self = false; // 우리가 부르는 scrollTo 인지
  // 스크롤 앵커링이 없는 브라우저(사파리·iOS WebView)는 남이 스크롤을 옮기면 scrollY 가 우리 값과 달라진다 — 그걸로 상태바 탭을 알아챈다.
  // 앵커링이 있는 크롬은 이미지가 뜰 때 브라우저가 scrollY 를 옮기므로 이 판정은 쓰지 않는다(아래 scrollTo 가로채기만).
  const noAnchoring = (() => {
    try { return !CSS.supports("overflow-anchor", "auto"); } catch { return false; }
  })();

  const targetOf = () => {
    if (snap.anchorId) {
      const el = document.querySelector<HTMLElement>(`[data-feed-post="${CSS.escape(snap.anchorId)}"]`);
      if (el) return Math.max(0, Math.round(el.getBoundingClientRect().top + window.scrollY - snap.anchorTop));
    }
    return Math.max(0, snap.y);
  };
  const apply = () => {
    const target = targetOf();
    if (Math.abs(window.scrollY - target) > 1) {
      self = true;
      try { window.scrollTo(0, target); } finally { self = false; }
    }
    lastSet = window.scrollY;
    return target;
  };
  const events = ["touchstart", "wheel", "keydown", "mousedown"] as const;
  // 앱이 부르는 window.scrollTo(맨 위로 등) — 우리 것이 아니면 멈추고 그대로 실행(AccountSwitcher 처럼 감싼 것도 그대로 이어 부른다)
  const prevScrollTo = window.scrollTo;
  const prevScroll = window.scroll;
  const prevScrollBy = window.scrollBy;
  const wrap = <F extends (...a: never[]) => void>(orig: F) =>
    function (this: Window, ...args: Parameters<F>) {
      if (!self && !stopped) stop();
      return (orig as unknown as (...a: unknown[]) => void).apply(this, args);
    } as unknown as F;
  const myScrollTo = wrap(prevScrollTo);
  const myScroll = wrap(prevScroll);
  const myScrollBy = wrap(prevScrollBy);
  window.scrollTo = myScrollTo;
  window.scroll = myScroll;
  window.scrollBy = myScrollBy;
  function stop() {
    if (stopped) return;
    stopped = true;
    cancelAnimationFrame(raf);
    events.forEach((e) => window.removeEventListener(e, stop, true));
    // 그 사이 누가 또 감쌌으면(우리 위에) 건드리지 않는다 — 우리 감싸기는 멈춘 뒤엔 그냥 넘겨 준다
    if (window.scrollTo === myScrollTo) window.scrollTo = prevScrollTo;
    if (window.scroll === myScroll) window.scroll = prevScroll;
    if (window.scrollBy === myScrollBy) window.scrollBy = prevScrollBy;
    html.style.scrollBehavior = prevBehavior;
    onDone?.();
  }
  events.forEach((e) => window.addEventListener(e, stop, { capture: true, passive: true }));

  const tick = (now: number) => {
    if (stopped) return;
    if (noAnchoring && !Number.isNaN(lastSet)) {
      // 우리가 맞춘 값에서 위로 벗어났고(맨 위로·상태바 탭), 문서가 줄어 잘린 것도, 기준 글이 움직인 것도 아니면 = 사용자 동작
      const y = window.scrollY;
      const max = html.scrollHeight - window.innerHeight;
      const clamped = y >= max - 2 && lastSet > y;
      if (y < lastSet - 2 && !clamped && y < targetOf() - 2) {
        stop();
        return;
      }
    }
    const target = apply();
    const reachable = html.scrollHeight - window.innerHeight >= target - 1;
    const reached = reachable && Math.abs(window.scrollY - target) <= 1;
    if (reached && target === lastTarget) {
      if (!stableSince) stableSince = now;
    } else {
      stableSince = 0;
    }
    lastTarget = target;
    const settled = !held && stableSince > 0 && now - stableSince > 400 && now - t0 > 600;
    if (settled || now - t0 > (held ? 8000 : 4000)) {
      stop();
      return;
    }
    raf = requestAnimationFrame(tick);
  };
  apply();
  raf = requestAnimationFrame(tick);
  return {
    cancel: stop,
    release: () => {
      if (!held) return;
      held = false;
      // 새 목록이 그려지고 이미지가 자리 잡을 시간을 다시 준다
      t0 = performance.now();
      stableSince = 0;
    },
  };
}
