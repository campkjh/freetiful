'use client';

import { Download, Loader2 } from 'lucide-react';

export interface AdminExportColumn<T> {
  header: string;
  value: (row: T, index: number) => string | number | boolean | null | undefined | Date;
}

interface FetchAllRowsOptions<T> {
  pageSize?: number;
  maxPages?: number;
  fetchPage: (page: number, limit: number) => Promise<{
    rows: T[];
    total?: number;
    hasMore?: boolean;
  }>;
}

interface AdminExportButtonProps {
  loading: boolean;
  onClick: () => void | Promise<void>;
  label?: string;
}

function escapeHtml(value: unknown) {
  return String(value ?? '')
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;')
    .replace(/'/g, '&#39;');
}

function normalizeCellValue(value: string | number | boolean | null | undefined | Date) {
  if (value == null) return '';
  if (value instanceof Date) return Number.isNaN(value.getTime()) ? '' : value.toLocaleString('ko-KR');
  if (typeof value === 'boolean') return value ? 'Y' : 'N';
  return value;
}

function safeFileName(value: string) {
  return value.replace(/[\\/:*?"<>|]/g, '_').trim() || 'admin-export';
}

export function formatExportDate(value?: string | Date | null, withTime = false) {
  if (!value) return '';
  const date = value instanceof Date ? value : new Date(value);
  if (Number.isNaN(date.getTime())) return '';
  return withTime
    ? date.toLocaleString('ko-KR', { hour12: false })
    : date.toLocaleDateString('ko-KR');
}

export async function fetchAllAdminRows<T>({
  fetchPage,
  pageSize = 100,
  maxPages = 100,
}: FetchAllRowsOptions<T>) {
  const rows: T[] = [];

  for (let page = 1; page <= maxPages; page += 1) {
    const result = await fetchPage(page, pageSize);
    rows.push(...(result.rows || []));

    const explicitHasMore = typeof result.hasMore === 'boolean' ? result.hasMore : null;
    const hasMoreByTotal = typeof result.total === 'number' ? rows.length < result.total : null;
    const hasMore = explicitHasMore ?? hasMoreByTotal ?? (result.rows || []).length >= pageSize;
    if (!hasMore || (result.rows || []).length === 0) break;
  }

  return rows;
}

export function exportRowsToXls<T>(
  filename: string,
  sheetName: string,
  rows: T[],
  columns: AdminExportColumn<T>[],
) {
  const tableRows = rows.map((row, index) => (
    `<tr>${columns.map((column) => (
      `<td>${escapeHtml(normalizeCellValue(column.value(row, index)))}</td>`
    )).join('')}</tr>`
  )).join('');

  const html = `
    <html>
      <head>
        <meta charset="UTF-8" />
        <style>
          table { border-collapse: collapse; font-family: Arial, sans-serif; font-size: 12px; }
          th { background: #f2f4f6; font-weight: 700; }
          th, td { border: 1px solid #d9dde3; padding: 6px 8px; mso-number-format:'\\@'; }
        </style>
      </head>
      <body>
        <table>
          <thead><tr>${columns.map((column) => `<th>${escapeHtml(column.header)}</th>`).join('')}</tr></thead>
          <tbody>${tableRows}</tbody>
        </table>
      </body>
    </html>
  `;

  const date = new Date().toISOString().slice(0, 10);
  const blob = new Blob(['\ufeff', html], { type: 'application/vnd.ms-excel;charset=utf-8' });
  const url = URL.createObjectURL(blob);
  const a = document.createElement('a');
  a.href = url;
  a.download = `${safeFileName(filename || sheetName)}-${date}.xls`;
  document.body.appendChild(a);
  a.click();
  a.remove();
  URL.revokeObjectURL(url);
}

export function AdminExportButton({ loading, onClick, label = '엑셀 다운로드' }: AdminExportButtonProps) {
  return (
    <button
      type="button"
      onClick={onClick}
      disabled={loading}
      className="admin-icon-button inline-flex h-10 items-center gap-1.5 rounded-full bg-white px-3.5 text-[12px] font-bold text-[#3180F7] shadow-[0_6px_16px_rgba(2,32,71,0.04)] hover:bg-[#F3F8FF] disabled:opacity-50"
      title={label}
    >
      {loading ? <Loader2 size={15} className="animate-spin" /> : <Download size={15} />}
      <span className="hidden sm:inline">{label}</span>
    </button>
  );
}
