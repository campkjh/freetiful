'use client';

// 공지사항 — 토스 뉴스룸 어법(261001 사장 지시).
//  · 맨 위 = 뉴스룸 큰 카드 한 장(고정 공지 우선, 없으면 최신). 그림 4:3 · 아래 '태그 | 날짜' · 큰 제목.
//  · 그 아래 = 2열 카드. 그림 1:1 · 제목 2줄 · 날짜. 테두리·바탕 없이 그림만 둥글게(레퍼런스 그대로).
//  · 그림 = 동물 친구 20종(public/images/notices)을 공지 id 해시로 고르게 나눠 준다.
//    DB 에 그림 칸이 없어도 되고, 새 공지가 올라와도 알아서 한 장을 받는다.
//    낱장 배경이 파스텔 단색이라 그 색을 카드 바탕에 깔면 4:3·1:1 어느 칸이든 잘리지 않는다.
//  · 누르면 아래에서 스프링으로 올라오는 시트에 본문(뒤 화면 잠금, 닫을 땐 내려간다).
import { useState, useEffect, useMemo } from 'react';
import { AnimatePresence, MotionConfig, motion } from 'framer-motion';
import { announcementApi, type Announcement } from '@/lib/api/announcement.api';
import { EmptyDocumentIcon } from '@/components/icons/color';
import { useBodyScrollLock } from '@/lib/hooks/useBodyScrollLock';
import { MyDetailHeader } from '../_components/detail-ui';

/** 동물 친구 20종 — 낱장마다 배경이 단색이라 그 색을 카드 바탕으로 쓴다 */
const ART_COUNT = 20;
const ART_BG = [
  '#FCD8BA', '#FCBAB4', '#9C9CE4', '#D8FCE4', '#FCEAA8',
  '#D8C0E4', '#B4D8F0', '#D8F6DE', '#FCD2B4', '#D8C6F6',
  '#C6E4C6', '#F6E4C6', '#D2F0CC', '#FCD2C0', '#FCF0AE',
  '#B4DEF6', '#FCCCCC', '#BAE4E4', '#D8C0F0', '#C6DEC6',
];

type Art = { src: string; bg: string };

function art(n: number): Art {
  return { src: `/images/notices/notice-${String(n + 1).padStart(2, '0')}.webp`, bg: ART_BG[n] };
}

/** 공지 id → 그림 번호(0~19). 같은 공지는 늘 같은 그림이 나온다. */
function seedOf(id: string): number {
  let h = 0;
  for (let i = 0; i < id.length; i++) h = (h * 31 + id.charCodeAt(i)) >>> 0;
  return h % ART_COUNT;
}

/**
 * 목록 전체에 그림을 나눠 준다.
 * id 해시가 먼저지만, 바로 앞 NEAR 칸이 쓴 그림이면 다음 번호로 밀어 준다.
 * 공지가 20건을 넘으면 그림은 반드시 겹치는데, 옆 칸·윗줄과 같은 그림이 붙으면
 * 복사한 것처럼 보이기 때문(2열이라 6칸만 떨어져도 눈에 안 띈다).
 */
const NEAR = 5;
function dealArt(ids: string[]): Art[] {
  const recent: number[] = [];
  return ids.map((id) => {
    let n = seedOf(id);
    for (let step = 0; step < ART_COUNT && recent.includes(n); step++) n = (n + 1) % ART_COUNT;
    recent.push(n);
    if (recent.length > NEAR) recent.shift();
    return art(n);
  });
}

function formatDate(iso: string): string {
  const d = new Date(iso);
  if (Number.isNaN(d.getTime())) return '';
  return `${d.getFullYear()}.${String(d.getMonth() + 1).padStart(2, '0')}.${String(d.getDate()).padStart(2, '0')}`;
}

const GLASS = {
  backgroundColor: 'rgba(0, 0, 0, 0.36)',
  WebkitBackdropFilter: 'blur(10px) saturate(140%)',
  backdropFilter: 'blur(10px) saturate(140%)',
  boxShadow: 'inset 0 0 0 0.5px rgba(255, 255, 255, 0.18)',
} as const;

