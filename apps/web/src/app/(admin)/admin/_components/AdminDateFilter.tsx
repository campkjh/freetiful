'use client';

import { useEffect, useState } from 'react';
import { CalendarDays, RotateCcw } from 'lucide-react';
import { AdminTerm } from './AdminHelpTooltip';

export type AdminDateRange = {
  startDate: string;
  endDate: string;
};

type Props = {
  value: AdminDateRange;
  onApply: (range: AdminDateRange) => void;
  label?: string;
};

function formatDate(value: Date) {
  const year = value.getFullYear();
  const month = String(value.getMonth() + 1).padStart(2, '0');
  const day = String(value.getDate()).padStart(2, '0');
  return `${year}-${month}-${day}`;
}

function addDays(value: Date, days: number) {
  const next = new Date(value);
  next.setDate(next.getDate() + days);
  return next;
}

function presetRange(type: 'yesterday' | 'lastWeek' | 'lastMonth' | 'thisMonth'): AdminDateRange {
  const today = new Date();
  if (type === 'yesterday') {
    const yesterday = addDays(today, -1);
    return { startDate: formatDate(yesterday), endDate: formatDate(yesterday) };
  }
  if (type === 'lastWeek') {
    return { startDate: formatDate(addDays(today, -6)), endDate: formatDate(today) };
  }
  if (type === 'lastMonth') {
    const first = new Date(today.getFullYear(), today.getMonth() - 1, 1);
    const last = new Date(today.getFullYear(), today.getMonth(), 0);
    return { startDate: formatDate(first), endDate: formatDate(last) };
  }
  return {
    startDate: formatDate(new Date(today.getFullYear(), today.getMonth(), 1)),
    endDate: formatDate(today),
  };
}

function normalizeRange(range: AdminDateRange) {
  if (range.startDate && range.endDate && range.startDate > range.endDate) {
    return { startDate: range.endDate, endDate: range.startDate };
  }
  return range;
}

export function AdminDateFilter({ value, onApply, label = '조회기간' }: Props) {
  const [draft, setDraft] = useState<AdminDateRange>(value);

  useEffect(() => {
    setDraft(value);
  }, [value.startDate, value.endDate]);

  const applyPreset = (type: 'yesterday' | 'lastWeek' | 'lastMonth' | 'thisMonth') => {
    const next = presetRange(type);
    setDraft(next);
    onApply(next);
  };

  const reset = () => {
    const next = { startDate: '', endDate: '' };
    setDraft(next);
    onApply(next);
  };

  return (
    <div className="admin-date-filter flex flex-col gap-3 border-y border-[#E5E8EB] bg-white px-4 py-3 lg:flex-row lg:items-center">
      <div className="flex min-w-[180px] items-center gap-2 text-[12px] font-semibold text-[#4E5968]">
        <CalendarDays className="h-4 w-4 text-[#8B95A1]" />
        <AdminTerm term={label}>{label}</AdminTerm>
      </div>
      <div className="flex flex-1 flex-col gap-2 sm:flex-row sm:items-center">
        <input
          type="date"
          value={draft.startDate}
          onChange={(e) => setDraft((prev) => ({ ...prev, startDate: e.target.value }))}
          className="h-10 min-w-[150px] rounded-lg border border-[#E5E8EB] bg-[#F7F8FA] px-3 text-[12px] font-semibold text-[#333D4B] outline-none"
        />
        <span className="hidden text-[12px] font-semibold text-[#B0B8C1] sm:block">→</span>
        <input
          type="date"
          value={draft.endDate}
          onChange={(e) => setDraft((prev) => ({ ...prev, endDate: e.target.value }))}
          className="h-10 min-w-[150px] rounded-lg border border-[#E5E8EB] bg-[#F7F8FA] px-3 text-[12px] font-semibold text-[#333D4B] outline-none"
        />
        <div className="flex flex-wrap gap-2 sm:ml-2">
          {[
            ['yesterday', '어제'],
            ['lastWeek', '지난주'],
            ['lastMonth', '지난달'],
            ['thisMonth', '이번 달'],
          ].map(([type, text]) => (
            <button
              key={type}
              type="button"
              onClick={() => applyPreset(type as 'yesterday' | 'lastWeek' | 'lastMonth' | 'thisMonth')}
              className="admin-chip h-9 px-3 text-[#6B7684] hover:bg-[#F3F8FF] hover:text-[#3180F7]"
            >
              {text}
            </button>
          ))}
        </div>
      </div>
      <div className="flex gap-2 lg:justify-end">
        <button
          type="button"
          onClick={() => {
            const next = normalizeRange(draft);
            setDraft(next);
            onApply(next);
          }}
          className="h-10 rounded-lg bg-[#3180F7] px-4 text-[12px] font-semibold text-white hover:bg-[#1B64DA]"
        >
          적용
        </button>
        <button
          type="button"
          onClick={reset}
          className="admin-icon-button flex h-10 w-10 items-center justify-center rounded-lg bg-[#F7F8FA] text-[#8B95A1] hover:bg-[#F2F4F6] hover:text-[#3180F7]"
          aria-label="날짜 필터 초기화"
          title="초기화"
        >
          <RotateCcw className="h-4 w-4" />
        </button>
      </div>
    </div>
  );
}
