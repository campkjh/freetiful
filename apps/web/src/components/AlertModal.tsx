"use client";

interface AlertButton {
  label: string;
  color?: string;
  bgColor?: string;
  onClick: () => void;
}

interface AlertModalProps {
  title: string;
  subtitle?: string;
  buttons: AlertButton[];
  onClose?: () => void;
}

// 파괴적 동작(이름 삭제·탈퇴·나가기 / 빨간 배경 지정)이면 첫 버튼을 danger 로
function isDestructive({ label, bgColor = "" }: AlertButton) {
  if (/삭제|탈퇴|나가기/.test(label) || /danger|red/i.test(bgColor)) return true;
  const m = /^#([0-9a-f]{3}|[0-9a-f]{6})$/i.exec(bgColor.trim());
  if (!m) return false;
  const hex = m[1].length === 3 ? m[1].replace(/./g, "$&$&") : m[1];
  const [r, g, b] = [0, 2, 4].map((i) => parseInt(hex.slice(i, i + 2), 16));
  return r > 180 && g < 120 && b < 120;
}

// 공통 모달(웨딩숲 톤 · 버튼 56/r17/17) — 첫 버튼이 강조(primary·danger), 나머지는 secondary
export default function AlertModal({ title, subtitle, buttons, onClose }: AlertModalProps) {
  return (
    <div className="ft-scrim" onClick={onClose}>
      <div className="ft-sheet" role="dialog" aria-modal="true" onClick={(e) => e.stopPropagation()}>
        <div className="ft-grab" aria-hidden="true" />
        <h2 className="ft-title">{title}</h2>
        {subtitle && <p className="ft-desc">{subtitle}</p>}

        {/* 버튼 2개면 토스식 가로 [보조 | 강조] — 호출부는 강조를 먼저 넘기므로 뒤집어 그린다. 그 밖엔 세로로 */}
        <div className={`ft-actions${buttons.length === 2 ? "" : " col"}`}>
          {(buttons.length === 2 ? [buttons[1], buttons[0]] : buttons).map((btn) => {
            const emphasized = btn === buttons[0];
            return (
              <button
                key={btn.label}
                type="button"
                onClick={btn.onClick}
                className={`ft-btn ${emphasized ? (isDestructive(btn) ? "danger" : "primary") : "secondary"}`}
                // 호출부가 색을 지정했으면 그대로 존중(인라인이 클래스보다 우선)
                style={{ background: btn.bgColor, color: btn.color }}
              >
                {btn.label}
              </button>
            );
          })}
        </div>
      </div>
    </div>
  );
}
