'use client';

import { useState, useEffect, useMemo } from 'react';
import { Plus, Trash2, Save, Eye, EyeOff } from 'lucide-react';
import toast from 'react-hot-toast';
import { AdminExportButton, exportRowsToXls, formatExportDate } from '../_components/AdminExportButton';
import { AdminSwitch } from '../_components/AdminSwitch';
import { adminFetch } from '../_components/adminFetch';

interface Faq {
  id: string;
  category: string;
  question: string;
  answer: string;
  displayOrder: number;
  isActive: boolean;
  isPublished: boolean;
  createdAt: string;
  updatedAt: string;
}

const DEFAULT_CATEGORIES = ['서비스 이용', '결제/환불', '계정', '기타'];

const emptyDraft = {
  category: '서비스 이용',
  customCategory: '',
  question: '',
  answer: '',
  displayOrder: 0,
  isPublished: true,
};

export default function AdminFaqsPage() {
  const [items, setItems] = useState<Faq[]>([]);
  const [loading, setLoading] = useState(true);
  const [savingId, setSavingId] = useState<string | null>(null);
  const [draft, setDraft] = useState(emptyDraft);
  const [creating, setCreating] = useState(false);
  const [activeCategory, setActiveCategory] = useState<string | null>(null);

  const fetchList = async () => {
    setLoading(true);
    try {
      const data = await adminFetch('GET', '/api/v1/admin/faqs');
      setItems(Array.isArray(data) ? data : []);
    } catch (e: any) {
      toast.error(`로드 실패: ${e?.response?.data?.message || e?.message || ''}`);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => { fetchList(); }, []);

  // 기존 카테고리 + 기본 카테고리 통합
  const allCategories = useMemo(() => {
    const set = new Set<string>(DEFAULT_CATEGORIES);
    items.forEach((it) => it.category && set.add(it.category));
    return Array.from(set);
  }, [items]);

  const filteredItems = activeCategory ? items.filter((it) => it.category === activeCategory) : items;

  const updateField = (id: string, patch: Partial<Faq>) => {
    setItems((prev) => prev.map((it) => (it.id === id ? { ...it, ...patch } : it)));
  };

  const saveItem = async (item: Faq) => {
    if (!item.question.trim()) { toast.error('질문은 필수입니다'); return; }
    setSavingId(item.id);
    try {
      await adminFetch('PATCH', `/api/v1/admin/faqs/${item.id}`, {
        category: item.category,
        question: item.question,
        answer: item.answer,
        displayOrder: item.displayOrder,
        isPublished: item.isPublished,
      });
      toast.success('저장됨');
    } catch (e: any) {
      toast.error(`저장 실패: ${e?.response?.data?.message || e?.message || ''}`);
    } finally {
      setSavingId(null);
    }
  };

  const deleteItem = async (item: Faq) => {
    if (!confirm(`"${item.question}" FAQ를 삭제하시겠습니까?`)) return;
    try {
      await adminFetch('DELETE', `/api/v1/admin/faqs/${item.id}`);
      toast.success('삭제됨');
      fetchList();
    } catch (e: any) {
      toast.error(`삭제 실패: ${e?.response?.data?.message || e?.message || ''}`);
    }
  };

  const create = async () => {
    if (!draft.question.trim()) { toast.error('질문은 필수입니다'); return; }
    const category = draft.category === '__custom__'
      ? draft.customCategory.trim() || '기타'
      : draft.category;
    setCreating(true);
    try {
      await adminFetch('POST', '/api/v1/admin/faqs', {
        category,
        question: draft.question,
        answer: draft.answer,
        displayOrder: Number(draft.displayOrder) || 0,
        isPublished: draft.isPublished,
      });
      toast.success('FAQ 등록됨');
      setDraft(emptyDraft);
      fetchList();
    } catch (e: any) {
      toast.error(`등록 실패: ${e?.response?.data?.message || e?.message || ''}`);
    } finally {
      setCreating(false);
    }
  };

  const handleExport = () => {
    exportRowsToXls('admin-faqs', 'FAQ 관리', filteredItems, [
      { header: '순번', value: (_, index) => index + 1 },
      { header: 'FAQ ID', value: (row) => row.id },
      { header: '카테고리', value: (row) => row.category },
      { header: '질문', value: (row) => row.question },
      { header: '답변', value: (row) => row.answer },
      { header: '표시순서', value: (row) => row.displayOrder },
      { header: '활성', value: (row) => row.isActive },
      { header: '게시', value: (row) => row.isPublished },
      { header: '생성일', value: (row) => formatExportDate(row.createdAt, true) },
      { header: '수정일', value: (row) => formatExportDate(row.updatedAt, true) },
    ]);
    toast.success(`${filteredItems.length.toLocaleString()}건 엑셀 다운로드 완료`);
  };

  return (
    <div className="space-y-5">
      {/* 헤더 */}
      <div className="flex items-center justify-between px-1">
        <div>
          <h1 className="text-[22px] font-bold text-[#191F28] tracking-tight">FAQ 관리</h1>
          <p className="text-[13px] text-[#8B95A1] mt-0.5">자주 묻는 질문 등록 · 카테고리 · 게시 관리</p>
        </div>
        <AdminExportButton loading={false} onClick={handleExport} />
      </div>

      {/* 새 FAQ 등록 */}
      <div className="bg-white rounded-3xl p-6">
        <h2 className="text-[15px] font-bold text-[#191F28] mb-4">새 FAQ 등록</h2>
        <div className="space-y-3">
          <div className="grid grid-cols-[auto_1fr] gap-3">
            <div>
              <label className="block text-[12px] font-medium text-[#8B95A1] mb-1.5">카테고리</label>
              <select
                value={draft.category}
                onChange={(e) => setDraft({ ...draft, category: e.target.value })}
                className="bg-[#F9FAFB] rounded-xl px-4 py-3 text-[14px] text-[#191F28] focus:outline-none focus:bg-white focus:ring-2 focus:ring-[#3182F6]"
              >
                {allCategories.map((c) => (
                  <option key={c} value={c}>{c}</option>
                ))}
                <option value="__custom__">+ 새 카테고리</option>
              </select>
            </div>
            {draft.category === '__custom__' && (
              <div>
                <label className="block text-[12px] font-medium text-[#8B95A1] mb-1.5">새 카테고리 이름</label>
                <input
                  type="text"
                  value={draft.customCategory}
                  onChange={(e) => setDraft({ ...draft, customCategory: e.target.value })}
                  placeholder="예: 전문가 문의"
                  className="w-full bg-[#F9FAFB] rounded-xl px-4 py-3 text-[14px] text-[#191F28] focus:outline-none focus:bg-white focus:ring-2 focus:ring-[#3182F6]"
                />
              </div>
            )}
          </div>
          <div>
            <label className="block text-[12px] font-medium text-[#8B95A1] mb-1.5">질문 *</label>
            <input
              type="text"
              value={draft.question}
              onChange={(e) => setDraft({ ...draft, question: e.target.value })}
              placeholder="자주 묻는 질문"
              className="w-full bg-[#F9FAFB] rounded-xl px-4 py-3 text-[14px] text-[#191F28] focus:outline-none focus:bg-white focus:ring-2 focus:ring-[#3182F6]"
            />
          </div>
          <div>
            <label className="block text-[12px] font-medium text-[#8B95A1] mb-1.5">답변</label>
            <textarea
              value={draft.answer}
              onChange={(e) => setDraft({ ...draft, answer: e.target.value })}
              placeholder="답변 내용 (줄바꿈 허용)"
              rows={5}
              className="w-full bg-[#F9FAFB] rounded-xl px-4 py-3 text-[14px] text-[#191F28] focus:outline-none focus:bg-white focus:ring-2 focus:ring-[#3182F6] resize-y"
            />
          </div>
          <div className="grid grid-cols-[1fr_auto_auto] gap-3 items-end">
            <div>
              <label className="block text-[12px] font-medium text-[#8B95A1] mb-1.5">표시 순서</label>
              <input
                type="number"
                value={draft.displayOrder}
                onChange={(e) => setDraft({ ...draft, displayOrder: Number(e.target.value) })}
                className="w-full bg-[#F9FAFB] rounded-xl px-4 py-3 text-[14px] text-[#191F28] focus:outline-none focus:bg-white focus:ring-2 focus:ring-[#3182F6]"
              />
            </div>
            <div className="flex items-center bg-[#F9FAFB] rounded-xl px-4 py-3 hover:bg-[#F2F4F6]">
              <AdminSwitch
                checked={draft.isPublished}
                onChange={(checked) => setDraft({ ...draft, isPublished: checked })}
                label="게시"
              />
            </div>
            <button
              onClick={create}
              disabled={creating || !draft.question.trim()}
              className="flex items-center gap-1.5 px-4 py-3 rounded-xl bg-[#3182F6] text-white text-[14px] font-semibold hover:bg-[#1B64DA] disabled:opacity-50 whitespace-nowrap"
            >
              <Plus size={16} /> {creating ? '등록 중...' : '등록'}
            </button>
          </div>
        </div>
      </div>

      {/* 카테고리 필터 */}
      <div className="flex flex-wrap gap-2 px-1">
        <button
          onClick={() => setActiveCategory(null)}
          className={`px-3 py-1.5 rounded-full text-[12px] font-semibold transition-colors ${
            !activeCategory ? 'bg-[#191F28] text-white' : 'bg-[#F2F4F6] text-[#8B95A1] hover:bg-[#E5E8EB]'
          }`}
        >
          전체 ({items.length})
        </button>
        {allCategories.map((cat) => {
          const count = items.filter((it) => it.category === cat).length;
          if (count === 0) return null;
          return (
            <button
              key={cat}
              onClick={() => setActiveCategory(activeCategory === cat ? null : cat)}
              className={`px-3 py-1.5 rounded-full text-[12px] font-semibold transition-colors ${
                activeCategory === cat
                  ? 'bg-[#191F28] text-white'
                  : 'bg-[#F2F4F6] text-[#8B95A1] hover:bg-[#E5E8EB]'
              }`}
            >
              {cat} ({count})
            </button>
          );
        })}
      </div>

      {/* 목록 */}
      <div className="bg-white rounded-3xl overflow-hidden">
        <div className="px-5 pt-5 pb-2">
          <h2 className="text-[15px] font-bold text-[#191F28]">
            FAQ 목록 <span className="text-[13px] font-medium text-[#8B95A1] ml-1">({filteredItems.length})</span>
          </h2>
        </div>
        {loading ? (
          <div className="px-5 py-10 text-center text-[13px] text-[#8B95A1]">로딩 중...</div>
        ) : filteredItems.length === 0 ? (
          <div className="px-5 py-10 text-center text-[13px] text-[#8B95A1]">
            {activeCategory ? `${activeCategory} 카테고리에 FAQ가 없습니다` : '등록된 FAQ가 없습니다'}
          </div>
        ) : (
          <div className="divide-y divide-[#F2F4F6]">
            {filteredItems.map((item) => (
              <div key={item.id} className="px-5 py-5 space-y-3">
                <div className="grid grid-cols-[auto_1fr] gap-2 items-center">
                  <input
                    type="text"
                    value={item.category}
                    onChange={(e) => updateField(item.id, { category: e.target.value })}
                    placeholder="카테고리"
                    list={`cat-list-${item.id}`}
                    className="bg-[#F9FAFB] rounded-lg px-3 py-2 text-[12px] font-semibold focus:outline-none focus:ring-1 focus:ring-[#3182F6] min-w-[120px]"
                  />
                  <datalist id={`cat-list-${item.id}`}>
                    {allCategories.map((c) => <option key={c} value={c} />)}
                  </datalist>
                  <input
                    type="number"
                    value={item.displayOrder}
                    onChange={(e) => updateField(item.id, { displayOrder: Number(e.target.value) })}
                    placeholder="순서"
                    className="bg-[#F9FAFB] rounded-lg px-3 py-2 text-[12px] focus:outline-none focus:ring-1 focus:ring-[#3182F6] w-20"
                  />
                </div>
                <input
                  type="text"
                  value={item.question}
                  onChange={(e) => updateField(item.id, { question: e.target.value })}
                  placeholder="질문"
                  className="w-full bg-[#F9FAFB] rounded-lg px-3 py-2 text-[14px] font-semibold focus:outline-none focus:ring-1 focus:ring-[#3182F6]"
                />
                <textarea
                  value={item.answer}
                  onChange={(e) => updateField(item.id, { answer: e.target.value })}
                  placeholder="답변"
                  rows={4}
                  className="w-full bg-[#F9FAFB] rounded-lg px-3 py-2 text-[13px] focus:outline-none focus:ring-1 focus:ring-[#3182F6] resize-y"
                />
                <div className="flex items-center gap-2">
                  <button
                    onClick={() => updateField(item.id, { isPublished: !item.isPublished })}
                    className={`flex items-center gap-1 rounded-lg px-3 py-2 text-[12px] font-semibold transition-colors ${
                      item.isPublished
                        ? 'bg-[#E8F3FF] text-[#3182F6] hover:bg-[#D6E9FF]'
                        : 'bg-[#F2F4F6] text-[#8B95A1] hover:bg-[#E5E8EB]'
                    }`}
                  >
                    {item.isPublished ? <><Eye size={12} /> 게시</> : <><EyeOff size={12} /> 숨김</>}
                  </button>
                  <div className="ml-auto flex gap-2">
                    <button
                      onClick={() => deleteItem(item)}
                      className="flex items-center gap-1 rounded-lg bg-[#FFECEC] text-[#F04452] text-[12px] font-semibold px-3 py-2 hover:bg-[#FFDDDD]"
                    >
                      <Trash2 size={12} /> 삭제
                    </button>
                    <button
                      onClick={() => saveItem(item)}
                      disabled={savingId === item.id}
                      className="flex items-center gap-1 rounded-lg bg-[#3182F6] text-white text-[12px] font-semibold px-3 py-2 hover:bg-[#1B64DA] disabled:opacity-50"
                    >
                      <Save size={12} /> {savingId === item.id ? '저장 중' : '저장'}
                    </button>
                  </div>
                </div>
              </div>
            ))}
          </div>
        )}
      </div>
    </div>
  );
}
