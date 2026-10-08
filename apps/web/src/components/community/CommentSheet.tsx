"use client";

// 웨딩숲 댓글 시트(261008) — 사장 '이 영상을 완전히 분석해서 댓글 모달 디자인과 인터렉션 다시 해줘' + '댓글 모달에서 뒤 요소가 계속 스크롤되는데 안 되게'.
// 인스타 릴스 댓글 시트(영상 프레임 실측)를 우리 데이터·아이콘·Pretendard 로 다시 그렸다. CommunityClient 의 CommentModal 과 props·API 가 같다.
//  · 열기: 아래에서 스프링(감쇠 0.88·약 0.2초)으로 70% 높이까지, 뒤는 짙게 어두워지고 뒤 화면은 useScrollLock 으로 완전히 잠근다.
//  · 손잡이·'댓글' 머리를 끌면 따라오고, 놓을 때 속도·위치로 닫기/70%/전체를 고른다. 목록 맨 위에서 아래로 끌어도 내려가고,
//    70% 에서 목록을 올리면 먼저 전체 높이로 펼쳐진다. 바깥(어두운 곳)을 누르면 닫힌다.
//  · 불러오는 동안 뼈대(동그라미 + 막대 두 줄) → 댓글: 아바타·이름(시간·작성자)·본문(@멘션 파랑)·답글 달기·오른쪽 하트+수.
//  · 답글은 32 들여쓰기, 3개 이상이면 '답글 N개 더 보기'로 접는다.
//  · 길게 누르면(0.48초, 누르는 동안 살짝 커짐) 그 댓글만 흰 카드로 떠오르고 나머지는 20% 어두워지며 유리 메뉴 —
//    내 댓글: 답글 달기·수정·삭제 / 남의 댓글: 답글 달기·차단·신고(빨강). 데스크톱은 오른쪽 클릭.
//  · 답글 달기: 그 댓글이 하늘색으로 2초 깜빡, '○○님에게 답글 남기는 중 ×' 줄, 입력칸에 '@닉네임 ', 파란 보내기 —
//    키보드가 뜨면 시트는 전체 높이. ×는 답글을 접고 입력칸을 비운다(영상 그대로).
//  · 입력칸 위 빠른 이모지 줄(❤️🙌🔥👏😢😍😮😂) — 누르면 입력칸 커서 자리에 넣는다.
import "./comment-sheet.css";
import {
  memo,
  useCallback,
  useEffect,
  useLayoutEffect,
  useMemo,
  useRef,
  useState,
  type CSSProperties,
  type KeyboardEvent as ReactKeyboardEvent,
  type MouseEvent as ReactMouseEvent,
  type PointerEvent as ReactPointerEvent,
  type ReactNode,
} from "react";
import { createPortal } from "react-dom";
import { AnimatePresence, animate, motion, useMotionValue, type AnimationPlaybackControls } from "framer-motion";
import { cfetch } from "@/lib/community/cfetch";
import { useAuthStore } from "@/lib/store/auth.store";
import { useKeyboardInset } from "@/lib/useKeyboardInset";
import { formatRelativeTime, formatExactTime } from "@/lib/relativeTime";
import { personaBody } from "@/lib/community/persona-store";
import { fetchMyNickname, type MyNickname } from "@/lib/community/my-nickname";
import NicknameBar from "@/components/community/NicknameBar";
import { useActiveEditor } from "@/components/community/PersonaPicker";
import AlertModal from "@/components/AlertModal";
import { useScrollLock } from "./useScrollLock";

/** CommunityClient 의 CommunityPost 중 시트가 쓰는 것만(구조 타입이라 그대로 넘기면 된다) */
export interface CommentSheetPost {
  id: string;
  nickname: string;
  title?: string;
  userId?: string | null;
}

export interface SheetComment {
  id: string;
  userId: string | null;
  parentId: string | null;
  nickname: string;
  avatar?: string | null;
  content: string;
  createdAt: string;
  likeCount: number;
  likedByMe: boolean;
  replies: SheetComment[];
  /** 내가 운영진 에디터 이름으로 단 댓글(260930) — 고치기·지우기 가능 */
  postedByMe?: boolean;
  isPostAuthor?: boolean;
  authorRole?: string | null;
  isEdited?: boolean;
  isActive?: boolean;
  isBlocked?: boolean;
  isPinned?: boolean;
}

type SortKey = "popular" | "newest";
const SORTS: { key: SortKey; label: string }[] = [
  { key: "popular", label: "인기순" },
  { key: "newest", label: "최신순" },
];
export const QUICK_EMOJIS = ["❤️", "🙌", "🔥", "👏", "😢", "😍", "😮", "😂"];
const REPORT_REASONS = ["스팸/광고", "욕설/비방", "음란물/선정성", "혐오 발언", "개인정보 노출", "기타"];

// 영상 실측 스프링 — 열기 0.6초 프레임: 감쇠비 0.88 · ω 28.5(질량 1) / 키보드와 함께 펼칠 때: 0.92 · 30.5
const SPRING_OPEN = { type: "spring" as const, stiffness: 812, damping: 50, mass: 1, restDelta: 0.5, restSpeed: 20 };
const SPRING_EXPAND = { type: "spring" as const, stiffness: 930, damping: 56, mass: 1, restDelta: 0.5, restSpeed: 20 };
const LONG_PRESS_MS = 480;
const FLASH_MS = 2100; // 하늘색 강조가 남아 있는 시간(영상 6.02→8.12초)
const MENU_W = 250;
const MENU_ROW = 38;
const MENU_PAD = 11;
const REPLIES_SHOWN = 2;

type Mode = { kind: "reply" | "edit"; target: SheetComment } | null;
type MenuItemKey = "reply" | "edit" | "delete" | "block" | "report";
type MenuState = {
  c: SheetComment;
  depth: number;
  rowTop: number; // 루트 기준 그 댓글 줄 윗변
  textWidth: number; // 본문 칸 폭(카드에서도 줄바꿈이 같게)
  sheetLeft: number;
  sheetWidth: number;
  minTop: number;
  point: { x: number; y: number };
  items: MenuItemKey[];
};

const shortTime = (d: string) => formatRelativeTime(d).replace(/ 전$/, "");
const isDead = (c: SheetComment) => c.isActive === false || !!c.isBlocked;
const formatCount = (n: number) => (n >= 10000 ? `${(n / 10000).toFixed(1).replace(/\.0$/, "")}만` : String(n));

function countAll(list: SheetComment[]): number {
  return list.reduce((s, c) => s + 1 + countAll(c.replies || []), 0);
}
function updateIn(list: SheetComment[], id: string, fn: (c: SheetComment) => SheetComment): SheetComment[] {
  return list.map((c) => (c.id === id ? fn(c) : { ...c, replies: updateIn(c.replies || [], id, fn) }));
}
function rootIdOf(list: SheetComment[], id: string): string | null {
  for (const c of list) {
    if (c.id === id) return c.id;
    if ((c.replies || []).some((r) => r.id === id)) return c.id;
  }
  return null;
}

