'use client';

/* 송년회 참여자(261108 사장 'campkjh@nate.com 어드민에서 누가 참여했는지 누가 설문조사에 응답했는지')
 *  · 한 줄 = 한 기기(로그인 없는 화면이라 기기가 곧 사람). 이름 = 자리 탭에서 넣은 것(없으면 설문 · 사진 이름).
 *  · 자리 = 손님 화면과 같은 seatFor(배정표가 비어 있으면 임시 자리라 '임시' 표시).
 *  · 손님 표(reception_guests)는 261108 배포부터 쌓인다 — 그 전에 이름만 넣고 아무것도 안 한 기기는 다시 들어와야 보인다. */
import { useMemo, useState } from 'react';
import { RollingNumber } from '../_components/AdminNumber';
import { AdminListCard, AdminTableScroll } from '../_components/AdminListCard';
import { AdminSearchField } from '../_components/AdminSearchField';
import { formatKstDateTime } from '../_components/adminEvent';
import { useReceptionOverview } from '../_components/receptionAdmin';
import { seatFor } from '@/lib/reception/event';

export default function ReceptionParticipantsPage() {
  const { data, loading, error } = useReceptionOverview();
  const [q, setQ] = useState('');
  const rows = useMemo(() => {
    const list = data?.participants || [];
    const k = q.replace(/\s+/g, '').toLowerCase();
    return k ? list.filter((p) => (p.name || '').replace(/\s+/g, '').toLowerCase().includes(k)) : list;
  }, [data, q]);
  const s = data?.summary;

  return (
    <div className="space-y-5">
      <div className="adm-grid grid-cols-2 lg:grid-cols-4">
        <div className="adm-stat">
          <p className="adm-stat-label">참여자</p>
          <p className="adm-stat-value"><RollingNumber value={s?.participants || 0} /><small>명</small></p>
          <p className="adm-stat-sub">이름 넣은 기기 {s?.named || 0}대</p>
        </div>
        <div className="adm-stat">
          <p className="adm-stat-label">베스트드레서 사진</p>
          <p className="adm-stat-value"><RollingNumber value={s?.photos || 0} /><small>장</small></p>
          <p className="adm-stat-sub">한 사람 1장</p>
        </div>
        <div className="adm-stat">
          <p className="adm-stat-label">좋아요 · 공감 누른 사람</p>
          <p className="adm-stat-value"><RollingNumber value={s?.voters || 0} /><small>명</small></p>
          <p className="adm-stat-sub">종류별 10개까지</p>
        </div>
        <div className="adm-stat">
          <p className="adm-stat-label">설문 응답</p>
          <p className="adm-stat-value" style={s?.surveys ? { color: 'var(--admin-blue)' } : undefined}><RollingNumber value={s?.surveys || 0} /><small>명</small></p>
          <p className="adm-stat-sub">{s?.avgRating != null ? `평균 만족도 ${s.avgRating}점` : '아직 없어요'}</p>
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
          <p className="adm-empty">{q ? '찾는 이름이 없어요' : '아직 참여한 사람이 없어요'}</p>
        ) : (
          <AdminTableScroll>
            <table className="adm-table">
              <thead>
                <tr>
                  <th>이름</th>
                  <th>자리</th>
                  <th>처음 · 마지막</th>
                  <th>베스트드레서 사진</th>
                  <th>누른 수</th>
                  <th>설문</th>
                </tr>
              </thead>
              <tbody>
                {rows.map((p) => {
                  const seat = p.name ? seatFor(p.name) : null;
                  return (
                    <tr key={p.deviceId}>
                      <td>
                        <b>{p.name || '이름 없음'}</b>
                        <span className="adm-cell-sub">기기 {p.deviceId.slice(0, 8)}</span>
                      </td>
                      <td>
                        {seat ? (
                          <>
                            {seat.table}번 테이블 {seat.seat}번
                            {!seat.assigned && <span className="adm-cell-sub">임시 자리</span>}
                          </>
                        ) : '—'}
                      </td>
                      <td className="adm-num">
                        {formatKstDateTime(p.firstAt)}
                        <span className="adm-cell-sub">{formatKstDateTime(p.lastAt)}</span>
                      </td>
                      <td>
                        {p.photo ? (
                          <a href={p.photo.imageUrl} target="_blank" rel="noreferrer" style={{ display: 'flex', alignItems: 'center', gap: 10 }}>
                            <img src={p.photo.thumbUrl} alt="" width={40} height={40} style={{ width: 40, height: 40, borderRadius: 8, objectFit: 'cover', flex: 'none' }} />
                            <span>
                              {p.photo.rank}위
                              <span className="adm-cell-sub adm-num">공감 {p.photo.empathies} · 좋아요 {p.photo.likes}</span>
                            </span>
                          </a>
                        ) : <span className="adm-cell-sub">안 올림</span>}
                      </td>
                      <td className="adm-num">
                        좋아요 {p.likesUsed}/10
                        <span className="adm-cell-sub">공감 {p.empathiesUsed}/10</span>
                      </td>
                      <td>
                        {p.surveyAt ? (
                          <>
                            <span className="adm-badge green">응답함</span>
                            <span className="adm-cell-sub adm-num">{formatKstDateTime(p.surveyAt)}</span>
                          </>
                        ) : <span className="adm-badge">미응답</span>}
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
