'use client';

import { useEffect, useState } from 'react';
import toast from 'react-hot-toast';

/* ─────────────────────────────────────────────────────────────
 * 정산 명세서(빌지) — 관리자 '정산하기' 뒤 / 사회자 정산 푸시를 누르면 연다(261005 사장 '빌지 형태로, 카톡으로 이미지 공유').
 *  · 화면 = 영수증 모양 흰 카드(아래 톱니 가장자리) — 정산 금액 크게 · 사회자·고객(가운데 가림)·행사 · 결제/수수료/정산 · 날짜·번호.
 *  · 이미지 = 같은 내용을 canvas 로 다시 그린 PNG(1080px 폭). html 캡처 라이브러리 없이 직접 그려 한글이 겹치지 않는다.
 *  · 카카오톡으로 공유 = 폰은 기본 공유 시트(카카오톡 고르면 사진으로 감), PC 는 이미지 복사 → 카톡 대화창에 붙여넣기.
 *    둘 다 안 되면 이미지 저장으로 넘어간다. 공유는 누른 순간에 바로 불러야 해서(브라우저 제한) 이미지는 열 때 미리 그려 둔다.
 * ──────────────────────────────────────────────────────────── */
export type SettlementBillData = {
  id: string;
  no: string;
  status: 'pending' | 'settled' | 'cancelled' | string;
  proName: string;
  customerName: string;
  event: { title: string | null; kind: string | null; date: string | null; time: string | null; location: string | null } | null;
  amount: number;
  platformFee: number;
  netAmount: number;
  method: string | null;
  paidAt: string | null;
  settledAt: string | null;
  createdAt: string;
  note?: string | null;
};

const WEEK = ['일', '월', '화', '수', '목', '금', '토'];
const won = (n: number) => `${Math.round(n || 0).toLocaleString('ko-KR')}원`;

/** ISO → KST '2026.10.05 17:15' */
function kstDateTime(iso: string | null | undefined): string {
  if (!iso) return '—';
  const d = new Date(new Date(iso).getTime() + 9 * 3600000);
  if (Number.isNaN(d.getTime())) return '—';
  const p = (n: number) => String(n).padStart(2, '0');
  return `${d.getUTCFullYear()}.${p(d.getUTCMonth() + 1)}.${p(d.getUTCDate())} ${p(d.getUTCHours())}:${p(d.getUTCMinutes())}`;
}

/** ISO → KST '2026년 10월 5일' */
function kstLongDate(iso: string | null | undefined): string {
  if (!iso) return '';
  const d = new Date(new Date(iso).getTime() + 9 * 3600000);
  return Number.isNaN(d.getTime()) ? '' : `${d.getUTCFullYear()}년 ${d.getUTCMonth() + 1}월 ${d.getUTCDate()}일`;
}

/** 행사일 'YYYY-MM-DD' + 'HH:mm' → '2026.11.04 (수) 11:00' */
function eventWhen(ev: SettlementBillData['event']): string {
  const m = ev?.date ? /^(\d{4})-(\d{2})-(\d{2})/.exec(ev.date) : null;
  if (!m) return ev?.time || '—';
  const dow = WEEK[new Date(Date.UTC(Number(m[1]), Number(m[2]) - 1, Number(m[3]))).getUTCDay()];
  return `${m[1]}.${m[2]}.${m[3]} (${dow})${ev?.time ? ` ${ev.time}` : ''}`;
}

const feeRate = (b: SettlementBillData) => (b.amount > 0 && b.platformFee > 0 ? Math.round((b.platformFee / b.amount) * 1000) / 10 : 0);
const statusOf = (b: SettlementBillData) =>
  b.status === 'settled'
    ? { text: '정산 완료', fg: '#03A35F', bg: '#E5F8EF' }
    : b.status === 'cancelled'
      ? { text: '정산 취소', fg: '#6B7684', bg: '#F2F4F6' }
      : { text: '정산 대기', fg: '#E65F00', bg: '#FFF1E6' };

