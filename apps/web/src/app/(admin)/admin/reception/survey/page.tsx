'use client';

/* 송년회 설문 응답(261108 사장 '누가 설문조사에 응답했는지') — 손님이 설문 탭에서 낸 답(기기당 1개, 고쳐 내면 덮어씀).
 *  · 요약 = 2차 회식 참여 · 응답 수 · 평균 만족도 · 내년 참석 · 가장 좋았던 순서 순위. 목록 = 최근에 낸(고친) 순.
 *  · (261122 사장 '설문조사에 첫번째가 2차 회식 참여 여부') 2차 답은 손님이 누르는 순간 손님 표에 저장된다 — 설문을 안 낸 사람도
 *    '2차 참여 명단'에 보인다(서버 overview.afterParty). 표의 '2차' 칸도 손님 표 값(설문을 낸 뒤 바꿨으면 지금 답). 옛 서버면 설문 답으로 센다. */
import { useMemo, useState } from 'react';
import { RollingNumber } from '../../_components/AdminNumber';
import { AdminListCard, AdminTableScroll } from '../../_components/AdminListCard';
import { AdminSearchField } from '../../_components/AdminSearchField';
import { formatKstDateTime } from '../../_components/adminEvent';
import { AGAIN_LABEL, AGAIN_TONE, useReceptionOverview, type ReceptionOverview } from '../../_components/receptionAdmin';

const stars = (n?: number) => (n && n >= 1 && n <= 5 ? '★'.repeat(n) + '☆'.repeat(5 - n) : '—');

/** 2차 회식에 답한 사람(설문 안 낸 사람 포함) — 서버 overview.afterParty(261122, 옛 서버는 없음) */
interface AfterPartyRow {
  deviceId: string;
  name: string | null;
  afterParty: 'yes' | 'no';
  afterPartyAt: string | null;
  surveyAt: string | null;
}
type OverviewWithAfterParty = ReceptionOverview & {
  summary: ReceptionOverview['summary'] & { afterParty?: { yes: number; no: number; noSurvey: number } };
  afterParty?: AfterPartyRow[];
};

const AFTER_PARTY_LABEL = { yes: '2차 참여', no: '불참' } as const;
const AFTER_PARTY_TONE = { yes: 'green', no: '' } as const;
type ApFilter = 'all' | 'yes' | 'no';
const AP_FILTERS: Array<{ value: ApFilter; label: string }> = [
  { value: 'all', label: '전체' },
  { value: 'yes', label: '2차 참여' },
  { value: 'no', label: '2차 불참' },
];