/** 맨 위 큰 카드 — 뉴스룸 첫 장 */
function HeadlineCard({ a, art, onOpen }: { a: Announcement; art: Art; onOpen: () => void }) {
  return (
    <button
      type="button"
      onClick={onOpen}
      className="qd-a-item group card-press block w-full text-left"
      style={{ animationDelay: '0.26s' }}
    >
      <div
        className="relative overflow-hidden rounded-[20px]"
        style={{ aspectRatio: '4 / 3', backgroundColor: art.bg }}
      >
        {/* eslint-disable-next-line @next/next/no-img-element */}
        <img
          src={art.src}
          alt=""
          draggable={false}
          className="absolute left-1/2 top-1/2 h-full -translate-x-1/2 -translate-y-1/2 object-contain transition-transform duration-500 ease-out group-hover:scale-[1.04]"
        />
        {a.isPinned && (
          <span
            className="absolute left-3 top-3 inline-flex h-[26px] items-center rounded-[8px] px-2 text-[12.5px] font-bold tracking-[-0.2px] text-white"
            style={GLASS}
          >
            고정
          </span>
        )}
      </div>

      <p className="mt-3.5 text-[13px] leading-[1.5] tracking-[-0.2px] text-[#8B95A1]">
        {a.tag || '안내'}
        <span className="px-1.5 text-[#D1D6DB]">|</span>
        {formatDate(a.publishedAt || a.createdAt)}
      </p>
      <p className="mt-1.5 line-clamp-2 break-keep text-[20px] font-bold leading-[1.4] tracking-[-0.5px] text-[#191F28]">
        {a.title}
      </p>
    </button>
  );
}

/** 아래 2열 카드 */
function NoticeCard({ a, art, index, onOpen }: { a: Announcement; art: Art; index: number; onOpen: () => void }) {
  return (
    <button
      type="button"
      onClick={onOpen}
      // button 은 줄 높이만큼 늘면 내용을 세로 가운데로 모은다 → flex 세로로 위부터
      className="qd-a-item group card-press flex h-full flex-col text-left"
      style={{ animationDelay: `${0.34 + Math.min(index, 12) * 0.05}s` }}
    >
      <div
        className="relative w-full overflow-hidden rounded-[16px]"
        style={{ aspectRatio: '1 / 1', backgroundColor: art.bg }}
      >
        {/* eslint-disable-next-line @next/next/no-img-element */}
        <img
          src={art.src}
          alt=""
          draggable={false}
          loading="lazy"
          className="h-full w-full object-cover transition-transform duration-500 ease-out group-hover:scale-[1.05]"
        />
        {a.isPinned && (
          <span
            className="absolute left-2 top-2 inline-flex h-[24px] items-center rounded-[7px] px-1.5 text-[11.5px] font-bold tracking-[-0.2px] text-white"
            style={GLASS}
          >
            고정
          </span>
        )}
      </div>

      <p className="mt-2.5 line-clamp-2 break-keep text-[15px] font-bold leading-[1.42] tracking-[-0.35px] text-[#191F28]">
        {a.title}
      </p>
      <p className="mt-1 text-[12.5px] leading-[1.5] tracking-[-0.2px] text-[#8B95A1]">
        {formatDate(a.publishedAt || a.createdAt)}
      </p>
    </button>
  );
}

