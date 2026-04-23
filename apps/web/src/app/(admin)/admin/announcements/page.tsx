'use client';

import { useState, useEffect } from 'react';
import { Plus, Trash2, Save, Eye, EyeOff, Pin, PinOff } from 'lucide-react';
import toast from 'react-hot-toast';
import { adminFetch } from '../_components/adminFetch';

interface Announcement {
  id: string;
  title: string;
  content: string;
  tag: string | null;
  isPinned: boolean;
  isPublished: boolean;
  publishedAt: string | null;
  createdAt: string;
  updatedAt: string;
}

const TAG_OPTIONS = ['필독', '업데이트', '안내', '이벤트', '점검'];

const emptyDraft = {
  title: '',
  content: '',
  tag: '안내' as string | null,
  isPinned: false,
  isPublished: true,
};

export default function AdminAnnouncementsPage() {
  const [items, setItems] = useState<Announcement[]>([]);
  const [loading, setLoading] = useState(true);
  const [savingId, setSavingId] = useState<string | null>(null);
  const [draft, setDraft] = useState(emptyDraft);
  const [creating, setCreating] = useState(false);

  const fetchList = async () => {
    setLoading(true);
    try {
      const data = await adminFetch('GET', '/api/v1/admin/announcements');
      setItems(Array.isArray(data) ? data : []);
    } catch (e: any) {
      toast.error(`로드 실패: ${e?.response?.data?.message || e?.message || ''}`);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => { fetchList(); }, []);

  const updateField = (id: string, patch: Partial<Announcement>) => {
    setItems((prev) => prev.map((it) => (it.id === id ? { ...it, ...patch } : it)));
  };

  const saveItem = async (item: Announcement) => {
    if (!item.title.trim()) { toast.error('제목은 필수입니다'); return; }
    setSavingId(item.id);
    try {
      await adminFetch('PATCH', `/api/v1/admin/announcements/${item.id}`, {
        title: item.title,
        content: item.content,
        tag: item.tag,
        isPinned: item.isPinned,
        isPublished: item.isPublished,
      });
      toast.success('저장됨');
    } catch (e: any) {
      toast.error(`저장 실패: ${e?.response?.data?.message || e?.message || ''}`);
    } finally {
      setSavingId(null);
    }
  };

  const deleteItem = async (item: Announcement) => {
    if (!confirm(`"${item.title}" 공지사항을 삭제하시겠습니까?`)) return;
    try {
      await adminFetch('DELETE', `/api/v1/admin/announcements/${item.id}`);
      toast.success('삭제됨');
      fetchList();
    } catch (e: any) {
      toast.error(`삭제 실패: ${e?.response?.data?.message || e?.message || ''}`);
    }
  };

  const create = async () => {
    if (!draft.title.trim()) { toast.error('제목은 필수입니다'); return; }
    setCreating(true);
    try {
      await adminFetch('POST', '/api/v1/admin/announcements', {
        title: draft.title,
        content: draft.content,
        tag: draft.tag || null,
        isPinned: draft.isPinned,
        isPublished: draft.isPublished,
      });
      toast.success('공지사항 등록됨');
      setDraft(emptyDraft);
      fetchList();
    } catch (e: any) {
      toast.error(`등록 실패: ${e?.response?.data?.message || e?.message || ''}`);
    } finally {
      setCreating(false);
    }
  };

  const formatDate = (iso: string | null) => {
    if (!iso) return '-';
    try {
      const d = new Date(iso);
      return `${d.getFullYear()}.${String(d.getMonth() + 1).padStart(2, '0')}.${String(d.getDate()).padStart(2, '0')}`;
    } catch {
      return '-';
    }
  };

  return (
    <div className="space-y-5">
      {/* 헤더 */}
      <div className="flex items-center justify-between px-1">
        <div>
          <h1 className="text-[22px] font-bold text-[#191F28] tracking-tight">공지사항 관리</h1>
          <p className="text-[13px] text-[#8B95A1] mt-0.5">공지 생성 · 고정 · 게시 여부 관리</p>
        </div>
      </div>

      {/* 새 공지 등록 */}
      <div className="bg-white rounded-3xl p-6">
        <h2 className="text-[15px] font-bold text-[#191F28] mb-4">새 공지 등록</h2>
        <div className="space-y-3">
          <div>
            <label className="block text-[12px] font-medium text-[#8B95A1] mb-1.5">제목 *</label>
            <input
              type="text"
              value={draft.title}
              onChange={(e) => setDraft({ ...draft, title: e.target.value })}
              placeholder="공지 제목"
              className="w-full bg-[#F9FAFB] rounded-xl px-4 py-3 text-[14px] text-[#191F28] focus:outline-none focus:bg-white focus:ring-2 focus:ring-[#3182F6]"
            />
          </div>
          <div>
            <label className="block text-[12px] font-medium text-[#8B95A1] mb-1.5">내용</label>
            <textarea
              value={draft.content}
              onChange={(e) => setDraft({ ...draft, content: e.target.value })}
              placeholder="공지 내용 (줄바꿈 허용)"
              rows={6}
              className="w-full bg-[#F9FAFB] rounded-xl px-4 py-3 text-[14px] text-[#191F28] focus:outline-none focus:bg-white focus:ring-2 focus:ring-[#3182F6] resize-y"
            />
          </div>
          <div className="grid grid-cols-[1fr_auto_auto_auto] gap-3 items-end">
            <div>
              <label className="block text-[12px] font-medium text-[#8B95A1] mb-1.5">태그</label>
              <select
                value={draft.tag ?? ''}
                onChange={(e) => setDraft({ ...draft, tag: e.target.value || null })}
                className="w-full bg-[#F9FAFB] rounded-xl px-4 py-3 text-[14px] text-[#191F28] focus:outline-none focus:bg-white focus:ring-2 focus:ring-[#3182F6]"
              >
                <option value="">(태그 없음)</option>
                {TAG_OPTIONS.map((t) => (
                  <option key={t} value={t}>{t}</option>
                ))}
              </select>
            </div>
            <label className="flex items-center gap-2 bg-[#F9FAFB] rounded-xl px-4 py-3 cursor-pointer hover:bg-[#F2F4F6]">
              <input
                type="checkbox"
                checked={draft.isPinned}
                onChange={(e) => setDraft({ ...draft, isPinned: e.target.checked })}
                className="w-4 h-4"
              />
              <span className="text-[13px] font-semibold text-[#191F28]">고정</span>
            </label>
            <label className="flex items-center gap-2 bg-[#F9FAFB] rounded-xl px-4 py-3 cursor-pointer hover:bg-[#F2F4F6]">
              <input
                type="checkbox"
                checked={draft.isPublished}
                onChange={(e) => setDraft({ ...draft, isPublished: e.target.checked })}
                className="w-4 h-4"
              />
              <span className="text-[13px] font-semibold text-[#191F28]">게시</span>
            </label>
            <button
              onClick={create}
              disabled={creating || !draft.title.trim()}
              className="flex items-center gap-1.5 px-4 py-3 rounded-xl bg-[#3182F6] text-white text-[14px] font-semibold hover:bg-[#1B64DA] disabled:opacity-50 whitespace-nowrap"
            >
              <Plus size={16} /> {creating ? '등록 중...' : '등록'}
            </button>
          </div>
        </div>
      </div>

      {/* 목록 */}
      <div className="bg-white rounded-3xl overflow-hidden">
        <div className="px-5 pt-5 pb-2">
          <h2 className="text-[15px] font-bold text-[#191F28]">
            공지 목록 <span className="text-[13px] font-medium text-[#8B95A1] ml-1">({items.length})</span>
          </h2>
        </div>
        {loading ? (
          <div className="px-5 py-10 text-center text-[13px] text-[#8B95A1]">로딩 중...</div>
        ) : items.length === 0 ? (
          <div className="px-5 py-10 text-center text-[13px] text-[#8B95A1]">등록된 공지가 없습니다</div>
        ) : (
          <div className="divide-y divide-[#F2F4F6]">
            {items.map((item) => (
              <div key={item.id} className="px-5 py-5 space-y-3">
                <div className="flex items-center gap-2 text-[11px] text-[#8B95A1]">
                  <span>생성: {formatDate(item.createdAt)}</span>
                  {item.updatedAt && item.updatedAt !== item.createdAt && (
                    <span>· 수정: {formatDate(item.updatedAt)}</span>
                  )}
                </div>
                <input
                  type="text"
                  value={item.title}
                  onChange={(e) => updateField(item.id, { title: e.target.value })}
                  placeholder="제목"
                  className="w-full bg-[#F9FAFB] rounded-lg px-3 py-2 text-[14px] font-semibold focus:outline-none focus:ring-1 focus:ring-[#3182F6]"
                />
                <textarea
                  value={item.content}
                  onChange={(e) => updateField(item.id, { content: e.target.value })}
                  placeholder="내용"
                  rows={5}
                  className="w-full bg-[#F9FAFB] rounded-lg px-3 py-2 text-[13px] focus:outline-none focus:ring-1 focus:ring-[#3182F6] resize-y"
                />
                <div className="flex flex-wrap items-center gap-2">
                  <select
                    value={item.tag ?? ''}
                    onChange={(e) => updateField(item.id, { tag: e.target.value || null })}
                    className="bg-[#F9FAFB] rounded-lg px-3 py-2 text-[13px] focus:outline-none focus:ring-1 focus:ring-[#3182F6]"
                  >
                    <option value="">(태그 없음)</option>
                    {TAG_OPTIONS.map((t) => (
                      <option key={t} value={t}>{t}</option>
                    ))}
                  </select>
                  <button
                    onClick={() => updateField(item.id, { isPinned: !item.isPinned })}
                    className={`flex items-center gap-1 rounded-lg px-3 py-2 text-[12px] font-semibold transition-colors ${
                      item.isPinned
                        ? 'bg-pink-50 text-pink-600 hover:bg-pink-100'
                        : 'bg-[#F2F4F6] text-[#8B95A1] hover:bg-[#E5E8EB]'
                    }`}
                  >
                    {item.isPinned ? <><Pin size={12} /> 고정</> : <><PinOff size={12} /> 일반</>}
                  </button>
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