export default function ReceptionSurveyAdminPage() {
  const { data: raw, loading, error } = useReceptionOverview();
  const data = raw as OverviewWithAfterParty | null;
  const [q, setQ] = useState('');
  const [apFilter, setApFilter] = useState<ApFilter>('all');
  const rows = useMemo(() => {
    let list = data?.surveys || [];
    if (apFilter !== 'all') list = list.filter((r) => r.answers?.afterParty === apFilter);
    const k = q.replace(/\s+/g, '').toLowerCase();
    return k ? list.filter((r) => r.name.replace(/\s+/g, '').toLowerCase().includes(k)) : list;
  }, [data, q, apFilter]);
  const s = data?.summary;
  const top = s?.best.slice(0, 3) || [];
  // 2차 — 서버 요약(손님 표 기준)이 있으면 그것, 옛 서버면 설문 답으로
  const ap = useMemo(() => {
    if (s?.afterParty) return s.afterParty;
    const list = data?.surveys || [];
    return {
      yes: list.filter((r) => r.answers?.afterParty === 'yes').length,
      no: list.filter((r) => r.answers?.afterParty === 'no').length,
      noSurvey: 0,
    };
  }, [s, data]);
  const goers = useMemo(() => (data?.afterParty || []).filter((r) => r.afterParty === 'yes'), [data]);

  return (
    <div className="space-y-5">
      <div className="adm-grid grid-cols-2 lg:grid-cols-5">
        <div className="adm-stat">
          <p className="adm-stat-label">2차 회식 참여</p>
          <p className="adm-stat-value" style={{ color: 'var(--admin-green)' }}><RollingNumber value={ap.yes} /><small>명</small></p>
          <p className="adm-stat-sub">불참 {ap.no}{ap.noSurvey ? ` · 설문 전 ${ap.noSurvey}명 포함` : ''}</p>
        </div>
        <div className="adm-stat">
          <p className="adm-stat-label">응답</p>
          <p className="adm-stat-value"><RollingNumber value={s?.surveys || 0} /><small>명</small></p>
          <p className="adm-stat-sub">참여자 {s?.participants || 0}명 중</p>
        </div>
        <div className="adm-stat">
          <p className="adm-stat-label">평균 만족도</p>
          <p className="adm-stat-value">{s?.avgRating != null ? s.avgRating : '—'}<small>/ 5</small></p>
          <p className="adm-stat-sub">별점 1~5</p>
        </div>
        <div className="adm-stat">
          <p className="adm-stat-label">내년에도 꼭 올게요</p>
          <p className="adm-stat-value" style={{ color: 'var(--admin-green)' }}><RollingNumber value={s?.again.yes || 0} /><small>명</small></p>
          <p className="adm-stat-sub">아마도요 {s?.again.maybe || 0} · 잘 모르겠어요 {s?.again.no || 0}</p>
        </div>
        <div className="adm-stat">
          <p className="adm-stat-label">가장 좋았던 순서</p>
          <p className="adm-stat-value" style={{ fontSize: 20 }}>{top[0]?.title || '—'}</p>
          <p className="adm-stat-sub">{top.length ? top.map((b) => `${b.title} ${b.count}`).join(' · ') : '아직 없어요'}</p>
        </div>
      </div>

      {goers.length > 0 && (
        <div className="adm-card">
          <div className="adm-card-head">
            <div>
              <p className="adm-card-title">2차 참여 명단 <span style={{ color: 'var(--admin-green)' }}>{goers.length}명</span></p>
              <p className="adm-card-sub">설문 첫 질문에서 &lsquo;예&rsquo;를 고른 사람 — 설문을 아직 안 낸 사람도 포함 · 마지막으로 고른 순</p>
            </div>
          </div>
          <div className="adm-chips">
            {goers.map((r) => (
              <span key={r.deviceId} className="adm-badge green" title={r.afterPartyAt ? `고른 시각 ${formatKstDateTime(r.afterPartyAt)}${r.surveyAt ? '' : ' · 설문 전'}` : undefined}>
                {r.name || '이름 없음'}{r.surveyAt ? '' : ' · 설문 전'}
              </span>
            ))}
          </div>
        </div>
      )}

      <AdminListCard
        filter={
          <div className="adm-toolbar">
            <AdminSearchField className="grow" value={q} onChange={setQ} onSubmit={setQ} placeholder="이름 검색" />
            <div className="adm-chips">
              {AP_FILTERS.map((f) => (
                <button key={f.value} type="button" className={`adm-chip ${apFilter === f.value ? 'on' : ''}`} aria-pressed={apFilter === f.value} onClick={() => setApFilter(f.value)}>
                  {f.label}
                </button>
              ))}
            </div>
            <span className="adm-count">총 <b><RollingNumber value={rows.length} /></b>명</span>
          </div>
        }
      >
        {loading && !data ? (
          <p className="adm-empty">불러오는 중…</p>
        ) : error ? (
          <p className="adm-empty">{error}</p>
        ) : rows.length === 0 ? (
          <p className="adm-empty">{q ? '찾는 이름이 없어요' : apFilter !== 'all' ? '해당하는 응답이 없어요' : '아직 응답이 없어요'}</p>
        ) : (
          <AdminTableScroll>
            <table className="adm-table">
              <thead>
                <tr>
                  <th>이름</th>
                  <th>2차</th>
                  <th>만족도</th>
                  <th>가장 좋았던 순서</th>
                  <th>내년</th>
                  <th>하고 싶은 말</th>
                  <th>낸 시각</th>
                </tr>
              </thead>
              <tbody>
                {rows.map((r) => {
                  const a = r.answers || {};
                  return (
                    <tr key={r.deviceId}>
                      <td><b>{r.name}</b></td>
                      <td>{a.afterParty ? <span className={`adm-badge ${AFTER_PARTY_TONE[a.afterParty]}`}>{AFTER_PARTY_LABEL[a.afterParty]}</span> : <span className="adm-cell-sub">—</span>}</td>
                      <td style={{ color: '#F5A623', letterSpacing: 1, whiteSpace: 'nowrap' }} aria-label={a.rating ? `${a.rating}점` : '없음'}>{stars(a.rating)}</td>
                      <td>{a.best || <span className="adm-cell-sub">고르지 않음</span>}</td>
                      <td>{a.again ? <span className={`adm-badge ${AGAIN_TONE[a.again]}`}>{AGAIN_LABEL[a.again]}</span> : '—'}</td>
                      <td style={{ minWidth: 220, maxWidth: 420, whiteSpace: 'pre-wrap', wordBreak: 'break-word' }}>{a.comment || <span className="adm-cell-sub">—</span>}</td>
                      <td className="adm-num">
                        {formatKstDateTime(r.updatedAt)}
                        {r.updatedAt !== r.createdAt && <span className="adm-cell-sub">처음 {formatKstDateTime(r.createdAt)}</span>}
                      </td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </AdminTableScroll>
        )}
      </AdminListCard>
    </div>
  );
}
