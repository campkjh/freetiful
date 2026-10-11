'use client';

/* ─────────────────────────────────────────────────────────────
 * 웨딩런 기록 확인(261011 검증 E5 — 자동 보류된 판을 운영자가 확인할 화면이 없었다)
 *  · 서버 API 는 이미 있음: GET /game/wedding-run/admin/scores?hidden=auto|1|0&sort=recent|top|long · POST …/scores/:id/hide · POST …/scores/:id/player
 *  · 보류 = 대조는 통과했지만 사람이 내기 어려운 판(완주 3번 이상·수집이 거리 상한의 0.62~0.50배 넘음(길수록 낮게)·12분 넘게 무사고·초당 점수 이론 상한 위)
 *    → '반영'(숨김 해제 = 순위 요약 다시 계산) / '보류 유지' / '플레이어 숨김'. 바꾼 내용은 서버가 감사 기록(admin_audit_logs)에 남김.
 *  · 메뉴 '분석 · 콘텐츠 › 웨딩런 기록'(자동 보류 건수 뱃지) — layout.tsx.
 * ──────────────────────────────────────────────────────────── */

import { useCallback, useEffect, useState } from 'react';
import toast from 'react-hot-toast';
import { adminFetch } from '../_components/adminFetch';
import { adminConfirm } from '../_components/adminDialog';

type Row = {
  id: string;
  nickname: string;
  playerNickname: string | null;
  score: number;
  stage: number;
  segment: number;
  arrived: boolean;
  laps: number;
  durationMs: number;
  hearts: number;
  envelopes: number;
  scorePerSec: number;
  createdAt: string;
  hiddenAt: string | null;
  hiddenReason: string | null;
  playerHiddenAt: string | null;
};

type Tab = { key: string; label: string; q: string };
const TABS: Tab[] = [
  { key: 'auto', label: '자동 보류', q: 'hidden=auto&sort=recent' },
  { key: 'hidden', label: '숨김 전체', q: 'hidden=1&sort=recent' },
  { key: 'top', label: '높은 점수', q: 'hidden=0&sort=top' },
  { key: 'recent', label: '최근', q: 'sort=recent' },
];

const SEG_NAMES = ['서울', '종로', '경복궁', '상견례', '드레스 매장', '가전 매장', '웨딩플래너 상담', '빈 웨딩홀', '하객 웨딩홀', '비행기', '발리', '신혼집'];
const REASON: Record<string, string> = {
  'auto:many-laps': '완주 3번 이상',
  'auto:long-run': '12분 넘게 무사고',
  'auto:high-collect': '수집이 거리 상한의 0.62~0.50배 넘음',
  'auto:high-rate': '초당 점수가 이론 상한 위',
};

const fmt = (n: number) => n.toLocaleString('ko-KR');
const dur = (ms: number) => {
  const s = Math.round(ms / 1000);
  return `${Math.floor(s / 60)}분 ${String(s % 60).padStart(2, '0')}초`;
};
const when = (iso: string) => {
  const d = new Date(iso);
  return `${d.getMonth() + 1}/${d.getDate()} ${String(d.getHours()).padStart(2, '0')}:${String(d.getMinutes()).padStart(2, '0')}`;
};
const BASE = '/api/v1/game/wedding-run/admin/scores';

