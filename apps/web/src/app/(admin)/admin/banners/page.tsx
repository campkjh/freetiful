'use client';

import { useState, useEffect, useRef } from 'react';
import { Plus, Trash2, Save, Eye, EyeOff, ImageOff, Upload } from 'lucide-react';
import toast from 'react-hot-toast';
import { adminFetch } from '../_components/adminFetch';

// 파일 → 1600px 이하로 리사이즈 → webp data URL (품질 0.88)
// 너무 큰 이미지는 거부 (원본 8MB 초과 시 에러)
async function fileToResizedDataUrl(file: File, maxWidth = 1600, quality = 0.88): Promise<string> {
  if (file.size > 8 * 1024 * 1024) {
    throw new Error('파일이 너무 큽니다 (최대 8MB)');
  }
  const img = await new Promise<HTMLImageElement>((resolve, reject) => {
    const url = URL.createObjectURL(file);
    const i = new Image();
    i.onload = () => { URL.revokeObjectURL(url); resolve(i); };
    i.onerror = () => { URL.revokeObjectURL(url); reject(new Error('이미지를 읽을 수 없습니다')); };
    i.src = url;
  });
  const scale = Math.min(1, maxWidth / img.width);
  const w = Math.round(img.width * scale);
  const h = Math.round(img.height * scale);
  const canvas = document.createElement('canvas');
  canvas.width = w; canvas.height = h;
  const ctx = canvas.getContext('2d');
  if (!ctx) throw new Error('canvas 생성 실패');
  ctx.drawImage(img, 0, 0, w, h);
  // webp 우선, 미지원 브라우저는 jpeg 폴백
  let dataUrl = canvas.toDataURL('image/webp', quality);
  if (!dataUrl.startsWith('data:image/webp')) {
    dataUrl = canvas.toDataURL('image/jpeg', quality);
  }
  // 최종 data URL 이 2.5MB 초과면 품질 낮춰 재시도
  if (dataUrl.length > 2.5 * 1024 * 1024) {
    dataUrl = canvas.toDataURL('image/jpeg', 0.72);
  }
  return dataUrl;
}

interface Banner {
  id: string;
  title: string;
  subtitle: string;
  imageUrl: string;
  linkUrl: string | null;
  bgColor: string | null;
  sortOrder: number;
  isActive: boolean;
  createdAt?: string;
  updatedAt?: string;
}

const emptyDraft = {
  title: '',
  subtitle: '',
  imageUrl: '',
  linkUrl: '',
  bgColor: '',
  sortOrder: 0,
  isActive: true,
};

