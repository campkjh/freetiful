'use client';

// 공지사항 — 토스 뉴스룸 카드 그대로(261001 · 260928 사장 '공지사항 카드 이렇게 — 완전 똑같이, 하단엔 그라데이션 블러, 카드는 4:3').
//  · 큰 제목 '공지사항'(뉴스룸처럼 크게) 아래로 카드가 모바일 1열 · 넓은 화면 2열.
//  · 카드 = 4:3 · 모서리 크게 · 그림이 칸을 가득 채우고, 아래쪽은 점점 짙어지는 흐림(그라데이션 블러) + 옅은 흰 막 위에
//    '태그 | 날짜'(회색) · 굵은 제목 2줄. 테두리·그림자 없음.
//  · 그림 = 동물 친구 20종(public/images/notices)을 공지 id 해시로 고르게 나눠 준다.
//    DB 에 그림 칸이 없어도 되고, 새 공지가 올라와도 알아서 한 장을 받는다.
//    낱장 배경이 파스텔 단색이라 그 색을 카드 바탕에 깔면 그림을 조금 위로 올려 앉혀도 이음새가 없다(주인공 얼굴이 글자 위로 오게).
//  · 누르면 아래에서 스프링으로 올라오는 시트에 본문(뒤 화면 잠금, 닫을 땐 내려간다).
import { useState, useEffect, useMemo } from 'react';
import { AnimatePresence, MotionConfig, motion } from 'framer-motion';
import { announcementApi, type Announcement } from '@/lib/api/announcement.api';
import { EmptyDocumentIcon } from '@/components/icons/color';
import { useBodyScrollLock } from '@/lib/hooks/useBodyScrollLock';
import { QdBackHeader } from '../_components/detail-ui';

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

/** 그림 좌우 끝을 바탕색으로 녹인다 — 낱장 배경과 카드 바탕(ART_BG)이 한두 끗 달라 세로 이음새가 비쳤다 */
const ART_FEATHER = 'linear-gradient(to right, transparent 0%, #000 10%, #000 90%, transparent 100%)';
/** 아래쪽 흐림 — 위는 0, 내려갈수록 짙어진다(마스크로 흐림 자체를 서서히) */
const BLUR_FADE = 'linear-gradient(to bottom, transparent 0%, rgba(0, 0, 0, 0.5) 30%, #000 60%)';