// @멘션 — 이 글의 닉네임(띄어쓰기 포함)을 길이순으로 먼저, 그다음 '@글자들'
function mentionPattern(names: string[]): RegExp {
  const known = Array.from(new Set(names.filter(Boolean)))
    .sort((a, b) => b.length - a.length)
    .map((n) => n.replace(/[.*+?^${}()|[\]\\]/g, "\\$&"));
  return new RegExp(`${known.length ? `@(?:${known.join("|")})|` : ""}@[^\\s@]{1,30}`, "g");
}
// 이모지(피부색·ZWJ 묶음 포함) — 본문보다 한 단계 크게 감싼다
const EMOJI_RE: RegExp = (() => {
  try {
    return new RegExp("\\p{Extended_Pictographic}(?:\\uFE0F|\\u200D\\p{Extended_Pictographic}|[\\u{1F3FB}-\\u{1F3FF}])*", "gu");
  } catch {
    // 유니코드 속성을 모르는 구형 WebView — 흔한 이모지 영역만
    return /(?:[\u2600-\u27BF]|\uD83C[\uDF00-\uDFFF]|\uD83D[\uDC00-\uDE4F\uDE80-\uDEFF]|\uD83E[\uDD00-\uDDFF])\uFE0F?/g;
  }
})();
// '#'·'@' 바로 뒤에서 줄이 바뀌어 기호만 덩그러니 남지 않게(크롬은 '#|유머스타그램' 사이를 끊는다) — 보이지 않는 글자 이음표
const glue = (t: string) => t.replace(/([#@])(?=[^\s#@])/g, "$1\u2060");
// key 는 조각 번호(seg)+조각 안 위치로 — 이음표를 끼운 뒤 위치에 원문 위치를 더하던 예전 방식은 조각끼리 key 가 겹쳤다
function withEmoji(raw: string, seg: number): ReactNode[] {
  const text = glue(raw);
  const out: ReactNode[] = [];
  let last = 0;
  EMOJI_RE.lastIndex = 0;
  for (let m = EMOJI_RE.exec(text); m; m = EMOJI_RE.exec(text)) {
    if (m.index > last) out.push(text.slice(last, m.index));
    out.push(<span key={`e${seg}-${m.index}`} className="cmt-emo">{m[0]}</span>);
    last = m.index + m[0].length;
  }
  if (last < text.length) out.push(text.slice(last));
  return out;
}
function renderText(text: string, re: RegExp): ReactNode {
  const out: ReactNode[] = [];
  let last = 0;
  let seg = 0;
  re.lastIndex = 0;
  for (let m = re.exec(text); m; m = re.exec(text)) {
    if (m.index > last) out.push(...withEmoji(text.slice(last, m.index), seg++));
    out.push(<span key={`m${m.index}`} className="cmt-mention">{glue(m[0])}</span>);
    last = m.index + m[0].length;
    if (m[0].length === 0) re.lastIndex += 1;
  }
  if (last < text.length) out.push(...withEmoji(text.slice(last), seg++));
  return out;
}

// ── 아이콘(직접 그린 선 아이콘) ──
function HeartIcon({ filled }: { filled: boolean }) {
  return (
    <svg width="18.7" height="18.7" viewBox="0 0 24 24" aria-hidden="true">
      <path
        d="M12 20.3 10.7 19.1C6 14.9 3 12.2 3 8.9 3 6.2 5.1 4.1 7.8 4.1c1.5 0 3 .7 4.2 1.9 1.2-1.2 2.7-1.9 4.2-1.9 2.7 0 4.8 2.1 4.8 4.8 0 3.3-3 6-7.7 10.2L12 20.3Z"
        fill={filled ? "currentColor" : "none"}
        stroke="currentColor"
        strokeWidth={filled ? 0 : 1.9}
        strokeLinejoin="round"
      />
    </svg>
  );
}
function ArrowUpIcon() {
  return (
    <svg width="16" height="16" viewBox="0 0 24 24" fill="none" aria-hidden="true">
      <path d="M12 19.5V5M5.8 11.2 12 5l6.2 6.2" stroke="currentColor" strokeWidth="2.6" strokeLinecap="round" strokeLinejoin="round" />
    </svg>
  );
}
function XIcon() {
  return (
    <svg width="10" height="10" viewBox="0 0 10 10" fill="none" aria-hidden="true">
      <path d="M1.2 1.2 8.8 8.8M8.8 1.2 1.2 8.8" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" />
    </svg>
  );
}
function ChevronIcon() {
  return (
    <svg width="9" height="9" viewBox="0 0 12 12" fill="none" aria-hidden="true">
      <path d="M2.5 4.5 6 8l3.5-3.5" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round" />
    </svg>
  );
}
function PinIcon() {
  return (
    <svg width="10" height="10" viewBox="0 0 24 24" fill="none" aria-hidden="true">
      <path d="M9 3h6l-1 6 4 4H6l4-4-1-6ZM12 13v8" stroke="currentColor" strokeWidth="2.2" strokeLinejoin="round" strokeLinecap="round" />
    </svg>
  );
}
function DefaultAvatar() {
  return (
    <svg viewBox="0 0 44 44" aria-hidden="true">
      <rect width="44" height="44" fill="#EFF0F2" />
      <circle cx="22" cy="17" r="7.6" fill="#8D9298" />
      <path d="M7.5 41.5c1.8-7.6 7.6-11.6 14.5-11.6s12.7 4 14.5 11.6" fill="#8D9298" />
    </svg>
  );
}
const MENU_ICON: Record<MenuItemKey, ReactNode> = {
  reply: (
    <svg viewBox="0 0 24 24" fill="none" aria-hidden="true">
      <path d="M9.5 6.5 4.5 11.5l5 5" stroke="currentColor" strokeWidth="1.7" strokeLinecap="round" strokeLinejoin="round" />
      <path d="M5 11.5h8.5a6 6 0 0 1 6 6v1" stroke="currentColor" strokeWidth="1.7" strokeLinecap="round" />
    </svg>
  ),
  edit: (
    <svg viewBox="0 0 24 24" fill="none" aria-hidden="true">
      <path d="M4.5 19.5h3.8L18.6 9.2a2.1 2.1 0 0 0-3-3L5.3 16.5v3Z" stroke="currentColor" strokeWidth="1.7" strokeLinejoin="round" />
      <path d="m13.8 8 2.6 2.6" stroke="currentColor" strokeWidth="1.7" strokeLinecap="round" />
    </svg>
  ),
  delete: (
    <svg viewBox="0 0 24 24" fill="none" aria-hidden="true">
      <path d="M4.5 7h15M9.5 7V5.2c0-.5.4-.9.9-.9h3.2c.5 0 .9.4.9.9V7M6.5 7l.9 12.1c.1 1 .9 1.7 1.9 1.7h5.4c1 0 1.8-.7 1.9-1.7L17.5 7M10.3 11v5.6M13.7 11v5.6" stroke="currentColor" strokeWidth="1.7" strokeLinecap="round" strokeLinejoin="round" />
    </svg>
  ),
  block: (
    <svg viewBox="0 0 24 24" fill="none" aria-hidden="true">
      <circle cx="12" cy="12" r="8.6" stroke="currentColor" strokeWidth="1.8" />
      <path d="M6 6l12 12" stroke="currentColor" strokeWidth="1.8" />
    </svg>
  ),
  report: (
    <svg viewBox="0 0 24 24" fill="none" aria-hidden="true">
      <path d="M6.2 4h11.6c1.2 0 2.2 1 2.2 2.2v8.6c0 1.2-1 2.2-2.2 2.2H13l-3.6 3.2V17H6.2C5 17 4 16 4 14.8V6.2C4 5 5 4 6.2 4Z" stroke="currentColor" strokeWidth="1.7" strokeLinejoin="round" />
      <path d="M12 7.8v4.4" stroke="currentColor" strokeWidth="1.9" strokeLinecap="round" />
      <circle cx="12" cy="14.6" r="1.05" fill="currentColor" />
    </svg>
  ),
};
const MENU_LABEL: Record<MenuItemKey, string> = { reply: "답글 달기", edit: "수정", delete: "삭제", block: "차단", report: "신고" };

// ── 댓글 한 줄의 '내용'(아바타·이름 줄·본문) — 목록과 길게 눌렀을 때 카드가 같이 쓴다 ──
function CommentBody({ c, re, textWidth }: { c: SheetComment; re: RegExp; textWidth?: number }) {
  const dead = isDead(c);
  return (
    <>
      <span className="cmt-av" aria-hidden="true">
        {c.avatar && !dead ? (
          // eslint-disable-next-line @next/next/no-img-element
          <img src={c.avatar} alt="" referrerPolicy="no-referrer" decoding="async" draggable={false} />
        ) : (
          c.nickname.slice(0, 1)
        )}
      </span>
      <div className="cmt-main" style={textWidth ? { flex: "none", width: textWidth } : undefined}>
        {c.isPinned && (
          <div className="cmt-pin">
            <PinIcon />
            고정된 댓글
          </div>
        )}
        <div className="cmt-nameline">
          <span className="cmt-nick">{c.nickname}</span>
          {c.authorRole && <span className="cmt-role">{c.authorRole}</span>}
          <span className="cmt-meta" title={formatExactTime(c.createdAt)}>
            {shortTime(c.createdAt)}
            {c.isPostAuthor ? " · 작성자" : ""}
            {c.isEdited ? " · 수정됨" : ""}
          </span>
        </div>
        <p className={`cmt-text${dead ? " is-dead" : ""}`}>{dead ? c.content : renderText(c.content, re)}</p>
      </div>
    </>
  );
}

type RowProps = {
  c: SheetComment;
  depth: number;
  re: RegExp;
  flash: boolean;
  lifted: boolean;
  pop: boolean;
  onReply: (c: SheetComment) => void;
  onLike: (c: SheetComment) => void;
  onPress: (c: SheetComment, depth: number, body: HTMLElement, point: { x: number; y: number }) => void;
};

const CommentRow = memo(function CommentRow({ c, depth, re, flash, lifted, pop, onReply, onLike, onPress }: RowProps) {
  const bodyRef = useRef<HTMLDivElement | null>(null);
  const press = useRef<{ id: number; x: number; y: number; timer: number } | null>(null);
  const [pressing, setPressing] = useState(false);
  const suppressClick = useRef(0); // 길게 눌러 메뉴를 연 뒤 손을 떼면 오는 click(답글 달기·하트로 감)을 버린다
  const dead = isDead(c);

  const cancel = () => {
    if (press.current) window.clearTimeout(press.current.timer);
    press.current = null;
    setPressing(false);
  };
  useEffect(() => () => { if (press.current) window.clearTimeout(press.current.timer); }, []);

  // 길게 누르기는 줄 전체에서(답글 달기·하트 위도 — 손가락 보정으로 단추에 붙는 일이 많다), 떠오르는 효과는 내용(cmt-body)만
  return (
    <div
      className={`cmt-row${depth ? " is-reply" : ""}${flash ? " is-flash" : ""}`}
      data-cid={c.id}
      onPointerDown={(e) => {
        if (dead || (e.pointerType === "mouse" && e.button !== 0)) return;
        const x = e.clientX;
        const y = e.clientY;
        if (press.current) window.clearTimeout(press.current.timer);
        const timer = window.setTimeout(() => {
          press.current = null;
          setPressing(false);
          suppressClick.current = Date.now();
          if (bodyRef.current) onPress(c, depth, bodyRef.current, { x, y });
        }, LONG_PRESS_MS);
        press.current = { id: e.pointerId, x, y, timer };
        setPressing(true);
      }}
      onPointerMove={(e) => {
        const p = press.current;
        if (p && p.id === e.pointerId && Math.hypot(e.clientX - p.x, e.clientY - p.y) > 8) cancel();
      }}
      onPointerUp={cancel}
      onPointerCancel={cancel}
      onPointerLeave={cancel}
      onClickCapture={(e) => {
        if (suppressClick.current && Date.now() - suppressClick.current < 1500) {
          e.stopPropagation();
          e.preventDefault();
        }
        suppressClick.current = 0;
      }}
      onContextMenu={(e) => {
        // 안드 크롬 길게 누르기·데스크톱 오른쪽 클릭 — 브라우저 메뉴 대신 우리 메뉴
        e.preventDefault();
        if (dead || !bodyRef.current) return;
        cancel();
        onPress(c, depth, bodyRef.current, { x: e.clientX, y: e.clientY });
      }}
    >
      <div ref={bodyRef} className={`cmt-body${pressing ? " is-pressing" : ""}${lifted ? " is-lifted" : ""}`}>
        <CommentBody c={c} re={re} />
      </div>
      {!dead && (
        <>
          <div className="cmt-foot">
            <button type="button" className="cmt-replybtn" onClick={() => onReply(c)}>
              답글 달기
            </button>
          </div>
          <div className="cmt-like">
            <button
              type="button"
              className={`cmt-heart${c.likedByMe ? " is-on" : ""}${pop ? " is-pop" : ""}`}
              aria-pressed={c.likedByMe}
              aria-label={c.likedByMe ? "좋아요 취소" : "좋아요"}
              onClick={() => onLike(c)}
            >
              <HeartIcon filled={c.likedByMe} />
            </button>
            {c.likeCount > 0 && <span className="cmt-count">{formatCount(c.likeCount)}</span>}
          </div>
        </>
      )}
    </div>
  );
});

// ── 길게 누른 댓글: 20% 어둠 + 흰 카드 + 유리 메뉴 ──
function ContextLayer({
  menu,
  re,
  rootH,
  focusMenu,
  onClose,
  onPick,
}: {
  menu: MenuState;
  re: RegExp;
  rootH: number;
  /** 열리자마자 첫 항목으로 포커스(키보드·스크린리더가 바로 닿게) — 터치로 입력 중(키보드 떠 있음)이면 false */
  focusMenu: boolean;
  onClose: () => void;
  onPick: (key: MenuItemKey) => void;
}) {
  const cardRef = useRef<HTMLDivElement | null>(null);
  const menuRef = useRef<HTMLDivElement | null>(null);
  const [cardH, setCardH] = useState(0);
  useLayoutEffect(() => setCardH(cardRef.current?.offsetHeight || 0), []);
  useLayoutEffect(() => {
    if (focusMenu) menuRef.current?.querySelector<HTMLElement>('[role="menuitem"]')?.focus({ preventScroll: true });
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);
  // 메뉴 안 키보드: ↑↓·Home·End 로 항목 사이, Tab 은 메뉴 안에서 돈다(aria-modal 시트 뒤 피드로 새지 않게). Esc 는 시트가 받는다.
  const onKeyDown = (e: ReactKeyboardEvent) => {
    const items = Array.from(menuRef.current?.querySelectorAll<HTMLElement>('[role="menuitem"]') ?? []);
    if (!items.length) return;
    const i = items.indexOf(document.activeElement as HTMLElement);
    const n = items.length;
    let next = -1;
    if (e.key === "ArrowDown") next = i < 0 ? 0 : (i + 1) % n;
    else if (e.key === "ArrowUp") next = i < 0 ? n - 1 : (i - 1 + n) % n;
    else if (e.key === "Home") next = 0;
    else if (e.key === "End") next = n - 1;
    else if (e.key === "Tab") next = i < 0 ? 0 : (i + (e.shiftKey ? n - 1 : 1)) % n;
    if (next < 0) return;
    e.preventDefault();
    items[next].focus({ preventScroll: true });
  };
  const cardLeft = menu.sheetLeft + 20;
  const cardW = menu.sheetWidth - 40;
  const cardTop = menu.rowTop;
  const menuH = MENU_PAD * 2 + MENU_ROW * menu.items.length;
  const menuLeft = Math.max(menu.sheetLeft + 12, cardLeft + cardW - MENU_W);
  // 영상: 카드 위 20 띄워 오른쪽 끝을 맞춘다 — 위에 자리가 없으면 아래로
  let menuTop = cardTop - 20 - menuH;
  if (menuTop < menu.minTop) {
    menuTop = cardTop + cardH + 14;
    if (menuTop + menuH > rootH - 12) menuTop = Math.max(menu.minTop, rootH - 12 - menuH);
  }
  const dx = (menu.depth ? 50 : 12) - (20 + 10); // 줄 안 아바타 자리 → 카드 안 자리
  // 길게 누른 손가락을 떼면 iOS·안드가 click 을 하나 더 보낸다 — 이 층에서 새로 누른 손가락만 받는다(안 그러면 열리자마자 닫힘)
  const armed = useRef<EventTarget | null>(null);
  const arm = (e: ReactPointerEvent) => {
    armed.current = e.target;
  };
  const fresh = (e: ReactMouseEvent) => armed.current !== null && (armed.current === e.target || (e.currentTarget as Node).contains(armed.current as Node));
  return (
    <div
      className="cmt-ctx"
      onPointerDown={arm}
      // 메뉴를 연 손가락을 뗄 때·바깥을 누를 때 오는 mousedown 이 포커스를 body 로 빼지 않게(포커스는 위에서 직접 옮긴다)
      onMouseDown={(e) => e.preventDefault()}
      onKeyDown={onKeyDown}
      onClick={(e) => {
        if (fresh(e)) onClose();
      }}
      onContextMenu={(e) => e.preventDefault()}
    >
      <motion.div
        className="cmt-ctx-dim"
        initial={{ opacity: 0 }}
        animate={{ opacity: 1, transition: { duration: 0.12, ease: "easeOut" } }}
        exit={{ opacity: 0, transition: { duration: 0.22, ease: "easeOut" } }}
      />
      <motion.div
        ref={cardRef}
        className="cmt-card"
        style={{ left: cardLeft, width: cardW, top: cardTop }}
        initial={{ x: dx, scale: 1.03 }}
        animate={{ x: 0, scale: 1, transition: { type: "spring", stiffness: 620, damping: 40 } }}
        exit={{ x: dx, scale: 1, transition: { duration: 0.12, ease: "easeOut" } }}
      >
        <div className={`cmt-row${menu.depth ? " is-reply" : ""}`}>
          <div className="cmt-body">
            <CommentBody c={menu.c} re={re} textWidth={menu.textWidth} />
          </div>
        </div>
      </motion.div>
      <motion.div
        ref={menuRef}
        className="cmt-menu"
        role="menu"
        aria-label={`${menu.c.nickname}님의 댓글`}
        style={{ left: menuLeft, top: menuTop, transformOrigin: `${menu.point.x - menuLeft}px ${menu.point.y - menuTop}px` }}
        initial={{ opacity: 0, scale: 0.78 }}
        animate={{ opacity: 1, scale: 1, transition: { type: "spring", stiffness: 700, damping: 40, opacity: { duration: 0.08 } } }}
        exit={{ opacity: 0, scale: 0.86, transition: { duration: 0.1, ease: "easeIn" } }}
        onClick={(e) => e.stopPropagation()}
      >
        {menu.items.map((key) => (
          <button
            key={key}
            type="button"
            role="menuitem"
            className={`cmt-mi${key === "delete" || key === "report" ? " is-danger" : ""}`}
            onClick={(e) => {
              if (fresh(e) || e.detail === 0) onPick(key); // detail 0 = 키보드(Enter·Space)
            }}
          >
            {MENU_ICON[key]}
            {MENU_LABEL[key]}
          </button>
        ))}
      </motion.div>
    </div>
  );
}

export default function CommentSheet({
  post,
  onClose,
  onCountChange,
}: {
  post: CommentSheetPost;
  onClose: () => void;
  onCountChange: (delta: number) => void; // 카드의 댓글 수 갱신(+1 등록, -1 삭제)
}) {
  const [comments, setComments] = useState<SheetComment[]>([]);
  const [loading, setLoading] = useState(true);
  const [refetching, setRefetching] = useState(false);
  const [sort, setSort] = useState<SortKey>("popular");
  const [text, setText] = useState("");
  const [posting, setPosting] = useState(false);
  const [toast, setToast] = useState("");
  const [meId, setMeId] = useState<string | null>(null);
  const [me, setMe] = useState<{ nickname: string; avatar: string | null } | null>(null);
  const [identity, setIdentity] = useState<MyNickname | null>(null);
  const activeEditor = useActiveEditor(identity);
  const inputMe = activeEditor ? { nickname: activeEditor.name, avatar: activeEditor.avatar } : me;
  const [mode, setMode] = useState<Mode>(null);
  const [flashId, setFlashId] = useState<string | null>(null);
  const [popId, setPopId] = useState<string | null>(null);
  const [menu, setMenu] = useState<MenuState | null>(null);
  const [liftedId, setLiftedId] = useState<string | null>(null);
  const [sortPop, setSortPop] = useState<{ top: number; right: number } | null>(null);
  const [expanded, setExpanded] = useState<Set<string>>(() => new Set());
  const [confirm, setConfirm] = useState<{ kind: "delete" | "block"; c: SheetComment } | null>(null);
  const [reportTarget, setReportTarget] = useState<SheetComment | null>(null);
  const [reportBusy, setReportBusy] = useState(false);
  const [focused, setFocused] = useState(false);
  const [rootH, setRootH] = useState(0);
  const loggedIn = useAuthStore((s) => !!s.accessToken && !!s.user);

  const rootRef = useRef<HTMLDivElement | null>(null);
  const probeRef = useRef<HTMLDivElement | null>(null);
  const dimRef = useRef<HTMLDivElement | null>(null);
  const sheetRef = useRef<HTMLDivElement | null>(null);
  const listRef = useRef<HTMLDivElement | null>(null);
  const inputRef = useRef<HTMLTextAreaElement | null>(null);
  const sortBtnRef = useRef<HTMLButtonElement | null>(null);
  const onCloseRef = useRef(onClose);
  onCloseRef.current = onClose;

  // 뒤 화면 잠금(body fixed + 터치 가드 + 페이지 제스처 차단)
  useScrollLock(true);
  // 닫히면 연 단추(카드의 댓글 단추 등)로 포커스를 돌려준다 — 시트가 스스로 포커스를 가져가기(다음 프레임) 전에 기억
  useLayoutEffect(() => {
    const opener = document.activeElement as HTMLElement | null;
    return () => {
      if (opener && opener !== document.body && opener.isConnected && !rootRef.current?.contains(opener)) opener.focus({ preventScroll: true });
    };
  }, []);
  // 안드 WebView: 키보드가 떠도 fixed 기준 화면이 안 줄어 입력칸이 키보드 뒤로 숨는다 → 겹친 만큼 시트 바닥을 올린다
  const keyboardInset = useKeyboardInset(true, rootRef);
  const insetRef = useRef(0);
  insetRef.current = keyboardInset;

  // ── 시트 위치: p = 루트 기준 시트 윗변(px). 70% 위쪽이면 높이를 키우고, 아래쪽이면 높이는 두고 내린다(내리는 건 transform 만) ──
  const p = useMotionValue(10000);
  const geo = useRef({ H: 0, avail: 0, full: 0, half: 0, hidden: 0 });
  const anim = useRef<AnimationPlaybackControls | null>(null);
  const detent = useRef<"half" | "full">("half");
  const closing = useRef(false);
  const opened = useRef(false);
  const dragging = useRef(false);
  const isTouch = useRef(false);
  const isIosApp = useRef(false);
  const isAndroid = useRef(false);
  const animTarget = useRef<number | null>(null);

  const apply = useCallback((v: number) => {
    const g = geo.current;
    const sheet = sheetRef.current;
    if (!sheet || !g.avail) return;
    const h = v <= g.half ? g.avail - v : g.avail - g.half;
    const y = v <= g.half ? 0 : v - g.half;
    sheet.style.height = `${Math.max(0, Math.round(h * 2) / 2)}px`;
    sheet.style.transform = `translate3d(0, ${Math.round(y * 2) / 2}px, 0)`;
    const fade = v <= g.half ? 1 : Math.max(0, 1 - (v - g.half) / Math.max(1, g.avail - g.half));
    if (dimRef.current) dimRef.current.style.opacity = String(fade);
  }, []);

  const measure = useCallback(() => {
    const root = rootRef.current;
    if (!root) return;
    const H = root.clientHeight;
    const avail = H - insetRef.current;
    const vv = typeof window !== "undefined" ? window.visualViewport : null;
    // iOS: 키보드가 뜨면 보이는 높이(visualViewport)만 줄고 fixed 기준은 그대로 — 시트를 보이는 높이에 맞추면 iOS 가 올려 준 뒤 딱 맞는다.
    // 안드: 키보드는 useKeyboardInset(시트 바닥 올림)이 맡는다 — 여기서 vv 높이까지 보면 인셋이 반영되기 전 한 박자 동안 두 번 빼서 시트가 튄다.
    const vis = !isAndroid.current && vv && H - vv.height > 80 ? Math.min(avail, vv.height) : avail;
    const safeTop = probeRef.current?.offsetHeight || 0;
    const full = Math.max(0, avail - (vis - safeTop));
    // 70% 높이(영상: 화면 30% 지점). iOS 앱은 웹뷰가 상태바·홈바 안쪽이라 화면 기준 30% 를 맞추려면 26%
    const ratio = isIosApp.current ? 0.26 : 0.3;
    const half = Math.max(full, avail - Math.round(vis * (1 - ratio)));
    geo.current = { H, avail, full, half, hidden: avail + 24 };
    setRootH(H);
  }, []);

  const run = useCallback(
    (target: number, spring: typeof SPRING_OPEN, velocity = 0, onComplete?: () => void) => {
      anim.current?.stop();
      animTarget.current = target;
      const reduce = typeof window !== "undefined" && window.matchMedia?.("(prefers-reduced-motion: reduce)").matches;
      const done = () => {
        animTarget.current = null;
        onComplete?.();
      };
      anim.current = reduce
        ? animate(p, target, { duration: 0.12, ease: "easeOut", onComplete: done })
        : animate(p, target, { ...spring, velocity, onComplete: done });
    },
    [p]
  );

  const kbOpen = focused && (isTouch.current || (geo.current.avail > 0 && geo.current.full > 80));
  const kbRef = useRef(false);
  kbRef.current = kbOpen;

  const goDetent = useCallback(
    (d: "half" | "full", velocity = 0) => {
      detent.current = d;
      const g = geo.current;
      run(d === "full" ? g.full : g.half, d === "full" ? SPRING_EXPAND : SPRING_OPEN, velocity);
    },
    [run]
  );

  const finishClose = useRef(false);
  const close = useCallback(
    (velocity = 0) => {
      if (closing.current) return;
      closing.current = true;
      // 닫히는 동안(딤이 다 사라진 뒤에도 0.2초쯤) 투명한 루트가 뒤 화면 탭을 먹지 않게 — 손가락은 바로 뒤 화면으로
      for (const el of [rootRef.current, dimRef.current, sheetRef.current]) if (el) el.style.pointerEvents = "none";
      setMenu(null);
      setSortPop(null);
      inputRef.current?.blur();
      const done = () => {
        if (finishClose.current) return;
        finishClose.current = true;
        onCloseRef.current();
        // iOS 앱 네이티브 탭바 — 창이 사라졌다고 바로 알린다
        window.setTimeout(() => (window as unknown as { __freetifulNativeNavPostState?: (f?: boolean) => void }).__freetifulNativeNavPostState?.(true), 80);
      };
      run(geo.current.hidden, SPRING_OPEN, Math.max(0, velocity), done);
      window.setTimeout(done, 650);
    },
    [run]
  );

  // 개발 중 점검용(실험실·자동 검사) — 운영 빌드엔 없음
  useEffect(() => {
    if (process.env.NODE_ENV === "production") return;
    (window as unknown as { __cmtDebug?: unknown }).__cmtDebug = { geo, p, detent, insetRef };
  }, [p]);

  // 첫 그림 전에 자리 잡기 → 다음 프레임에 70% 까지 스프링
  useLayoutEffect(() => {
    isTouch.current = typeof window !== "undefined" && !!window.matchMedia?.("(pointer: coarse)").matches;
    isIosApp.current = !!(window as unknown as { webkit?: { messageHandlers?: { nativeNavState?: unknown } } }).webkit?.messageHandlers?.nativeNavState;
    isAndroid.current = /Android/i.test(navigator.userAgent); // useKeyboardInset 과 같은 기준
    measure();
    const unsub = p.on("change", apply);
    p.set(geo.current.hidden);
    apply(geo.current.hidden);
    const raf = window.requestAnimationFrame(() => {
      opened.current = true;
      goDetent("half");
      sheetRef.current?.focus({ preventScroll: true });
      (window as unknown as { __freetifulNativeNavPostState?: (f?: boolean) => void }).__freetifulNativeNavPostState?.(true);
    });
    return () => {
      unsub();
      window.cancelAnimationFrame(raf);
      anim.current?.stop();
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  // 화면·키보드가 바뀌면 다시 재고 지금 단계 자리로
  const retarget = useCallback(() => {
    measure();
    if (!opened.current || closing.current || dragging.current) return;
    const g = geo.current;
    const target = detent.current === "full" ? g.full : g.half;
    // 다른 자리로 가던 중이면(키보드가 오르내리는 사이 목표가 바뀜) 지금 값이 같아도 다시 겨눈다
    const inFlight = animTarget.current !== null && Math.abs(animTarget.current - target) > 0.5;
    if (inFlight || Math.abs(p.get() - target) > 0.5) run(target, SPRING_EXPAND);
    else apply(p.get());
  }, [measure, run, apply, p]);

  useEffect(() => {
    const vv = window.visualViewport;
    window.addEventListener("resize", retarget);
    vv?.addEventListener("resize", retarget);
    vv?.addEventListener("scroll", retarget);
    return () => {
      window.removeEventListener("resize", retarget);
      vv?.removeEventListener("resize", retarget);
      vv?.removeEventListener("scroll", retarget);
    };
  }, [retarget]);
  useEffect(() => {
    retarget();
  }, [keyboardInset, retarget]);

  // ── 끌기(머리: 포인터 / 목록: 맨 위에서 아래로 · 70% 에서 위로) ──
  const drag = useRef<{ startY: number; startP: number; moved: boolean; samples: { t: number; y: number }[] } | null>(null);
  const dragStart = useCallback(
    (y: number) => {
      if (closing.current) return;
      drag.current = { startY: y, startP: p.get(), moved: false, samples: [{ t: performance.now(), y }] };
    },
    [p]
  );
  const dragMove = useCallback(
    (y: number) => {
      const d = drag.current;
      if (!d || closing.current) return false;
      if (!d.moved) {
        const dy0 = y - d.startY;
        if (Math.abs(dy0) < 4) return false;
        // 실제로 움직일 때 붙잡는다 — 눌렀다 떼기만 하면(단추 누르기) 올라오던 애니메이션이 멈추지 않게
        d.moved = true;
        dragging.current = true;
        anim.current?.stop();
        d.startY = y;
        d.startP = p.get();
        d.samples = [{ t: performance.now(), y }];
        // 키보드가 떠 있을 때 끌어 내리면 키보드부터 내린다
        if (dy0 > 0 && document.activeElement === inputRef.current) inputRef.current?.blur();
      }
      const dy = y - d.startY;
      const g = geo.current;
      let next = d.startP + dy;
      if (next < g.full) next = g.full - Math.min(56, (g.full - next) * 0.32); // 전체 위로는 고무줄
      p.set(next);
      const now = performance.now();
      d.samples.push({ t: now, y });
      while (d.samples.length > 2 && now - d.samples[0].t > 90) d.samples.shift();
      return true;
    },
    [p]
  );
  const dragEnd = useCallback(() => {
    const d = drag.current;
    drag.current = null;
    dragging.current = false;
    if (!d || !d.moved) return false;
    const first = d.samples[0];
    const last = d.samples[d.samples.length - 1];
    const dt = Math.max(16, last.t - first.t);
    const v = ((last.y - first.y) / dt) * 1000; // px/s, 아래로 +
    const g = geo.current;
    const cur = p.get();
    const projected = cur + v * 0.18;
    if (v > 1100 || projected > g.half + (g.avail - g.half) * 0.42) close(v);
    else if (kbRef.current) goDetent("full", v);
    else goDetent(projected < (g.full + g.half) / 2 ? "full" : "half", v);
    return true;
    // 키보드 상태는 ref 로 읽는다 — 끄는 도중 키보드가 내려가며 이 함수가 바뀌면 목록 손가락 리스너가 다시 붙어 끌기가 끊긴다
  }, [p, close, goDetent]);

  const headDrag = useRef<{ id: number; captured: boolean } | null>(null);
  const suppressHeadClick = useRef(false);

  // 목록 손가락: 맨 위에서 아래로 = 시트 끌기, 70% 에서 위로 = 먼저 펼치기. 그 밖은 평소 스크롤.
  const menuOpenRef = useRef(false);
  menuOpenRef.current = !!menu;
  const menuReturnRef = useRef<HTMLElement | null>(null);
  const menuFocusRef = useRef(true);
  useEffect(() => {
    const el = listRef.current;
    if (!el) return;
    let st: { x0: number; y0: number; mode: "none" | "sheet" | "scroll" } | null = null;
    const onStart = (e: TouchEvent) => {
      if (menuOpenRef.current || closing.current || e.touches.length !== 1) {
        st = null;
        return;
      }
      st = { x0: e.touches[0].clientX, y0: e.touches[0].clientY, mode: "none" };
    };
    const onMove = (e: TouchEvent) => {
      if (!st) return;
      const t = e.touches[0];
      if (!t) return;
      const dy = t.clientY - st.y0;
      const dx = t.clientX - st.x0;
      if (st.mode === "none") {
        if (Math.abs(dy) < 6 && Math.abs(dx) < 6) return;
        if (Math.abs(dx) > Math.abs(dy)) st.mode = "scroll";
        else if (dy > 0 && el.scrollTop <= 0) st.mode = "sheet";
        else if (dy < 0 && detent.current === "half" && !kbRef.current) st.mode = "sheet";
        else st.mode = "scroll";
        if (st.mode === "sheet") dragStart(t.clientY);
      }
      if (st.mode === "sheet") {
        if (e.cancelable) e.preventDefault();
        dragMove(t.clientY);
      }
    };
    const onEnd = () => {
      if (st?.mode === "sheet") dragEnd();
      st = null;
    };
    el.addEventListener("touchstart", onStart, { passive: true });
    el.addEventListener("touchmove", onMove, { passive: false });
    el.addEventListener("touchend", onEnd);
    el.addEventListener("touchcancel", onEnd);
    return () => {
      el.removeEventListener("touchstart", onStart);
      el.removeEventListener("touchmove", onMove);
      el.removeEventListener("touchend", onEnd);
      el.removeEventListener("touchcancel", onEnd);
    };
  }, [dragStart, dragMove, dragEnd]);

  // ── 안내 문구 ──
  const toastTimer = useRef(0);
  const showToast = useCallback((msg: string) => {
    setToast(msg);
    window.clearTimeout(toastTimer.current);
    toastTimer.current = window.setTimeout(() => setToast(""), 1800);
  }, []);
  useEffect(() => () => window.clearTimeout(toastTimer.current), []);

  const requireLogin = useCallback(
    (msg: string) => {
      const a = useAuthStore.getState();
      if (a.accessToken && a.user) return true;
      window.dispatchEvent(new Event("freetiful:show-login"));
      showToast(msg);
      return false;
    },
    [showToast]
  );

  // ── 불러오기 ──
  const reqSeq = useRef(0);
  const load = useCallback(
    async (s: SortKey) => {
      const seq = ++reqSeq.current;
      try {
        const res = await cfetch(`/api/community/posts/${encodeURIComponent(post.id)}/comments?sort=${s}`, { credentials: "include" });
        const data = await res.json().catch(() => ({}));
        if (seq !== reqSeq.current) return;
        if (res.ok) setComments(Array.isArray(data.comments) ? data.comments : []);
      } catch {
        /* 못 받아도 시트는 열어 둔다(작성은 가능) */
      } finally {
        if (seq === reqSeq.current) {
          setLoading(false);
          setRefetching(false);
        }
      }
    },
    [post.id]
  );
  useEffect(() => {
    load(sort);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [post.id]);

  // 내 id(내 댓글에만 수정·삭제) + 입력칸 옆 내 사진 — 로그인 상태가 바뀌면(시트 위 로그인) 다시
  useEffect(() => {
    let alive = true;
    cfetch("/api/auth/me", { credentials: "include" })
      .then((r) => (r.ok ? r.json() : null))
      .then((d) => {
        if (!alive) return;
        setMeId(d?.user?.id ?? null);
        setMe(d?.user ? { nickname: d.user.nickname ?? "나", avatar: d.user.avatar ?? null } : null);
        if (d?.user)
          fetchMyNickname().then((n) => {
            if (!alive) return;
            setIdentity(n);
            if (n?.custom || n?.customAvatar) setMe((m) => (m ? { ...m, nickname: n.nickname, avatar: n.avatar } : m));
          });
      })
      .catch(() => {});
    if (opened.current) load(sort);
    return () => {
      alive = false;
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [loggedIn]);

  const chooseSort = (s: SortKey) => {
    setSortPop(null);
    if (s === sort) return;
    setSort(s);
    setRefetching(true);
    load(s);
    listRef.current?.scrollTo({ top: 0 });
  };

  // ── 강조·스크롤 ──
  const flashTimer = useRef(0);
  const flash = useCallback((id: string) => {
    setFlashId(id);
    window.clearTimeout(flashTimer.current);
    flashTimer.current = window.setTimeout(() => setFlashId(null), FLASH_MS);
  }, []);
  useEffect(() => () => window.clearTimeout(flashTimer.current), []);

  const revealComment = useCallback((id: string, smooth = true) => {
    const list = listRef.current;
    const row = list?.querySelector<HTMLElement>(`[data-cid="${CSS.escape(id)}"]`);
    if (!list || !row) return;
    const lr = list.getBoundingClientRect();
    const rr = row.getBoundingClientRect();
    if (rr.top >= lr.top + 4 && rr.bottom <= lr.bottom - 4) return;
    const top = list.scrollTop + (rr.top - lr.top) - Math.max(12, (lr.height - rr.height) / 3);
    list.scrollTo({ top: Math.max(0, top), behavior: smooth ? "smooth" : "auto" });
  }, []);

  // ── 입력칸 ──
  const pendingCaret = useRef<number | null>(null);
  const autosize = useCallback(() => {
    const el = inputRef.current;
    if (!el) return;
    el.style.height = "auto";
    const base = 42;
    el.style.height = `${Math.min(96, Math.max(base, el.scrollHeight))}px`;
  }, []);
  useLayoutEffect(() => {
    autosize();
    const el = inputRef.current;
    if (el && pendingCaret.current != null) {
      const n = Math.min(pendingCaret.current, el.value.length);
      pendingCaret.current = null;
      try {
        el.setSelectionRange(n, n);
      } catch {
        /* 일부 WebView */
      }
    }
  }, [text, mode, autosize]);

  const focusInput = () => {
    const el = inputRef.current;
    if (!el) return;
    el.focus({ preventScroll: true }); // 사용자 손가락 안에서 바로 — iOS 는 그래야 키보드가 뜬다
    if (isTouch.current) goDetent("full");
  };

  const startReply = useCallback(
    (c: SheetComment) => {
      if (!requireLogin("로그인하면 답글을 남길 수 있어요")) return;
      const mention = `@${c.nickname} `;
      setMode({ kind: "reply", target: c });
      setText(mention);
      pendingCaret.current = mention.length;
      flash(c.id);
      focusInput();
      window.setTimeout(() => revealComment(c.id), 420);
    },
    // eslint-disable-next-line react-hooks/exhaustive-deps
    [requireLogin, flash, revealComment]
  );

  const startEdit = (c: SheetComment) => {
    setMode({ kind: "edit", target: c });
    setText(c.content);
    pendingCaret.current = c.content.length;
    flash(c.id);
    focusInput();
    window.setTimeout(() => revealComment(c.id), 420);
  };

  const cancelMode = () => {
    setMode(null);
    setText("");
    setFlashId(null);
  };

  const insertEmoji = (emo: string) => {
    if (!requireLogin("로그인하면 댓글을 남길 수 있어요")) return;
    const el = inputRef.current;
    const start = el ? el.selectionStart ?? text.length : text.length;
    const end = el ? el.selectionEnd ?? text.length : text.length;
    const next = text.slice(0, start) + emo + text.slice(end);
    setText(next);
    pendingCaret.current = start + emo.length;
    focusInput();
  };

  // ── 서버 동작(예전 CommentModal 과 같은 경로) ──
  const likeBusy = useRef(new Set<string>());
  const toggleLike = useCallback(
    async (c: SheetComment) => {
      if (!requireLogin("로그인하면 좋아요를 누를 수 있어요")) return;
      if (likeBusy.current.has(c.id)) return;
      likeBusy.current.add(c.id);
      const was = { liked: c.likedByMe, count: c.likeCount };
      setComments((cur) => updateIn(cur, c.id, (x) => ({ ...x, likedByMe: !was.liked, likeCount: Math.max(0, was.count + (was.liked ? -1 : 1)) })));
      if (!was.liked) {
        setPopId(c.id);
        window.setTimeout(() => setPopId((cur) => (cur === c.id ? null : cur)), 450);
      }
      const revert = () => setComments((cur) => updateIn(cur, c.id, (x) => ({ ...x, likedByMe: was.liked, likeCount: was.count })));
      try {
        const res = await cfetch(`/api/community/comments/${encodeURIComponent(c.id)}/like`, { method: "POST", credentials: "include" });
        if (res.status === 401) {
          revert();
          window.dispatchEvent(new Event("freetiful:show-login"));
          showToast("로그인하면 좋아요를 누를 수 있어요");
          return;
        }
        const data = await res.json().catch(() => ({}));
        if (!res.ok) throw new Error(data.error || data.message || "댓글 공감을 처리하지 못했어요");
        if (typeof data.liked === "boolean")
          setComments((cur) => updateIn(cur, c.id, (x) => ({ ...x, likedByMe: data.liked, likeCount: typeof data.likeCount === "number" ? data.likeCount : x.likeCount })));
      } catch (e) {
        revert();
        showToast(e instanceof Error ? e.message : "댓글 공감을 처리하지 못했어요");
      } finally {
        likeBusy.current.delete(c.id);
      }
    },
    [requireLogin, showToast]
  );

  async function submit() {
    const content = text.trim();
    if (!content || posting) return;
    if (!requireLogin("로그인하면 댓글을 남길 수 있어요")) return;
    setPosting(true);
    try {
      if (mode?.kind === "edit") {
        const target = mode.target;
        const res = await cfetch(`/api/community/comments/${encodeURIComponent(target.id)}`, {
          method: "PATCH",
          credentials: "include",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ content }),
        });
        if (res.status === 401) {
          window.dispatchEvent(new Event("freetiful:show-login"));
          showToast("로그인하면 댓글을 고칠 수 있어요");
          return;
        }
        const data = await res.json().catch(() => ({}));
        if (!res.ok) throw new Error(data.error || data.message || "댓글을 수정하지 못했습니다.");
        setText("");
        setMode(null);
        await load(sort);
        flash(target.id);
        return;
      }
      const parentId = mode?.kind === "reply" ? mode.target.id : undefined;
      const res = await cfetch(`/api/community/posts/${encodeURIComponent(post.id)}/comments`, {
        method: "POST",
        credentials: "include",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ content, ...(parentId ? { parentId } : {}), ...personaBody() }),
      });
      if (res.status === 401) {
        window.dispatchEvent(new Event("freetiful:show-login"));
        showToast("로그인하면 댓글을 남길 수 있어요");
        return;
      }
      const data = await res.json().catch(() => ({}));
      if (!res.ok) throw new Error(data.error || data.message || "댓글을 저장하지 못했습니다.");
      setText("");
      setMode(null);
      onCountChange(1);
      if (parentId) {
        const rid = rootIdOf(comments, parentId);
        if (rid) setExpanded((cur) => new Set(cur).add(rid));
      }
      await load(sort);
      if (data?.id) {
        flash(String(data.id));
        window.requestAnimationFrame(() => revealComment(String(data.id)));
      }
    } catch (e) {
      showToast(e instanceof Error ? e.message : "댓글을 저장하지 못했습니다.");
    } finally {
      setPosting(false);
    }
  }

  async function deleteComment(c: SheetComment) {
    setConfirm(null);
    try {
      const res = await cfetch(`/api/community/comments/${encodeURIComponent(c.id)}`, { method: "DELETE", credentials: "include" });
      const data = await res.json().catch(() => ({}));
      if (!res.ok) {
        showToast(data.error || data.message || "댓글을 삭제하지 못했습니다.");
        return;
      }
      if (mode?.target.id === c.id) cancelMode();
      onCountChange(-1);
      await load(sort);
    } catch {
      showToast("댓글을 삭제하지 못했습니다.");
    }
  }

  async function blockAuthor(c: SheetComment) {
    setConfirm(null);
    if (!c.userId) return;
    try {
      const res = await cfetch("/api/community/blocks", {
        method: "POST",
        credentials: "include",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ userId: c.userId }),
      });
      let data = await res.json().catch(() => ({}));
      if (!res.ok) {
        showToast(data.error || "차단하지 못했어요.");
        return;
      }
      // 서버는 '토글'이다 — 다른 화면에서 이미 차단해 둔 사람이면 방금 요청이 차단을 풀었다. 한 번 더 보내 차단 상태로 맞춘다.
      if (data?.blocked === false) {
        const again = await cfetch("/api/community/blocks", {
          method: "POST",
          credentials: "include",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ userId: c.userId }),
        });
        data = await again.json().catch(() => ({}));
        if (!again.ok || data?.blocked === false) {
          showToast(data.error || "차단 상태를 확인하지 못했어요. 마이페이지에서 확인해 주세요.");
          await load(sort);
          return;
        }
      }
      showToast(`${c.nickname}님을 차단했어요`);
      await load(sort);
    } catch {
      showToast("네트워크 오류로 차단하지 못했어요.");
    }
  }

  async function reportComment(c: SheetComment, reason: string) {
    if (reportBusy) return;
    setReportBusy(true);
    try {
      const res = await cfetch("/api/community/reports", {
        method: "POST",
        credentials: "include",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ targetType: "comment", commentId: c.id, reason }),
      });
      const data = await res.json().catch(() => ({}));
      showToast(res.ok ? "신고가 접수되었어요. 확인 후 조치할게요." : data.error || "신고를 접수하지 못했어요.");
    } catch {
      showToast("네트워크 오류로 신고하지 못했어요.");
    } finally {
      setReportBusy(false);
      setReportTarget(null);
    }
  }

  // ── 길게 누르기 ──
  const openMenu = useCallback(
    (c: SheetComment, depth: number, body: HTMLElement, point: { x: number; y: number }) => {
      if (menuOpenRef.current || closing.current || dragging.current) return;
      const root = rootRef.current;
      const sheet = sheetRef.current;
      const row = body.closest<HTMLElement>(".cmt-row");
      const main = body.querySelector<HTMLElement>(".cmt-main");
      if (!root || !sheet || !row || !main) return;
      const rr = root.getBoundingClientRect();
      const sr = sheet.getBoundingClientRect();
      const mine = !!meId && (c.userId === meId || !!c.postedByMe);
      const items: MenuItemKey[] = mine ? ["reply", "edit", "delete"] : c.userId ? ["reply", "block", "report"] : ["reply", "report"];
      try {
        navigator.vibrate?.(10);
      } catch {
        /* 지원 안 함 */
      }
      // 메뉴가 닫히면 돌려줄 포커스(시트 안에 있던 것) — 터치로 입력 중이면 메뉴로 옮기지 않는다(키보드가 내려가며 시트가 움직여 카드가 어긋남)
      const active = document.activeElement as HTMLElement | null;
      menuReturnRef.current = active && active !== document.body && root.contains(active) ? active : null;
      menuFocusRef.current = !(isTouch.current && active === inputRef.current);
      setLiftedId(c.id);
      setMenu({
        c,
        depth,
        rowTop: row.getBoundingClientRect().top - rr.top,
        textWidth: main.offsetWidth, // 누르는 동안 1.03배 커진 상태라 getBoundingClientRect 폭은 쓰지 않는다
        sheetLeft: sr.left - rr.left,
        sheetWidth: sr.width,
        minTop: Math.max(8, sr.top - rr.top + 8),
        point: { x: point.x - rr.left, y: point.y - rr.top },
        items,
      });
    },
    [meId]
  );

  const pickMenu = (key: MenuItemKey) => {
    const m = menu;
    setMenu(null);
    if (!m) return;
    const c = m.c;
    if (key === "reply") startReply(c);
    else if (key === "edit") startEdit(c);
    else if (key === "delete") setConfirm({ kind: "delete", c });
    else if (key === "block") {
      if (requireLogin("로그인 후 이용할 수 있어요")) setConfirm({ kind: "block", c });
    } else if (key === "report") {
      if (requireLogin("로그인 후 이용할 수 있어요")) setReportTarget(c);
    }
  };

  // ── Esc: 위에 떠 있는 것부터 하나씩 ──
  //  시트 밖 공통 모달(로그인·웨딩숲 프로필)이 위에 떠 있으면 그쪽이 먼저 — 그 모달이 이미 처리했으면(preventDefault) 손대지 않는다.
  //  (리스너가 매 렌더 다시 붙어 로그인 시트 리스너 뒤로 가면, 로그인 시트가 먼저 닫혀 .ft-scrim 이 사라진 뒤라 시트까지 같이 닫혔다)
  useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      if (e.key !== "Escape" || e.defaultPrevented) return;
      const outer = Array.from(document.querySelectorAll(".ft-scrim")).some((el) => !rootRef.current?.contains(el));
      if (outer) return;
      e.preventDefault();
      if (confirm) setConfirm(null);
      else if (reportTarget) setReportTarget(null);
      else if (menu) setMenu(null);
      else if (sortPop) setSortPop(null);
      else if (mode) cancelMode();
      else close();
    };
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  });

  // ── 포커스: 메뉴·확인창이 닫히면 원래 자리(메뉴를 열 때 시트 안에 있던 것, 없으면 시트)로 돌려준다 ──
  //  답글·수정을 고르면 입력칸으로 간 포커스는 그대로 둔다. 확인창(삭제·차단)·신고 사유가 뜨면 그 안 '취소'(보조 단추)로 — Enter 한 번에 지워지지 않게.
  const layer = menu ? "menu" : confirm ? "confirm" : reportTarget ? "report" : "";
  const prevLayer = useRef("");
  useEffect(() => {
    const was = prevLayer.current;
    prevLayer.current = layer;
    if (was === layer) return;
    const root = rootRef.current;
    if (!root) return;
    if (layer === "confirm" || layer === "report") {
      const dlg = Array.from(root.querySelectorAll<HTMLElement>(".ft-scrim [role=dialog]")).pop();
      const btns = dlg ? Array.from(dlg.querySelectorAll<HTMLButtonElement>("button:not([disabled])")) : [];
      (btns.find((b) => b.classList.contains("secondary")) ?? btns[btns.length - 1])?.focus({ preventScroll: true });
      return;
    }
    if (layer || !was || closing.current) return;
    const active = document.activeElement as HTMLElement | null;
    const lost = !active || active === document.body || !root.contains(active) || !!active.closest(".cmt-ctx, .ft-scrim");
    const back = menuReturnRef.current;
    menuReturnRef.current = null;
    if (!lost) return;
    (back && back.isConnected && root.contains(back) && !back.closest(".cmt-ctx, .ft-scrim") ? back : sheetRef.current)?.focus({ preventScroll: true });
  }, [layer]);

  const names = useMemo(() => {
    const out: string[] = [post.nickname];
    const walk = (list: SheetComment[]) => list.forEach((c) => { out.push(c.nickname); walk(c.replies || []); });
    walk(comments);
    return out;
  }, [comments, post.nickname]);
  const re = useMemo(() => mentionPattern(names), [names]);
  const total = countAll(comments);

  const rowProps = (c: SheetComment, depth: number) => ({
    c,
    depth,
    re,
    flash: flashId === c.id,
    lifted: liftedId === c.id,
    pop: popId === c.id,
    onReply: startReply,
    onLike: toggleLike,
    onPress: openMenu,
  });

  const canSend = !!text.trim() && !posting;

  // body 로 띄운다 — 부모 어딘가에 transform(탭 진입 효과 등)이 있으면 fixed 가 화면이 아니라 그 칸 기준이 돼 버린다
  if (typeof document === "undefined") return null;
  return createPortal(
    <div ref={rootRef} className={`cmt-root${kbOpen ? " is-kb" : ""}`}>
      {/* env(safe-area-inset-top) 재는 자 */}
      <div ref={probeRef} aria-hidden="true" style={{ position: "absolute", top: 0, left: 0, width: 0, height: "env(safe-area-inset-top, 0px)", visibility: "hidden", pointerEvents: "none" }} />
      <div ref={dimRef} className="cmt-dim" aria-hidden="true" onClick={() => close()} />
      <div
        ref={sheetRef}
        className="cmt-sheet"
        role="dialog"
        aria-modal="true"
        aria-label={loading ? "댓글" : `댓글 ${total}개`}
        tabIndex={-1}
        style={{ bottom: keyboardInset } as CSSProperties}
      >
        <div
          className="cmt-head"
          onPointerDown={(e) => {
            if (e.pointerType === "mouse" && e.button !== 0) return;
            headDrag.current = { id: e.pointerId, captured: false };
            suppressHeadClick.current = false;
            dragStart(e.clientY);
          }}
          onPointerMove={(e) => {
            const hd = headDrag.current;
            if (hd?.id !== e.pointerId) return;
            if (!dragMove(e.clientY)) return;
            suppressHeadClick.current = true;
            // 실제로 끌기 시작한 뒤에만 붙잡는다 — 처음부터 잡으면 '정렬'·'닫기' 단추의 click 이 머리로 가 버린다
            if (!hd.captured) {
              hd.captured = true;
              try {
                e.currentTarget.setPointerCapture(e.pointerId);
              } catch {
                /* 구형 */
              }
            }
          }}
          onPointerUp={(e) => {
            if (headDrag.current?.id !== e.pointerId) return;
            headDrag.current = null;
            dragEnd();
          }}
          onPointerCancel={(e) => {
            if (headDrag.current?.id !== e.pointerId) return;
            headDrag.current = null;
            dragEnd();
          }}
          onClickCapture={(e) => {
            if (suppressHeadClick.current) {
              e.stopPropagation();
              e.preventDefault();
              suppressHeadClick.current = false;
            }
          }}
        >
          <span className="cmt-grab" aria-hidden="true" />
          <h2 className="cmt-title">댓글</h2>
          {comments.length > 1 && (
            <button
              ref={sortBtnRef}
              type="button"
              className="cmt-sort"
              aria-haspopup="menu"
              aria-expanded={!!sortPop}
              onClick={() => {
                const b = sortBtnRef.current?.getBoundingClientRect();
                const r = rootRef.current?.getBoundingClientRect();
                if (!b || !r) return;
                setSortPop(sortPop ? null : { top: b.bottom - r.top + 6, right: r.right - b.right });
              }}
            >
              {SORTS.find((s) => s.key === sort)?.label}
              <ChevronIcon />
            </button>
          )}
          <button type="button" className="cmt-sr" onClick={() => close()}>
            닫기
          </button>
        </div>

        <div ref={listRef} className="cmt-list">
          <AnimatePresence initial={false} mode="wait">
            {loading ? (
              <motion.div key="skel" className="cmt-skel" exit={{ opacity: 0, transition: { duration: 0.13 } }} aria-label="댓글 불러오는 중">
                {Array.from({ length: 9 }, (_, i) => (
                  <div key={i} className="cmt-skel-row">
                    <i />
                  </div>
                ))}
              </motion.div>
            ) : comments.length === 0 ? (
              <motion.div key="empty" className="cmt-empty" initial={{ opacity: 0 }} animate={{ opacity: 1, transition: { duration: 0.15 } }}>
                {/* eslint-disable-next-line @next/next/no-img-element */}
                <img src="/icons/toss/sleeping.svg" alt="" width={44} height={44} />
                <p>
                  댓글이 자고있나봐요
                  <br />
                  깨워주세요!
                </p>
              </motion.div>
            ) : (
              <motion.div key="list" className={`cmt-fade${refetching ? " is-dim" : ""}`} initial={{ opacity: 0 }} animate={{ opacity: 1, transition: { duration: 0.15 } }}>
                {comments.map((c) => {
                  const replies = c.replies || [];
                  const open = replies.length <= REPLIES_SHOWN || expanded.has(c.id);
                  const shown = open ? replies : replies.slice(0, REPLIES_SHOWN);
                  return (
                    <div key={c.id} className="cmt-thread">
                      <CommentRow {...rowProps(c, 0)} />
                      {shown.map((r) => (
                        <CommentRow key={r.id} {...rowProps(r, 1)} />
                      ))}
                      {replies.length > REPLIES_SHOWN && (
                        <button
                          type="button"
                          className="cmt-more"
                          onClick={() =>
                            setExpanded((cur) => {
                              const next = new Set(cur);
                              if (next.has(c.id)) next.delete(c.id);
                              else next.add(c.id);
                              return next;
                            })
                          }
                        >
                          {open ? "답글 숨기기" : `답글 ${replies.length - REPLIES_SHOWN}개 더 보기`}
                        </button>
                      )}
                    </div>
                  );
                })}
              </motion.div>
            )}
          </AnimatePresence>
        </div>

        <div className="cmt-composer">
          <AnimatePresence>
            {toast && (
              <motion.div
                key={toast}
                className="cmt-toast"
                role="status"
                initial={{ opacity: 0, y: 6, x: "-50%" }}
                animate={{ opacity: 1, y: 0, x: "-50%", transition: { duration: 0.18 } }}
                exit={{ opacity: 0, x: "-50%", transition: { duration: 0.16 } }}
              >
                {toast}
              </motion.div>
            )}
          </AnimatePresence>
          {/* 지정 계정만 — '닉네임 ○○ · 바꾸기'(계정당 하나). 일반 계정은 비어서 숨는다 */}
          {loggedIn && (
            <div className="cmt-persona">
              <NicknameBar
                onEditorsChanged={setIdentity}
                onChanged={(n) => {
                  setIdentity(n);
                  setMe((m) => (m ? { ...m, nickname: n.nickname, avatar: n.avatar } : m));
                  load(sort);
                  showToast("웨딩숲 프로필을 바꿨어요");
                }}
              />
            </div>
          )}
          <div className="cmt-emojis" role="group" aria-label="빠른 이모지">
            {QUICK_EMOJIS.map((emo) => (
              <button
                key={emo}
                type="button"
                className="cmt-emoji"
                aria-label={`${emo} 넣기`}
                onPointerDown={(e) => e.preventDefault()} // 입력칸 포커스(키보드) 유지
                onClick={() => insertEmoji(emo)}
              >
                {emo}
              </button>
            ))}
          </div>
          <div className="cmt-inwrap">
            <span className="cmt-me" aria-hidden="true">
              {loggedIn && inputMe?.avatar ? (
                // eslint-disable-next-line @next/next/no-img-element
                <img src={inputMe.avatar} alt="" referrerPolicy="no-referrer" />
              ) : (
                <DefaultAvatar />
              )}
            </span>
            <div className="cmt-pill">
              <AnimatePresence initial={false}>
                {mode && (
                  <motion.div
                    key="bar"
                    className="cmt-bar"
                    initial={{ height: 0, opacity: 0 }}
                    animate={{ height: 38, opacity: 1, transition: { duration: 0.16, ease: [0.22, 1, 0.36, 1] } }}
                    exit={{ height: 0, opacity: 0, transition: { duration: 0.12, ease: "easeOut" } }}
                  >
                    <div className="cmt-bar-in">
                      <span>{mode.kind === "reply" ? `${mode.target.nickname}님에게 답글 남기는 중` : "댓글 수정 중"}</span>
                      <button
                        type="button"
                        className="cmt-bar-x"
                        aria-label={mode.kind === "reply" ? "답글 취소" : "수정 취소"}
                        onPointerDown={(e) => e.preventDefault()}
                        onClick={cancelMode}
                      >
                        <XIcon />
                      </button>
                    </div>
                  </motion.div>
                )}
              </AnimatePresence>
              <div className="cmt-inrow">
                <textarea
                  ref={inputRef}
                  className="cmt-input"
                  rows={1}
                  value={text}
                  readOnly={!loggedIn}
                  enterKeyHint="send"
                  placeholder={`${post.nickname}님에게 댓글 추가`}
                  aria-label="댓글 입력"
                  onChange={(e) => setText(e.target.value)}
                  onFocus={(e) => {
                    if (!loggedIn) {
                      e.currentTarget.blur();
                      requireLogin("로그인하면 댓글을 남길 수 있어요");
                      return;
                    }
                    setFocused(true);
                    if (isTouch.current) goDetent("full");
                  }}
                  onBlur={() => setFocused(false)}
                  onKeyDown={(e) => {
                    // Enter=등록, Shift+Enter=줄바꿈 — 한글 조합 중 Enter 는 글자 확정이라 무시
                    if (e.key === "Enter" && !e.shiftKey && !e.nativeEvent.isComposing && e.keyCode !== 229) {
                      e.preventDefault();
                      submit();
                    }
                  }}
                />
                <AnimatePresence initial={false}>
                  {!!text.trim() && (
                    <motion.button
                      key="send"
                      type="button"
                      className="cmt-send"
                      aria-label={mode?.kind === "edit" ? "수정 저장" : "댓글 보내기"}
                      disabled={!canSend}
                      initial={{ scale: 0.4, opacity: 0 }}
                      animate={{ scale: 1, opacity: 1, transition: { type: "spring", stiffness: 700, damping: 32 } }}
                      exit={{ scale: 0.4, opacity: 0, transition: { duration: 0.12 } }}
                      onPointerDown={(e) => e.preventDefault()} // 보내도 키보드는 그대로
                      onClick={submit}
                    >
                      <ArrowUpIcon />
                    </motion.button>
                  )}
                </AnimatePresence>
              </div>
            </div>
          </div>
        </div>
      </div>

      <AnimatePresence onExitComplete={() => setLiftedId(null)}>
        {menu && <ContextLayer key={menu.c.id} menu={menu} re={re} rootH={rootH} focusMenu={menuFocusRef.current} onClose={() => setMenu(null)} onPick={pickMenu} />}
      </AnimatePresence>

      <AnimatePresence>
        {sortPop && (
          <motion.div key="sortpop" className="cmt-pop-shield" initial={{ opacity: 1 }} exit={{ opacity: 1 }} onClick={() => setSortPop(null)}>
            <motion.div
              className="cmt-pop"
              role="menu"
              aria-label="댓글 정렬"
              style={{ top: sortPop.top, right: sortPop.right, transformOrigin: "100% 0" }}
              initial={{ opacity: 0, scale: 0.82 }}
              animate={{ opacity: 1, scale: 1, transition: { type: "spring", stiffness: 700, damping: 40, opacity: { duration: 0.1 } } }}
              exit={{ opacity: 0, scale: 0.9, transition: { duration: 0.1 } }}
              onClick={(e) => e.stopPropagation()}
            >
              {SORTS.map((s) => (
                <button
                  key={s.key}
                  type="button"
                  role="menuitemradio"
                  aria-checked={sort === s.key}
                  className={`cmt-mi${sort === s.key ? " is-on" : ""}`}
                  onClick={() => chooseSort(s.key)}
                >
                  {s.label}
                  {sort === s.key && (
                    <svg className="cmt-check" width="16" height="16" viewBox="0 0 24 24" fill="none" aria-hidden="true">
                      <path d="m5 12.5 4.5 4.5L19 7.5" stroke="currentColor" strokeWidth="2.4" strokeLinecap="round" strokeLinejoin="round" />
                    </svg>
                  )}
                </button>
              ))}
            </motion.div>
          </motion.div>
        )}
      </AnimatePresence>

      {confirm?.kind === "delete" && (
        <AlertModal
          title="댓글을 삭제할까요?"
          subtitle="삭제한 댓글은 되돌릴 수 없어요."
          onClose={() => setConfirm(null)}
          buttons={[
            { label: "삭제", onClick: () => deleteComment(confirm.c) },
            { label: "취소", onClick: () => setConfirm(null) },
          ]}
        />
      )}
      {confirm?.kind === "block" && (
        <AlertModal
          title={`${confirm.c.nickname}님을 차단할까요?`}
          subtitle={"차단하면 이 사용자의 글과 댓글이 보이지 않아요.\n차단은 상대에게 알려지지 않고, 마이페이지에서 해제할 수 있어요."}
          onClose={() => setConfirm(null)}
          buttons={[
            { label: "차단하기", bgColor: "#F04452", onClick: () => blockAuthor(confirm.c) },
            { label: "취소", onClick: () => setConfirm(null) },
          ]}
        />
      )}
      {reportTarget && (
        // 신고 사유 — 공통 시트(웨딩숲 톤, ReportBlockMenu 와 같은 사유·경로)
        <div className="ft-scrim" onClick={() => setReportTarget(null)}>
          <div className="ft-sheet" role="dialog" aria-modal="true" aria-label="신고 사유" onClick={(e) => e.stopPropagation()}>
            <div className="ft-grab" aria-hidden="true" />
            <h2 className="ft-title">신고 사유를 선택해 주세요</h2>
            <div className="mt-3 -mx-6">
              {REPORT_REASONS.map((reason) => (
                <button key={reason} type="button" className="nt-menu-item" disabled={reportBusy} onClick={() => reportComment(reportTarget, reason)}>
                  {reason}
                </button>
              ))}
            </div>
            <div className="ft-actions">
              <button type="button" className="ft-btn secondary" onClick={() => setReportTarget(null)}>
                취소
              </button>
            </div>
          </div>
        </div>
      )}
    </div>,
    document.body
  );
}