/** 명세서 줄 묶음 — 화면·이미지가 같은 순서를 쓴다 */
function billSections(b: SettlementBillData): Array<Array<{ label: string; value: string; strong?: boolean }>> {
  const ev = b.event;
  const rate = feeRate(b);
  return [
    [
      { label: '사회자', value: b.proName },
      { label: '고객', value: b.customerName },
      { label: '행사', value: [ev?.kind, ev?.title].filter(Boolean).join(' · ') || '—' },
      { label: '행사일', value: eventWhen(ev) },
      { label: '장소', value: ev?.location || '—' },
    ],
    [
      { label: '결제 금액', value: won(b.amount) },
      { label: `수수료${rate ? ` (${rate}%)` : ''}`, value: b.platformFee ? `-${won(b.platformFee)}` : '0원' },
      { label: '정산 금액', value: won(b.netAmount), strong: true },
    ],
    [
      { label: '결제일', value: kstDateTime(b.paidAt) },
      ...(b.method ? [{ label: '결제 수단', value: b.method }] : []),
      { label: '정산일', value: b.status === 'settled' ? kstDateTime(b.settledAt) : '정산 대기' },
      { label: '명세서 번호', value: b.no },
    ],
  ];
}

/** 화면용 영수증 카드 */
export function SettlementBillCard({ bill }: { bill: SettlementBillData }) {
  const st = statusOf(bill);
  const sections = billSections(bill);
  return (
    <div className="mx-auto w-full max-w-[360px] select-text" style={{ filter: 'drop-shadow(0 8px 24px rgba(2, 32, 71, .08))' }}>
      <div className="rounded-t-[24px] bg-white px-6 pb-5 pt-7">
        <p className="text-[13px] font-semibold tracking-[-0.2px] text-[#3182F6]">프리티풀 정산 명세서</p>
        <p className="mt-2 text-[30px] font-bold leading-[1.2] tracking-[-0.8px] text-[#191F28]">{won(bill.netAmount)}</p>
        <div className="mt-2.5 flex items-center gap-2">
          <span className="rounded-[7px] px-2 py-[2px] text-[12.5px] font-bold" style={{ color: st.fg, backgroundColor: st.bg }}>{st.text}</span>
          <span className="text-[13.5px] text-[#8B95A1]">{bill.status === 'settled' ? `${kstLongDate(bill.settledAt)} 정산` : `${kstLongDate(bill.createdAt)} 접수`}</span>
        </div>
        {sections.map((rows, i) => (
          <div key={i} className="mt-5 border-t border-dashed border-[#E5E8EB] pt-4">
            {rows.map((r) => (
              <div key={r.label} className="flex items-start justify-between gap-4 py-[5px]">
                <span className="shrink-0 text-[14px] text-[#8B95A1]">{r.label}</span>
                <span className={`min-w-0 break-keep text-right text-[14px] ${r.strong ? 'text-[16px] font-bold text-[#1B64DA]' : 'font-medium text-[#333D4B]'}`}>{r.value}</span>
              </div>
            ))}
          </div>
        ))}
        <p className="mt-5 text-center text-[12px] text-[#B0B8C1]">프리티풀이 발행한 정산 명세서예요 · freetiful.com</p>
      </div>
      {/* 아래 톱니 가장자리(영수증) */}
      <div
        aria-hidden="true"
        className="h-[10px]"
        style={{
          background: 'linear-gradient(-45deg, transparent 7px, #fff 0) 0 0 / 14px 10px repeat-x, linear-gradient(45deg, transparent 7px, #fff 0) 0 0 / 14px 10px repeat-x',
        }}
      />
    </div>
  );
}

/* ── 이미지(PNG) — 화면 카드와 같은 배치를 canvas 로. 폭 360 기준 × 3배 = 1080px ── */
const IMG_W = 360;
const IMG_PAD = 20;
const IMG_SCALE = 3;