/** 뉴스룸 카드 — 4:3 · 그림 가득 · 아래 그라데이션 블러 위에 '태그 | 날짜' + 굵은 제목 */
function NewsCard({ a, art, index, onOpen }: { a: Announcement; art: Art; index: number; onOpen: () => void }) {
  return (
    <button
      type="button"
      onClick={onOpen}
      className="qd-a-item group card-press block w-full text-left"
      style={{ animationDelay: `${0.22 + Math.min(index, 10) * 0.05}s` }}
    >
      <div
        // translateZ(0): 사파리에서 안쪽 backdrop 흐림이 둥근 모서리 밖으로 번지지 않게
        className="relative overflow-hidden rounded-[28px] sm:rounded-[32px] lg:rounded-[40px]"
        style={{ aspectRatio: '4 / 3', backgroundColor: art.bg, transform: 'translateZ(0)' }}
      >
        {/* 그림 — 바탕과 같은 단색이라 칸보다 살짝 크게, 위로 올려 앉힌다(얼굴이 글자 위) */}
        {/* eslint-disable-next-line @next/next/no-img-element */}
        <img
          src={art.src}
          alt=""
          draggable={false}
          loading={index < 2 ? 'eager' : 'lazy'}
          className="absolute left-1/2 top-[-6%] h-[108%] w-auto max-w-none -translate-x-1/2 transition-transform duration-700 ease-out group-hover:scale-[1.04]"
          style={{ WebkitMaskImage: ART_FEATHER, maskImage: ART_FEATHER }}
        />
        {/* 그라데이션 블러 + 옅은 흰 막 */}
        <span
          aria-hidden="true"
          className="pointer-events-none absolute inset-x-0 bottom-0 h-[66%]"
          style={{
            WebkitBackdropFilter: 'blur(28px) saturate(150%)',
            backdropFilter: 'blur(28px) saturate(150%)',
            WebkitMaskImage: BLUR_FADE,
            maskImage: BLUR_FADE,
          }}
        />
        <span
          aria-hidden="true"
          className="pointer-events-none absolute inset-x-0 bottom-0 h-[66%]"
          style={{ background: 'linear-gradient(to bottom, rgba(255, 255, 255, 0) 0%, rgba(255, 255, 255, 0.34) 48%, rgba(255, 255, 255, 0.55) 100%)' }}
        />

        <span className="absolute inset-x-0 bottom-0 block px-6 pb-6 sm:px-7 sm:pb-7 lg:px-[38px] lg:pb-[38px]">
          <span className="flex items-center text-[13px] font-medium leading-[1.4] tracking-[-0.2px] text-[#6B7684] lg:text-[15px]">
            {a.isPinned && (
              <>
                <b className="font-semibold text-[#3182F6]">고정</b>
                <span aria-hidden="true" className="mx-2 h-[11px] w-px bg-[#8B95A1] opacity-50 lg:mx-2.5 lg:h-[13px]" />
              </>
            )}
            {a.tag || '안내'}
            <span aria-hidden="true" className="mx-2 h-[11px] w-px bg-[#8B95A1] opacity-50 lg:mx-2.5 lg:h-[13px]" />
            {formatDate(a.publishedAt || a.createdAt)}
          </span>
          <span className="mt-2.5 line-clamp-2 break-keep text-[19px] font-bold leading-[1.38] tracking-[-0.5px] text-[#191F28] sm:text-[20px] lg:mt-[18px] lg:text-[24px] lg:leading-[1.36]">
            {a.title}
          </span>
        </span>
      </div>
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

  // 서버가 고정 공지를 앞으로 보내 준다 — 목록 순서 그대로.
  const arts = useMemo(() => dealArt(items.map((x) => x.id)), [items]);
  const openIndex = open ? items.findIndex((x) => x.id === open.id) : -1;
  const openArt = openIndex >= 0 ? arts[openIndex] : null;

  return (
    <div className="mx-auto min-h-screen max-w-lg bg-white pb-24 sm:max-w-[1100px]" style={{ letterSpacing: '-0.02em' }}>
      <QdBackHeader />
      {/* 큰 제목 — 뉴스룸처럼 굵고 크게 */}
      <div className="px-6 pb-6 pt-2 sm:px-8 lg:px-10 lg:pb-9 lg:pt-4" data-native-back-header>
        <h1 className="qd-a-title m-0 text-[30px] font-bold leading-[1.25] tracking-[-0.8px] text-[#191F28] lg:text-[54px] lg:tracking-[-1.8px]">공지사항</h1>
      </div>

      <div className="px-5 sm:px-8 lg:px-10">
        {loading ? (
          <div className="grid grid-cols-1 gap-4 sm:grid-cols-2 sm:gap-5 lg:gap-6">
            {[0, 1, 2, 3].map((i) => (
              <div key={i} className="animate-pulse rounded-[28px] bg-[#F2F4F6] sm:rounded-[32px] lg:rounded-[40px]" style={{ aspectRatio: '4 / 3' }} />
            ))}
          </div>
        ) : items.length === 0 ? (
          <div className="flex flex-col items-center justify-center px-6 py-24 text-center">
            <EmptyDocumentIcon size={64} className="mb-3" />
            <p className="text-[15px] font-bold text-[#2B313D]">등록된 공지사항이 없습니다</p>
            <p className="mt-1.5 text-[13px] text-[#A4ABBA]">새로운 소식이 생기면 이곳에 알려드릴게요.</p>
          </div>
        ) : (
          <div className="grid grid-cols-1 gap-4 sm:grid-cols-2 sm:gap-5 lg:gap-6">
            {items.map((a, i) => (
              <NewsCard key={a.id} a={a} art={arts[i]} index={i} onOpen={() => setOpenId(a.id)} />
            ))}
          </div>
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
