'use client';

/* 송년회 베스트드레서(261123 사장 '퀴즈에서 럭키드로우 · 베스트드레서로 화면전환하는거 추가해줘 옆에 햄버거로 이동할 수 있게').
 *  · 손님 사진 순위 = 공감 → 좋아요 → 먼저 올린 순(서버 reception.rules.ts compareRank, 피드의 rank 그대로).
 *  · 공개 피드 GET /reception/:ek/photos 를 5초마다 다시 읽는다(기기 머리글 없이 — 내 표 · 남은 수는 안 쓴다).
 *  · [크게 보기] = 프로젝터용 판 — 1 · 2 · 3등 사진 시상대 + 4~10등 줄. ☰ 로 퀴즈 · 럭키드로우와 오간다(?stage=1 이면 바로 연다). */
import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import toast from 'react-hot-toast';
import RankCrown from '@/components/reception/RankCrown';
import { HeartIcon, ThumbIcon } from '@/components/reception/ReceptionIcons';
import type { ReceptionPhoto } from '@/lib/reception/api';
import { RECEPTION_EVENT_KEY } from '@/lib/reception/event';
import { RollingNumber } from '../../_components/AdminNumber';
import { AdminListCard, AdminTableScroll } from '../../_components/AdminListCard';
import { formatKstDateTime } from '../../_components/adminEvent';
import { adminConfirm } from '../../_components/adminDialog';
import { adminErrorText, receptionAdminApi } from '../../_components/receptionAdmin';
import { ReceptionStage } from '../_parts/ReceptionStage';
import { useStageFromQuery } from '../_parts/StageNav';
import '../reception-admin.css';
import './dresser.css';

const FEED = `/api/v1/reception/${RECEPTION_EVENT_KEY}/photos`;
const POLL_MS = 5000;
/** 판에 보이는 순위(아래는 '외 N장') */
const STAGE_TOP = 10;

type RankedPhoto = Pick<ReceptionPhoto, 'id' | 'name' | 'imageUrl' | 'thumbUrl' | 'likes' | 'empathies' | 'createdAt' | 'rank'>;

const num = (v: unknown) => (typeof v === 'number' && Number.isFinite(v) && v >= 0 ? Math.floor(v) : 0);

/** 피드 → 순위 줄(모양이 어긋난 줄은 버린다) */
function toRanked(raw: unknown): RankedPhoto[] {
  const list = (raw as { photos?: unknown } | null)?.photos;
  if (!Array.isArray(list)) return [];
  return list
    .filter((p): p is RankedPhoto => !!p && typeof p === 'object' && typeof (p as RankedPhoto).id === 'string' && typeof (p as RankedPhoto).imageUrl === 'string')
    .map((p) => ({
      id: p.id,
      name: typeof p.name === 'string' && p.name.trim() ? p.name : '이름 없음',
      imageUrl: p.imageUrl,
      thumbUrl: typeof p.thumbUrl === 'string' && p.thumbUrl ? p.thumbUrl : p.imageUrl,
      likes: num(p.likes),
      empathies: num(p.empathies),
      createdAt: typeof p.createdAt === 'string' ? p.createdAt : '',
      rank: num(p.rank),
    }))
    .sort((a, b) => (a.rank || Infinity) - (b.rank || Infinity));
}

/** 5초마다 사진 순위 — 망이 끊겨도 마지막으로 받은 순위는 남긴다 */
function usePhotoRanking() {
  const [photos, setPhotos] = useState<RankedPhoto[] | null>(null);
  const [error, setError] = useState<string | null>(null);
  // 지운 사진 — 서버 피드 캐시(2.5초) · 늦게 온 응답에 다시 떠도 화면에선 뺀다
  const gone = useRef(new Set<string>());
  const seq = useRef(0);
  const load = useCallback(async () => {
    const mine = ++seq.current;
    try {
      const res = await fetch(FEED, { cache: 'no-store' });
      if (!res.ok) throw new Error(`HTTP ${res.status}`);
      const ranked = toRanked(await res.json());
      if (mine !== seq.current) return;
      setPhotos(ranked.filter((p) => !gone.current.has(p.id)));
      setError(null);
    } catch {
      if (mine === seq.current) setError('사진 순위를 불러오지 못했어요.');
    }
  }, []);
  useEffect(() => {
    void load();
    const t = window.setInterval(() => void load(), POLL_MS);
    return () => {
      seq.current++;
      window.clearInterval(t);
    };
  }, [load]);
  const drop = useCallback((id: string) => {
    gone.current.add(id);
    setPhotos((list) => (list ? list.filter((p) => p.id !== id) : list));
  }, []);
  return { photos, error, reload: load, drop };
}

