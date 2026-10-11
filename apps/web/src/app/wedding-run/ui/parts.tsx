'use client';

// 웨딩런 화면 공통 부품(261011 사장 사양서 [7] 'UI 17종 실제 연결')
//  · ImgButton — 버튼 이미지 + 실제 터치 영역 = 매니페스트 hit(투명 여백 뺀 영역). 작아도 44×44 CSS px 은 지킨다.
//    누르면 0.95배, 놓으면 1배(pointer 로 처리 — iOS :active 는 터치에서 잘 안 먹음).
//  · ModalPanel — modal_blank(빈 팝업 패널) 위에 동적 글자·개별 버튼을 올린다. 03_panels 예시 패널은 쓰지 않는다(예시 숫자 노출 금지).
//    가로 화면에 맞게 넓히되 꽃 모서리·위 장식은 비율 그대로 두고 단색 테두리·가운데만 늘리는 15조각 그리기(캔버스).
//  · HudPill — hud_blank(빈 점수판) 3조각 늘이기(border-image) 위에 동적 글자.
//  · (261011 검증 반영) Dim 은 click 으로 닫는다(pointerdown 에 닫으면 같은 탭의 click 이 새로 드러난 아래 버튼에 떨어져 판이 시작되던 유령 클릭).
//    ModalPanel 은 열릴 때 패널로 포커스를 옮기고 Tab 을 패널 안에 가두며, 닫히면(restoreFocus) 이전 포커스로 돌려준다.
//    ResizeObserver 가 없는 옛 웹뷰(iOS 13.4 미만)에서도 팝업이 깨지지 않게 확인 후 사용.
import { useEffect, useRef, useState, type CSSProperties, type ReactNode } from 'react';
import { WR_UI, type WrUiKey } from '../assets';

export type ButtonKey = Exclude<WrUiKey, 'score_hud' | 'pause_panel' | 'result_panel' | 'hud_blank' | 'modal_blank'>;

/** 버튼 이미지 미리 받기용 */
export const UI_SRC = (k: WrUiKey) => WR_UI[k].src;

type ImgButtonProps = {
  ui: ButtonKey;
  /** 터치 영역(hit) 너비 — CSS 길이 */
  width: string;
  label: string;
  onClick?: () => void;
  disabled?: boolean;
  className?: string;
  style?: CSSProperties;
  /** 이미지 위에 덧붙일 것(배지 등) */
  children?: ReactNode;
  pulse?: boolean;
};

/**
 * 이미지 버튼 — 버튼 상자 = hit 영역(이미지 px 비율 그대로), 이미지는 hit 기준으로 자리 잡고 투명 여백은 상자 밖으로 넘친다(터치 안 됨).
 * 너비가 작아 높이가 44px 밑이면 min-height 로 터치 영역만 위아래로 조금 늘린다(그림은 가운데).
 */
export function ImgButton({ ui, width, label, onClick, disabled, className, style, children, pulse }: ImgButtonProps) {
  const u = WR_UI[ui];
  const [pressed, setPressed] = useState(false);
  const hit = u.hit;
  const vars = {
    '--ib-w': width,
    '--ib-ar': `${hit.w} / ${hit.h}`,
    '--ib-img-w': `${(u.w / hit.w) * 100}%`,
    '--ib-img-l': `${(-hit.x / hit.w) * 100}%`,
    '--ib-img-t': `${(-hit.y / hit.h) * 100}%`,
    // aspect-ratio 를 모르는 옛 브라우저(Chromium 88 미만) 대체 — 세로/가로 비율(padding-top %)
    '--ib-pt': `${(hit.h / hit.w) * 100}%`,
  } as CSSProperties;
  return (
    <button
      type="button"
      className={`wr-ib${pressed ? ' is-pressed' : ''}${pulse ? ' is-pulse' : ''}${className ? ` ${className}` : ''}`}
      style={{ ...vars, ...style }}
      aria-label={label}
      disabled={disabled}
      onPointerDown={() => !disabled && setPressed(true)}
      onPointerUp={() => setPressed(false)}
      onPointerLeave={() => setPressed(false)}
      onPointerCancel={() => setPressed(false)}
      onContextMenu={(e) => e.preventDefault()}
      onClick={(e) => {
        // 키보드 Space 로 점프할 때 포커스 남은 버튼이 다시 눌리지 않게
        (e.currentTarget as HTMLButtonElement).blur();
        if (!disabled) onClick?.();
      }}
    >
      <span className="wr-ib-box">
        <img className="wr-ib-img" src={u.src} alt="" draggable={false} />
      </span>
      {children}
    </button>
  );
}