export default function WeddingRunAdminPage() {
  const [tab, setTab] = useState<Tab>(TABS[0]);
  const [rows, setRows] = useState<Row[]>([]);
  const [total, setTotal] = useState(0);
  const [page, setPage] = useState(1);
  const [loading, setLoading] = useState(true);
  const [busy, setBusy] = useState<string | null>(null);

  const load = useCallback(async (t: Tab, p: number) => {
    setLoading(true);
    try {
      const d = await adminFetch('GET', `${BASE}?${t.q}&limit=50&page=${p}`, undefined, { cache: false });
      setRows(Array.isArray(d?.data) ? d.data : []);
      setTotal(Number(d?.total) || 0);
    } catch {
      toast.error('불러오기 실패');
      setRows([]);
      setTotal(0);
    } finally {
      setLoading(false);
    }
  }, []);
  useEffect(() => {
    load(tab, page);
  }, [tab, page, load]);

  const act = async (r: Row, kind: 'publish' | 'keep' | 'player') => {
    const msg =
      kind === 'publish'
        ? `이 판을 순위에 반영할까요?\n${r.playerNickname || r.nickname} · ${fmt(r.score)}점 — 숨김을 풀고 순위 요약을 다시 계산해요`
        : kind === 'keep'
          ? `보류를 유지할까요?\n순위엔 계속 안 보이고, 이유를 '운영 확인: 보류 유지'로 남겨요`
          : `이 플레이어를 숨길까요?\n그 사람의 모든 기록이 순위에서 빠져요`;
    if (!(await adminConfirm(msg))) return;
    setBusy(r.id);
    try {
      if (kind === 'publish') await adminFetch('POST', `${BASE}/${r.id}/hide`, { hidden: false, reason: '운영 확인: 반영' });
      else if (kind === 'keep') await adminFetch('POST', `${BASE}/${r.id}/hide`, { hidden: true, reason: '운영 확인: 보류 유지' });
      else await adminFetch('POST', `${BASE}/${r.id}/player`, { hidden: true, reason: '운영 확인: 웨딩런 기록 이상' });
      toast.success(kind === 'publish' ? '순위에 반영했어요' : kind === 'keep' ? '보류를 유지했어요' : '플레이어를 숨겼어요');
      load(tab, page);
    } catch (e: any) {
      toast.error(e?.response?.data?.message || e?.message || '처리하지 못했어요');
    } finally {
      setBusy(null);
    }
  };

  const pages = Math.max(1, Math.ceil(total / 50));
  return (
    <div className="space-y-5">
      <div className="adm-card">
        <div className="adm-card-head">
          <div>
            <h2 className="adm-card-title">웨딩런 기록 확인</h2>
            <p className="adm-card-sub">자동 보류된 판(완주 3번 이상·수집 과다·12분 초과)을 보고 순위에 반영하거나 보류를 유지해요</p>
          </div>
        </div>
        <div className="adm-toolbar" role="tablist" aria-label="기록 목록">
          {TABS.map((t) => (
            <button
              key={t.key}
              type="button"
              role="tab"
              aria-selected={tab.key === t.key}
              className={`adm-btn ${tab.key === t.key ? 'primary' : 'weak'}`}
              onClick={() => {
                setTab(t);
                setPage(1);
              }}
            >
              {t.label}
            </button>
          ))}
          <span className="grow" />
          <span className="adm-count">
            총 <b>{fmt(total)}</b>건
          </span>
        </div>
        {loading ? (
          <p className="adm-empty">불러오는 중…</p>
        ) : rows.length === 0 ? (
          <p className="adm-empty">{tab.key === 'auto' ? '확인할 보류 판이 없어요' : '기록이 없어요'}</p>
        ) : (
          <div className="overflow-x-auto">
            <table className="w-full text-[13px]" style={{ borderCollapse: 'separate', borderSpacing: 0 }}>
              <thead>
                <tr className="text-left text-gray-500">
                  {['시각', '닉네임', '점수', '진행', '달린 시간', '초당', '하트·봉투', '상태', ''].map((h) => (
                    <th key={h} className="whitespace-nowrap px-3 py-2 font-semibold">
                      {h}
                    </th>
                  ))}
                </tr>
              </thead>
              <tbody>
                {rows.map((r) => {
                  const held = !!r.hiddenAt && (r.hiddenReason || '').startsWith('auto:');
                  return (
                    <tr key={r.id} className="border-t border-gray-100 align-top">
                      <td className="whitespace-nowrap px-3 py-2 text-gray-500">{when(r.createdAt)}</td>
                      <td className="px-3 py-2">
                        <b>{r.playerNickname || r.nickname}</b>
                        {r.playerHiddenAt && <span className="ml-1 text-[11px] text-red-500">플레이어 숨김</span>}
                      </td>
                      <td className="whitespace-nowrap px-3 py-2 font-bold">{fmt(r.score)}</td>
                      <td className="whitespace-nowrap px-3 py-2">
                        {r.laps > 0 ? `완주 ${r.laps} · ` : ''}
                        {SEG_NAMES[r.segment] ?? r.segment}
                      </td>
                      <td className="whitespace-nowrap px-3 py-2">{dur(r.durationMs)}</td>
                      <td className="whitespace-nowrap px-3 py-2">{r.scorePerSec}</td>
                      <td className="whitespace-nowrap px-3 py-2">
                        {fmt(r.hearts)} · {fmt(r.envelopes)}
                      </td>
                      <td className="px-3 py-2">
                        {r.hiddenAt ? (
                          <span className={held ? 'text-amber-600' : 'text-gray-500'}>{REASON[r.hiddenReason || ''] || (r.hiddenReason || '').replace(/^admin:/, '') || '숨김'}</span>
                        ) : (
                          <span className="text-emerald-600">순위 반영</span>
                        )}
                      </td>
                      <td className="whitespace-nowrap px-3 py-2">
                        <div className="flex gap-1.5">
                          {r.hiddenAt && (
                            <button type="button" className="adm-btn primary" disabled={busy === r.id} onClick={() => act(r, 'publish')}>
                              반영
                            </button>
                          )}
                          {held && (
                            <button type="button" className="adm-btn weak" disabled={busy === r.id} onClick={() => act(r, 'keep')}>
                              보류 유지
                            </button>
                          )}
                          {!r.playerHiddenAt && (
                            <button type="button" className="adm-btn weak" disabled={busy === r.id} onClick={() => act(r, 'player')}>
                              플레이어 숨김
                            </button>
                          )}
                        </div>
                      </td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>
        )}
        {pages > 1 && (
          <div className="adm-toolbar">
            <button type="button" className="adm-btn weak" disabled={page <= 1} onClick={() => setPage((p) => Math.max(1, p - 1))}>
              이전
            </button>
            <span className="adm-count">
              {page} / {pages}
            </span>
            <button type="button" className="adm-btn weak" disabled={page >= pages} onClick={() => setPage((p) => Math.min(pages, p + 1))}>
              다음
            </button>
          </div>
        )}
      </div>
    </div>
  );
}