/** 1 · 2 · 3등 표시 — 공감을 하나라도 받아야 왕관(손님 순위 목록과 같은 규칙) */
function RankMark({ p, size }: { p: RankedPhoto; size: number }) {
  if (p.rank >= 1 && p.rank <= 3 && p.empathies > 0) return <RankCrown rank={p.rank as 1 | 2 | 3} size={size} />;
  return <span className="rcb-rank-no">{p.rank}</span>;
}

function Score({ p }: { p: RankedPhoto }) {
  return (
    <span className="rcb-score">
      <span className="rcb-emp" aria-label={`공감 ${p.empathies}`}><HeartIcon size={18} />{p.empathies}</span>
      <span className="rcb-like" aria-label={`좋아요 ${p.likes}`}><ThumbIcon size={15} />{p.likes}</span>
    </span>
  );
}

function DresserStageBody({ photos }: { photos: RankedPhoto[] | null }) {
  const podium = (photos || []).slice(0, 3);
  const rest = (photos || []).slice(3, STAGE_TOP);
  const more = Math.max(0, (photos?.length || 0) - STAGE_TOP);
  return (
    <div className="rcb-stage">
      <p className="rcs-eyebrow">공감 순위 · 실시간</p>
      <h2 className="rcs-title">베스트드레서</h2>
      {!photos ? (
        <p className="rcb-stage-empty">순위를 불러오는 중…</p>
      ) : photos.length === 0 ? (
        <p className="rcb-stage-empty">사진이 올라오면 공감 순서대로 순위가 매겨져요.</p>
      ) : (
        <div className={`rcb-board${rest.length ? '' : ' solo'}`}>
          <ol className="rcb-podium" aria-label="1~3등">
            {podium.map((p) => (
              <li key={p.id} className={`rcb-pod rcb-pod-${p.rank}`}>
                <div className="rcb-pod-photo">
                  <img src={p.imageUrl} alt={`${p.rank}등 ${p.name}`} />
                </div>
                <div className="rcb-pod-meta">
                  <RankMark p={p} size={p.rank === 1 ? 34 : 28} />
                  <b className="rcb-pod-name">{p.name}</b>
                  <Score p={p} />
                </div>
              </li>
            ))}
          </ol>
          {rest.length > 0 && (
            <ol className="rcb-rest" aria-label={`4~${3 + rest.length}등`}>
              {rest.map((p, i) => (
                <li key={p.id} className="rcb-rest-row" style={{ ['--i' as string]: i }}>
                  <span className="rcb-rest-rank">{p.rank}</span>
                  <img src={p.thumbUrl} alt="" className="rcb-rest-thumb" />
                  <span className="rcb-rest-name">{p.name}</span>
                  <Score p={p} />
                </li>
              ))}
              {more > 0 && <li className="rcb-rest-more">외 {more}장</li>}
            </ol>
          )}
        </div>
      )}
    </div>
  );
}