// ── modal_blank 15조각 ──

// modal_blank 658×1000(이미지 px) 기준 구간
/** 가로 구간: 꽃 모서리(비율 고정) · 늘림 · 위 장식(비율 고정) · 늘림 · 꽃 모서리 — modal_blank 열마다 첫 불투명 행을 재서 정함 */
const COLS: Array<[number, number, boolean]> = [
  [0, 190, false],
  [190, 100, true],
  [290, 78, false],
  [368, 100, true],
  [468, 190, false],
];
/** 세로 구간: 위(꽃) · 가운데(단색 테두리 — 210~810 행은 왼쪽 테두리가 한결같음) · 아래(꽃) */
const ROWS: Array<[number, number, boolean]> = [
  [0, 210, false],
  [210, 600, true],
  [810, 190, false],
];

let modalImg: HTMLImageElement | null = null;
let modalImgReady: Promise<HTMLImageElement> | null = null;
/** 화면이 뜰 때 미리 불러 둔다(첫 팝업이 비어 보이지 않게) */
export function preloadPanel() {
  if (typeof window !== 'undefined') loadModalImg().catch(() => undefined);
}
function loadModalImg(): Promise<HTMLImageElement> {
  if (modalImgReady) return modalImgReady;
  modalImgReady = new Promise((resolve, reject) => {
    const img = new Image();
    img.decoding = 'async';
    img.onload = () => {
      modalImg = img;
      resolve(img);
    };
    img.onerror = () => {
      modalImgReady = null;
      reject(new Error('modal image'));
    };
    img.src = WR_UI.modal_blank.src;
  });
  return modalImgReady;
}

/** 화면 단위 u(px) — CSS --u 와 같은 식 */
export function uPx(): number {
  if (typeof window === 'undefined') return 1;
  const vv = window.visualViewport;
  const h = vv ? vv.height : window.innerHeight;
  const w = vv ? vv.width : window.innerWidth;
  return Math.min(h / 390, w / 740, 1.85);
}

/** 패널 모서리 배율 = 0.34 × u(이미지 px → CSS px) — 모든 팝업의 꽃 크기가 같게 */
export const PANEL_SCALE = 0.34;

