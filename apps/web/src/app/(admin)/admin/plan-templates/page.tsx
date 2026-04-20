'use client';

import { useState, useEffect } from 'react';
import { Plus, Trash2, Save, GripVertical, Eye, EyeOff, X } from 'lucide-react';
import toast from 'react-hot-toast';
import { adminFetch } from '../_components/adminFetch';

interface PlanTemplate {
  id: string;
  planKey: string;
  label: string;
  description: string | null;
  defaultPrice: number;
  includedItems: string[];
  displayOrder: number;
  isActive: boolean;
}

export default function AdminPlanTemplatesPage() {
  const [items, setItems] = useState<PlanTemplate[]>([]);
  const [loading, setLoading] = useState(true);
  const [savingId, setSavingId] = useState<string | null>(null);
  const [newKeyInput, setNewKeyInput] = useState('');
  const [creating, setCreating] = useState(false);

  const fetchList = async () => {
    setLoading(true);
    try {
      const data = await adminFetch('GET', '/api/v1/admin/plan-templates');
      setItems(Array.isArray(data) ? data : []);
    } catch (e: any) {
      toast.error(`로드 실패: ${e?.response?.data?.message || e?.message || ''}`);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => { fetchList(); }, []);

  const updateField = (id: string, patch: Partial<PlanTemplate>) => {
    setItems((prev) => prev.map((it) => (it.id === id ? { ...it, ...patch } : it)));
  };

  const saveItem = async (item: PlanTemplate) => {
    setSavingId(item.id);
    try {
      await adminFetch('PATCH', `/api/v1/admin/plan-templates/${item.id}`, {
        label: item.label,
        description: item.description,
        defaultPrice: item.defaultPrice,
        includedItems: item.includedItems,
        displayOrder: item.displayOrder,
        isActive: item.isActive,
        planKey: item.planKey,
      });
      // 프로 상세 페이지의 프론트 캐시도 무효화 + 플랜 템플릿 캐시 무효화
      try {
        const { invalidateProCache } = await import('@/lib/api/discovery.api');
        invalidateProCache();
        const { invalidatePlanTemplateCache } = await import('@/lib/api/plan-templates.api');
        invalidatePlanTemplateCache();
      } catch {}
      toast.success(`${item.label} 저장됨 — 모든 프로에 반영됐어요`);
    } catch (e: any) {
      toast.error(`저장 실패: ${e?.response?.data?.message || e?.message || ''}`);
    } finally {
      setSavingId(null);
    }
  };

  const removeItem = async (item: PlanTemplate) => {
    if (!confirm(`"${item.label}" 플랜을 삭제하시겠습니까? 이미 등록된 프로들의 서비스는 유지됩니다.`)) return;
    try {
      await adminFetch('DELETE', `/api/v1/admin/plan-templates/${item.id}`);
      toast.success('삭제됨');
      fetchList();
    } catch (e: any) {
      toast.error(`삭제 실패: ${e?.response?.data?.message || e?.message || ''}`);
    }
  };

  const createItem = async () => {
    const key = newKeyInput.trim().toLowerCase();
    if (!key) { toast.error('planKey를 입력하세요'); return; }
    if (!/^[a-z0-9_-]+$/.test(key)) { toast.error('planKey는 영문 소문자/숫자/하이픈/언더스코어만 허용됩니다'); return; }
    setCreating(true);
    try {
      await adminFetch('POST', '/api/v1/admin/plan-templates', {
        planKey: key,
        label: key.charAt(0).toUpperCase() + key.slice(1),
        defaultPrice: 0,
        includedItems: [],
        displayOrder: items.length,
        isActive: true,
      });
      setNewKeyInput('');
      toast.success('생성됨');
      fetchList();
    } catch (e: any) {
      toast.error(`생성 실패: ${e?.response?.data?.message || e?.message || ''}`);
    } finally {
      setCreating(false);
    }
  };

  const addIncludedItem = (id: string, value: string) => {
    if (!value.trim()) return;
    setItems((prev) => prev.map((it) => (it.id === id ? { ...it, includedItems: [...it.includedItems, value.trim()] } : it)));
  };
  const removeIncludedItem = (id: string, idx: number) => {
    setItems((prev) => prev.map((it) => (it.id === id ? { ...it, includedItems: it.includedItems.filter((_, i) => i !== idx) } : it)));
  };

  return (
    <div>
      <div className="flex items-center gap-3 mb-6">
        <h1 className="text-xl font-bold text-gray-900">서비스 플랜 템플릿</h1>
        <span className="ml-auto text-sm text-gray-400">{items.length}개</span>
      </div>

      <p className="text-sm text-gray-500 mb-6">
        이곳에서 설정한 플랜이 프로 등록 / 수정 페이지에 자동으로 반영됩니다. 플랜명·가격·포함 항목을 수정하면 새로 등록하는 프로들부터 적용됩니다.
      </p>

      {/* New plan */}
      <div className="bg-white rounded-xl border border-gray-200 p-4 mb-6">
        <label className="block text-xs font-bold text-gray-500 mb-2">새 플랜 추가 (planKey)</label>
        <div className="flex gap-2">
          <input
            type="text"
            value={newKeyInput}
            onChange={(e) => setNewKeyInput(e.target.value)}
            onKeyDown={(e) => { if (e.key === 'Enter') createItem(); }}
            placeholder="예: vip, basic, weekend ..."
            className="flex-1 h-10 border border-gray-200 rounded-lg px-3 text-sm focus:outline-none focus:ring-2 focus:ring-blue-200"
          />
          <button
            onClick={createItem}
            disabled={creating}
            className="px-4 h-10 rounded-lg bg-blue-500 text-white text-sm font-medium hover:bg-blue-600 disabled:opacity-50 flex items-center gap-1"
          >
            <Plus size={14} /> 추가
          </button>
        </div>
      </div>

      {loading ? (
        <div className="text-center text-gray-400 py-12">로딩 중...</div>
      ) : items.length === 0 ? (
        <div className="text-center text-gray-400 py-12">등록된 플랜이 없습니다</div>
      ) : (
        <div className="space-y-4">
          {items.map((item) => (
            <PlanCard
              key={item.id}
              item={item}
              onUpdate={updateField}
              onSave={saveItem}
              onRemove={removeItem}
              onAddItem={addIncludedItem}
              onRemoveItem={removeIncludedItem}
              saving={savingId === item.id}
            />
          ))}
        </div>
      )}
    </div>
  );
}

function PlanCard({
  item,
  onUpdate,
  onSave,
  onRemove,
  onAddItem,
  onRemoveItem,
  saving,
}: {
  item: PlanTemplate;
  onUpdate: (id: string, patch: Partial<PlanTemplate>) => void;
  onSave: (item: PlanTemplate) => void;
  onRemove: (item: PlanTemplate) => void;
  onAddItem: (id: string, value: string) => void;
  onRemoveItem: (id: string, idx: number) => void;
  saving: boolean;
}) {
  const [newItemInput, setNewItemInput] = useState('');

  return (
    <div className={`bg-white rounded-xl border p-5 ${item.isActive ? 'border-gray-200' : 'border-gray-100 opacity-60'}`}>
      <div className="flex items-start gap-3 mb-4">
        <GripVertical size={18} className="text-gray-300 mt-1 cursor-move" />
        <div className="flex-1 grid grid-cols-2 gap-3">
          <div>
            <label className="block text-[11px] font-bold text-gray-400 mb-1">planKey</label>
            <input
              type="text"
              value={item.planKey}
              onChange={(e) => onUpdate(item.id, { planKey: e.target.value })}
              className="w-full h-9 border border-gray-200 rounded-lg px-2.5 text-sm font-mono focus:outline-none focus:ring-2 focus:ring-blue-200"
            />
          </div>
          <div>
            <label className="block text-[11px] font-bold text-gray-400 mb-1">표시 이름</label>
            <input
              type="text"
              value={item.label}
              onChange={(e) => onUpdate(item.id, { label: e.target.value })}
              className="w-full h-9 border border-gray-200 rounded-lg px-2.5 text-sm font-bold focus:outline-none focus:ring-2 focus:ring-blue-200"
            />
          </div>
          <div>
            <label className="block text-[11px] font-bold text-gray-400 mb-1">기본 가격 (원)</label>
            <input
              type="number"
              value={item.defaultPrice}
              onChange={(e) => onUpdate(item.id, { defaultPrice: Number(e.target.value) })}
              className="w-full h-9 border border-gray-200 rounded-lg px-2.5 text-sm focus:outline-none focus:ring-2 focus:ring-blue-200"
            />
          </div>
          <div>
            <label className="block text-[11px] font-bold text-gray-400 mb-1">표시 순서</label>
            <input
              type="number"
              value={item.displayOrder}
              onChange={(e) => onUpdate(item.id, { displayOrder: Number(e.target.value) })}
              className="w-full h-9 border border-gray-200 rounded-lg px-2.5 text-sm focus:outline-none focus:ring-2 focus:ring-blue-200"
            />
          </div>
          <div className="col-span-2">
            <label className="block text-[11px] font-bold text-gray-400 mb-1">서브 설명</label>
            <input
              type="text"
              value={item.description ?? ''}
              onChange={(e) => onUpdate(item.id, { description: e.target.value })}
              placeholder="예: 행사 1시간 진행"
              className="w-full h-9 border border-gray-200 rounded-lg px-2.5 text-sm focus:outline-none focus:ring-2 focus:ring-blue-200"
            />
          </div>
        </div>
      </div>

      {/* Included items */}
      <div className="ml-7">
        <label className="block text-[11px] font-bold text-gray-400 mb-2">포함 항목 ({item.includedItems.length}개)</label>
        <div className="flex flex-wrap gap-1.5 mb-2">
          {item.includedItems.map((v, i) => (
            <span key={i} className="inline-flex items-center gap-1 px-2.5 py-1 bg-blue-50 text-blue-700 rounded-full text-xs font-medium">
              {v}
              <button onClick={() => onRemoveItem(item.id, i)} className="text-blue-400 hover:text-blue-700">
                <X size={12} />
              </button>
            </span>
          ))}
        </div>
        <div className="flex gap-2">
          <input
            type="text"
            value={newItemInput}
            onChange={(e) => setNewItemInput(e.target.value)}
            onKeyDown={(e) => {
              if (e.key === 'Enter') {
                onAddItem(item.id, newItemInput);
                setNewItemInput('');
              }
            }}
            placeholder="항목 추가 후 Enter (예: 사회 진행)"
            className="flex-1 h-9 border border-gray-200 rounded-lg px-2.5 text-sm focus:outline-none focus:ring-2 focus:ring-blue-200"
          />
          <button
            onClick={() => { onAddItem(item.id, newItemInput); setNewItemInput(''); }}
            className="px-3 h-9 rounded-lg bg-gray-100 text-gray-700 text-sm hover:bg-gray-200"
          >
            <Plus size={14} />
          </button>
        </div>
      </div>

      {/* Bottom actions */}
      <div className="mt-5 pt-4 border-t border-gray-100 flex items-center gap-2">
        <button
          onClick={() => onUpdate(item.id, { isActive: !item.isActive })}
          className={`flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-xs font-medium ${
            item.isActive ? 'bg-emerald-50 text-emerald-600' : 'bg-gray-100 text-gray-500'
          }`}
        >
          {item.isActive ? <Eye size={12} /> : <EyeOff size={12} />}
          {item.isActive ? '노출중' : '숨김'}
        </button>
        <div className="ml-auto flex items-center gap-2">
          <button
            onClick={() => onRemove(item)}
            className="flex items-center gap-1 px-3 py-1.5 rounded-lg bg-red-50 text-red-600 text-xs font-medium hover:bg-red-100"
          >
            <Trash2 size={12} /> 삭제
          </button>
          <button
            onClick={() => onSave(item)}
            disabled={saving}
            className="flex items-center gap-1 px-4 py-1.5 rounded-lg bg-blue-500 text-white text-xs font-medium hover:bg-blue-600 disabled:opacity-50"
          >
            <Save size={12} /> {saving ? '저장 중' : '저장'}
          </button>
        </div>
      </div>
    </div>
  );
}