export default function AdminBannersPage() {
  const [items, setItems] = useState<Banner[]>([]);
  const [loading, setLoading] = useState(true);
  const [savingId, setSavingId] = useState<string | null>(null);
  const [draft, setDraft] = useState(emptyDraft);
  const [creating, setCreating] = useState(false);
  const [processing, setProcessing] = useState(false);
  const fileInputRef = useRef<HTMLInputElement>(null);
  const rowFileInputRefs = useRef<Record<string, HTMLInputElement | null>>({});

  const onPickDraftFile = async (file: File) => {
    setProcessing(true);
    try {
      const dataUrl = await fileToResizedDataUrl(file);
      setDraft((d) => ({ ...d, imageUrl: dataUrl }));
      toast.success(`이미지 로드 (${Math.round(dataUrl.length / 1024)}KB)`);
    } catch (e: any) {
      toast.error(e?.message || '이미지 변환 실패');
    } finally {
      setProcessing(false);
    }
  };

  const onPickRowFile = async (id: string, file: File) => {
    try {
      const dataUrl = await fileToResizedDataUrl(file);
      updateField(id, { imageUrl: dataUrl });
      toast.success(`이미지 교체 (${Math.round(dataUrl.length / 1024)}KB) — "저장" 버튼 눌러 반영`);
    } catch (e: any) {
      toast.error(e?.message || '이미지 변환 실패');
    }
  };

  const fetchList = async () => {
    setLoading(true);
    try {
      const data = await adminFetch('GET', '/api/v1/admin/banners');
      setItems(Array.isArray(data) ? data : []);
    } catch (e: any) {
      toast.error(`로드 실패: ${e?.response?.data?.message || e?.message || ''}`);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => { fetchList(); }, []);

  const updateField = (id: string, patch: Partial<Banner>) => {
    setItems((prev) => prev.map((it) => (it.id === id ? { ...it, ...patch } : it)));
  };

  const saveItem = async (item: Banner) => {
    setSavingId(item.id);
    try {
      await adminFetch('PATCH', `/api/v1/admin/banners/${item.id}`, {
        title: item.title,
        subtitle: item.subtitle,
        imageUrl: item.imageUrl,
        linkUrl: item.linkUrl,
        bgColor: item.bgColor,
        sortOrder: item.sortOrder,
        isActive: item.isActive,
      });
      toast.success('저장됨');
    } catch (e: any) {
      toast.error(`저장 실패: ${e?.response?.data?.message || e?.message || ''}`);
    } finally {
      setSavingId(null);
    }
  };

  const deleteItem = async (item: Banner) => {
    if (!confirm(`"${item.title || item.imageUrl.slice(-30)}" 배너를 삭제하시겠습니까?`)) return;
    try {
      await adminFetch('DELETE', `/api/v1/admin/banners/${item.id}`);
      toast.success('삭제됨');
      fetchList();
    } catch (e: any) {
      toast.error(`삭제 실패: ${e?.response?.data?.message || e?.message || ''}`);
    }
  };

  const create = async () => {
    if (!draft.imageUrl.trim()) { toast.error('이미지 URL은 필수'); return; }
    setCreating(true);
    try {
      await adminFetch('POST', '/api/v1/admin/banners', {
        title: draft.title,
        subtitle: draft.subtitle,
        imageUrl: draft.imageUrl,
        linkUrl: draft.linkUrl || null,
        bgColor: draft.bgColor || null,
        sortOrder: Number(draft.sortOrder) || 0,
        isActive: draft.isActive,
      });
      toast.success('배너 등록됨');
      setDraft(emptyDraft);
      fetchList();
    } catch (e: any) {
      toast.error(`등록 실패: ${e?.response?.data?.message || e?.message || ''}`);
    } finally {
      setCreating(false);
    }
  };

  return (
    <div className="space-y-5">
      {/* 헤더 */}
      <div className="flex items-center justify-between px-1">
        <div>
          <h1 className="text-[22px] font-bold text-[#191F28] tracking-tight">배너 관리</h1>
          <p className="text-[13px] text-[#8B95A1] mt-0.5">홈 상단 슬라이드 배너 등록 · 순서 · 활성화</p>
        </div>
      </div>

      {/* 새 배너 등록 */}
      <div className="bg-white rounded-3xl p-6">
        <h2 className="text-[15px] font-bold text-[#191F28] mb-4">새 배너 등록</h2>
        <div className="grid grid-cols-1 md:grid-cols-[200px_1fr] gap-5">
          {/* 프리뷰 (클릭 시 파일 선택) */}
          <div>
            <input
              ref={fileInputRef}
              type="file"
              accept="image/*"
              className="hidden"
              onChange={(e) => {
                const f = e.target.files?.[0];
                if (f) onPickDraftFile(f);
                if (e.target) e.target.value = '';
              }}
            />
            <button
              type="button"
              onClick={() => fileInputRef.current?.click()}
              disabled={processing}
              className="group relative aspect-[1170/300] w-full rounded-2xl bg-[#F2F4F6] overflow-hidden flex items-center justify-center disabled:opacity-50"
              style={draft.bgColor ? { backgroundColor: draft.bgColor } : undefined}
            >
              {draft.imageUrl ? (
                <>
                  <img
                    src={draft.imageUrl}
                    alt="미리보기"
                    className="w-full h-full object-cover"
                    onError={(e) => { (e.target as HTMLImageElement).style.display = 'none'; }}
                  />
                  <div className="absolute inset-0 bg-black/0 group-hover:bg-black/40 transition-colors flex items-center justify-center opacity-0 group-hover:opacity-100">
                    <span className="text-white text-[12px] font-semibold flex items-center gap-1.5">
                      <Upload size={14} /> 파일 교체
                    </span>
                  </div>
                </>
              ) : (
                <div className="flex flex-col items-center gap-1.5 text-[#8B95A1]">
                  <Upload size={22} />
                  <span className="text-[12px] font-semibold">{processing ? '변환 중...' : '클릭해서 파일 선택'}</span>
                  <span className="text-[10px] text-[#B0B8C1]">또는 아래에 URL 입력</span>
                </div>
              )}
            </button>
            <p className="mt-2 text-[11px] text-[#8B95A1] text-center">비율 1170 × 300 권장 · 최대 8MB</p>
          </div>

          {/* 폼 */}
          <div className="space-y-3">
            <div>
              <label className="block text-[12px] font-medium text-[#8B95A1] mb-1.5">
                이미지 URL * <span className="text-[#B0B8C1] font-normal">(파일 선택 또는 직접 입력)</span>
              </label>
              <div className="flex gap-2">
                <input
                  type="text"
                  value={draft.imageUrl.startsWith('data:') ? `[업로드된 파일 · ${Math.round(draft.imageUrl.length / 1024)}KB]` : draft.imageUrl}
                  onChange={(e) => setDraft({ ...draft, imageUrl: e.target.value })}
                  readOnly={draft.imageUrl.startsWith('data:')}
                  placeholder="/images/banner-1.png 또는 https://..."
                  className="flex-1 bg-[#F9FAFB] rounded-xl px-4 py-3 text-[14px] text-[#191F28] focus:outline-none focus:bg-white focus:ring-2 focus:ring-[#3182F6]"
                />
                <button
                  type="button"
                  onClick={() => fileInputRef.current?.click()}
                  disabled={processing}
                  className="flex items-center gap-1.5 px-4 py-3 rounded-xl bg-[#E8F3FF] text-[#3182F6] text-[13px] font-semibold hover:bg-[#D6E9FF] disabled:opacity-50 whitespace-nowrap"
                >
                  <Upload size={14} /> {processing ? '처리 중' : '파일'}
                </button>
                {draft.imageUrl && (
                  <button
                    type="button"
                    onClick={() => setDraft({ ...draft, imageUrl: '' })}
                    className="px-3 py-3 rounded-xl bg-[#F2F4F6] text-[#8B95A1] text-[13px] font-semibold hover:bg-[#E5E8EB]"
                  >
                    비우기
                  </button>
                )}
              </div>
            </div>
            <div className="grid grid-cols-2 gap-3">
              <div>
                <label className="block text-[12px] font-medium text-[#8B95A1] mb-1.5">제목</label>
                <input
                  type="text"
                  value={draft.title}
                  onChange={(e) => setDraft({ ...draft, title: e.target.value })}
                  className="w-full bg-[#F9FAFB] rounded-xl px-4 py-3 text-[14px] text-[#191F28] focus:outline-none focus:bg-white focus:ring-2 focus:ring-[#3182F6]"
                />
              </div>
              <div>
                <label className="block text-[12px] font-medium text-[#8B95A1] mb-1.5">서브타이틀</label>
                <input
                  type="text"
                  value={draft.subtitle}
                  onChange={(e) => setDraft({ ...draft, subtitle: e.target.value })}
                  className="w-full bg-[#F9FAFB] rounded-xl px-4 py-3 text-[14px] text-[#191F28] focus:outline-none focus:bg-white focus:ring-2 focus:ring-[#3182F6]"
                />
              </div>
            </div>
            <div className="grid grid-cols-2 gap-3">
              <div>
                <label className="block text-[12px] font-medium text-[#8B95A1] mb-1.5">클릭 시 이동 URL</label>
                <input
                  type="text"
                  value={draft.linkUrl}
                  onChange={(e) => setDraft({ ...draft, linkUrl: e.target.value })}
                  placeholder="/pros 또는 https://..."
                  className="w-full bg-[#F9FAFB] rounded-xl px-4 py-3 text-[14px] text-[#191F28] focus:outline-none focus:bg-white focus:ring-2 focus:ring-[#3182F6]"
                />
              </div>
              <div>
                <label className="block text-[12px] font-medium text-[#8B95A1] mb-1.5">배경색 (선택)</label>
                <input
                  type="text"
                  value={draft.bgColor}
                  onChange={(e) => setDraft({ ...draft, bgColor: e.target.value })}
                  placeholder="#F4F7FF"
                  className="w-full bg-[#F9FAFB] rounded-xl px-4 py-3 text-[14px] text-[#191F28] focus:outline-none focus:bg-white focus:ring-2 focus:ring-[#3182F6]"
                />
              </div>
            </div>
            <div className="flex items-center gap-3">
              <div className="flex-1">
                <label className="block text-[12px] font-medium text-[#8B95A1] mb-1.5">노출 순서</label>
                <input
                  type="number"
                  value={draft.sortOrder}
                  onChange={(e) => setDraft({ ...draft, sortOrder: Number(e.target.value) })}
                  className="w-full bg-[#F9FAFB] rounded-xl px-4 py-3 text-[14px] text-[#191F28] focus:outline-none focus:bg-white focus:ring-2 focus:ring-[#3182F6]"
                />
              </div>
              <div className="flex items-end pb-[2px]">
                <label className="flex items-center gap-2 bg-[#F9FAFB] rounded-xl px-4 py-3 cursor-pointer hover:bg-[#F2F4F6]">
                  <input
                    type="checkbox"
                    checked={draft.isActive}
                    onChange={(e) => setDraft({ ...draft, isActive: e.target.checked })}
                    className="w-4 h-4"
                  />
                  <span className="text-[13px] font-semibold text-[#191F28]">활성</span>
                </label>
              </div>
              <button
                onClick={create}
                disabled={creating || !draft.imageUrl.trim()}
                className="self-end flex items-center gap-1.5 px-4 py-3 rounded-xl bg-[#3182F6] text-white text-[14px] font-semibold hover:bg-[#1B64DA] disabled:opacity-50"
              >
                <Plus size={16} /> {creating ? '등록 중...' : '등록'}
              </button>
            </div>
          </div>
        </div>
      </div>

      {/* 목록 */}
      <div className="bg-white rounded-3xl overflow-hidden">
        <div className="px-5 pt-5 pb-2">
          <h2 className="text-[15px] font-bold text-[#191F28]">
            배너 목록 <span className="text-[13px] font-medium text-[#8B95A1] ml-1">({items.length})</span>
          </h2>
        </div>
        {loading ? (
          <div className="px-5 py-10 text-center text-[13px] text-[#8B95A1]">로딩 중...</div>
        ) : items.length === 0 ? (
          <div className="px-5 py-10 text-center text-[13px] text-[#8B95A1]">등록된 배너가 없습니다</div>
        ) : (
          <div className="divide-y divide-[#F2F4F6]">
            {items.map((item) => (
              <div key={item.id} className="px-5 py-4">
                <div className="grid grid-cols-1 md:grid-cols-[160px_1fr_auto] gap-4 items-start">
                  {/* 썸네일 */}
                  <div className="aspect-[1170/300] rounded-xl bg-[#F2F4F6] overflow-hidden flex items-center justify-center" style={item.bgColor ? { backgroundColor: item.bgColor } : undefined}>
                    {item.imageUrl ? (
                      <img src={item.imageUrl} alt={item.title} className="w-full h-full object-cover" />
                    ) : (
                      <ImageOff size={20} className="text-[#B0B8C1]" />
                    )}
                  </div>
                  {/* 필드 */}
                  <div className="space-y-2">
                    <div className="grid grid-cols-2 gap-2">
                      <input
                        type="text"
                        value={item.title}
                        onChange={(e) => updateField(item.id, { title: e.target.value })}
                        placeholder="제목"
                        className="bg-[#F9FAFB] rounded-lg px-3 py-2 text-[13px] focus:outline-none focus:ring-1 focus:ring-[#3182F6]"
                      />
                      <input
                        type="text"
                        value={item.subtitle}
                        onChange={(e) => updateField(item.id, { subtitle: e.target.value })}
                        placeholder="서브타이틀"
                        className="bg-[#F9FAFB] rounded-lg px-3 py-2 text-[13px] focus:outline-none focus:ring-1 focus:ring-[#3182F6]"
                      />
                    </div>
                    <div className="flex gap-2">
                      <input
                        ref={(el) => { rowFileInputRefs.current[item.id] = el; }}
                        type="file"
                        accept="image/*"
                        className="hidden"
                        onChange={(e) => {
                          const f = e.target.files?.[0];
                          if (f) onPickRowFile(item.id, f);
                          if (e.target) e.target.value = '';
                        }}
                      />
                      <input
                        type="text"
                        value={item.imageUrl.startsWith('data:') ? `[업로드된 파일 · ${Math.round(item.imageUrl.length / 1024)}KB]` : item.imageUrl}
                        onChange={(e) => updateField(item.id, { imageUrl: e.target.value })}
                        readOnly={item.imageUrl.startsWith('data:')}
                        placeholder="이미지 URL"
                        className="flex-1 bg-[#F9FAFB] rounded-lg px-3 py-2 text-[13px] focus:outline-none focus:ring-1 focus:ring-[#3182F6]"
                      />
                      <button
                        type="button"
                        onClick={() => rowFileInputRefs.current[item.id]?.click()}
                        className="flex items-center gap-1 px-3 py-2 rounded-lg bg-[#E8F3FF] text-[#3182F6] text-[12px] font-semibold hover:bg-[#D6E9FF] whitespace-nowrap"
                      >
                        <Upload size={12} /> 파일
                      </button>
                    </div>
                    <div className="grid grid-cols-[1fr_1fr_90px_90px] gap-2">
                      <input
                        type="text"
                        value={item.linkUrl || ''}
                        onChange={(e) => updateField(item.id, { linkUrl: e.target.value })}
                        placeholder="이동 URL"
                        className="bg-[#F9FAFB] rounded-lg px-3 py-2 text-[13px] focus:outline-none focus:ring-1 focus:ring-[#3182F6]"
                      />
                      <input
                        type="text"
                        value={item.bgColor || ''}
                        onChange={(e) => updateField(item.id, { bgColor: e.target.value })}
                        placeholder="배경색"
                        className="bg-[#F9FAFB] rounded-lg px-3 py-2 text-[13px] focus:outline-none focus:ring-1 focus:ring-[#3182F6]"
                      />
                      <input
                        type="number"
                        value={item.sortOrder}
                        onChange={(e) => updateField(item.id, { sortOrder: Number(e.target.value) })}
                        placeholder="순서"
                        className="bg-[#F9FAFB] rounded-lg px-3 py-2 text-[13px] focus:outline-none focus:ring-1 focus:ring-[#3182F6]"
                      />
                      <button
                        onClick={() => updateField(item.id, { isActive: !item.isActive })}
                        className={`flex items-center justify-center gap-1 rounded-lg px-3 py-2 text-[13px] font-semibold transition-colors ${
                          item.isActive
                            ? 'bg-[#E8F3FF] text-[#3182F6] hover:bg-[#D6E9FF]'
                            : 'bg-[#F2F4F6] text-[#8B95A1] hover:bg-[#E5E8EB]'
                        }`}
                      >
                        {item.isActive ? <><Eye size={13} /> 노출</> : <><EyeOff size={13} /> 숨김</>}
                      </button>
                    </div>
                  </div>
                  {/* 액션 */}
                  <div className="flex md:flex-col gap-2 md:w-24">
                    <button
                      onClick={() => saveItem(item)}
                      disabled={savingId === item.id}
                      className="flex-1 md:flex-none flex items-center justify-center gap-1 rounded-lg bg-[#3182F6] text-white text-[13px] font-semibold px-3 py-2 hover:bg-[#1B64DA] disabled:opacity-50"
                    >
                      <Save size={13} /> {savingId === item.id ? '저장 중' : '저장'}
                    </button>
                    <button
                      onClick={() => deleteItem(item)}
                      className="flex-1 md:flex-none flex items-center justify-center gap-1 rounded-lg bg-[#FFECEC] text-[#F04452] text-[13px] font-semibold px-3 py-2 hover:bg-[#FFDDDD]"
                    >
                      <Trash2 size={13} /> 삭제
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