export default function AnnouncementsPage() {
  const [items, setItems] = useState<Announcement[]>([]);
  const [loading, setLoading] = useState(true);
  const [openId, setOpenId] = useState<string | null>(null);
  const open = items.find((x) => x.id === openId) || null;
  useBodyScrollLock(!!open);

  useEffect(() => { window.scrollTo(0, 0); }, []);

  useEffect(() => {
    (async () => {
      try {
        const data = await announcementApi.getList();
        setItems(Array.isArray(data) ? data : []); // 배열이 아니면(오류 응답 등) 빈 목록 — map 에서 화면이 죽지 않게
      } catch {
        setItems([]);
      } finally {
        setLoading(false);
      }
    })();
  }, []);

  // 맨 앞 한 장만 크게. 서버가 고정 공지를 앞으로 보내 주므로 목록 첫 장을 그대로 쓴다.
  const arts = useMemo(() => dealArt(items.map((x) => x.id)), [items]);
  const [headline, ...rest] = items;
  const openIndex = open ? items.findIndex((x) => x.id === open.id) : -1;
  const openArt = openIndex >= 0 ? arts[openIndex] : null;

  return (
    <div className="mx-auto min-h-screen max-w-lg bg-white pb-24" style={{ letterSpacing: '-0.02em' }}>
      <MyDetailHeader title="공지사항" sub="프리티풀의 새 소식을 알려 드려요" />

      <div className="px-5 pt-1">
        {loading ? (
          <>
            <div className="animate-pulse">
              <div className="rounded-[20px] bg-[#F2F4F6]" style={{ aspectRatio: '4 / 3' }} />
              <div className="mt-3.5 h-[62px]" />
            </div>
            <div className="mt-7 grid grid-cols-2 gap-x-3 gap-y-6">
              {[0, 1, 2, 3].map((i) => (
                <div key={i} className="animate-pulse">
                  <div className="rounded-[16px] bg-[#F2F4F6]" style={{ aspectRatio: '1 / 1' }} />
                  <div className="h-[58px]" />
                </div>
              ))}
            </div>
          </>
        ) : items.length === 0 ? (
          <div className="flex flex-col items-center justify-center px-6 py-24 text-center">
            <EmptyDocumentIcon size={64} className="mb-3" />
            <p className="text-[15px] font-bold text-[#2B313D]">등록된 공지사항이 없습니다</p>
            <p className="mt-1.5 text-[13px] text-[#A4ABBA]">새로운 소식이 생기면 이곳에 알려드릴게요.</p>
          </div>
        ) : (
          <>
            <HeadlineCard a={headline} art={arts[0]} onOpen={() => setOpenId(headline.id)} />

            {rest.length > 0 && (
              <div className="mt-7 grid grid-cols-2 gap-x-3 gap-y-6">
                {rest.map((a, i) => (
                  <NoticeCard key={a.id} a={a} art={arts[i + 1]} index={i} onOpen={() => setOpenId(a.id)} />
                ))}
              </div>
            )}
          </>
        )}
      </div>

      {/* 공지 본문 시트 — 아래에서 스프링으로 올라오고, 닫을 땐 내려간다 */}
      <MotionConfig reducedMotion="user">
        <AnimatePresence>
          {open && openArt && (
            <motion.div
              key="notice-scrim"
              className="ft-scrim"
              style={{ animation: 'none' }}
              initial={{ backgroundColor: 'rgba(0, 0, 0, 0)' }}
              animate={{ backgroundColor: 'rgba(0, 0, 0, 0.4)' }}
              exit={{ backgroundColor: 'rgba(0, 0, 0, 0)' }}
              transition={{ duration: 0.26, ease: [0.22, 1, 0.36, 1] }}
              onClick={() => setOpenId(null)}
            >
              <motion.div
                className="ft-sheet"
                role="dialog"
                aria-modal="true"
                aria-label={open.title}
                style={{ animation: 'none', overscrollBehavior: 'contain' }}
                initial={{ y: '100%' }}
                animate={{ y: 0 }}
                exit={{ y: '100%', transition: { duration: 0.26, ease: [0.4, 0, 1, 1] } }}
                transition={{ type: 'spring', stiffness: 380, damping: 36, mass: 0.9 }}
                onClick={(e) => e.stopPropagation()}
              >
                <div className="ft-grab" aria-hidden="true" />
                <div className="flex items-center gap-3">
                  <span
                    className="flex h-12 w-12 shrink-0 items-center justify-center overflow-hidden rounded-[14px]"
                    style={{ backgroundColor: openArt.bg }}
                  >
                    {/* eslint-disable-next-line @next/next/no-img-element */}
                    <img src={openArt.src} alt="" className="h-full w-full object-cover" />
                  </span>
                  <span className="min-w-0 text-[13px] leading-[1.5] text-[#8B95A1]">
                    <b className="font-semibold text-[#4E5968]">{open.tag || '안내'}</b> · {formatDate(open.publishedAt || open.createdAt)}
                  </span>
                </div>
                <h2 className="mt-4 text-[21px] font-bold leading-[1.4] tracking-[-0.5px] text-[#191F28]">{open.title}</h2>
                <p className="mt-3 whitespace-pre-line text-[16px] leading-[1.75] text-[#4E5968]">{open.content}</p>
                <div className="ft-actions">
                  <button type="button" className="ft-btn secondary" onClick={() => setOpenId(null)}>닫기</button>
                </div>
              </motion.div>
            </motion.div>
          )}
        </AnimatePresence>
      </MotionConfig>
    </div>
  );
}
