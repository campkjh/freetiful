'use client';

import { useEffect, useMemo, useState } from 'react';
import { Code2, Eye, FileText, Plus, RefreshCw, Save, Trash2 } from 'lucide-react';
import toast from 'react-hot-toast';
import { AdminExportButton, exportRowsToXls, formatExportDate } from '../_components/AdminExportButton';
import { AdminSwitch } from '../_components/AdminSwitch';
import { adminFetch } from '../_components/adminFetch';

interface PolicyDocument {
  id: string;
  slug: string;
  title: string;
  summary: string | null;
  contentHtml: string;
  version: string;
  effectiveDate: string | null;
  displayOrder: number;
  isPublished: boolean;
  createdAt: string;
  updatedAt: string;
}

type Draft = {
  id?: string;
  slug: string;
  title: string;
  summary: string;
  contentHtml: string;
  version: string;
  effectiveDate: string;
  displayOrder: number;
  isPublished: boolean;
};

const emptyDraft: Draft = {
  slug: '',
  title: '',
  summary: '',
  contentHtml: '<p>약관 내용을 HTML로 입력하세요.</p>',
  version: '1.0',
  effectiveDate: '',
  displayOrder: 0,
  isPublished: true,
};

function toDateInput(value?: string | null) {
  if (!value) return '';
  const date = new Date(value);
  if (Number.isNaN(date.getTime())) return '';
  return date.toISOString().slice(0, 10);
}

function toDraft(item: PolicyDocument): Draft {
  return {
    id: item.id,
    slug: item.slug,
    title: item.title,
    summary: item.summary || '',
    contentHtml: item.contentHtml || '',
    version: item.version || '1.0',
    effectiveDate: toDateInput(item.effectiveDate),
    displayOrder: item.displayOrder || 0,
    isPublished: item.isPublished,
  };
}