function wrapText(ctx: CanvasRenderingContext2D, text: string, maxW: number): string[] {
  const out: string[] = [];
  let line = '';
  for (const ch of Array.from(text)) {
    const next = line + ch;
    if (ctx.measureText(next).width > maxW && line) {
      out.push(line);
      line = ch.trimStart();
    } else {
      line = next;
    }
  }
  if (line) out.push(line);
  return out.slice(0, 3);
}

export async function renderSettlementBillPng(bill: SettlementBillData): Promise<Blob> {
  if (typeof document === 'undefined') throw new Error('브라우저에서만 그릴 수 있어요');
  try { await (document as any).fonts?.ready; } catch { /* 글꼴 대기 실패 — 기본 글꼴로 */ }
  const family = getComputedStyle(document.body).fontFamily || "Pretendard, -apple-system, 'Apple SD Gothic Neo', sans-serif";
  const font = (weight: number, size: number) => `${weight} ${size}px ${family}`;
  const sections = billSections(bill);
  const st = statusOf(bill);
  const cardX = IMG_PAD;
  const cardW = IMG_W - IMG_PAD * 2;
  const inX = cardX + 24;
  const inW = cardW - 48;
  const labelW = 86;

  // 1) 높이 재기(값 줄바꿈 포함) — 그리는 순서 그대로 한 번 걷는다
  const measure = document.createElement('canvas').getContext('2d')!;
  const plan: Array<{ y: number; draw: (ctx: CanvasRenderingContext2D) => void }> = [];
  let y = IMG_PAD + 28;
  const yTitle = y;
  plan.push({ y: yTitle, draw: (ctx) => { ctx.font = font(600, 13); ctx.fillStyle = '#3182F6'; ctx.fillText('프리티풀 정산 명세서', inX, yTitle + 13); } });
  const yAmount = y + 22;
  plan.push({ y: yAmount, draw: (ctx) => { ctx.font = font(700, 30); ctx.fillStyle = '#191F28'; ctx.fillText(won(bill.netAmount), inX, yAmount + 30); } });
  const yChip = yAmount + 46;
  const sub = bill.status === 'settled' ? `${kstLongDate(bill.settledAt)} 정산` : `${kstLongDate(bill.createdAt)} 접수`;
  plan.push({
    y: yChip,
    draw: (ctx) => {
      ctx.font = font(700, 12.5);
      const tw = ctx.measureText(st.text).width;
      ctx.fillStyle = st.bg;
      roundRect(ctx, inX, yChip, tw + 16, 22, 7);
      ctx.fill();
      ctx.fillStyle = st.fg;
      ctx.fillText(st.text, inX + 8, yChip + 15.5);
      ctx.font = font(400, 13.5);
      ctx.fillStyle = '#8B95A1';
      ctx.fillText(sub, inX + tw + 16 + 8, yChip + 15.5);
    },
  });
  y = yChip + 22;
  for (const rows of sections) {
    y += 20;
    const lineY = y;
    plan.push({ y: lineY, draw: (ctx) => { ctx.save(); ctx.strokeStyle = '#E5E8EB'; ctx.lineWidth = 1; ctx.setLineDash([4, 4]); ctx.beginPath(); ctx.moveTo(inX, lineY + 0.5); ctx.lineTo(inX + inW, lineY + 0.5); ctx.stroke(); ctx.restore(); } });
    y += 16;
    for (const r of rows) {
      measure.font = r.strong ? font(700, 16) : font(500, 14);
      const lines = wrapText(measure, r.value, inW - labelW);
      const rowY = y;
      const lh = r.strong ? 24 : 21;
      plan.push({
        y: rowY,
        draw: (ctx) => {
          ctx.font = font(400, 14);
          ctx.fillStyle = '#8B95A1';
          ctx.textAlign = 'left';
          ctx.fillText(r.label, inX, rowY + 15);
          ctx.font = r.strong ? font(700, 16) : font(500, 14);
          ctx.fillStyle = r.strong ? '#1B64DA' : '#333D4B';
          ctx.textAlign = 'right';
          lines.forEach((ln, k) => ctx.fillText(ln, inX + inW, rowY + (r.strong ? 16 : 15) + k * lh));
          ctx.textAlign = 'left';
        },
      });
      y += Math.max(1, lines.length) * lh + 10;
    }
  }
  y += 14;
  const footY = y;
  plan.push({ y: footY, draw: (ctx) => { ctx.font = font(400, 12); ctx.fillStyle = '#B0B8C1'; ctx.textAlign = 'center'; ctx.fillText('프리티풀이 발행한 정산 명세서예요 · freetiful.com', cardX + cardW / 2, footY + 12); ctx.textAlign = 'left'; } });
  const cardBottom = footY + 32;
  const H = cardBottom + 10 + IMG_PAD;

  // 2) 그리기
  const canvas = document.createElement('canvas');
  canvas.width = IMG_W * IMG_SCALE;
  canvas.height = Math.ceil(H * IMG_SCALE);
  const ctx = canvas.getContext('2d')!;
  ctx.scale(IMG_SCALE, IMG_SCALE);
  ctx.fillStyle = '#F2F4F6';
  ctx.fillRect(0, 0, IMG_W, H);
  // 카드 + 아래 톱니
  ctx.save();
  ctx.shadowColor = 'rgba(2, 32, 71, 0.08)';
  ctx.shadowBlur = 18;
  ctx.shadowOffsetY = 6;
  ctx.fillStyle = '#fff';
  ctx.beginPath();
  ctx.moveTo(cardX, IMG_PAD + 24);
  ctx.arcTo(cardX, IMG_PAD, cardX + 24, IMG_PAD, 24);
  ctx.lineTo(cardX + cardW - 24, IMG_PAD);
  ctx.arcTo(cardX + cardW, IMG_PAD, cardX + cardW, IMG_PAD + 24, 24);
  ctx.lineTo(cardX + cardW, cardBottom);
  const tooth = 14;
  for (let x = cardX + cardW; x > cardX; x -= tooth) {
    const nx = Math.max(cardX, x - tooth);
    ctx.lineTo((x + nx) / 2, cardBottom + 8);
    ctx.lineTo(nx, cardBottom);
  }
  ctx.closePath();
  ctx.fill();
  ctx.restore();
  ctx.textBaseline = 'alphabetic';
  for (const p of plan) p.draw(ctx);

  return new Promise((resolve, reject) => canvas.toBlob((b) => (b ? resolve(b) : reject(new Error('이미지를 만들지 못했어요'))), 'image/png'));
}

