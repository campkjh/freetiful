'use client';

// 포토 이벤트(261108 사장) — 3열 피드(인스타 탐색 결) + 아래 떠 있는 올리기 단추(사진 한 장) + 옆 순위.
//  · 좋아요 · 공감은 종류별 한 사람 10개까지(사진 한 장에 1개, 내 사진엔 못 누름) — 사진이 받는 수는 무제한.
//  · 순위 = 공감 많은 순. 넓은 화면은 오른쪽 칸에 늘 보이고, 폰은 오른쪽 가장자리 '순위' 손잡이 → 옆에서 나오는 서랍.
//  · 8초마다 새로 받는다(화면이 보일 때만, 누르는 중엔 쉼). 규칙은 서버 apps/api/src/reception.
import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { createPortal } from 'react-dom';
import toast from 'react-hot-toast';
import { NameGateModal } from '@/components/reception/NameGate';
import PhotoViewer from '@/components/reception/PhotoViewer';
import RankingList from '@/components/reception/RankingList';
import { CloseIcon, EventIcon, HeartIcon, PlusIcon, RankMedal, ThumbIcon } from '@/components/reception/ReceptionIcons';
import { receptionApi, shrinkPhoto, type ReceptionFeed, type ReceptionPhoto, type VoteKind } from '@/lib/reception/api';
import { readGuest, useReceptionGuest } from '@/lib/reception/guest';

const POLL_MS = 8000;
const KIND_LABEL: Record<VoteKind, string> = { like: '좋아요', empathy: '공감' };

/** 누른 즉시 화면에 반영(서버 답이 오면 그걸로 바꿈) — 순위도 같은 규칙으로 다시 매긴다 */
function applyVote(feed: ReceptionFeed, id: string, kind: VoteKind, on: boolean): ReceptionFeed {
  const d = on ? 1 : -1;
  const photos = feed.photos.map((p) =>
    p.id !== id ? { ...p } : kind === 'like' ? { ...p, liked: on, likes: Math.max(0, p.likes + d) } : { ...p, empathized: on, empathies: Math.max(0, p.empathies + d) },
  );
  [...photos]
    .sort((a, b) => b.empathies - a.empathies || b.likes - a.likes || a.createdAt.localeCompare(b.createdAt) || a.id.localeCompare(b.id))
    .forEach((p, i) => { p.rank = i + 1; });
  const me = { ...feed.me };
  if (kind === 'like') me.likesLeft = Math.max(0, me.likesLeft - d);
  else me.empathiesLeft = Math.max(0, me.empathiesLeft - d);
  return { photos, me };
}

