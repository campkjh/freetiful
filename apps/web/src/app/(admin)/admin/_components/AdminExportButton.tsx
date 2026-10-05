'use client';

import { Loader2 } from '@/app/(admin)/admin/_components/admin-icons';

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

/** 엑셀 아이콘(261005 사장 제공 icon-excel.svg 그대로 — 초록 #26A06B, 마스크는 그림 전체를 덮는 사각형이라 뺐다) */
function ExcelIcon({ size = 18 }: { size?: number }) {
  return (
    <svg width={size} height={size} viewBox="0 0 24 24" fill="none" aria-hidden="true" className="shrink-0">
      <path fillRule="evenodd" clipRule="evenodd" d="M15 16.172V22L22 15H16.172C15.523 15 15.01 15.523 15.01 16.162" fill="#26A06B" />
      <path fillRule="evenodd" clipRule="evenodd" d="M7.918 7.60351L9.889 10.4965C9.95 10.8775 9.661 10.9855 9.33 10.9855H8.584C8.263 10.9695 8.205 10.9525 7.999 10.5855L6.983 8.72051L6.97 8.70551L6.957 8.72051L5.941 10.5855C5.735 10.9525 5.677 10.9695 5.356 10.9855H4.61C4.279 10.9855 3.99 10.8775 4.051 10.4965L6.022 7.60351L6.023 7.60251L5.985 7.55851L4.085 4.73851C3.935 4.52151 4.207 4.22151 4.587 4.22151H5.333C5.664 4.22151 5.705 4.26451 5.871 4.53651L6.955 6.46251L6.97 6.48051L6.985 6.46251L8.069 4.53651C8.235 4.26451 8.276 4.22151 8.607 4.22151H9.353C9.733 4.22151 10.005 4.52151 9.856 4.73851L7.955 7.55851L7.917 7.60251L7.918 7.60351ZM20.818 1.99951H3.182C2.528 1.99951 2 2.52751 2 3.18151V20.8285C2 21.4825 2.528 21.9995 3.172 21.9995H13.177V16.1215C13.177 14.4955 14.496 13.1765 16.121 13.1765H22V3.18151C22 2.52751 21.472 1.99951 20.818 1.99951Z" fill="#26A06B" />
    </svg>
  );
}

/** 엑셀 다운로드 — 초록 버튼 + 엑셀 아이콘(261005 사장 '첨부한 아이콘 넣고 버튼 색은 초록 계열'). 모든 목록 화면 공통 */
export function AdminExportButton({ loading, onClick, label = '엑셀 다운로드' }: AdminExportButtonProps) {
  return (
    <button
      type="button"
      onClick={onClick}
      disabled={loading}
      className="adm-btn adm-xls"
      title={label}
    >
      {loading ? <Loader2 size={16} className="animate-spin" /> : <ExcelIcon />}
      <span className="hidden sm:inline">{label}</span>
    </button>
  );
}
