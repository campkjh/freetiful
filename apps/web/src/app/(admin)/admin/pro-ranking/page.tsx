'use client';

import { useEffect, useLayoutEffect, useRef, useState } from 'react';
import { GripVertical, ChevronUp, ChevronDown } from '@/app/(admin)/admin/_components/admin-icons';
import toast from 'react-hot-toast';
import { adminFetch } from '../_components/adminFetch';
import { useAdminRefresh } from '../_components/adminRefresh';
import { adminConfirm } from '../_components/adminDialog';

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

  /* 순서 바뀔 때 카드가 새 자리로 스르르(FLIP) — 바꾸기 전 위치를 재 두고, 그린 뒤 차이만큼 되돌렸다가 0 으로 */
  const rowRefs = useRef(new Map<string, HTMLLIElement>());
  const before = useRef<Map<string, number> | null>(null);
  useLayoutEffect(() => {
    const prev = before.current;
    if (!prev) return;
    before.current = null;
    rowRefs.current.forEach((el, id) => {
      const top = prev.get(id);
      if (top == null) return;
      const dy = top - el.getBoundingClientRect().top;
      if (!dy) return;
      el.style.transition = 'none';
      el.style.transform = `translateY(${dy}px)`;
      requestAnimationFrame(() => {
        el.style.transition = 'transform .38s cubic-bezier(.22,.61,.36,1)';
        el.style.transform = '';
      });
    });
  }, [list]);

  const move = (from: number, to: number) => {
    if (to < 0 || to >= list.length || from === to) return;
    before.current = new Map(Array.from(rowRefs.current, ([id, el]) => [id, el.getBoundingClientRect().top]));
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

  // 머리 오른쪽 새로고침(종 옆) — 저장 안 한 순서가 있으면 묻고
  useAdminRefresh(async () => { if (!dirty || (await adminConfirm('저장하지 않은 순서가 있어요. 새로 불러올까요?'))) load(); });

  return (
    <div className="mx-auto max-w-[760px]">
      {/* 저장 막대 — 위에 붙어 따라온다. 제목은 레이아웃 머리(회원 관리 · 사회자 랭킹 탭) */}
      <div className="adm-rank-bar">
        <div className="min-w-0">
          <p className="adm-rank-bar-title">
            {loading ? '불러오는 중' : `${list.length}명`}
            {dirty && <span className="adm-badge orange ml-2">바뀜 · 아직 저장 안 함</span>}
          </p>
          <p className="adm-rank-bar-sub">≡ 를 끌거나 ▲▼ 로 순서를 바꾸고 저장하세요. 사회자 목록(추천·평점 정렬)에 이 순서가 반영돼요.</p>
        </div>
        <button type="button" onClick={save} disabled={!dirty || saving} className="adm-btn primary">
          {saving ? '저장 중…' : '순서 저장'}
        </button>
      </div>

      {loading ? (
        <div className="space-y-2">{Array.from({ length: 6 }).map((_, i) => <div key={i} className="adm-skel h-[68px]" />)}</div>
      ) : (
        <ul className="adm-rise space-y-2">
          {list.map((p, i) => (
            <li
              key={p.proProfileId}
              ref={(el) => { if (el) rowRefs.current.set(p.proProfileId, el); else rowRefs.current.delete(p.proProfileId); }}
              draggable
              onDragStart={() => { dragIdx.current = i; }}
              onDragOver={(e) => { e.preventDefault(); setOverIdx(i); }}
              onDragEnd={() => { if (dragIdx.current != null && overIdx != null) move(dragIdx.current, overIdx); dragIdx.current = null; setOverIdx(null); }}
              onDrop={(e) => { e.preventDefault(); if (dragIdx.current != null) move(dragIdx.current, i); dragIdx.current = null; setOverIdx(null); }}
              className={`adm-rank-row ${overIdx === i ? 'over' : ''}`}
            >
              <GripVertical className="h-5 w-5 shrink-0 cursor-grab opacity-40 active:cursor-grabbing" />
              <span className={`adm-rank-n ${i < 3 ? 'top' : ''}`}>{i + 1}</span>
              {p.image ? (
                // eslint-disable-next-line @next/next/no-img-element
                <img src={p.image} alt="" className="adm-ava" />
              ) : (
                <div className="adm-ava" />
              )}
              <div className="min-w-0 flex-1">
                <p className="adm-cell-main">{p.name}{p.isFeatured && <span className="adm-badge blue ml-2 align-middle">추천</span>}</p>
                <p className="adm-cell-sub">★ {p.rating.toFixed(1)} · 리뷰 {p.reviewCount}</p>
              </div>
              <div className="flex shrink-0 gap-1">
                <button type="button" onClick={() => move(i, i - 1)} disabled={i === 0} className="adm-btn icon sm" aria-label={`${p.name} 위로`}><ChevronUp className="h-4 w-4" /></button>
                <button type="button" onClick={() => move(i, i + 1)} disabled={i === list.length - 1} className="adm-btn icon sm" aria-label={`${p.name} 아래로`}><ChevronDown className="h-4 w-4" /></button>
              </div>
            </li>
          ))}
        </ul>
      )}
    </div>
  );
}
