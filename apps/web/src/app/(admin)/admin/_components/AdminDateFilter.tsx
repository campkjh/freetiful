'use client';

import { useEffect, useState } from 'react';
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

type PresetType = 'all' | 'yesterday' | 'lastWeek' | 'lastMonth' | 'thisMonth';
const PRESETS: Array<[PresetType, string]> = [
  ['all', '전체'],
  ['yesterday', '어제'],
  ['lastWeek', '최근 7일'],
  ['lastMonth', '지난달'],
  ['thisMonth', '이번 달'],
];

/** 기간 필터 — 어드민 2.0(261004): 흰 띠 한 줄. 바로가기 칩(고른 칩 = 연한 파랑) + 직접 고르는 날짜 두 칸 + 적용 */
export function AdminDateFilter({ value, onApply, label = '조회기간' }: Props) {
  const [draft, setDraft] = useState<AdminDateRange>(value);

  useEffect(() => {
    setDraft(value);
  }, [value.startDate, value.endDate]);

  const rangeOf = (type: PresetType): AdminDateRange => (type === 'all' ? { startDate: '', endDate: '' } : presetRange(type));
  const active = PRESETS.find(([type]) => {
    const r = rangeOf(type);
    return r.startDate === value.startDate && r.endDate === value.endDate;
  })?.[0];

  const applyPreset = (type: PresetType) => {
    const next = rangeOf(type);
    setDraft(next);
    onApply(next);
  };
  const dirty = draft.startDate !== value.startDate || draft.endDate !== value.endDate;

  return (
    <div className="adm-datebar">
      <span className="adm-datebar-label">
        <AdminTerm term={label}>{label}</AdminTerm>
      </span>
      <div className="adm-chips">
        {PRESETS.map(([type, text]) => (
          <button key={type} type="button" onClick={() => applyPreset(type)} className={`adm-chip ${active === type ? 'on' : ''}`}>
            {text}
          </button>
        ))}
      </div>
      <div className="adm-daterange">
        <input
          type="date"
          value={draft.startDate}
          onChange={(e) => setDraft((prev) => ({ ...prev, startDate: e.target.value }))}
          className="adm-input sm"
          aria-label="시작일"
        />
        <span aria-hidden>~</span>
        <input
          type="date"
          value={draft.endDate}
          onChange={(e) => setDraft((prev) => ({ ...prev, endDate: e.target.value }))}
          className="adm-input sm"
          aria-label="종료일"
        />
        <button
          type="button"
          disabled={!dirty}
          onClick={() => {
            const next = normalizeRange(draft);
            setDraft(next);
            onApply(next);
          }}
          className="adm-btn weak sm"
        >
          적용
        </button>
      </div>
    </div>
  );
}