export default function AdminPoliciesPage() {
  const [items, setItems] = useState<PolicyDocument[]>([]);
  const [draft, setDraft] = useState<Draft>(emptyDraft);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [preview, setPreview] = useState(false);

  const selected = useMemo(() => items.find((item) => item.id === draft.id) || null, [draft.id, items]);

  const fetchList = async (keepSelection = true) => {
    setLoading(true);
    try {
      const data = await adminFetch('GET', '/api/v1/admin/policies', undefined, { cache: false });
      const rows = Array.isArray(data) ? data : [];
      setItems(rows);
      if (!keepSelection || !draft.id) {
        setDraft(rows[0] ? toDraft(rows[0]) : emptyDraft);
      } else {
        const current = rows.find((row: PolicyDocument) => row.id === draft.id);
        if (current) setDraft(toDraft(current));
      }
    } catch (e: any) {
      toast.error(`약관 로드 실패: ${e?.response?.data?.message || e?.message || ''}`);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => { fetchList(false); }, []);

  const updateDraft = (patch: Partial<Draft>) => setDraft((prev) => ({ ...prev, ...patch }));

  const selectItem = (item: PolicyDocument) => {
    setDraft(toDraft(item));
    setPreview(false);
  };

  const newDocument = () => {
    setDraft({ ...emptyDraft, displayOrder: (items.length + 1) * 10 });
    setPreview(false);
  };

  const save = async () => {
    if (!draft.slug.trim()) { toast.error('slug는 필수입니다'); return; }
    if (!draft.title.trim()) { toast.error('제목은 필수입니다'); return; }
    if (!draft.contentHtml.trim()) { toast.error('HTML 내용은 필수입니다'); return; }
    setSaving(true);
    const payload = {
      slug: draft.slug.trim(),
      title: draft.title.trim(),
      summary: draft.summary.trim(),
      contentHtml: draft.contentHtml,
      version: draft.version.trim() || '1.0',
      effectiveDate: draft.effectiveDate || null,
      displayOrder: Number(draft.displayOrder) || 0,
      isPublished: draft.isPublished,
    };
    try {
      const saved = draft.id
        ? await adminFetch('PATCH', `/api/v1/admin/policies/${draft.id}`, payload)
        : await adminFetch('POST', '/api/v1/admin/policies', payload);
      toast.success(draft.id ? '약관이 업데이트되었습니다' : '약관이 등록되었습니다');
      await fetchList(true);
      setDraft(toDraft(saved));
    } catch (e: any) {
      toast.error(`저장 실패: ${e?.response?.data?.message || e?.message || ''}`);
    } finally {
      setSaving(false);
    }
  };

  const remove = async () => {
    if (!draft.id || !selected) return;
    if (!confirm(`"${selected.title}" 문서를 삭제하시겠습니까?`)) return;
    setSaving(true);
    try {
      await adminFetch('DELETE', `/api/v1/admin/policies/${draft.id}`);
      toast.success('약관 문서가 삭제되었습니다');
      setDraft(emptyDraft);
      await fetchList(false);
    } catch (e: any) {
      toast.error(`삭제 실패: ${e?.response?.data?.message || e?.message || ''}`);
    } finally {
      setSaving(false);
    }
  };

  const handleExport = () => {
    exportRowsToXls('admin-policies', '약관 관리', items, [
      { header: '순번', value: (_, index) => index + 1 },
      { header: '문서 ID', value: (row) => row.id },
      { header: 'slug', value: (row) => row.slug },
      { header: '제목', value: (row) => row.title },
      { header: '요약', value: (row) => row.summary || '' },
      { header: '버전', value: (row) => row.version },
      { header: '시행일', value: (row) => formatExportDate(row.effectiveDate) },
      { header: '게시', value: (row) => row.isPublished },
      { header: '표시순서', value: (row) => row.displayOrder },
      { header: 'HTML', value: (row) => row.contentHtml },
      { header: '수정일', value: (row) => formatExportDate(row.updatedAt, true) },
    ]);
    toast.success(`${items.length.toLocaleString()}건 엑셀 다운로드 완료`);
  };

  return (
    <div className="space-y-5">
      <div className="flex items-center justify-between gap-3 px-1">
        <div>
          <p className="text-[12px] font-bold text-[#3180F7]">콘텐츠 센터</p>
          <h1 className="mt-1 text-[24px] font-black tracking-tight text-[#191F28]">약관 관리</h1>
          <p className="mt-1 text-[13px] font-semibold text-[#8B95A1]">
            서비스 이용약관, 개인정보처리방침 등 공개 약관을 HTML로 수정합니다.
          </p>
        </div>
        <div className="flex items-center gap-2">
          <AdminExportButton loading={false} onClick={handleExport} />
          <button
            type="button"
            onClick={() => fetchList(true)}
            className="admin-icon-button flex h-10 w-10 items-center justify-center rounded-full bg-white text-[#6B7684] shadow-[0_6px_16px_rgba(2,32,71,0.04)] hover:bg-[#F2F4F6]"
            title="새로고침"
          >
            <RefreshCw size={16} className={loading ? 'animate-spin' : ''} />
          </button>
          <button
            type="button"
            onClick={newDocument}
            className="inline-flex h-10 items-center gap-1.5 rounded-full bg-[#3180F7] px-4 text-[12px] font-bold text-white shadow-[0_8px_18px_rgba(49,128,247,0.22)] hover:bg-[#1B64DA]"
          >
            <Plus size={15} /> 새 약관
          </button>
        </div>
      </div>

      <div className="grid gap-5 xl:grid-cols-[320px_minmax(0,1fr)]">
        <aside className="admin-list-card overflow-hidden">
          <div className="border-b border-[#F2F4F6] px-5 py-4">
            <p className="text-[13px] font-black text-[#191F28]">문서 목록</p>
            <p className="mt-0.5 text-[12px] font-semibold text-[#8B95A1]">총 {items.length.toLocaleString()}개</p>
          </div>
          <div className="max-h-[720px] overflow-y-auto">
            {loading ? (
              Array.from({ length: 6 }).map((_, index) => (
                <div key={index} className="border-b border-[#F2F4F6] px-5 py-4">
                  <div className="skeleton h-14 w-full" />
                </div>
              ))
            ) : items.length === 0 ? (
              <div className="px-5 py-10 text-center text-[13px] font-semibold text-[#8B95A1]">등록된 약관이 없습니다</div>
            ) : items.map((item) => {
              const active = item.id === draft.id;
              return (
                <button
                  key={item.id}
                  type="button"
                  onClick={() => selectItem(item)}
                  className={`block w-full border-b border-[#F2F4F6] px-5 py-4 text-left transition-colors ${
                    active ? 'bg-[#F3F8FF]' : 'bg-white hover:bg-[#F7F9FC]'
                  }`}
                >
                  <div className="flex items-center justify-between gap-2">
                    <p className={`truncate text-[14px] font-black ${active ? 'text-[#3180F7]' : 'text-[#191F28]'}`}>{item.title}</p>
                    <span className={`shrink-0 rounded-full px-2 py-0.5 text-[10px] font-bold ${
                      item.isPublished ? 'bg-[#E8F3FF] text-[#3180F7]' : 'bg-[#F2F4F6] text-[#8B95A1]'
                    }`}>
                      {item.isPublished ? '게시' : '숨김'}
                    </span>
                  </div>
                  <p className="mt-1 font-mono text-[11px] text-[#8B95A1]">/terms/{item.slug}</p>
                  <p className="mt-1 line-clamp-2 text-[12px] font-medium leading-relaxed text-[#8B95A1]">{item.summary || '요약 없음'}</p>
                </button>
              );
            })}
          </div>
        </aside>

        <section className="admin-list-card p-5">
          <div className="grid gap-3 md:grid-cols-[1fr_160px_130px]">
            <div>
              <label className="mb-1.5 block text-[12px] font-bold text-[#8B95A1]">제목</label>
              <input
                value={draft.title}
                onChange={(e) => updateDraft({ title: e.target.value })}
                placeholder="서비스 이용약관"
                className="h-11 w-full rounded-2xl border border-[#E5E8EB] bg-[#F7F8FA] px-4 text-sm font-semibold text-[#191F28] focus:outline-none focus:ring-2 focus:ring-[#3180F7]"
              />
            </div>
            <div>
              <label className="mb-1.5 block text-[12px] font-bold text-[#8B95A1]">slug</label>
              <input
                value={draft.slug}
                onChange={(e) => updateDraft({ slug: e.target.value })}
                placeholder="service"
                className="h-11 w-full rounded-2xl border border-[#E5E8EB] bg-[#F7F8FA] px-4 font-mono text-sm font-semibold text-[#191F28] focus:outline-none focus:ring-2 focus:ring-[#3180F7]"
              />
            </div>
            <div>
              <label className="mb-1.5 block text-[12px] font-bold text-[#8B95A1]">버전</label>
              <input
                value={draft.version}
                onChange={(e) => updateDraft({ version: e.target.value })}
                className="h-11 w-full rounded-2xl border border-[#E5E8EB] bg-[#F7F8FA] px-4 text-sm font-semibold text-[#191F28] focus:outline-none focus:ring-2 focus:ring-[#3180F7]"
              />
            </div>
          </div>

          <div className="mt-3">
            <label className="mb-1.5 block text-[12px] font-bold text-[#8B95A1]">요약</label>
            <input
              value={draft.summary}
              onChange={(e) => updateDraft({ summary: e.target.value })}
              placeholder="문서 설명"
              className="h-11 w-full rounded-2xl border border-[#E5E8EB] bg-[#F7F8FA] px-4 text-sm font-semibold text-[#191F28] focus:outline-none focus:ring-2 focus:ring-[#3180F7]"
            />
          </div>

          <div className="mt-3 grid gap-3 md:grid-cols-[180px_140px_1fr]">
            <div>
              <label className="mb-1.5 block text-[12px] font-bold text-[#8B95A1]">시행일</label>
              <input
                type="date"
                value={draft.effectiveDate}
                onChange={(e) => updateDraft({ effectiveDate: e.target.value })}
                className="h-11 w-full rounded-2xl border border-[#E5E8EB] bg-[#F7F8FA] px-4 text-sm font-semibold text-[#191F28] focus:outline-none focus:ring-2 focus:ring-[#3180F7]"
              />
            </div>
            <div>
              <label className="mb-1.5 block text-[12px] font-bold text-[#8B95A1]">표시 순서</label>
              <input
                type="number"
                value={draft.displayOrder}
                onChange={(e) => updateDraft({ displayOrder: Number(e.target.value) })}
                className="h-11 w-full rounded-2xl border border-[#E5E8EB] bg-[#F7F8FA] px-4 text-sm font-semibold text-[#191F28] focus:outline-none focus:ring-2 focus:ring-[#3180F7]"
              />
            </div>
            <div className="flex items-end justify-between gap-3">
              <AdminSwitch checked={draft.isPublished} onChange={(checked) => updateDraft({ isPublished: checked })} label="공개 게시" />
              <div className="flex rounded-2xl bg-[#F2F4F6] p-1">
                <button
                  type="button"
                  onClick={() => setPreview(false)}
                  className={`inline-flex h-9 items-center gap-1 rounded-xl px-3 text-[12px] font-bold ${!preview ? 'bg-white text-[#3180F7] shadow-sm' : 'text-[#8B95A1]'}`}
                >
                  <Code2 size={14} /> HTML
                </button>
                <button
                  type="button"
                  onClick={() => setPreview(true)}
                  className={`inline-flex h-9 items-center gap-1 rounded-xl px-3 text-[12px] font-bold ${preview ? 'bg-white text-[#3180F7] shadow-sm' : 'text-[#8B95A1]'}`}
                >
                  <Eye size={14} /> 미리보기
                </button>
              </div>
            </div>
          </div>

          <div className="mt-4">
            <div className="mb-1.5 flex items-center justify-between">
              <label className="text-[12px] font-bold text-[#8B95A1]">HTML 에디터</label>
              <a
                href={draft.slug ? `/terms/${draft.slug}` : '#'}
                target="_blank"
                rel="noreferrer"
                className="inline-flex items-center gap-1 text-[12px] font-bold text-[#3180F7]"
              >
                <FileText size={13} /> 공개 페이지
              </a>
            </div>
            {preview ? (
              <div
                className="policy-preview min-h-[520px] rounded-2xl border border-[#E5E8EB] bg-white p-5"
                dangerouslySetInnerHTML={{ __html: draft.contentHtml }}
              />
            ) : (
              <textarea
                value={draft.contentHtml}
                onChange={(e) => updateDraft({ contentHtml: e.target.value })}
                spellCheck={false}
                className="min-h-[520px] w-full resize-y rounded-2xl border border-[#E5E8EB] bg-[#0F172A] px-4 py-4 font-mono text-[12px] font-medium leading-relaxed text-[#DDE7FF] outline-none focus:ring-2 focus:ring-[#3180F7]"
              />
            )}
          </div>

          <div className="mt-4 flex items-center justify-between gap-3">
            <button
              type="button"
              onClick={remove}
              disabled={!draft.id || saving}
              className="inline-flex h-11 items-center gap-1.5 rounded-2xl bg-red-50 px-4 text-[13px] font-bold text-red-500 hover:bg-red-100 disabled:opacity-40"
            >
              <Trash2 size={15} /> 삭제
            </button>
            <button
              type="button"
              onClick={save}
              disabled={saving}
              className="inline-flex h-11 items-center gap-1.5 rounded-2xl bg-[#3180F7] px-5 text-[13px] font-bold text-white shadow-[0_8px_18px_rgba(49,128,247,0.22)] hover:bg-[#1B64DA] disabled:opacity-50"
            >
              <Save size={15} /> {saving ? '저장 중...' : draft.id ? '업데이트' : '등록'}
            </button>
          </div>
        </section>
      </div>

      <style>{`
        .policy-preview {
          color: #4b5563;
          font-size: 13px;
          line-height: 1.75;
        }
        .policy-preview section { margin-bottom: 24px; }
        .policy-preview h2 { margin: 0 0 8px; color: #111827; font-size: 15px; font-weight: 700; }
        .policy-preview h3 { margin: 12px 0 6px; color: #111827; font-size: 13px; font-weight: 700; }
        .policy-preview p { margin: 0 0 8px; }
        .policy-preview .policy-subtitle { margin: -4px 0 8px; color: #9ca3af; font-size: 11px; }
        .policy-preview ol { margin: 4px 0 0; padding-left: 18px; }
        .policy-preview li { margin: 4px 0; }
        .policy-preview table {
          width: 100%;
          margin-top: 10px;
          border-collapse: separate;
          border-spacing: 0;
          overflow: hidden;
          border: 1px solid #e5e7eb;
          border-radius: 8px;
        }
        .policy-preview th,
        .policy-preview td { border-bottom: 1px solid #f3f4f6; padding: 8px 10px; text-align: left; vertical-align: top; }
        .policy-preview th { background: #f9fafb; color: #374151; font-weight: 700; }
        .policy-preview tr:last-child td { border-bottom: 0; }
        .policy-preview .policy-notice {
          margin-top: 12px;
          border-radius: 8px;
          background: #f9fafb;
          padding: 10px 12px;
          color: #6b7280;
          font-size: 12px;
        }
      `}</style>
    </div>
  );
}