function drawPanel(canvas: HTMLCanvasElement, img: HTMLImageElement, cssW: number, cssH: number) {
  const dpr = Math.min(3, window.devicePixelRatio || 1);
  const W = Math.max(1, Math.round(cssW * dpr));
  const H = Math.max(1, Math.round(cssH * dpr));
  if (canvas.width !== W) canvas.width = W;
  if (canvas.height !== H) canvas.height = H;
  const ctx = canvas.getContext('2d');
  if (!ctx) return;
  ctx.clearRect(0, 0, W, H);
  ctx.imageSmoothingEnabled = true;
  ctx.imageSmoothingQuality = 'high';
  let s = PANEL_SCALE * uPx() * dpr;
  // 너무 작은 패널이면 모서리도 줄인다(고정 구간 합이 넘치지 않게)
  const fixedW = COLS.filter((c) => !c[2]).reduce((a, c) => a + c[1], 0);
  const fixedH = ROWS.filter((r) => !r[2]).reduce((a, r) => a + r[1], 0);
  s = Math.min(s, W / fixedW, H / fixedH);
  const stretchW = COLS.filter((c) => c[2]).reduce((a, c) => a + c[1], 0);
  const stretchH = ROWS.filter((r) => r[2]).reduce((a, r) => a + r[1], 0);
  const kx = (W - fixedW * s) / stretchW;
  const ky = (H - fixedH * s) / stretchH;
  // 정수 픽셀 경계로 이어 붙여 이음새(실선 틈)가 안 생기게
  const xs: number[] = [0];
  COLS.forEach((c) => xs.push(xs[xs.length - 1] + c[1] * (c[2] ? kx : s)));
  const ys: number[] = [0];
  ROWS.forEach((r) => ys.push(ys[ys.length - 1] + r[1] * (r[2] ? ky : s)));
  const rx = xs.map((v, i) => (i === xs.length - 1 ? W : Math.round(v)));
  const ry = ys.map((v, i) => (i === ys.length - 1 ? H : Math.round(v)));
  for (let r = 0; r < ROWS.length; r++) {
    // 가운데·아래 줄은 2~4열이 한 덩어리(단색)
    if (r === 0) {
      for (let c = 0; c < COLS.length; c++) {
        const dw = rx[c + 1] - rx[c];
        if (dw <= 0) continue;
        ctx.drawImage(img, COLS[c][0], ROWS[r][0], COLS[c][1], ROWS[r][1], rx[c], ry[r], dw, ry[r + 1] - ry[r]);
      }
    } else {
      const dh = ry[r + 1] - ry[r];
      if (dh <= 0) continue;
      ctx.drawImage(img, COLS[0][0], ROWS[r][0], COLS[0][1], ROWS[r][1], rx[0], ry[r], rx[1] - rx[0], dh);
      const mx0 = COLS[1][0];
      const mx1 = COLS[3][0] + COLS[3][1];
      ctx.drawImage(img, mx0, ROWS[r][0], mx1 - mx0, ROWS[r][1], rx[1], ry[r], rx[4] - rx[1], dh);
      ctx.drawImage(img, COLS[4][0], ROWS[r][0], COLS[4][1], ROWS[r][1], rx[4], ry[r], rx[5] - rx[4], dh);
    }
  }
}

/** 열린 팝업 패널(맨 위 = 마지막) — Tab 가두기는 맨 위 패널만 */
const panelStack: HTMLElement[] = [];
const FOCUSABLE = 'button:not([disabled]), [href], input:not([disabled]), textarea:not([disabled]), select:not([disabled]), [tabindex]:not([tabindex="-1"])';

