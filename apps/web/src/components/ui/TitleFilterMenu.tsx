'use client';

// 제목 ⌄ 거르기 메뉴 — 알림 화면('알림 ⌄')과 같은 어법(260926 사장 "새요청·매칭 탭 말고 알림처럼 ⌄ 눌러서 바꾸게").
//  · 제목을 누르면 토스 팝 메뉴(globals .pop-menu — 작게 시작해 커지고 항목은 오른쪽→왼쪽 촤라락)가 열리고, 고르면 제목이 그 이름으로 바뀐다.
//  · 바깥 클릭판(fixed)이 transform 조상 안에 들어가면 그 조상 크기로 줄어든다 → 등장 애니(qd-a-title)는 버튼 안쪽 span 에만 건다.
import { useState, type ReactNode } from 'react';
import { popItemDelay } from '@/lib/pop-menu';

export type TitleFilterOption<K extends string> = {
  key: K;
  /** 메뉴 줄 이름 */
  label: string;
  /** 골랐을 때 제목 */
  title: string;
  icon: ReactNode;
  count?: number;
};

export default function TitleFilterMenu<K extends string>({
  value,
  options,
  onChange,
  titleClassName = 'text-[20px]',
  enterClassName = '',
}: {
  value: K;
  options: TitleFilterOption<K>[];
  onChange: (key: K) => void;
  titleClassName?: string;
  enterClassName?: string;
}) {
  const [open, setOpen] = useState(false);
  const current = options.find((o) => o.key === value) || options[0];
  return (
    <div className="relative">
      <h1 className="m-0">
        <button
          type="button"
          onClick={() => setOpen((v) => !v)}
          aria-expanded={open}
          aria-haspopup="menu"
          className={`flex items-center rounded-[10px] font-bold tracking-[-0.02em] text-[#191F28] active:opacity-70 ${titleClassName}`}
        >
          <span className={`flex items-center gap-1 ${enterClassName}`}>
            {current.title}
            <svg
              width="20" height="20" viewBox="0 0 24 24" fill="none" aria-hidden="true"
              className="mt-[2px] shrink-0 transition-transform duration-200"
              style={{ transform: open ? 'rotate(180deg)' : 'none' }}
            >
              <path d="M6 9l6 6 6-6" stroke="#8B95A1" strokeWidth="2.2" strokeLinecap="round" strokeLinejoin="round" />
            </svg>
          </span>
        </button>
      </h1>

      {open && (
        <>
          <div className="fixed inset-0 z-40" onClick={() => setOpen(false)} />
          {/* 알림 메뉴와 같은 모서리 24(공통 .pop-menu 18 보다 뒤에 선언돼 인라인으로) */}
          <div
            className="pop-menu absolute left-0 top-full z-50 mt-1 w-max min-w-[208px] overflow-hidden py-2"
            style={{ transformOrigin: '32px 0', borderRadius: 24 }}
            role="menu"
          >
            {options.map((o, i) => {
              const on = o.key === value;
              return (
                <button
                  key={o.key}
                  type="button"
                  role="menuitemradio"
                  aria-checked={on}
                  onClick={() => { onChange(o.key); setOpen(false); }}
                  className="pop-menu-item flex w-full items-center gap-3.5 py-[9px] pl-5 pr-6 text-left transition-colors active:bg-[#F2F4F6] lg:hover:bg-[#F9FAFB]"
                  style={popItemDelay(i)}
                >
                  <span className="flex h-6 w-6 shrink-0 items-center justify-center">{o.icon}</span>
                  <span className={`text-[17px] leading-[24px] ${on ? 'font-semibold text-[#191F28]' : 'text-[#333D4B]'}`}>{o.label}</span>
                  {typeof o.count === 'number' && (
                    <span className={`ml-auto pl-5 text-[15px] tabular-nums ${on ? 'font-semibold text-[#3182F6]' : 'text-[#B0B8C1]'}`}>{o.count}</span>
                  )}
                </button>
              );
            })}
          </div>
        </>
      )}
    </div>
  );
}
