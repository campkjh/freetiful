'use client';

/* 송년회 설문 응답(261108 사장 '누가 설문조사에 응답했는지') — 손님이 설문 탭에서 낸 답(기기당 1개, 고쳐 내면 덮어씀).
 *  · 요약 = 응답 수 · 평균 만족도 · 내년 참석 · 가장 좋았던 순서 순위. 목록 = 최근에 낸(고친) 순. */
import { useMemo, useState } from 'react';
import { RollingNumber } from '../../_components/AdminNumber';
import { AdminListCard, AdminTableScroll } from '../../_components/AdminListCard';
import { AdminSearchField } from '../../_components/AdminSearchField';
import { formatKstDateTime } from '../../_components/adminEvent';
import { AGAIN_LABEL, AGAIN_TONE, useReceptionOverview } from '../../_components/receptionAdmin';

const stars = (n?: number) => (n && n >= 1 && n <= 5 ? '★'.repeat(n) + '☆'.repeat(5 - n) : '—');

export default function ReceptionSurveyAdminPage() {
  const { data, loading, error } = useReceptionOverview();
  const [q, setQ] = useState('');
  const rows = useMemo(() => {
    const list = data?.surveys || [];
    const k = q.replace(/\s+/g, '').toLowerCase();
    return k ? list.filter((r) => r.name.replace(/\s+/g, '').toLowerCase().includes(k)) : list;
  }, [data, q]);
  const s = data?.summary;
  const top = s?.best.slice(0, 3) || [];

  return (
    <div className="space-y-5">
      <div className="adm-grid grid-cols-2 lg:grid-cols-4">
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

      <AdminListCard
        filter={
          <div className="adm-toolbar">
            <AdminSearchField className="grow" value={q} onChange={setQ} onSubmit={setQ} placeholder="이름 검색" />
            <span className="adm-count">총 <b><RollingNumber value={rows.length} /></b>명</span>
          </div>
        }
      >
        {loading && !data ? (
          <p className="adm-empty">불러오는 중…</p>
        ) : error ? (
          <p className="adm-empty">{error}</p>
        ) : rows.length === 0 ? (
          <p className="adm-empty">{q ? '찾는 이름이 없어요' : '아직 응답이 없어요'}</p>
        ) : (
          <AdminTableScroll>
            <table className="adm-table">
              <thead>
                <tr>
                  <th>이름</th>
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