function roundRect(ctx: CanvasRenderingContext2D, x: number, y: number, w: number, h: number, r: number) {
  ctx.beginPath();
  ctx.moveTo(x + r, y);
  ctx.arcTo(x + w, y, x + w, y + h, r);
  ctx.arcTo(x + w, y + h, x, y + h, r);
  ctx.arcTo(x, y + h, x, y, r);
  ctx.arcTo(x, y, x + w, y, r);
  ctx.closePath();
}

const fileNameOf = (b: SettlementBillData) => `프리티풀-정산명세서-${b.no}.png`;

function downloadBlob(blob: Blob, name: string) {
  const url = URL.createObjectURL(blob);
  const a = document.createElement('a');
  a.href = url;
  a.download = name;
  document.body.appendChild(a);
  a.click();
  a.remove();
  window.setTimeout(() => URL.revokeObjectURL(url), 4000);
}

/** 카카오톡으로 공유 — 폰: 공유 시트(카카오톡 → 사진) · PC: 이미지 복사(카톡 대화창에 붙여넣기) · 둘 다 안 되면 저장 */
async function shareBlob(blob: Blob, bill: SettlementBillData): Promise<'shared' | 'cancelled' | 'copied' | 'downloaded'> {
  const file = new File([blob], fileNameOf(bill), { type: 'image/png' });
  const nav = navigator as Navigator & { canShare?: (d: unknown) => boolean };
  const touch = typeof window !== 'undefined' && window.matchMedia?.('(pointer: coarse)').matches;
  const tryShare = async () => {
    if (!nav.canShare?.({ files: [file] }) || !nav.share) return null;
    try {
      await nav.share({ files: [file], title: '프리티풀 정산 명세서' } as ShareData);
      return 'shared' as const;
    } catch (e: any) {
      return e?.name === 'AbortError' ? ('cancelled' as const) : null;
    }
  };
  const tryCopy = async () => {
    const CI = (window as any).ClipboardItem;
    if (!CI || !navigator.clipboard?.write) return null;
    try {
      await navigator.clipboard.write([new CI({ 'image/png': blob })]);
      return 'copied' as const;
    } catch {
      return null;
    }
  };
  const first = touch ? await tryShare() : await tryCopy();
  if (first) return first;
  const second = touch ? await tryCopy() : await tryShare();
  if (second) return second;
  downloadBlob(blob, fileNameOf(bill));
  return 'downloaded';
}