export default function ReceptionEventPage() {
  const guest = useReceptionGuest();
  const [feed, setFeed] = useState<ReceptionFeed | null>(null);
  const [loadError, setLoadError] = useState(false);
  // 보는 사진은 id 로 기억 — 공감을 누르면 순위 목록 순서가 바뀌어도 같은 사진에 머문다
  const [viewer, setViewer] = useState<{ list: 'feed' | 'rank'; id: string } | null>(null);
  const [rankOpen, setRankOpen] = useState(false);
  const [needName, setNeedName] = useState<null | (() => void)>(null);
  const [draft, setDraft] = useState<{ file: File; url: string } | null>(null);
  const [uploading, setUploading] = useState(false);
  const [replaceAsk, setReplaceAsk] = useState(false);
  const busy = useRef(0);
  const picker = useRef<HTMLInputElement>(null);

  const load = useCallback(async () => {
    if (busy.current) return;
    try {
      const next = await receptionApi.feed(readGuest().deviceId);
      if (!busy.current) setFeed(next);
      setLoadError(false);
    } catch {
      setLoadError(true);
    }
  }, []);

  useEffect(() => {
    load();
    const t = setInterval(() => { if (!document.hidden) load(); }, POLL_MS);
    const onVis = () => { if (!document.hidden) load(); };
    document.addEventListener('visibilitychange', onVis);
    return () => { clearInterval(t); document.removeEventListener('visibilitychange', onVis); };
  }, [load]);

  const photos = feed?.photos ?? [];
  const ranked = useMemo(() => [...photos].sort((a, b) => a.rank - b.rank), [photos]);
  const viewList = viewer?.list === 'rank' ? ranked : photos;
  const viewIndex = viewer ? viewList.findIndex((p) => p.id === viewer.id) : -1;
  const mine = photos.find((p) => p.mine) || null;

  /** 이름이 있어야 하는 일 — 없으면 이름 카드를 먼저 */
  const withName = (fn: () => void) => {
    if (readGuest().name) fn();
    else setNeedName(() => fn);
  };

  const vote = async (p: ReceptionPhoto, kind: VoteKind) => {
    if (!feed) return;
    if (p.mine) { toast('내 사진에는 누를 수 없어요'); return; }
    const on = kind === 'like' ? !p.liked : !p.empathized;
    const left = kind === 'like' ? feed.me.likesLeft : feed.me.empathiesLeft;
    if (on && left <= 0) {
      toast.error(`${KIND_LABEL[kind]}는 ${feed.me.limit}개까지 누를 수 있어요. 다른 사진에서 거두면 다시 쓸 수 있어요.`);
      return;
    }
    withName(async () => {
      busy.current++;
      setFeed((f) => (f ? applyVote(f, p.id, kind, on) : f));
      try {
        const next = await receptionApi.vote(readGuest().deviceId, p.id, kind, on);
        busy.current--;
        if (!busy.current) setFeed(next);
      } catch (e: any) {
        busy.current--;
        toast.error(e?.message || '잠시 후 다시 시도해 주세요.');
        load();
      }
    });
  };

  const openPicker = () => withName(() => {
    if (mine) { setReplaceAsk(true); return; }
    picker.current?.click();
  });

  const onPick = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    e.target.value = '';
    if (!file) return;
    if (!file.type.startsWith('image/') && !/\.(heic|heif)$/i.test(file.name)) { toast.error('사진 파일만 올릴 수 있어요.'); return; }
    setDraft({ file, url: URL.createObjectURL(file) });
  };

  const closeDraft = () => {
    if (draft) URL.revokeObjectURL(draft.url);
    setDraft(null);
  };

  const upload = async () => {
    if (!draft || uploading) return;
    setUploading(true);
    busy.current++;
    try {
      const g = readGuest();
      const { blob, name } = await shrinkPhoto(draft.file);
      if (mine) await receptionApi.remove(g.deviceId, mine.id);
      const next = await receptionApi.upload(g.deviceId, g.name, blob, name);
      busy.current--;
      setFeed(next);
      closeDraft();
      toast.success('사진을 올렸어요');
      window.scrollTo({ top: 0, behavior: 'smooth' });
    } catch (e: any) {
      busy.current--;
      toast.error(e?.message || '올리지 못했어요. 잠시 후 다시 시도해 주세요.');
      load();
    } finally {
      setUploading(false);
    }
  };

  const remove = async (p: ReceptionPhoto) => {
    busy.current++;
    try {
      const next = await receptionApi.remove(readGuest().deviceId, p.id);
      busy.current--;
      setFeed(next);
      setViewer(null);
      toast('사진을 지웠어요');
    } catch (e: any) {
      busy.current--;
      toast.error(e?.message || '잠시 후 다시 시도해 주세요.');
    }
  };

  const openPhoto = (p: ReceptionPhoto, list: 'feed' | 'rank') => {
    setRankOpen(false);
    setViewer({ list, id: p.id });
  };

  return (
    <div className="rc-page rc-event-page">
      <div className="rc-event-layout">
        <div className="rc-event-main">
          <header className="rc-event-head rc-rise">
            <p className="rc-eyebrow">Photo Event</p>
            <h1 className="rc-event-title">오늘의 한 컷</h1>
            <p className="rc-event-desc">사진을 한 장 올리고, 마음에 드는 사진에 좋아요·공감을 눌러 주세요. 공감을 많이 받은 순서대로 순위가 매겨져요.</p>
            <div className="rc-event-bar">
              <span className="rc-chip"><ThumbIcon size={15} />좋아요 <b>{feed?.me.likesLeft ?? 10}</b>/{feed?.me.limit ?? 10}</span>
              <span className="rc-chip empathy"><HeartIcon size={15} />공감 <b>{feed?.me.empathiesLeft ?? 10}</b>/{feed?.me.limit ?? 10}</span>
              <button type="button" className="rc-chip rc-chip-btn rc-rank-open" onClick={() => setRankOpen(true)}>
                <RankMedal rank={1} size={16} label="" />순위
              </button>
            </div>
            {guest?.name && <p className="rc-event-me">{guest.name} 님으로 참여 중</p>}
          </header>

          {!feed && !loadError && (
            <div className="rc-grid" aria-busy="true">
              {Array.from({ length: 9 }, (_, i) => <span key={i} className="rc-tile rc-tile-skel" />)}
            </div>
          )}
          {!feed && loadError && (
            <div className="rc-glass rc-empty">
              <p>사진을 불러오지 못했어요.</p>
              <button type="button" className="rc-btn-line sm" onClick={load}>다시 불러오기</button>
            </div>
          )}
          {feed && !photos.length && (
            <div className="rc-glass rc-empty rc-rise">
              <span className="rc-empty-ic"><EventIcon size={30} /></span>
              <p>아직 올라온 사진이 없어요.<br />첫 사진의 주인공이 되어 주세요!</p>
            </div>
          )}
          {feed && photos.length > 0 && (
            <ul className="rc-grid">
              {photos.map((p) => {
                const medal = p.empathies > 0 && p.rank <= 3;
                return (
                  <li key={p.id}>
                    <button type="button" className={`rc-tile ${p.mine ? 'mine' : ''}`} onClick={() => openPhoto(p, 'feed')} aria-label={`${p.name} 님의 사진, 공감 ${p.empathies}, 좋아요 ${p.likes}`}>
                      <img src={p.thumbUrl} alt="" loading="lazy" decoding="async" />
                      {medal && <RankMedal rank={p.rank as 1 | 2 | 3} size={28} className="rc-rank-medal" />}
                      {p.mine && <span className="rc-tile-mine">MY</span>}
                      <span className="rc-tile-meta">
                        <span className={`rc-tile-emp ${p.empathized ? 'on' : ''}`}><HeartIcon size={14} />{p.empathies}</span>
                        <span className={`rc-tile-like ${p.liked ? 'on' : ''}`}><ThumbIcon size={12} />{p.likes}</span>
                      </span>
                      <span className="rc-tile-name">{p.name}</span>
                    </button>
                  </li>
                );
              })}
            </ul>
          )}
        </div>

        <aside className="rc-glass rc-rank-side" aria-label="공감 순위">
          <h2 className="rc-rank-head"><RankMedal rank={1} size={22} label="" />공감 순위</h2>
          <RankingList photos={photos} onOpen={(p) => openPhoto(p, 'rank')} />
        </aside>
      </div>

      {/* 폰: 오른쪽 가장자리 손잡이 → 옆에서 나오는 순위 서랍 */}
      <button type="button" className="rc-rank-handle" onClick={() => setRankOpen(true)} aria-label="공감 순위 보기">
        <RankMedal rank={1} size={18} label="" /><span>순위</span>
      </button>
      {rankOpen && typeof document !== 'undefined' && createPortal(
        <div className="rc-theme rc-drawer-wrap" onClick={() => setRankOpen(false)}>
          <aside className="rc-drawer" role="dialog" aria-modal="true" aria-label="공감 순위" onClick={(e) => e.stopPropagation()}>
            <header className="rc-drawer-head">
              <h2 className="rc-rank-head"><RankMedal rank={1} size={22} label="" />공감 순위</h2>
              <button type="button" className="rc-icon-btn" onClick={() => setRankOpen(false)} aria-label="닫기"><CloseIcon size={20} /></button>
            </header>
            <RankingList photos={photos} onOpen={(p) => openPhoto(p, 'rank')} />
          </aside>
        </div>,
        document.body,
      )}

      <button type="button" className="rc-fab" onClick={openPicker} aria-label={mine ? '내 사진 바꾸기' : '사진 올리기'}>
        <PlusIcon size={26} />
      </button>
      <input ref={picker} type="file" accept="image/*" hidden onChange={onPick} />

      {replaceAsk && typeof document !== 'undefined' && createPortal(
        <div className="rc-theme rc-modal" role="dialog" aria-modal="true" onClick={() => setReplaceAsk(false)}>
          <div className="rc-glass rc-sheet rc-rise" onClick={(e) => e.stopPropagation()}>
            <p className="rc-eyebrow">My Photo</p>
            <h2 className="rc-sheet-title">이미 올린 사진이 있어요</h2>
            <p className="rc-sheet-desc">사진은 한 사람당 한 장이에요. 바꾸면 지금 사진이 받은 좋아요·공감은 사라져요.</p>
            <div className="rc-sheet-actions">
              <button type="button" className="rc-btn-line" onClick={() => { setReplaceAsk(false); if (mine) openPhoto(mine, 'feed'); }}>내 사진 보기</button>
              <button type="button" className="rc-btn-gold" onClick={() => { setReplaceAsk(false); picker.current?.click(); }}>사진 바꾸기</button>
            </div>
          </div>
        </div>,
        document.body,
      )}

      {draft && typeof document !== 'undefined' && createPortal(
        <div className="rc-theme rc-modal" role="dialog" aria-modal="true" aria-label="사진 올리기">
          <div className="rc-glass rc-sheet rc-upload rc-rise">
            <p className="rc-eyebrow">Upload</p>
            <h2 className="rc-sheet-title">이 사진을 올릴까요?</h2>
            <img src={draft.url} alt="올릴 사진 미리 보기" className="rc-upload-preview" />
            <p className="rc-sheet-desc">{guest?.name} 님 이름으로 올라가요.{mine ? ' 지금 올린 사진은 지워져요.' : ''}</p>
            <div className="rc-sheet-actions">
              <button type="button" className="rc-btn-line" disabled={uploading} onClick={() => { closeDraft(); picker.current?.click(); }}>다시 고르기</button>
              <button type="button" className="rc-btn-gold" disabled={uploading} onClick={upload}>{uploading ? '올리는 중…' : '올리기'}</button>
            </div>
          </div>
        </div>,
        document.body,
      )}

      {viewer && viewIndex >= 0 && (
        <PhotoViewer
          photos={viewList}
          index={viewIndex}
          onIndex={(index) => setViewer((v) => (v && viewList[index] ? { ...v, id: viewList[index].id } : v))}
          onClose={() => setViewer(null)}
          onVote={vote}
          onDelete={remove}
          likesLeft={feed?.me.likesLeft ?? 0}
          empathiesLeft={feed?.me.empathiesLeft ?? 0}
        />
      )}

      <NameGateModal
        open={!!needName}
        hint="사진 올리기와 좋아요·공감은 성함을 입력한 뒤에 할 수 있어요."
        onClose={() => setNeedName(null)}
        onDone={() => { const fn = needName; setNeedName(null); fn?.(); }}
      />
    </div>
  );
}
