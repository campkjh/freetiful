'use client';

// 웨딩홀 상세 칸 — '웨딩홀 정보'(이런 점이 좋아요 · 기본 정보) + '홀 안내'(홀마다 사진 줄 · 예식 · 수용 · 식대 · 대관료 · 꽃장식 · 주류).
// 데이터 = lib/business-hall-info(업체 소개 안의 숨은 표시). 업체 상세(businesses/[id])의 사진 모아보기와 위치 사이에 들어간다.
// 줄 모양은 같은 화면 '업체 정보'(왼쪽 회색 이름 72 · 오른쪽 값 15)와 같게, 홀 카드는 옅은 테두리 모서리 18.
import { TossCheckIcon } from '@/components/icons/TossMonoIcons';
import {
  formatCapacity,
  formatFlower,
  formatGuarantee,
  formatParking,
  formatRental,
  formatStyle,
  type HallInfo,
} from '@/lib/business-hall-info';

function Rows({ rows }: { rows: Array<{ label: string; value?: string }> }) {
  const shown = rows.filter((r) => r.value);
  if (shown.length === 0) return null;
  return (
    <dl>
      {shown.map((row, i) => (
        <div key={row.label} className={`flex gap-4 py-3 ${i ? 'border-t border-[#F2F4F6]' : ''}`}>
          <dt className="w-[72px] shrink-0 text-[15px] tracking-[-0.2px] text-[#8B95A1]">{row.label}</dt>
          <dd className="min-w-0 flex-1 break-keep text-[15px] leading-[1.55] tracking-[-0.2px] text-[#191F28]">{row.value}</dd>
        </div>
      ))}
    </dl>
  );
}

export default function HallInfoSections({
  info,
  images,
  onOpenPhoto,
}: {
  info: HallInfo;
  /** 화면 전체 사진 목록 — 홀 사진을 누르면 그 사진 자리에서 크게 보기 */
  images: string[];
  onOpenPhoto: (index: number) => void;
}) {
  const keypoints = (info.keypoints || []).filter(Boolean);
  const halls = (info.halls || []).filter((h) => h && (h.name || h.meal || h.capacity));
  return (
    <>
      <section className="px-5 pt-8">
        <h2 className="text-[19px] font-bold tracking-[-0.4px] text-[#191F28]">웨딩홀 정보</h2>
        {keypoints.length > 0 && (
          <ul className="mt-3 space-y-2.5 rounded-[16px] bg-[#F7F9FC] px-4 py-3.5">
            {keypoints.map((k) => (
              <li key={k} className="flex gap-2 break-keep text-[15px] leading-[1.55] tracking-[-0.2px] text-[#333D4B]">
                <span className="mt-[3px] shrink-0 text-[#3182F6]"><TossCheckIcon size={16} /></span>
                <span className="min-w-0">{k}</span>
              </li>
            ))}
          </ul>
        )}
        <div className="mt-2">
          <Rows
            rows={[
              { label: '홀 타입', value: info.hallType },
              { label: '메뉴', value: info.menu },
              { label: '식대', value: info.mealPrice },
              { label: '보증 인원', value: formatGuarantee(info.guarantee) },
              { label: '주차', value: formatParking(info.parking) },
            ]}
          />
        </div>
      </section>

      {halls.length > 0 && (
        <section className="px-5 pt-8">
          <h2 className="text-[19px] font-bold tracking-[-0.4px] text-[#191F28]">
            홀 안내 <span className="text-[#3182F6]">{halls.length}</span>
          </h2>
          <div className="mt-3 space-y-3">
            {halls.map((hall, hi) => {
              const photos = (hall.images || []).filter((src) => images.includes(src));
              return (
                <div key={`${hall.name}-${hi}`} className="overflow-hidden rounded-[18px] border border-[#EEF0F3]">
                  {photos.length > 0 && (
                    <div className="flex snap-x snap-mandatory gap-[3px] overflow-x-auto [scrollbar-width:none] [&::-webkit-scrollbar]:hidden">
                      {photos.map((src) => (
                        <button
                          key={src}
                          type="button"
                          onClick={() => onOpenPhoto(images.indexOf(src))}
                          className={`relative shrink-0 snap-start overflow-hidden bg-[#F2F4F6] ${photos.length === 1 ? 'w-full' : 'w-[64%]'}`}
                          style={{ aspectRatio: '4 / 3' }}
                          aria-label={`${hall.name} 사진 크게 보기`}
                        >
                          {/* eslint-disable-next-line @next/next/no-img-element */}
                          <img src={src} alt="" referrerPolicy="no-referrer" loading="lazy" decoding="async" className="absolute inset-0 h-full w-full object-cover" />
                        </button>
                      ))}
                    </div>
                  )}
                  <div className="px-4 pb-2 pt-3.5">
                    <p className="flex items-baseline gap-1.5 break-keep text-[17px] font-bold tracking-[-0.4px] text-[#191F28]">
                      {hall.name}
                      {hall.floor && <span className="text-[14px] font-semibold text-[#8B95A1]">{hall.floor}</span>}
                    </p>
                    <div className="mt-1">
                      <Rows
                        rows={[
                          { label: '예식', value: formatStyle(hall.style) },
                          { label: '수용 인원', value: formatCapacity(hall.capacity) },
                          { label: '식대', value: hall.meal },
                          { label: '대관료', value: formatRental(hall.rental) },
                          { label: '꽃장식', value: formatFlower(hall.flower) },
                          { label: '주류', value: hall.drink },
                        ]}
                      />
                    </div>
                  </div>
                </div>
              );
            })}
          </div>
        </section>
      )}

      {info.source && (
        <p className="px-5 pt-3 text-[13px] leading-[1.5] tracking-[-0.2px] text-[#8B95A1]">
          정보 제공 {info.source} · 웨딩홀 사정에 따라 메뉴와 가격이 바뀔 수 있어요
        </p>
      )}
    </>
  );
}