function KakaoGlyph() {
  return (
    <svg width="20" height="20" viewBox="0 0 24 24" aria-hidden="true">
      <path d="M12 3.5c-5.25 0-9.5 3.3-9.5 7.37 0 2.63 1.78 4.94 4.45 6.24-.2.72-.71 2.6-.81 3-.13.5.18.49.38.36.16-.1 2.49-1.69 3.5-2.38.64.09 1.3.14 1.98.14 5.25 0 9.5-3.3 9.5-7.37S17.25 3.5 12 3.5Z" fill="#191919" />
    </svg>
  );
}

/** 공유·저장 버튼 — 이미지는 열 때 미리 그려 둔다(누르는 순간 공유 시트를 불러야 해서) */
export function SettlementBillActions({ bill }: { bill: SettlementBillData }) {
  const [blob, setBlob] = useState<Blob | null>(null);
  const [busy, setBusy] = useState(false);
  useEffect(() => {
    let alive = true;
    setBlob(null);
    renderSettlementBillPng(bill).then((b) => { if (alive) setBlob(b); }).catch(() => {});
    return () => { alive = false; };
  }, [bill]);

  const share = async () => {
    if (busy) return;
    setBusy(true);
    try {
      const b = blob || (await renderSettlementBillPng(bill));
      const r = await shareBlob(b, bill);
      if (r === 'copied') toast.success('명세서 이미지를 복사했어요. 카카오톡 대화창에 붙여넣기 하세요', { duration: 4500 });
      else if (r === 'downloaded') toast.success('명세서 이미지를 저장했어요. 카카오톡에서 사진으로 보내 주세요', { duration: 4500 });
    } catch {
      toast.error('이미지를 만들지 못했어요. 잠시 뒤 다시 해 주세요');
    } finally {
      setBusy(false);
    }
  };
  const save = async () => {
    try {
      const b = blob || (await renderSettlementBillPng(bill));
      downloadBlob(b, fileNameOf(bill));
      toast.success('명세서 이미지를 저장했어요');
    } catch {
      toast.error('이미지를 만들지 못했어요');
    }
  };

  return (
    <div className="flex gap-2">
      <button
        type="button"
        onClick={share}
        disabled={busy}
        className="flex h-[52px] flex-[1.4] items-center justify-center gap-1.5 rounded-[16px] bg-[#FEE500] text-[16px] font-semibold text-[#191919] transition-[transform,opacity] duration-150 active:scale-[0.98] disabled:opacity-60"
      >
        <KakaoGlyph />
        카카오톡으로 공유
      </button>
      <button
        type="button"
        onClick={save}
        className="flex h-[52px] flex-1 items-center justify-center rounded-[16px] bg-[#F2F4F6] text-[16px] font-semibold text-[#4E5968] transition-[transform,background-color] duration-150 hover:bg-[#E8EBEE] active:scale-[0.98]"
      >
        이미지 저장
      </button>
    </div>
  );
}
