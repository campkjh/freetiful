'use client';

// 순위 — 공감을 가장 많이 받은 사람이 맨 위(같으면 좋아요 → 먼저 올린 순, 서버 reception.rules.ts compareRank).
import type { ReceptionPhoto } from '@/lib/reception/api';
import RankCrown from './RankCrown';
import { HeartIcon, ThumbIcon } from './ReceptionIcons';

export default function RankingList({ photos, onOpen }: { photos: ReceptionPhoto[]; onOpen: (p: ReceptionPhoto) => void }) {
  const ranked = [...photos].sort((a, b) => a.rank - b.rank);
  if (!ranked.length) return <p className="rc-rank-empty">사진이 올라오면 공감 순서대로 순위가 매겨져요.</p>;
  return (
    <ol className="rc-rank-list">
      {ranked.map((p) => {
        const medal = p.rank <= 3 && p.empathies > 0;
        return (
          <li key={p.id}>
            <button type="button" className={`rc-rank-row ${p.mine ? 'mine' : ''}`} onClick={() => onOpen(p)}>
              <span className="rc-rank-no">
                {medal ? <RankCrown rank={p.rank as 1 | 2 | 3} size={20} /> : p.rank}
              </span>
              <img src={p.thumbUrl} alt="" className="rc-rank-thumb" loading="lazy" />
              <span className="rc-rank-name">{p.name}{p.mine && <em>나</em>}</span>
              <span className="rc-rank-score">
                <span className="rc-rank-emp"><HeartIcon size={15} />{p.empathies}</span>
                <span className="rc-rank-like"><ThumbIcon size={13} />{p.likes}</span>
              </span>
            </button>
          </li>
        );
      })}
    </ol>
  );
}
