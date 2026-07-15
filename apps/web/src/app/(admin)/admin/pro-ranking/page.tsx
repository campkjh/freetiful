'use client';

import { useEffect, useRef, useState } from 'react';
import { GripVertical, ChevronUp, ChevronDown, Save, RefreshCw, Star, Trophy } from 'lucide-react';
import toast from 'react-hot-toast';
import { adminFetch } from '../_components/adminFetch';

interface Pro {
  proProfileId: string;
  name: string;
  rating: number;
  reviewCount: number;
  rankOrder: number | null;
  isFeatured: boolean;
  image: string | null;
}

export default function ProRankingPage() {
  const [list, setList] = useState<Pro[]>([]);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [dirty, setDirty] = useState(false);
  const dragIdx = useRef<number | null>(null);
  const [overIdx, setOverIdx] = useState<number | null>(null);

  const load = async () => {
    setLoading(true);
    try {
      const d = await adminFetch('GET', '/api/v1/admin/pro-ranking', undefined, { cache: false });
      setList(Array.isArray(d?.data) ? d.data : []);
      setDirty(false);
    } catch {
      toast.error('불러오기 실패');
    } finally {
      setLoading(false);
    }
  };
  useEffect(() => { load(); }, []);

  const move = (from: number, to: number) => {
    if (to < 0 || to >= list.length || from === to) return;
    setList((prev) => {
      const next = [...prev];
      const [item] = next.splice(from, 1);
      next.splice(to, 0, item);
      return next;
    });
    setDirty(true);
  };

  const save = async () => {
    setSaving(true);
    try {
      await adminFetch('PATCH', '/api/v1/admin/pro-ranking', { orderedIds: list.map((p) => p.proProfileId) });
      toast.success('랭킹이 저장되었습니다');
      setDirty(false);
    } catch {
      toast.error('저장 실패');
    } finally {
      setSaving(false);
    }
  };

  return (
    <div className="mx-auto max-w-[720px] px-4 py-6 md:px-6">
      <div className="mb-2 flex items-center justify-between gap-3">
        <div>
          <h1 className="flex items-center gap-2 text-[22px] font-bold text-gray-900"><Trophy className="h-6 w-6 text-[#3182F6]" /> 사회자 랭킹</h1>
          <p className="mt-1 text-[13px] text-gray-500">드래그(≡) 또는 ▲▼로 순서를 바꾸고 저장하세요. 사회자 목록(추천/평점 정렬)에 이 순서가 반영됩니다.</p>
        </div>
        <button onClick={load} disabled={loading} className="flex h-9 w-9 items-center justify-center rounded-full border border-gray-200 text-gray-500 hover:bg-gray-50">
          <RefreshCw className={`h-4 w-4 ${loading ? 'animate-spin' : ''}`} />
        </button>
      </div>

      <div className="sticky top-2 z-10 mb-4 flex items-center justify-between gap-2 rounded-xl border border-gray-100 bg-white/90 px-4 py-2.5 backdrop-blur">
        <span className="text-[13px] text-gray-500">{loading ? '…' : `${list.length}명`}{dirty && <span className="ml-2 font-bold text-amber-600">· 변경됨(미저장)</span>}</span>
        <button onClick={save} disabled={!dirty || saving}
          className={`flex items-center gap-1.5 rounded-full px-4 py-2 text-[13px] font-bold transition ${dirty && !saving ? 'bg-[#3182F6] text-white hover:brightness-95' : 'bg-gray-100 text-gray-400'}`}>
          <Save className="h-4 w-4" /> {saving ? '저장 중…' : '순서 저장'}
        </button>
      </div>

      {loading ? (
        <div className="py-16 text-center text-[14px] text-gray-400">불러오는 중…</div>
      ) : (
        <ul className="space-y-2">
          {list.map((p, i) => (
            <li
              key={p.proProfileId}
              draggable
              onDragStart={() => { dragIdx.current = i; }}
              onDragOver={(e) => { e.preventDefault(); setOverIdx(i); }}
              onDragEnd={() => { if (dragIdx.current != null && overIdx != null) move(dragIdx.current, overIdx); dragIdx.current = null; setOverIdx(null); }}
              onDrop={(e) => { e.preventDefault(); if (dragIdx.current != null) move(dragIdx.current, i); dragIdx.current = null; setOverIdx(null); }}
              className={`flex items-center gap-3 rounded-xl border bg-white px-3 py-2.5 transition ${overIdx === i ? 'border-[#3182F6] ring-2 ring-[#3182F6]/20' : 'border-gray-100'}`}
            >
              <GripVertical className="h-5 w-5 shrink-0 cursor-grab text-gray-300 active:cursor-grabbing" />
              <span className="w-7 shrink-0 text-center text-[15px] font-black tabular-nums text-[#3182F6]">{i + 1}</span>
              {p.image ? (
                // eslint-disable-next-line @next/next/no-img-element
                <img src={p.image} alt="" className="h-9 w-9 shrink-0 rounded-lg object-cover" />
              ) : (
                <div className="h-9 w-9 shrink-0 rounded-lg bg-gray-100" />
              )}
              <div className="min-w-0 flex-1">
                <p className="truncate text-[14px] font-bold text-gray-900">{p.name}{p.isFeatured && <span className="ml-1.5 rounded bg-[#EAF1FB] px-1.5 py-0.5 text-[10px] font-bold text-[#3182F6]">추천</span>}</p>
                <p className="flex items-center gap-1 text-[12px] text-gray-400"><Star className="h-3 w-3 fill-amber-400 text-amber-400" /> {p.rating.toFixed(1)} · 리뷰 {p.reviewCount}</p>
              </div>
              <div className="flex shrink-0 flex-col">
                <button onClick={() => move(i, i - 1)} disabled={i === 0} className="text-gray-300 hover:text-[#3182F6] disabled:opacity-30"><ChevronUp className="h-4 w-4" /></button>
                <button onClick={() => move(i, i + 1)} disabled={i === list.length - 1} className="text-gray-300 hover:text-[#3182F6] disabled:opacity-30"><ChevronDown className="h-4 w-4" /></button>
              </div>
            </li>
          ))}
        </ul>
      )}
    </div>
  );
}