export default function ReceptionDresserAdminPage() {
  const { photos, error, reload, drop } = usePhotoRanking();
  const [removing, setRemoving] = useState<string | null>(null);
  const removePhoto = async (p: RankedPhoto) => {
    if (removing) return;
    const ok = await adminConfirm({
      title: `${p.name} 사진을 내릴까요?`,
      description: `${p.rank}등 · 공감 ${p.empathies} · 좋아요 ${p.likes} — 받은 공감 · 좋아요도 같이 지워지고 손님 화면에서도 사라져요. 그 손님은 다시 올릴 수 있어요.`,
      confirmText: '내리기',
    });
    if (!ok) return;
    setRemoving(p.id);
    try {
      await receptionAdminApi.deletePhoto(p.id);
      drop(p.id);
      toast.success(`${p.name} 사진을 내렸어요`);
      void reload();
    } catch (e) {
      toast.error(adminErrorText(e, '사진을 내리지 못했어요'));
    } finally {
      setRemoving(null);
    }
  };
  const [stage, setStage] = useState(false);
  // ☰ 로 옮겨 오면(?stage=1) 크게 보기 판을 바로 연다
  useStageFromQuery(() => setStage(true));

  const totals = useMemo(
    () => (photos || []).reduce((t, p) => ({ empathies: t.empathies + p.empathies, likes: t.likes + p.likes }), { empathies: 0, likes: 0 }),
    [photos],
  );
  const top = photos?.[0];

  return (
    <div className="rca space-y-5">
      <div className="adm-grid grid-cols-2 lg:grid-cols-4">
        <div className="adm-stat">
          <p className="adm-stat-label">올라온 사진</p>
          <p className="adm-stat-value"><RollingNumber value={photos?.length || 0} /><small>장</small></p>
          <p className="adm-stat-sub">한 사람 한 장</p>
        </div>
        <div className="adm-stat">
          <p className="adm-stat-label">공감 합계</p>
          <p className="adm-stat-value" style={{ color: '#F04452' }}><RollingNumber value={totals.empathies} /><small>개</small></p>
          <p className="adm-stat-sub">순위 기준</p>
        </div>
        <div className="adm-stat">
          <p className="adm-stat-label">좋아요 합계</p>
          <p className="adm-stat-value"><RollingNumber value={totals.likes} /><small>개</small></p>
          <p className="adm-stat-sub">공감이 같을 때 순위 기준</p>
        </div>
        <div className="adm-stat">
          <p className="adm-stat-label">지금 1등</p>
          <p className="adm-stat-value rcb-top-name">{top ? top.name : '—'}</p>
          <p className="adm-stat-sub">{top ? `공감 ${top.empathies} · 좋아요 ${top.likes}` : '아직 사진이 없어요'}</p>
        </div>
      </div>

      <div className="rcb-actions">
        <p className="adm-note" style={{ margin: 0 }}>순위는 5초마다 새로 읽어요. 공감 → 좋아요 → 먼저 올린 순.</p>
        <button type="button" className="adm-btn primary" onClick={() => setStage(true)}>크게 보기</button>
      </div>
      {error && <p className="adm-note">연결이 잠깐 끊겼어요 — 마지막으로 받은 순위예요. ({error})</p>}

      <AdminListCard>
        {!photos ? (
          <p className="adm-empty">{error || '불러오는 중…'}</p>
        ) : photos.length === 0 ? (
          <p className="adm-empty">아직 올라온 사진이 없어요</p>
        ) : (
          <AdminTableScroll>
            <table className="adm-table">
              <thead>
                <tr>
                  <th>순위</th>
                  <th>사진</th>
                  <th>이름</th>
                  <th>공감</th>
                  <th>좋아요</th>
                  <th>올린 시각</th>
                  <th aria-label="관리" />
                </tr>
              </thead>
              <tbody>
                {photos.map((p) => (
                  <tr key={p.id}>
                    <td className="rcb-cell-rank"><RankMark p={p} size={22} /></td>
                    <td>
                      <a href={p.imageUrl} target="_blank" rel="noreferrer" className="rcb-cell-thumb" aria-label={`${p.name} 사진 크게 열기`}>
                        <img src={p.thumbUrl} alt="" loading="lazy" />
                      </a>
                    </td>
                    <td><b>{p.name}</b></td>
                    <td className="adm-num"><b>{p.empathies}</b></td>
                    <td className="adm-num">{p.likes}</td>
                    <td className="adm-num">{p.createdAt ? formatKstDateTime(p.createdAt) : '—'}</td>
                    <td>
                      <button type="button" className="adm-btn danger sm" disabled={!!removing} onClick={() => void removePhoto(p)}>
                        {removing === p.id ? '내리는 중…' : '내리기'}
                      </button>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </AdminTableScroll>
        )}
      </AdminListCard>

      <ReceptionStage open={stage} onClose={() => setStage(false)} label="베스트드레서 크게 보기" nav="dresser">
        <DresserStageBody photos={photos} />
      </ReceptionStage>
    </div>
  );
}