export function ModalPanel({
  className,
  style,
  children,
  label,
  restoreFocus = true,
}: {
  className?: string;
  style?: CSSProperties;
  children?: ReactNode;
  label: string;
  /** 닫힐 때 열기 전 포커스로 돌려줄지 — 게임 시작·재개로 닫히는 팝업(일시정지·결과)은 false(돌려주면 플레이 중 Enter 가 그 버튼을 누름) */
  restoreFocus?: boolean;
}) {
  const boxRef = useRef<HTMLDivElement>(null);
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const [painted, setPainted] = useState(!!modalImg);
  const restoreRef = useRef(restoreFocus);
  restoreRef.current = restoreFocus;

  // 포커스: 열릴 때 패널로(버튼에 바로 주면 Space·Enter 가 '다시 도전' 등을 눌러 버림), Tab 은 패널 안에서만 돎, 닫히면 돌려줌
  useEffect(() => {
    const box = boxRef.current;
    if (!box) return;
    const prev = (typeof document !== 'undefined' ? document.activeElement : null) as HTMLElement | null;
    panelStack.push(box);
    if (!box.contains(document.activeElement)) {
      try {
        box.focus({ preventScroll: true });
      } catch {
        /* 무시 */
      }
    }
    const onKey = (e: KeyboardEvent) => {
      if (e.key !== 'Tab' || panelStack[panelStack.length - 1] !== box) return;
      const items = Array.from(box.querySelectorAll<HTMLElement>(FOCUSABLE)).filter((el) => el.getClientRects().length > 0);
      if (!items.length) {
        e.preventDefault();
        box.focus({ preventScroll: true });
        return;
      }
      const first = items[0];
      const last = items[items.length - 1];
      const a = document.activeElement as HTMLElement | null;
      const inside = !!a && box.contains(a) && a !== box;
      if (e.shiftKey && (!inside || a === first)) {
        e.preventDefault();
        last.focus();
      } else if (!e.shiftKey && (!inside || a === last)) {
        e.preventDefault();
        first.focus();
      }
    };
    document.addEventListener('keydown', onKey, true);
    return () => {
      document.removeEventListener('keydown', onKey, true);
      const i = panelStack.lastIndexOf(box);
      if (i >= 0) panelStack.splice(i, 1);
      if (restoreRef.current && prev && prev !== document.body && prev.isConnected && typeof prev.focus === 'function') {
        try {
          prev.focus({ preventScroll: true });
        } catch {
          /* 무시 */
        }
      }
    };
  }, []);
  useEffect(() => {
    const box = boxRef.current;
    const canvas = canvasRef.current;
    if (!box || !canvas) return;
    let alive = true;
    const paint = () => {
      if (!alive || !modalImg) return;
      const r = box.getBoundingClientRect();
      // transform(등장 애니) 중엔 getBoundingClientRect 가 줄어든 값 — offset 크기를 쓴다
      drawPanel(canvas, modalImg, box.offsetWidth || r.width, box.offsetHeight || r.height);
      setPainted(true);
    };
    // 이미 불러 둔 그림이면 바로
    paint();
    loadModalImg().then(paint, () => undefined);
    // 옛 웹뷰(iOS 13.4 미만 등)엔 ResizeObserver 가 없다 — 그땐 창 크기 바뀜 + 등장 애니 끝(0.4초) 한 번 더로 대신
    const ro = typeof ResizeObserver !== 'undefined' ? new ResizeObserver(paint) : null;
    ro?.observe(box);
    const late = ro ? 0 : window.setTimeout(paint, 400);
    window.addEventListener('resize', paint);
    return () => {
      alive = false;
      ro?.disconnect();
      if (late) window.clearTimeout(late);
      window.removeEventListener('resize', paint);
    };
  }, []);
  return (
    <div
      ref={boxRef}
      className={`wr-panel${painted ? ' is-painted' : ''}${className ? ` ${className}` : ''}`}
      style={style}
      role="dialog"
      aria-modal="true"
      aria-label={label}
      tabIndex={-1}
    >
      <canvas ref={canvasRef} className="wr-panel-bg" aria-hidden />
      <div className="wr-panel-body">{children}</div>
    </div>
  );
}

/** hud_blank 위 글자 칸(좌우 끝 장식은 비율 그대로, 가운데만 늘림) */
export function HudPill({ className, style, children }: { className?: string; style?: CSSProperties; children?: ReactNode }) {
  return (
    <div className={`wr-hudpill${className ? ` ${className}` : ''}`} style={{ ...style, borderImageSource: `url("${WR_UI.hud_blank.src}")` }}>
      {children}
    </div>
  );
}

/**
 * 모달 뒤 어둡게 — 바깥(딤)을 탭하면 onBackdrop.
 * 닫기는 click 에서, 누름(pointerdown)과 click 이 모두 딤 자체에서 일어났을 때만(261011 검증 medium: pointerdown 에 닫으면
 * 팝업이 사라진 자리 아래 '게임 시작'·'프리티풀 홈으로' 버튼이 같은 탭의 click 을 받아 판이 시작되거나 /main 으로 나갔다).
 */
export function Dim({ children, onBackdrop, className }: { children: ReactNode; onBackdrop?: () => void; className?: string }) {
  const downOnSelf = useRef(false);
  return (
    <div
      className={`wr-dim${className ? ` ${className}` : ''}`}
      onPointerDown={(e) => {
        downOnSelf.current = e.target === e.currentTarget;
      }}
      onClick={(e) => {
        const ok = downOnSelf.current && e.target === e.currentTarget;
        downOnSelf.current = false;
        if (ok) onBackdrop?.();
      }}
    >
      {children}
    </div>
  );
}
