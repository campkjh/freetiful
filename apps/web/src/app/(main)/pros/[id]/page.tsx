'use client';

import { useState, useRef, useEffect } from 'react';
import { useParams, useRouter } from 'next/navigation';
import Link from 'next/link';
import Image from 'next/image';
import { ChevronLeft, Phone, Share2, Heart, Play, ChevronDown, ChevronRight, ArrowUpRight, X, Check, Copy, Link2 } from 'lucide-react';
import toast from 'react-hot-toast';
import { useAuthStore } from '@/lib/store/auth.store';
import { discoveryApi, getCachedProDetail } from '@/lib/api/discovery.api';
import { favoriteApi } from '@/lib/api/favorite.api';
import { chatApi } from '@/lib/api/chat.api';
import { preWarmChat, getPreWarmByProId } from '@/lib/chat-prewarm';

// ─── Brand Color ────────────────────────────────────────────
const BRAND = '#3180F7';
const BRAND_LIGHT = '#EAF3FF';

// ─── Reveal Hook ────────────────────────────────────────────
function useReveal(threshold = 0.15) {
  const ref = useRef<HTMLDivElement>(null);
  const [visible, setVisible] = useState(false);
  useEffect(() => {
    const el = ref.current;
    if (!el) return;
    const ob = new IntersectionObserver(
      ([e]) => { if (e.isIntersecting) setVisible(true); },
      { threshold },
    );
    ob.observe(el);
    return () => ob.disconnect();
  }, [threshold]);
  return { ref, visible };
}

function Reveal({ children, delay = 0, className = '' }: { children: React.ReactNode; delay?: number; className?: string }) {
  const { ref, visible } = useReveal();
  return (
    <div
      ref={ref}
      className={`transition-all duration-700 ease-out ${visible ? 'translate-y-0 opacity-100 blur-0' : 'translate-y-8 opacity-0 blur-[4px]'} ${className}`}
      style={{ transitionDelay: `${delay}ms` }}
    >
      {children}
    </div>
  );
}

// ─── CountUp ────────────────────────────────────────────────
function CountUp({ value, suffix = '' }: { value: number; suffix?: string }) {
  const { ref, visible } = useReveal(0.3);
  const [n, setN] = useState(0);
  useEffect(() => {
    if (!visible) return;
    const dur = 1200;
    const start = Date.now();
    const tick = () => {
      const p = Math.min(1, (Date.now() - start) / dur);
      const eased = 1 - Math.pow(1 - p, 3);
      setN(Math.round(value * eased));
      if (p < 1) requestAnimationFrame(tick);
    };
    tick();
  }, [visible, value]);
  return <span ref={ref}>{n.toLocaleString()}{suffix}</span>;
}

// ─── Helper: extract YouTube ID from URL ────────────────────
function extractYoutubeId(url: string | null | undefined): string | undefined {
  if (!url) return undefined;
  const match = url.match(/(?:youtu\.be\/|youtube\.com\/(?:watch\?v=|embed\/|shorts\/))([a-zA-Z0-9_-]{11})/);
  return match?.[1] || undefined;
}

// ─── Pro data type from API ────────────────────────────────
interface ProDetailData {
  id: string;
  name: string;
  profileImage: string;
  mainImage: string;
  images: string[];
  title: string;
  isPrime: boolean;
  youtubeId?: string;
  youtubeVideos: { id: string; title: string }[];
  rating: number;
  reviewCount: number;
  plans: { id: string; label: string; price: number; duration: string; title: string; desc: string[]; workDays: number; revisions: number }[];
  description: string;
  expertStats: {
    totalDeals: number;
    satisfaction: number;
    memberType: string;
    taxInvoice: string;
    responseTime: string;
    contactTime: string;
  };
  reviews: {
    id: string;
    name: string;
    rating: number;
    date: string;
    scores?: Record<string, number>;
    content: string;
    workDays: number;
    orderRange: string;
    badge?: string;
    proReply?: { date: string; content: string };
  }[];
  recommendedPros: { id: string; name: string; role: string; rating: number; reviews: number; experience: number; image: string; tags: string[]; isPartner: boolean }[];
  alsoViewed: { id: string; title: string; price: number; rating?: number; reviewCount?: number; author: string; image: string }[];
}

// ─── Components ─────────────────────────────────────────────

function RadarChart({ scores }: { scores: { label: string; value: number }[] }) {
  const { ref, visible } = useReveal(0.3);
  const cx = 130;
  const cy = 130;
  const r = 95;
  const n = scores.length;
  const total = scores.reduce((sum, s) => sum + s.value * (100 / 5), 0);
  const maxValue = Math.max(...scores.map((s) => s.value));
  const bestIndices = scores.map((s, i) => s.value === maxValue ? i : -1).filter((i) => i >= 0);

  const getPoint = (i: number, scale: number) => {
    const angle = (Math.PI * 2 * i) / n - Math.PI / 2;
    return { x: cx + Math.cos(angle) * r * scale, y: cy + Math.sin(angle) * r * scale };
  };

  const bgPath = scores.map((_, i) => { const p = getPoint(i, 1); return `${i === 0 ? 'M' : 'L'}${p.x},${p.y}`; }).join(' ') + ' Z';
  const dataPath = scores.map((s, i) => { const p = getPoint(i, visible ? s.value / 5 : 0); return `${i === 0 ? 'M' : 'L'}${p.x},${p.y}`; }).join(' ') + ' Z';

  return (
    <div ref={ref} className="bg-gray-50 rounded-2xl p-5 mb-3">
      <div className="flex items-center gap-3">
        {/* Left: total + tags */}
        <div className="flex-1 min-w-0">
          <p className="text-[11px] font-bold text-gray-500">총 포텐셜점수</p>
          <p className="text-[28px] font-bold text-[#3180F7] leading-tight">{Math.round(total)}점</p>
          <div className="flex flex-wrap gap-1.5 mt-3">
            {scores.map((s) => (
              <span key={s.label} className="px-2 h-[26px] rounded-full bg-white text-[10px] font-medium text-gray-600 flex items-center gap-1 shadow-[0_1px_3px_rgba(0,0,0,0.06)]">
                {s.label} <span className="font-bold text-[#3180F7]">{s.value.toFixed(1)}</span>
              </span>
            ))}
          </div>
        </div>

        {/* Right: radar chart SVG */}
        <div className="shrink-0">
          <svg width={160} height={160} viewBox="0 0 260 260" style={{ overflow: 'visible' }}>
            {/* Grid lines */}
            {[0.2, 0.4, 0.6, 0.8, 1].map((scale) => {
              const path = scores.map((_, i) => { const p = getPoint(i, scale); return `${i === 0 ? 'M' : 'L'}${p.x},${p.y}`; }).join(' ') + ' Z';
              return <path key={scale} d={path} fill="none" stroke="#E5E7EB" strokeWidth="0.8" />;
            })}

            {/* Axis lines */}
            {scores.map((_, i) => {
              const p = getPoint(i, 1);
              return <line key={i} x1={cx} y1={cy} x2={p.x} y2={p.y} stroke="#E5E7EB" strokeWidth="0.8" />;
            })}

            {/* Data fill */}
            <path
              d={dataPath}
              fill="rgba(49,128,247,0.2)"
              stroke="#3180F7"
              strokeWidth="2"
              strokeLinejoin="round"
              style={{ transition: 'all 1.2s cubic-bezier(0.22, 1, 0.36, 1)' }}
            />

            {/* Data dots */}
            {scores.map((s, i) => {
              const p = getPoint(i, visible ? s.value / 5 : 0);
              return (
                <circle
                  key={i}
                  cx={p.x}
                  cy={p.y}
                  r={3}
                  fill="#3180F7"
                  style={{ transition: `all 1.2s cubic-bezier(0.22, 1, 0.36, 1) ${i * 80}ms` }}
                />
              );
            })}

            {/* Labels + BEST badge */}
            {scores.map((s, i) => {
              const p = getPoint(i, 1.22);
              const isBest = bestIndices.includes(i);
              return (
                <g key={i}>
                  <text
                    x={p.x}
                    y={p.y}
                    textAnchor="middle"
                    dominantBaseline="middle"
                    className="text-[13px] font-semibold"
                    fill={isBest ? '#1a1a1a' : '#6B7280'}
                  >
                    {s.label}
                  </text>
                  {isBest && visible && (
                    <g style={{ animation: `bestBounce 0.5s cubic-bezier(0.34, 1.56, 0.64, 1) ${0.8 + i * 0.1}s both` }}>
                      <g style={{ animation: 'bestFloat 2s ease-in-out infinite', transformOrigin: `${p.x}px ${p.y - 22}px` }}>
                        <rect x={p.x - 24} y={p.y - 32} width={48} height={22} rx={11} fill="#1a1a1a" />
                        <polygon points={`${p.x - 5},${p.y - 10} ${p.x + 5},${p.y - 10} ${p.x},${p.y - 5}`} fill="#1a1a1a" />
                        <text x={p.x} y={p.y - 21} textAnchor="middle" dominantBaseline="central" fill="white" fontSize="10" fontWeight="700" letterSpacing="0.5">BEST</text>
                      </g>
                    </g>
                  )}
                </g>
              );
            })}
          </svg>
        </div>

      </div>
    </div>
  );
}

function ScoreBars({ items }: { items: { label: string; value: number }[] }) {
  const { ref, visible } = useReveal(0.3);
  return (
    <div ref={ref} className="mb-4">
      <div className="grid grid-cols-2 gap-x-4 gap-y-2">
        {items.map((item, i) => (
          <div key={item.label} className="flex items-center gap-2">
            <span className="text-[12px] text-gray-500 w-14 shrink-0">{item.label}</span>
            <div className="flex-1 h-1.5 bg-gray-100 rounded-full overflow-hidden">
              <div
                className="h-full rounded-full"
                style={{
                  width: visible ? `${(item.value / 5) * 100}%` : '0%',
                  background: 'linear-gradient(90deg, #3180F7, #6BA5FA)',
                  transition: `width 1.2s cubic-bezier(0.22, 1, 0.36, 1) ${i * 150}ms`,
                }}
              />
            </div>
            <span className="text-[12px] font-bold text-gray-900 tabular-nums">{item.value.toFixed(1)}</span>
          </div>
        ))}
      </div>
    </div>
  );
}

// 기존 사회자별 기업로고 매핑 (각 사회자가 함께한 기업)
const PRO_COMPANY_LOGOS: Record<string, string[]> = {
  '1': ['/images/company-logos/ARxaH4OpVaUc1UjpOv2UhQ8hgPGt-JH64gkcWcIAGz4XfVyiy1LAog-99r2v_a3zax4EEZzaMKE5l2tFcQ7i7A.svg', '/images/company-logos/D8d0CAJYg56wMGb2nqUnU5thBBSBSisClhYH5WA_KfgBzdgzgn4Tb-Wd8VtH17Nsal4NkSk9XZ2SwUgLUuhVVg.svg', '/images/company-logos/BRqtD2yZxxRP08TEpNXXNlHvXxtA9Dck7kO4rNAiyud7WyX1EudEU0Y7XpRaIi0eGipOIqU1iZRx06TjD87Bu_8PuSHC-vYi2expOi_ie9INQgZ_8lkfsq7WCiYGssRZvARyM-hmOKkZEOhr4vxl6Q.svg'],
  '2': ['/images/company-logos/EL-GmGKqmm_1_UI1I1HmCwdRis9GIdUfq0tBhZlKnvvB51kv2Wn0hFOfrApbJwh68wKSsYejtF7VN4Htuk2beb2mBOKIBpIM7NphrfKxnZWtfymCW5185hIVDb5q1_GmhJPNTV4GXIWat2Uw7SUHcw.svg', '/images/company-logos/FIN9iKw1Cdlcw0qdsLudvODTjrdndKbpbhu2rrzXy_MHd5LgMZBsbXaErtn_kNzWxM6iTiR7rJlKDcOV0TJ5UO7kwpWLap2PqskFK8q7Lb4kbHzAlpLii3vrpXzQbKneH9d2GEmKXMNl6VrkeepcXQ.svg'],
  '5': ['/images/company-logos/GwHvDSCNafSHnRiZNqDMJOvThTG4_8QJgEFMZC3jlpTg_e_IMR2WWQcB4W641zxOwU219ER8opVMfaK8uhdrl-F69hJn02bChdq-cAheQjLEjDthTLEr4gaXwc4V8ZDNYdfj319zkwONKucgD_G05w.svg', '/images/company-logos/Kl7O19oIwFHCfL2QV05oLVVoL684vmbcbpFHyQCiQRiYr7Dgb18bXQM9qY__l0rm0dlPJKRTqAcwaqRcmvg_m0mVOvVfkrcdjER-1QOvtudPOP8len_6uFgfriIGYpYVBjmCyJ0RAHKe7JjZ1soeWw.svg', '/images/company-logos/BzBaSlPhUQvUgTbep2YBg19b6coNL8iXPJp-BBD6f4z-rfsdylm8zOJnrkRmUWdJoQgJIDNuh7LnNaUeJ_B8Q32S11shONnXjdlQTFLz_5LSzLoW5D7pmuYXc99y6tWUOByfVz00-KNaJ9YAXRk2Eg.svg'],
  '8': ['/images/company-logos/N_7oK9jBqgd4o6MM1imyAIM0lZK2Rsr_oc9HDG8WRllhnrld37ChFRXkVZA5aMK-PSrkr9Y9LBrKuF0mQCMGP09WApahFXbjqTh-Rpw7fYqHkc2f7CKt7xCTc2OG0y1e1LPxvAqnwH4XOpxyWIyMMg.svg', '/images/company-logos/PV5QhQJrjCNrlEkK4HE-Myx-FNqaklavtwzZAzm_tVkUiX5U0kp-Ujm4vqKipQmsZj86CgDo_HVBtEEFgMCWIyrR7zWurNboYJJdW60duDKqWBF0ci_KpyXJ2-goGoXSB2_RmNotjMlducSl0kt_aA.svg', '/images/company-logos/Qqb24ODKcfgDz0dpJRti2CqDr9MThAod9YacFPOKifdbjvhBkviT1LgksZ5bxp92WDj3AsUa0h214Ln6fv3ejj1UxiP4hJfpPfq_u5Ae217Thzzkv3FqP9hDDBDGaNNBHJ1ypWViORlHmkucr_Elng.svg', '/images/company-logos/RDynDFYidWJ6Plgi-NOQnlBIMy3xfHiR0zgdLhyrv0PKCdBdstgmskNWU9s6MZ9iKGqbCRe8kK1zELijChT4yyIT285FNArduGoMzOK6nr3Jia0qu7Prqzk2awOznbMlKYQyxTaA_eSLDVRDyQFZpg.svg'],
  '9': ['/images/company-logos/Fbc3OBO5lnF_aljwIte4mbdQIFVsutSyv5oZ3_JZ5vZ5_Ez_Se0pe47JqRTjOZBqtlFGxYQXYzlG820nGt_M4of6r_OTf2hzjBGAa4UbekunDcLTFOXnG8Moc_cIMDhrABFn_g42rUoQk6FTMBErqg.svg', '/images/company-logos/0kIrqSx6FQ6AZtryR8Rii4lXBGrvITgNfRhhiLfi2aVr-Uqg1l5bOMa4Vi3THlnZYVns6hi5Y75mBhXXS4r6dBfKvn1HPMRq10Gh8NrRBcZE0Pd7zOeDm9WYfDEvAaCZSVD12nCLfeJdkz9WXPnZ3w.svg'],
  '10': ['/images/company-logos/CTCL5r-2Lrik1gBj6n7B0qyIP13vlZUsO_9YpcjuK8Hr8gUiNH33HhuUpwYDmywHYEBZencD5-2p_cJIfunWiqJXR16H5tsIW3hL6qiUK4o3afLmSrpCAf85-c-TDMmsTZRiKr9kWrRUGmMuKFNXlQ.svg', '/images/company-logos/1GPWKc37T7Qz08E07p9sDg0F4rYPxg_qbmh5CSSxrdDTQoy6hCl6k-UgoySwKANqEm0jCWiZjyMqaLUxX31_3RyRiW1yQ2L5zYtA6WzN7s5Zxy31rQSDGIotP0yP2rU6jhAVfxvxFl__q_NPEuRKAg.svg', '/images/company-logos/4nJH1a9BfVA9ilPdwu120VbDd-ERloXHcOus1u88Xhvpql-0zhgPSW9dj3zZKGKlGVEfqJwFPQLWwtXGYmft8KGikSA2N0n3yojcWKfrmKWyZ3dLtYmBFcKkeTn8CDL7HarNcbkEmB8AYP76lHFDTg.svg'],
  '12': ['/images/company-logos/5bZLn7_cvlKQnqzT0_0hMSHeq0y1K-YgT4X40IT9qxQClHZTU3fHCuuIyI7JSjm7MmtDrWs1KBx7VtHyTk4rrbhhAhWa-EpxfAJwkoVV9vrn7DLNFlXNy6zNfET5B7ohb0ULDDwO99agnC9QOW7lKA.svg', '/images/company-logos/7JPcHcbSryZEH9UhI0PnkdfR30SZvvoSyV7ynaBncTLEwBYWfUrG4IdzrpmjvAKS2a06vY7ReLjl6MGktfk6NaRQrN-tHBcs3GbLIDJ4x5s_O4NXZYGeNFUdkjS5iJJidsmP7fXHqWo7RlGL9mbNgg.svg', '/images/company-logos/7K5Bmcq7qiQ6Eud7OD2A2hTmRHTxkShb8lmf3EVD4alegph6WnxOEzfOYxM0LDCXkfT_vVZ9_Hjk_XXaRJlTsMPB9epfyN8kUFonEnB4GTiHlonXo_oKqJs4AR9MJhtmsVX8j90IdFvH1Ujko6XLOQ.svg'],
  '13': ['/images/company-logos/8iC8ebMvPPfZeTUkj9VBmsrPUw4lPJp9ITlR115EWv0ULvgo-S_CtNWa2TNlKwzqNS_KGPNo6xFnF_UxcRLylG-HIYXXoRmhDQUjoZvi8kTTM3-1l5hd558xNYS5PlZxUCI3j1XXJbcotsBxfHIeNQ.svg', '/images/company-logos/Fbe6yAmPhTGyBpbFnJrzWROlvct5aNx2TBIUKqyiunO_iZdfvBKbFzh7FVPmqRQpeRfEKA-pz-QeTLTsfVj7NxKMy8mEN8NUKbf9r0p4VlGyHGibJqXQKEBS-4NE0QWMgj4CvofMTvCYXMovp3WWNg.svg'],
  '15': ['/images/company-logos/ARxaH4OpVaUc1UjpOv2UhQ8hgPGt-JH64gkcWcIAGz4XfVyiy1LAog-99r2v_a3zax4EEZzaMKE5l2tFcQ7i7A.svg', '/images/company-logos/D8d0CAJYg56wMGb2nqUnU5thBBSBSisClhYH5WA_KfgBzdgzgn4Tb-Wd8VtH17Nsal4NkSk9XZ2SwUgLUuhVVg.svg', '/images/company-logos/EL-GmGKqmm_1_UI1I1HmCwdRis9GIdUfq0tBhZlKnvvB51kv2Wn0hFOfrApbJwh68wKSsYejtF7VN4Htuk2beb2mBOKIBpIM7NphrfKxnZWtfymCW5185hIVDb5q1_GmhJPNTV4GXIWat2Uw7SUHcw.svg', '/images/company-logos/GwHvDSCNafSHnRiZNqDMJOvThTG4_8QJgEFMZC3jlpTg_e_IMR2WWQcB4W641zxOwU219ER8opVMfaK8uhdrl-F69hJn02bChdq-cAheQjLEjDthTLEr4gaXwc4V8ZDNYdfj319zkwONKucgD_G05w.svg'],
  '23': ['/images/company-logos/BRqtD2yZxxRP08TEpNXXNlHvXxtA9Dck7kO4rNAiyud7WyX1EudEU0Y7XpRaIi0eGipOIqU1iZRx06TjD87Bu_8PuSHC-vYi2expOi_ie9INQgZ_8lkfsq7WCiYGssRZvARyM-hmOKkZEOhr4vxl6Q.svg', '/images/company-logos/FIN9iKw1Cdlcw0qdsLudvODTjrdndKbpbhu2rrzXy_MHd5LgMZBsbXaErtn_kNzWxM6iTiR7rJlKDcOV0TJ5UO7kwpWLap2PqskFK8q7Lb4kbHzAlpLii3vrpXzQbKneH9d2GEmKXMNl6VrkeepcXQ.svg'],
  '24': ['/images/company-logos/Kl7O19oIwFHCfL2QV05oLVVoL684vmbcbpFHyQCiQRiYr7Dgb18bXQM9qY__l0rm0dlPJKRTqAcwaqRcmvg_m0mVOvVfkrcdjER-1QOvtudPOP8len_6uFgfriIGYpYVBjmCyJ0RAHKe7JjZ1soeWw.svg', '/images/company-logos/N_7oK9jBqgd4o6MM1imyAIM0lZK2Rsr_oc9HDG8WRllhnrld37ChFRXkVZA5aMK-PSrkr9Y9LBrKuF0mQCMGP09WApahFXbjqTh-Rpw7fYqHkc2f7CKt7xCTc2OG0y1e1LPxvAqnwH4XOpxyWIyMMg.svg', '/images/company-logos/PV5QhQJrjCNrlEkK4HE-Myx-FNqaklavtwzZAzm_tVkUiX5U0kp-Ujm4vqKipQmsZj86CgDo_HVBtEEFgMCWIyrR7zWurNboYJJdW60duDKqWBF0ci_KpyXJ2-goGoXSB2_RmNotjMlducSl0kt_aA.svg'],
  '25': ['/images/company-logos/Qqb24ODKcfgDz0dpJRti2CqDr9MThAod9YacFPOKifdbjvhBkviT1LgksZ5bxp92WDj3AsUa0h214Ln6fv3ejj1UxiP4hJfpPfq_u5Ae217Thzzkv3FqP9hDDBDGaNNBHJ1ypWViORlHmkucr_Elng.svg', '/images/company-logos/RDynDFYidWJ6Plgi-NOQnlBIMy3xfHiR0zgdLhyrv0PKCdBdstgmskNWU9s6MZ9iKGqbCRe8kK1zELijChT4yyIT285FNArduGoMzOK6nr3Jia0qu7Prqzk2awOznbMlKYQyxTaA_eSLDVRDyQFZpg.svg', '/images/company-logos/BzBaSlPhUQvUgTbep2YBg19b6coNL8iXPJp-BBD6f4z-rfsdylm8zOJnrkRmUWdJoQgJIDNuh7LnNaUeJ_B8Q32S11shONnXjdlQTFLz_5LSzLoW5D7pmuYXc99y6tWUOByfVz00-KNaJ9YAXRk2Eg.svg'],
  '31': ['/images/company-logos/0kIrqSx6FQ6AZtryR8Rii4lXBGrvITgNfRhhiLfi2aVr-Uqg1l5bOMa4Vi3THlnZYVns6hi5Y75mBhXXS4r6dBfKvn1HPMRq10Gh8NrRBcZE0Pd7zOeDm9WYfDEvAaCZSVD12nCLfeJdkz9WXPnZ3w.svg', '/images/company-logos/CTCL5r-2Lrik1gBj6n7B0qyIP13vlZUsO_9YpcjuK8Hr8gUiNH33HhuUpwYDmywHYEBZencD5-2p_cJIfunWiqJXR16H5tsIW3hL6qiUK4o3afLmSrpCAf85-c-TDMmsTZRiKr9kWrRUGmMuKFNXlQ.svg', '/images/company-logos/Fbc3OBO5lnF_aljwIte4mbdQIFVsutSyv5oZ3_JZ5vZ5_Ez_Se0pe47JqRTjOZBqtlFGxYQXYzlG820nGt_M4of6r_OTf2hzjBGAa4UbekunDcLTFOXnG8Moc_cIMDhrABFn_g42rUoQk6FTMBErqg.svg'],
  '34': ['/images/company-logos/1GPWKc37T7Qz08E07p9sDg0F4rYPxg_qbmh5CSSxrdDTQoy6hCl6k-UgoySwKANqEm0jCWiZjyMqaLUxX31_3RyRiW1yQ2L5zYtA6WzN7s5Zxy31rQSDGIotP0yP2rU6jhAVfxvxFl__q_NPEuRKAg.svg', '/images/company-logos/4nJH1a9BfVA9ilPdwu120VbDd-ERloXHcOus1u88Xhvpql-0zhgPSW9dj3zZKGKlGVEfqJwFPQLWwtXGYmft8KGikSA2N0n3yojcWKfrmKWyZ3dLtYmBFcKkeTn8CDL7HarNcbkEmB8AYP76lHFDTg.svg'],
  '35': ['/images/company-logos/5bZLn7_cvlKQnqzT0_0hMSHeq0y1K-YgT4X40IT9qxQClHZTU3fHCuuIyI7JSjm7MmtDrWs1KBx7VtHyTk4rrbhhAhWa-EpxfAJwkoVV9vrn7DLNFlXNy6zNfET5B7ohb0ULDDwO99agnC9QOW7lKA.svg', '/images/company-logos/7JPcHcbSryZEH9UhI0PnkdfR30SZvvoSyV7ynaBncTLEwBYWfUrG4IdzrpmjvAKS2a06vY7ReLjl6MGktfk6NaRQrN-tHBcs3GbLIDJ4x5s_O4NXZYGeNFUdkjS5iJJidsmP7fXHqWo7RlGL9mbNgg.svg', '/images/company-logos/8iC8ebMvPPfZeTUkj9VBmsrPUw4lPJp9ITlR115EWv0ULvgo-S_CtNWa2TNlKwzqNS_KGPNo6xFnF_UxcRLylG-HIYXXoRmhDQUjoZvi8kTTM3-1l5hd558xNYS5PlZxUCI3j1XXJbcotsBxfHIeNQ.svg'],
  '37': ['/images/company-logos/ARxaH4OpVaUc1UjpOv2UhQ8hgPGt-JH64gkcWcIAGz4XfVyiy1LAog-99r2v_a3zax4EEZzaMKE5l2tFcQ7i7A.svg', '/images/company-logos/Fbe6yAmPhTGyBpbFnJrzWROlvct5aNx2TBIUKqyiunO_iZdfvBKbFzh7FVPmqRQpeRfEKA-pz-QeTLTsfVj7NxKMy8mEN8NUKbf9r0p4VlGyHGibJqXQKEBS-4NE0QWMgj4CvofMTvCYXMovp3WWNg.svg'],
  '38': ['/images/company-logos/D8d0CAJYg56wMGb2nqUnU5thBBSBSisClhYH5WA_KfgBzdgzgn4Tb-Wd8VtH17Nsal4NkSk9XZ2SwUgLUuhVVg.svg', '/images/company-logos/GwHvDSCNafSHnRiZNqDMJOvThTG4_8QJgEFMZC3jlpTg_e_IMR2WWQcB4W641zxOwU219ER8opVMfaK8uhdrl-F69hJn02bChdq-cAheQjLEjDthTLEr4gaXwc4V8ZDNYdfj319zkwONKucgD_G05w.svg', '/images/company-logos/Kl7O19oIwFHCfL2QV05oLVVoL684vmbcbpFHyQCiQRiYr7Dgb18bXQM9qY__l0rm0dlPJKRTqAcwaqRcmvg_m0mVOvVfkrcdjER-1QOvtudPOP8len_6uFgfriIGYpYVBjmCyJ0RAHKe7JjZ1soeWw.svg'],
};

function CompanyLogoCarousel({ proId }: { proId?: string }) {
  const [logos, setLogos] = useState<string[]>([]);
  useEffect(() => {
    // 1. 해당 프로의 매핑된 로고 확인
    if (proId && PRO_COMPANY_LOGOS[proId]) {
      setLogos(PRO_COMPANY_LOGOS[proId]);
      return;
    }
    // 2. 본인 프로필 페이지일 때만 localStorage에서 읽기 (my-pro 또는 내 프로 ID인 경우)
    const isOwnProfile = proId === 'my-pro';
    if (!isOwnProfile) {
      setLogos([]);
      return;
    }
    try {
      const saved = localStorage.getItem('proRegister_companyLogos');
      if (saved) {
        const parsed = JSON.parse(saved);
        if (Array.isArray(parsed) && parsed.length > 0 && typeof parsed[0] === 'string' && parsed[0].startsWith('/images/')) {
          setLogos(parsed);
        }
      }
    } catch {}
  }, [proId]);

  if (logos.length === 0) return null;

  const repeated = [...logos, ...logos, ...logos];

  return (
    <div className="overflow-hidden mb-4 -mx-2.5 px-2.5">
      <div
        className="flex items-center gap-5"
        style={{
          width: 'max-content',
          animation: `logoScroll ${logos.length * 3}s linear infinite`,
        }}
      >
        {repeated.map((logo, i) => (
          <div key={i} className="shrink-0 h-[28px] w-[72px] flex items-center justify-center opacity-40 grayscale">
            <img src={encodeURI(logo)} alt="" className="max-h-full max-w-full object-contain" />
          </div>
        ))}
      </div>
      <style>{`@keyframes logoScroll { 0% { transform: translateX(0); } 100% { transform: translateX(-${logos.length * 92}px); } }`}</style>
    </div>
  );
}

function StarRating({ value, size = 14 }: { value: number; size?: number }) {
  return (
    <div className="flex items-center gap-0" style={{ fontSize: size }}>
      {[0, 1, 2, 3, 4].map((i) => (
        <svg key={i} width={size} height={size} viewBox="0 0 24 24" fill={i < Math.floor(value) ? BRAND : '#E5E7EB'}>
          <path d="M12 2l2.9 6.5 7.1.8-5.3 4.9 1.5 7L12 17.8 5.8 21.2l1.5-7L2 9.3l7.1-.8L12 2z" />
        </svg>
      ))}
    </div>
  );
}


// ─── Page ───────────────────────────────────────────────────

export default function ProDetailPage() {
  const { id } = useParams<{ id: string }>();
  const router = useRouter();
  const [pro, setPro] = useState<ProDetailData | null>(null);
  const [apiError, setApiError] = useState(false);
  const [apiLoading, setApiLoading] = useState(true);

  // API에서 전문가 상세 데이터 가져오기
  useEffect(() => {
    if (!id) return;

    // 'my-pro' special case: localStorage에서 등록된 사회자
    if (id === 'my-pro') {
      try {
        const name = localStorage.getItem('proRegister_name') || '전문가';
        const photos = JSON.parse(localStorage.getItem('proRegister_photos') || '[]');
        const mainPhotoIndex = parseInt(localStorage.getItem('proRegister_mainPhotoIndex') || '0') || 0;
        const intro = localStorage.getItem('proRegister_intro') || '프리티풀 인증 전문가';
        const career = localStorage.getItem('proRegister_career') || '';
        const careerYears = parseInt(localStorage.getItem('proRegister_careerYears') || '1');
        // 영상 목록: proRegister_videos 배열 우선, 없으면 단일 URL fallback
        let videoUrls: string[] = [];
        try {
          const vs = JSON.parse(localStorage.getItem('proRegister_videos') || '[]');
          if (Array.isArray(vs)) videoUrls = vs.filter(Boolean);
        } catch {}
        if (videoUrls.length === 0) {
          const single = localStorage.getItem('proRegister_youtubeUrl') || localStorage.getItem('proRegister_videoUrl') || '';
          if (single) videoUrls = [single];
        }
        const ytIds = videoUrls.map((u) => extractYoutubeId(u)).filter(Boolean) as string[];
        const ytId = ytIds[0];
        const allImages = photos.length > 0 ? photos : ['/images/placeholder.avif'];

        setPro({
          id: 'my-pro',
          name,
          profileImage: allImages[mainPhotoIndex] || allImages[0],
          mainImage: allImages[0],
          images: allImages,
          title: `사회자 ${name}`,
          isPrime: true,
          youtubeId: ytId,
          youtubeVideos: ytIds.map((id, i) => ({ id, title: `${name} 사회자 진행 영상 ${i + 1}` })),
          rating: 5.0,
          reviewCount: 0,
          plans: [
            { id: 'premium', label: 'Premium', price: 450000, duration: '1시간', title: '행사 1시간 진행', desc: ['사회 진행', '사전 미팅'], workDays: 14, revisions: 1 },
            { id: 'superior', label: 'Superior', price: 800000, duration: '2시간', title: '행사 2시간 진행', desc: ['사회 진행', '사전 미팅', '대본 작성', '리허설 참석', '포토타임 진행', '영상 큐시트 관리'], workDays: 14, revisions: 2 },
            { id: 'enterprise', label: 'Enterprise', price: 1700000, duration: '6시간', title: '6시간 풀타임 진행', desc: ['사회 진행', '사전 미팅', '대본 작성', '리허설 참석', '축사/건배사 코디', '포토타임 진행', '하객 응대 안내', '2차 진행', '영상 큐시트 관리', '전담 코디네이터'], workDays: 14, revisions: 3 },
          ],
          description: `안녕하세요. 사회자 ${name}입니다.\n\n${intro}\n\n${career ? `주요 경력:\n• ${career.split('/').map((s: string) => s.trim()).join('\n• ')}` : ''}`,
          expertStats: {
            totalDeals: careerYears * 8 + 10,
            satisfaction: 100,
            memberType: '기업',
            taxInvoice: '프리티풀 발행',
            responseTime: '1시간 이내',
            contactTime: '언제나 가능',
          },
          reviews: [],
          recommendedPros: [],
          alsoViewed: [],
        });
        setApiLoading(false);
        return;
      } catch {
        setApiError(true);
        setApiLoading(false);
        return;
      }
    }

    // API에서 실제 데이터 로드 (pro detail + recommended pros 병렬)
    // 본인 프로 페이지면 항상 최신 데이터 로드 (캐시 스킵)
    const myProId = typeof window !== 'undefined' ? localStorage.getItem('freetiful-my-pro-id') : null;
    const skipCache = myProId === id;
    Promise.all([
      discoveryApi.getProDetail(id, skipCache),
      discoveryApi.getProList({ limit: 9, sort: 'rating' }),
    ])
      .then(([res, proListRes]: [any, any]) => {
        if (!res) {
          setApiError(true);
          return;
        }
        try {
        const userName = res.user?.name || '전문가';
        const images = res.images?.map((img: any) => img.imageUrl) || [];
        const profileImg = res.user?.profileImageUrl || images[0] || '';
        const ytId = extractYoutubeId(res.youtubeUrl);
        const services = res.services || [];
        const PLAN_META_MAP: Record<string, { label: string; duration: string; revisions: number; defaultDesc: string[] }> = {
          premium: { label: 'Premium', duration: '1시간', revisions: 1, defaultDesc: ['사회 진행', '사전 미팅'] },
          superior: { label: 'Superior', duration: '2시간', revisions: 2, defaultDesc: ['사회 진행', '사전 미팅', '대본 작성', '리허설 참석', '포토타임 진행', '영상 큐시트 관리'] },
          enterprise: { label: 'Enterprise', duration: '6시간', revisions: 3, defaultDesc: ['사회 진행', '사전 미팅', '대본 작성', '리허설 참석', '축사/건배사 코디', '포토타임 진행', '하객 응대 안내', '2차 진행', '영상 큐시트 관리', '전담 코디네이터'] },
          test: { label: 'Test', duration: '테스트', revisions: 1, defaultDesc: ['테스트 서비스'] },
        };
        // API에 등록된 services만 표시 (없으면 빈 배열 — mock 데이터 없음)
        const plans = services.map((s: any, idx: number) => {
          const key = (s.title || '').toLowerCase();
          const meta = PLAN_META_MAP[key] || { label: s.title || `옵션 ${idx + 1}`, duration: '', revisions: idx + 1, defaultDesc: ['사회 진행'] };
          return {
            id: s.id || key || `svc-${idx}`,
            label: meta.label,
            price: s.basePrice || 0,
            duration: meta.duration,
            title: s.description || `${meta.label} 서비스`,
            desc: s.description ? s.description.split('\n').filter(Boolean) : meta.defaultDesc,
            workDays: 14,
            revisions: meta.revisions,
          };
        });

        const reviews = (res.reviews || []).map((r: any) => ({
          id: r.id,
          name: r.isAnonymous ? '익명' : (r.reviewer?.name ? r.reviewer.name.slice(0, 2) + '********' : '고객'),
          rating: Number(r.avgRating) || 5.0,
          date: new Date(r.createdAt).toLocaleDateString('ko-KR', { year: '2-digit', month: '2-digit', day: '2-digit' }),
          scores: {
            경력: r.ratingExperience,
            만족도: r.ratingSatisfaction,
            구성력: r.ratingComposition,
            위트: r.ratingWit,
            발성: r.ratingVoice,
            이미지: r.ratingAppearance,
          },
          content: r.comment || '',
          workDays: 14,
          orderRange: '협의',
          proReply: r.proReply ? { date: r.proRepliedAt ? new Date(r.proRepliedAt).toLocaleDateString('ko-KR', { year: '2-digit', month: '2-digit', day: '2-digit' }) : '', content: r.proReply } : undefined,
        }));

        const descParts = [
          `안녕하세요. 사회자 ${userName}입니다.`,
          res.shortIntro ? `\n${res.shortIntro}` : '',
          res.mainExperience ? `\n\n주요 경력:\n• ${res.mainExperience.split('/').map((s: string) => s.trim()).join('\n• ')}` : '',
          res.detailHtml || '',
        ].filter(Boolean).join('');

        setPro({
          id: res.id,
          name: userName,
          profileImage: profileImg,
          mainImage: images[0] || profileImg,
          images: images.length > 0 ? images : [profileImg].filter(Boolean),
          title: `사회자 ${userName}`,
          isPrime: res.isFeatured || res.showPartnersLogo || false,
          youtubeId: ytId,
          youtubeVideos: ytId ? [{ id: ytId, title: `${userName} 사회자 진행 영상` }] : [],
          rating: res.avgRating || 0,
          reviewCount: res.reviewCount || 0,
          plans,
          description: descParts,
          expertStats: {
            totalDeals: res.reviewCount || 0,
            satisfaction: res.avgRating ? Math.round((res.avgRating / 5) * 100) : 0,
            memberType: '기업',
            taxInvoice: '프리티풀 발행',
            responseTime: res.responseRate ? `${res.responseRate}시간 이내` : '1시간 이내',
            contactTime: '언제나 가능',
          },
          reviews,
          recommendedPros: (proListRes?.data || [])
            .filter((p: any) => p.id !== res.id)
            .slice(0, 6)
            .map((p: any) => ({
              id: p.id,
              name: p.name,
              role: '사회자',
              rating: p.avgRating,
              reviews: p.reviewCount,
              experience: p.careerYears,
              image: p.images?.[0] || p.profileImageUrl || '',
              tags: p.shortIntro ? p.shortIntro.split(' ').slice(0, 3) : [],
              isPartner: p.isFeatured,
            })),
          alsoViewed: [],
        });
        } catch (mapErr) {
          console.error('ProDetail mapping error:', mapErr);
          setApiError(true);
        }
      })
      .catch((err) => {
        console.error('ProDetail load error:', err);
        setApiError(true);
      })
      .finally(() => setApiLoading(false));
  }, [id]);

  const [activeImage, setActiveImage] = useState(0);
  const [activePlan, setActivePlan] = useState(() => {
    return (pro?.plans?.length || 0) > 1 ? 1 : 0;
  });
  const [activeSection, setActiveSection] = useState<'desc' | 'info' | 'reviews'>('desc');
  const [headerSolid, setHeaderSolid] = useState(false);
  const [scrollY, setScrollY] = useState(0);
  const authUser = useAuthStore((s) => s.user);
  const [isFavorited, setIsFavorited] = useState(() => {
    try {
      const stored: string[] = JSON.parse(localStorage.getItem('freetiful-favorites') || '[]');
      return stored.includes(id);
    } catch { return false; }
  });

  // Check favorite status from API
  useEffect(() => {
    if (authUser && id) {
      favoriteApi.check(id).then((res) => setIsFavorited(res.isFavorited)).catch(() => {});
    }
  }, [authUser, id]);

  // Pre-warm chat room + 메시지까지 백그라운드에서 미리 로드 + chat 라우트 prefetch
  useEffect(() => {
    if (!authUser || !id || id === 'my-pro') return;
    const pre = preWarmChat(id);
    // createRoom 끝나면 실제 /chat/[roomId] 번들도 prefetch
    pre.roomIdPromise?.then((rid) => {
      if (rid) router.prefetch(`/chat/${rid}`);
    });
  }, [authUser, id, router]);
  const [openingChat, setOpeningChat] = useState(false);
  const [descExpanded, setDescExpanded] = useState(false);
  const [showTooltip, setShowTooltip] = useState(true);
  const [expandedPanel, setExpandedPanel] = useState<string | null>(null);
  const [favoriteItems, setFavoriteItems] = useState<Set<string>>(new Set());
  const [imageModal, setImageModal] = useState<string | null>(null);
  const [showDoubleTapHeart, setShowDoubleTapHeart] = useState(false);
  const lastTapRef = useRef(0);
  const [shareModal, setShareModal] = useState(false);
  const [purchaseModal, setPurchaseModal] = useState(false);
  const [reviewsModal, setReviewsModal] = useState(false);
  const [phoneModal, setPhoneModal] = useState(false);
  const [loginModal, setLoginModal] = useState(false);
  const [reviewMenu, setReviewMenu] = useState<string | null>(null);

  const descRef = useRef<HTMLDivElement>(null);
  const infoRef = useRef<HTMLDivElement>(null);
  const reviewsRef = useRef<HTMLDivElement>(null);
  const galleryRef = useRef<HTMLDivElement>(null);
  const touchStartX = useRef<number | null>(null);

  const plan = pro?.plans?.[activePlan] ?? { id: 'premium', label: 'Premium', price: 450000, duration: '1시간', title: '행사 1시간 진행', desc: ['사회 진행'], workDays: 14, revisions: 1 };

  // 방문 기록 저장
  useEffect(() => {
    try {
      const key = 'viewed-pros';
      const stored = JSON.parse(localStorage.getItem(key) || '[]') as { id: string; time: number }[];
      const filtered = stored.filter((v) => v.id !== id);
      filtered.unshift({ id, time: Date.now() });
      localStorage.setItem(key, JSON.stringify(filtered.slice(0, 20)));
    } catch {}
  }, [id]);

  // Active section auto-tracking on scroll + header solid bg
  useEffect(() => {
    const sections: Array<{ id: 'desc' | 'info' | 'reviews'; ref: React.RefObject<HTMLDivElement> }> = [
      { id: 'desc', ref: descRef },
      { id: 'info', ref: infoRef },
      { id: 'reviews', ref: reviewsRef },
    ];
    const onScroll = () => {
      const scrollY = window.scrollY + 120;
      let current: 'desc' | 'info' | 'reviews' = 'desc';
      sections.forEach(({ id, ref }) => {
        if (ref.current && ref.current.offsetTop <= scrollY) current = id;
      });
      setActiveSection(current);
      setScrollY(window.scrollY);
      // Solid header when gallery's bottom passes the top of viewport
      if (galleryRef.current) {
        const galleryBottom = galleryRef.current.offsetTop + galleryRef.current.offsetHeight;
        setHeaderSolid(window.scrollY > galleryBottom - 60);
      }
    };
    window.addEventListener('scroll', onScroll, { passive: true });
    return () => window.removeEventListener('scroll', onScroll);
  }, []);

  // Body scroll lock when modals open
  useEffect(() => {
    const anyModal = imageModal || shareModal || purchaseModal || reviewsModal || phoneModal;
    if (anyModal) document.body.style.overflow = 'hidden';
    else document.body.style.overflow = '';
    return () => { document.body.style.overflow = ''; };
  }, [imageModal, shareModal, purchaseModal, reviewsModal, phoneModal]);

  // Toggle carousel favorite
  const toggleCarouselFav = (id: string) => {
    setFavoriteItems((prev) => {
      const next = new Set(prev);
      if (next.has(id)) {
        next.delete(id);
        toast('찜 해제', { icon: '💙' });
      } else {
        next.add(id);
        toast('찜 목록에 추가됨', { icon: '❤️' });
      }
      return next;
    });
  };

  // Handlers
  const handleShare = async () => {
    if (typeof navigator !== 'undefined' && navigator.share) {
      try {
        await navigator.share({ title: pro?.title || '', url: window.location.href });
      } catch {
        setShareModal(true);
      }
    } else {
      setShareModal(true);
    }
  };

  const handleCopyLink = () => {
    if (typeof navigator !== 'undefined') {
      navigator.clipboard.writeText(window.location.href);
      toast.success('링크가 복사되었습니다');
      setShareModal(false);
    }
  };

  const handleToggleFavorite = () => {
    setIsFavorited((v) => {
      const newVal = !v;
      toast(v ? '찜 해제' : '찜 목록에 추가됨', { icon: v ? '💙' : '❤️' });
      // Sync to API
      if (authUser) {
        favoriteApi.toggle(pro?.id || id).catch(() => {});
      }
      try {
        const stored: string[] = JSON.parse(localStorage.getItem('freetiful-favorites') || '[]');
        if (newVal) {
          if (!stored.includes(pro?.id || id)) stored.push(pro?.id || id);
        } else {
          const idx = stored.indexOf(pro?.id || id);
          if (idx !== -1) stored.splice(idx, 1);
        }
        localStorage.setItem('freetiful-favorites', JSON.stringify(stored));
      } catch {}
      return newVal;
    });
  };

  const handlePurchase = () => {
    router.push(`/pros/${pro?.id || id}/booking`);
  };

  const confirmPurchase = () => {
    setPurchaseModal(false);
    router.push(`/pros/${pro?.id || id}/booking`);
  };

  const scrollToSection = (section: 'desc' | 'info' | 'reviews') => {
    setActiveSection(section);
    const target = section === 'desc' ? descRef.current : section === 'info' ? infoRef.current : reviewsRef.current;
    if (target) {
      const y = target.getBoundingClientRect().top + window.scrollY - 100;
      window.scrollTo({ top: y, behavior: 'smooth' });
    }
  };

  // Error state: 전문가를 찾을 수 없습니다
  if (apiError) {
    return (
      <div className="bg-white min-h-screen flex flex-col items-center justify-center" style={{ letterSpacing: '-0.02em' }}>
        <div className="text-center px-6">
          <div className="w-16 h-16 rounded-full bg-gray-100 flex items-center justify-center mx-auto mb-4">
            <ChevronLeft size={28} className="text-gray-400" />
          </div>
          <h2 className="text-[20px] font-bold text-gray-900 mb-2">전문가를 찾을 수 없습니다</h2>
          <p className="text-[14px] text-gray-500 mb-6">요청하신 전문가 정보를 불러올 수 없습니다.<br />다시 시도해 주세요.</p>
          <button
            onClick={() => router.back()}
            className="px-6 py-3 bg-[#3180F7] text-white font-semibold rounded-xl active:scale-95 transition-transform"
          >
            돌아가기
          </button>
        </div>
      </div>
    );
  }

  if (apiLoading || !pro) {
    return (
      <div className="bg-white min-h-screen" style={{ letterSpacing: '-0.02em' }}>
        {/* Gallery skeleton */}
        <div className="skeleton" style={{ width: '100%', aspectRatio: '1/1', borderRadius: 0 }} />
        {/* Info skeleton */}
        <div className="px-4 pt-4">
          <div className="skeleton mb-2" style={{ width: 60, height: 20, borderRadius: 10 }} />
          <div className="skeleton mb-2" style={{ width: '80%', height: 22 }} />
          <div className="skeleton mb-3" style={{ width: '50%', height: 14 }} />
          <div className="skeleton mb-2" style={{ width: '60%', height: 28 }} />
          <div className="flex gap-2 mt-4 mb-4">
            {[1, 2, 3].map((i) => (
              <div key={i} className="skeleton" style={{ width: 70, height: 32, borderRadius: 16 }} />
            ))}
          </div>
          <div className="skeleton mb-2" style={{ width: '100%', height: 100 }} />
          <div className="skeleton mb-2" style={{ width: '100%', height: 100 }} />
        </div>
      </div>
    );
  }

  return (
    <div className="bg-white pb-24" style={{ letterSpacing: '-0.02em' }}>
      {/* ─── Top Header (Floating → Solid with thumbnail on scroll) ─── */}
      <div
        className={`fixed top-0 left-0 right-0 z-40 flex items-center gap-2 px-3 transition-all duration-300 ${
          headerSolid ? 'bg-white border-b border-gray-100 h-[60px] py-0' : 'justify-between pt-3 pb-3 px-4'
        }`}
      >
        <button
          onClick={() => router.back()}
          className={`flex items-center justify-center shrink-0 active:scale-90 transition-all ${
            headerSolid
              ? 'w-9 h-9 text-gray-900'
              : 'w-9 h-9 rounded-full bg-white/90 backdrop-blur-md shadow-sm'
          }`}
        >
          <ChevronLeft size={22} className="text-gray-900" />
        </button>

        {/* Scrolled state: Thumbnail + Title + Price */}
        <div
          className={`flex-1 min-w-0 flex items-center gap-2.5 transition-all duration-300 ${
            headerSolid ? 'opacity-100' : 'opacity-0 pointer-events-none'
          }`}
          style={{
            transform: headerSolid ? 'translateY(0)' : 'translateY(6px)',
          }}
        >
          <img
            src={pro.images[0]}
            alt=""
            className="w-10 h-10 rounded-xl object-cover shrink-0"
          />
          <div className="min-w-0 flex-1">
            <p className="text-[13px] font-bold text-gray-900 truncate leading-tight">
              <span className="text-[#3180F7]">{(pro.plans[activePlan] || pro.plans[0])?.label}</span> {pro.title}
            </p>
            <p className="text-[12px] leading-tight mt-0.5">
              <span className="font-bold text-gray-900">{((pro.plans[activePlan] || pro.plans[0])?.price || 0).toLocaleString()}원</span>
              <span className="text-gray-400 ml-1">(VAT 포함)</span>
            </p>
          </div>
        </div>

        <div className={`flex items-center gap-2 shrink-0 ${headerSolid ? '' : 'ml-auto'}`}>
          <button
            onClick={handleShare}
            className={`flex items-center justify-center active:scale-90 transition-all ${
              headerSolid
                ? 'w-9 h-9 text-gray-900'
                : 'w-9 h-9 rounded-full bg-white/90 backdrop-blur-md shadow-sm'
            }`}
          >
            <Share2 size={18} className="text-gray-900" />
          </button>
        </div>
      </div>

      {/* ─── Image Gallery with swipe ─── */}
      <div
        ref={galleryRef}
        className="relative w-full aspect-square bg-gray-100 overflow-hidden"
        onTouchStart={(e) => { touchStartX.current = e.touches[0].clientX; }}
        onTouchEnd={(e) => {
          if (touchStartX.current === null) return;
          const dx = e.changedTouches[0].clientX - touchStartX.current;
          if (dx > 50) setActiveImage((i) => Math.max(0, i - 1));
          if (dx < -50) setActiveImage((i) => Math.min(pro.images.length - 1, i + 1));
          touchStartX.current = null;
        }}
      >
        {/* Parallax wrapper: shrinks + moves up on scroll */}
        <div
          className="absolute inset-0 will-change-transform"
          style={{
            transform: `translateY(${scrollY * 0.35}px) scale(${Math.max(0.88, 1 - scrollY / 1600)})`,
            transformOrigin: 'center center',
            opacity: Math.max(0, 1 - scrollY / 600),
          }}
        >
          <div
            className="flex h-full transition-transform duration-[600ms] will-change-transform"
            style={{
              transform: `translateX(-${activeImage * 100}%)`,
              transitionTimingFunction: 'cubic-bezier(0.16, 1, 0.3, 1)',
            }}
          >
            {pro.images.map((src, i) => (
              <button
                key={i}
                onClick={() => {
                  const now = Date.now();
                  if (now - lastTapRef.current < 300) {
                    // Double tap → favorite
                    if (!isFavorited) setIsFavorited(true);
                    setShowDoubleTapHeart(true);
                    setTimeout(() => setShowDoubleTapHeart(false), 900);
                    lastTapRef.current = 0;
                  } else {
                    lastTapRef.current = now;
                  }
                }}
                className="relative w-full h-full shrink-0 block"
              >
                <Image src={src} alt={pro.name} fill className="object-cover" priority={i === 0} />
              </button>
            ))}
          </div>
        </div>

        {/* Double-tap heart overlay */}
        {showDoubleTapHeart && (
          <div className="absolute inset-0 flex items-center justify-center pointer-events-none z-20">
            <Heart
              size={80}
              className="fill-white text-white drop-shadow-lg"
              style={{ animation: 'doubleTapHeart 0.9s cubic-bezier(0.34, 1.56, 0.64, 1) forwards' }}
            />
          </div>
        )}

        {/* Page indicator */}
        <div className="absolute bottom-4 right-4 bg-black/60 text-white text-[12px] font-medium px-2.5 py-1 rounded-full backdrop-blur-sm">
          {activeImage + 1} / {pro.images.length}
        </div>

        {/* Dot navigation */}
        <div className="absolute bottom-4 left-1/2 -translate-x-1/2 flex gap-1.5">
          {pro.images.map((_, i) => (
            <button
              key={i}
              onClick={() => setActiveImage(i)}
              className="rounded-full transition-all duration-500"
              style={{
                width: i === activeImage ? 22 : 6,
                height: 6,
                backgroundColor: i === activeImage ? 'white' : 'rgba(255,255,255,0.5)',
                transitionTimingFunction: 'cubic-bezier(0.22, 1, 0.36, 1)',
              }}
            />
          ))}
        </div>

        {/* YouTube 영상 썸네일 (우측 하단) */}
        {pro.youtubeId && (
          <div
            className="absolute bottom-4 right-4 w-[130px] aspect-[5/3] rounded-xl overflow-hidden shadow-[0_4px_20px_rgba(0,0,0,0.4)] border-2 border-white/90 bg-black z-10"
          >
            <iframe
              className="w-full h-full pointer-events-none"
              src={`https://www.youtube.com/embed/${pro.youtubeId}?autoplay=1&mute=1&controls=0&loop=1&playlist=${pro.youtubeId}&playsinline=1&modestbranding=1&rel=0&showinfo=0`}
              title="YouTube preview"
              allow="autoplay; encrypted-media"
            />
          </div>
        )}
      </div>

      {/* ─── Main Content ─── */}
      <div className="px-2.5 pt-4">
        {/* Pro row + prime */}
        <Reveal>
          <div className="flex items-center justify-between mb-1.5">
            <div className="flex items-center gap-2.5">
              <img src={pro.profileImage} alt="" className="w-10 h-10 rounded-xl object-cover" />
              <p className="text-[18px] font-bold text-gray-900">사회자 {pro.name}</p>
            </div>
            {pro.isPrime && (
              <span className="flex items-center gap-1 bg-[#3180F7]/10 text-[#3180F7] text-[11px] font-bold px-2.5 py-1 rounded-full">
                <img src="/images/verified-pro.svg" alt="" width={14} height={14} className="shrink-0" />
                인증 전문가
              </span>
            )}
          </div>
        </Reveal>

        {/* Rating */}
        <Reveal delay={100}>
          <div className="flex items-center gap-2 mb-4">
            <StarRating value={parseFloat(pro.rating.toFixed(1))} size={16} />
            <span className="text-[16px] font-bold text-gray-900">{pro.rating.toFixed(1)}</span>
            <span className="text-[14px] text-gray-400">({pro.reviewCount})</span>
          </div>
        </Reveal>

        {/* ─── 기업 로고 캐러셀 ─── */}
        <CompanyLogoCarousel proId={pro.id} />

        {/* ─── Plan Tabs ─── */}
        <div className="flex border-b border-gray-200 -mx-2.5 relative">
          {pro.plans.map((p, i) => (
            <button
              key={p.id}
              onClick={() => setActivePlan(i)}
              className={`flex-1 py-3 text-[14px] font-bold relative transition-colors duration-300 ${
                activePlan === i ? 'text-[#3180F7]' : 'text-gray-300 hover:text-gray-500'
              }`}
            >
              {p.label}
            </button>
          ))}
          {/* Animated indicator */}
          <span
            className="absolute bottom-[-1px] h-[2px] bg-[#3180F7] transition-all duration-500"
            style={{
              left: `${(activePlan * 100) / pro.plans.length}%`,
              width: `${100 / pro.plans.length}%`,
              transitionTimingFunction: 'cubic-bezier(0.22, 1, 0.36, 1)',
            }}
          />
        </div>

        {/* ─── Plan Content ─── */}
        <div className="py-5">
          {/* Price */}
          <div className="flex items-baseline gap-1.5">
            <span className="text-[28px] font-bold text-gray-900 tabular-nums">
              {plan.price.toLocaleString()}원
            </span>
            <span className="text-[14px] text-gray-400">(VAT 포함)</span>
          </div>
          <p className="text-[12px] text-gray-400 mt-1">결제 시 수수료 10%(VAT포함)가 추가돼요.</p>

          {/* Service title */}
          <div className="mt-6 mb-3">
            <h3 className="text-[17px] font-bold text-gray-900">{plan.title}</h3>
          </div>

          {/* Description */}
          <ul className="space-y-1 text-[14px] text-gray-700 leading-relaxed">
            {plan.desc.map((line, i) => (
              <li key={i} className="whitespace-pre-line">{i === 0 ? '- ' : '* '}{line}</li>
            ))}
          </ul>

          {/* Custom options from localStorage (if pro registered them) */}
          {typeof window !== 'undefined' && (() => {
            try {
              const stored = localStorage.getItem('proRegister_customOptions');
              if (!stored) return null;
              const customOptions = JSON.parse(stored);
              const planOptions = customOptions[plan.id];
              if (!planOptions || planOptions.length === 0) return null;
              return (
                <div className="mt-4 pt-3 border-t border-gray-100">
                  <p className="text-[12px] font-bold text-amber-600 mb-2">추가 옵션</p>
                  <ul className="space-y-1 text-[14px] text-gray-700 leading-relaxed">
                    {planOptions.map((opt: {name: string, price: number} | string, i: number) => {
                      const name = typeof opt === 'string' ? opt : opt.name;
                      const price = typeof opt === 'string' ? 0 : opt.price;
                      return (
                        <li key={i} className="flex items-center justify-between">
                          <span>+ {name}</span>
                          {price > 0 && <span className="text-[13px] font-semibold text-gray-500">{price.toLocaleString()}원</span>}
                        </li>
                      );
                    })}
                  </ul>
                </div>
              );
            } catch { return null; }
          })()}

        </div>
      </div>

      {/* ─── Divider ─── */}
      <div className="h-2 bg-gray-50" />

      {/* ─── Section Tabs (Sticky below header) ─── */}
      <div className="sticky top-[60px] z-30 bg-white border-b border-gray-200">
        <div className="flex relative">
          {[
            { id: 'desc', label: '서비스 설명' },
            { id: 'info', label: '전문가 정보' },
            { id: 'reviews', label: `리뷰 (${pro.reviewCount})` },
          ].map((tab) => {
            const tabs = ['desc', 'info', 'reviews'];
            const idx = tabs.indexOf(activeSection);
            return (
              <button
                key={tab.id}
                onClick={() => scrollToSection(tab.id as 'desc' | 'info' | 'reviews')}
                className={`flex-1 py-4 text-[15px] font-semibold relative transition-colors duration-300 ${
                  activeSection === tab.id ? 'text-[#3180F7]' : 'text-gray-400 hover:text-gray-600'
                }`}
              >
                {tab.label}
              </button>
            );
          })}
          <span
            className="absolute bottom-[-1px] h-[2px] bg-[#3180F7] transition-all duration-500"
            style={{
              left: `${(['desc', 'info', 'reviews'].indexOf(activeSection) * 100) / 3}%`,
              width: `${100 / 3}%`,
              transitionTimingFunction: 'cubic-bezier(0.22, 1, 0.36, 1)',
            }}
          />
        </div>
      </div>

      {/* ─── 서비스 설명 Section ─── */}
      <div ref={descRef} className="px-2.5 pt-8">
        <Reveal>
          <h2 className="text-[20px] font-bold text-gray-900 mb-5">서비스 설명</h2>
        </Reveal>

        {pro.isPrime && (
          <Reveal delay={100}>
            <div className="relative overflow-hidden rounded-xl p-5 mb-6 border border-[#3180F7]/15 bg-gradient-to-br from-[#EAF3FF]/40 via-white to-white">
              {/* Glow accent */}
              <div className="absolute -top-10 -right-10 w-32 h-32 rounded-full bg-[#3180F7]/10 blur-3xl pointer-events-none" />
              <span className="inline-flex items-center gap-1 text-[11px] font-bold text-[#3180F7] bg-[#EAF3FF] px-2.5 py-1 rounded-full mb-3">
                <svg width="11" height="11" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round"><polyline points="20 6 9 17 4 12"/></svg>
                Partners
              </span>
              <p className="text-[15px] font-bold text-gray-900 mb-3">
                이 서비스는 프리티풀 엄선 <span className="text-[#3180F7]">상위 2% 전문가</span>가 제공해요
              </p>
              <ul className="space-y-1.5">
                {['포트폴리오와 고객 후기로 검증된 퀄리티', '경력·이력 인증 심사를 통과한 서비스', '다양한 고객의 요청에 맞춘 전문성'].map((item, i) => (
                  <li
                    key={item}
                    className="flex items-center gap-2 text-[13px] text-gray-700 opacity-0"
                    style={{ animation: `slideInLeft 0.6s ease-out ${300 + i * 100}ms forwards` }}
                  >
                    <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="#3180F7" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round"><polyline points="20 6 9 17 4 12"/></svg>
                    {item}
                  </li>
                ))}
              </ul>
            </div>
          </Reveal>
        )}

        {/* Description text */}
        <div className={`whitespace-pre-line text-[15px] leading-[1.8] text-gray-800 text-center ${descExpanded ? '' : 'max-h-[400px] overflow-hidden relative'}`}>
          {pro.description}
          {!descExpanded && (
            <div className="absolute bottom-0 left-0 right-0 h-24 bg-gradient-to-t from-white to-transparent pointer-events-none" />
          )}
        </div>

        {!descExpanded && (
          <button
            onClick={() => setDescExpanded(true)}
            className="mt-4 w-full py-3.5 border border-gray-200 rounded-xl text-[18px] font-medium text-gray-700 hover:bg-gray-50 transition-colors"
          >
            더보기
          </button>
        )}

        {/* Image expand notice */}
        <div className="mt-8 bg-gray-50 rounded-xl py-3 flex items-center justify-center gap-2 text-[13px] text-gray-400">
          이미지를 클릭해서 확대 할 수 있어요
          <ArrowUpRight size={14} />
        </div>

        {/* YouTube 영상 리스트 */}
        {pro.youtubeVideos && pro.youtubeVideos.length > 0 && (
          <Reveal delay={200}>
            <div className="mt-8">
              <h3 className="text-[16px] font-bold text-gray-900 mb-3">영상</h3>
              <div className="flex gap-3 overflow-x-auto scrollbar-hide snap-x ml-[-2.5px] pl-[2.5px] pr-4">
                {pro.youtubeVideos.map((video) => (
                  <div key={video.id} className="shrink-0 w-[260px] snap-start">
                    <div className="relative w-full aspect-video rounded-xl overflow-hidden bg-black">
                      <iframe
                        className="w-full h-full"
                        src={`https://www.youtube.com/embed/${video.id}?modestbranding=1&rel=0&playsinline=1`}
                        title={video.title}
                        allow="accelerometer; autoplay; clipboard-write; encrypted-media; gyroscope; picture-in-picture"
                        allowFullScreen
                      />
                    </div>
                    <p className="mt-2 text-[13px] font-medium text-gray-700 leading-tight line-clamp-1">{video.title}</p>
                  </div>
                ))}
              </div>
            </div>
          </Reveal>
        )}
      </div>

      {/* ─── 프리티풀의 다른 검증된 전문가 ─── */}
      <div className="px-4 pt-10">
        <Reveal>
          <h3 className="text-[17px] font-bold text-gray-900 leading-tight mb-4"><span className="text-[#3180F7]">프리티풀</span>의 다른<br />검증된 전문가를 살펴보세요</h3>
        </Reveal>
        <div className="flex gap-3 overflow-x-auto scrollbar-hide snap-x pr-4">
          {pro.alsoViewed.map((item) => (
            <Link
              key={item.id}
              href={`/pros/${item.id}`}
              className="shrink-0 w-[130px] snap-start group"
            >
              <div className="relative rounded-xl overflow-hidden" style={{ aspectRatio: '3/4' }}>
                <Image src={item.image} alt="" fill className="object-cover transition-transform duration-500 group-hover:scale-105" />
                <button
                  onClick={(e) => { e.preventDefault(); toggleCarouselFav(item.id); }}
                  className="absolute top-1.5 right-1.5 active:scale-90 transition-transform"
                >
                  <svg width="14" height="14" viewBox="0 0 20 20" fill="none"><path d="M1.85156 7.75662C1.85156 11.7173 5.12524 13.8279 7.52163 15.717C8.36726 16.3836 9.18173 17.0113 9.99619 17.0113C10.8107 17.0113 11.6251 16.3836 12.4707 15.717C14.8671 13.8279 18.1408 11.7173 18.1408 7.75662C18.1408 3.79594 13.6611 0.987106 9.99619 4.79486C6.33124 0.987106 1.85156 3.79594 1.85156 7.75662Z" fill={favoriteItems.has(item.id) ? '#FF4D4D' : 'rgba(0,0,0,0.3)'}/></svg>
                </button>
              </div>
              <div className="mt-1.5">
                <span className="inline-flex items-center gap-0.5 text-[9px] font-bold text-[#3180F7] bg-[#EAF3FF] px-1.5 py-[2px] rounded-full mb-0.5"><svg width="8" height="8" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round"><polyline points="20 6 9 17 4 12"/></svg>Partners</span>
                <p className="text-[13px] font-semibold text-gray-900 leading-tight">사회자 {item.author}</p>
                {item.rating && (
                  <div className="flex items-center gap-1 mt-0.5">
                    <StarRating value={parseFloat(item.rating.toFixed(1))} size={10} />
                    <span className="text-[11px] font-bold text-gray-900">{item.rating.toFixed(1)}</span>
                    <span className="text-[10px] text-gray-400">({item.reviewCount})</span>
                  </div>
                )}
                <p className="text-[13px] font-bold text-gray-900 mt-0.5">{item.price.toLocaleString()}원~</p>
              </div>
            </Link>
          ))}
        </div>
      </div>

      {/* ─── Divider ─── */}
      <div className="h-2 bg-gray-50 mt-8" />

      {/* ─── 전문가 정보 Section ─── */}
      <div ref={infoRef} className="px-2.5 pt-8">
        <h2 className="text-[20px] font-bold text-gray-900 mb-5">전문가 정보</h2>

        <div className="flex items-center gap-4 mb-5">
          <img src={pro.profileImage} alt="" className="w-[60px] h-[60px] rounded-xl object-cover" />
          <div className="flex-1">
            <p className="text-[15px] font-bold text-gray-900">{pro.name}</p>
            <div className="flex items-center gap-1 mt-0.5">
              <StarRating value={parseFloat(pro.rating.toFixed(1))} size={12} />
              <span className="text-[12px] font-semibold text-gray-900">{pro.rating.toFixed(1)} ({pro.reviewCount})</span>
            </div>
            <p className="text-[11px] text-gray-400 mt-1">연락 가능 시간: {pro.expertStats.contactTime}</p>
            <p className="text-[11px] text-gray-400">평균 응답 시간: {pro.expertStats.responseTime}</p>
          </div>
        </div>

        {/* Stats grid */}
        <div className="grid grid-cols-2 gap-2 mb-3">
          {/* 총 거래 건수 */}
          <div className="bg-gray-50 rounded-xl px-3 py-3">
            <p className="text-[11px] text-gray-400 mb-2">총 거래 건수</p>
            <div className="flex items-end gap-1 h-[32px] mb-1.5">
              {[35, 52, 68, 75, 82, 89].map((v, i) => (
                <div key={i} className="flex-1 rounded-sm" style={{ height: `${(v / 89) * 100}%`, background: i === 5 ? '#3180F7' : '#E5E7EB' }} />
              ))}
            </div>
            <p className="text-[16px] font-bold text-gray-900">{pro.expertStats.totalDeals}건</p>
          </div>
          {/* 만족도 */}
          <div className="bg-gray-50 rounded-xl px-3 py-3">
            <p className="text-[11px] text-gray-400 mb-2">만족도</p>
            <div className="relative w-full h-[32px] flex items-center justify-center mb-1.5">
              <svg width="48" height="32" viewBox="0 0 48 32">
                <circle cx="24" cy="24" r="20" fill="none" stroke="#E5E7EB" strokeWidth="5" strokeDasharray="94.2 125.7" transform="rotate(-210 24 24)" />
                <circle cx="24" cy="24" r="20" fill="none" stroke="#3180F7" strokeWidth="5" strokeDasharray={`${94.2 * (pro.expertStats.satisfaction / 100)} 125.7`} strokeLinecap="round" transform="rotate(-210 24 24)" />
              </svg>
            </div>
            <p className="text-[16px] font-bold text-gray-900">{pro.expertStats.satisfaction}%</p>
          </div>
        </div>

        <div className="grid grid-cols-2 gap-2">
          <div className="bg-gray-50 rounded-xl px-3 py-3">
            <p className="text-[11px] text-gray-400 mb-1">회원구분</p>
            <p className="text-[16px] font-bold text-gray-900">{pro.expertStats.memberType}</p>
          </div>
          <div className="bg-gray-50 rounded-xl px-3 py-3">
            <p className="text-[11px] text-gray-400 mb-1">세금계산서</p>
            <p className="text-[16px] font-bold text-gray-900">{pro.expertStats.taxInvoice}</p>
          </div>
        </div>

      </div>

      {/* ─── Divider ─── */}
      <div className="h-2 bg-gray-50 mt-10" />

      {/* ─── 리뷰 Section ─── */}
      <div ref={reviewsRef} className="px-2.5 pt-6">
        <h2 className="text-[20px] font-bold text-gray-900 mb-2">리뷰</h2>

        <div className="flex items-center gap-2 mb-2">
          <StarRating value={parseFloat(pro.rating.toFixed(1))} size={20} />
          <span className="text-[24px] font-bold text-gray-900">{pro.rating.toFixed(1)}</span>
          <span className="text-[14px] text-gray-400">({pro.reviewCount})</span>
        </div>

        {/* Radar Chart - derived from review scores */}
        {(() => {
          const reviewsWithScores = pro.reviews.filter(r => r.scores);
          const avgScore = (key: string) => {
            const vals = reviewsWithScores.map(r => r.scores?.[key]).filter((v): v is number => v != null && v > 0);
            return vals.length > 0 ? vals.reduce((a, b) => a + b, 0) / vals.length : pro.rating || 4.5;
          };
          const scoreItems = [
            { label: '경력', value: avgScore('경력') },
            { label: '만족도', value: avgScore('만족도') },
            { label: '위트', value: avgScore('위트') },
            { label: '발성', value: avgScore('발성') },
            { label: '이미지', value: avgScore('이미지') },
            { label: '구성력', value: avgScore('구성력') },
          ];
          return (
            <>
              <RadarChart scores={scoreItems} />
              <ScoreBars items={scoreItems} />
            </>
          );
        })()}


        {/* Reviews list */}
        <div className="flex items-center justify-between mb-4">
          <h3 className="text-[16px] font-bold text-gray-900">전체 리뷰 {pro.reviewCount}건</h3>
          <button><ChevronRight size={20} className="text-gray-400" /></button>
        </div>

        <div className="space-y-6">
          {pro.reviews.map((review) => (
            <div key={review.id} className="pb-6 border-b border-gray-100 last:border-0 relative">
              <div className="flex items-center justify-between mb-2">
                <div className="flex items-center gap-2">
                  <div className="w-9 h-9 rounded-full bg-gray-100 flex items-center justify-center text-[14px]">🚀</div>
                  <span className="text-[14px] text-gray-600">{review.name}</span>
                </div>
                <div className="relative">
                  <button
                    onClick={() => setReviewMenu(reviewMenu === review.id ? null : review.id)}
                    className="w-7 h-7 flex items-center justify-center rounded-full hover:bg-gray-100 transition-colors"
                  >
                    <span className="text-[16px] text-gray-400 leading-none">⋯</span>
                  </button>
                  {reviewMenu === review.id && (
                    <div className="absolute right-0 top-8 bg-white border border-gray-200 rounded-xl shadow-lg py-1 z-20 min-w-[120px]">
                      <button onClick={() => { toast('리뷰를 신고했습니다', { icon: '🚨' }); setReviewMenu(null); }} className="w-full text-left px-4 py-2.5 text-[13px] text-gray-700 hover:bg-gray-50">신고하기</button>
                      <button onClick={() => { toast('리뷰를 차단했습니다', { icon: '🚫' }); setReviewMenu(null); }} className="w-full text-left px-4 py-2.5 text-[13px] text-gray-700 hover:bg-gray-50">차단하기</button>
                      <button onClick={() => { navigator.clipboard.writeText(review.content); toast.success('복사됨'); setReviewMenu(null); }} className="w-full text-left px-4 py-2.5 text-[13px] text-gray-700 hover:bg-gray-50">복사하기</button>
                    </div>
                  )}
                </div>
              </div>
              <div className="flex items-center gap-1.5 mb-2">
                <StarRating value={parseFloat(review.rating.toFixed(1))} size={14} />
                <span className="text-[13px] font-bold text-gray-900">{review.rating.toFixed(1)}</span>
                <span className="text-[12px] text-gray-300">|</span>
                <span className="text-[12px] text-gray-400">{review.date}</span>
              </div>
              {(review as typeof review & { scores?: Record<string, number> }).scores && (
                <div className="flex flex-wrap gap-1 mb-2.5">
                  {Object.entries((review as typeof review & { scores: Record<string, number> }).scores).map(([key, val]) => (
                    <span key={key} className="text-[10px] font-medium px-1.5 rounded-[5px] bg-gray-100 text-gray-600 flex items-center" style={{ height: 22 }}>
                      {key} <span className="font-bold text-[#3180F7] ml-1">{val}</span>
                    </span>
                  ))}
                </div>
              )}
              <p className="text-[14px] leading-[1.7] text-gray-800 mb-3 whitespace-pre-line">{review.content}</p>
              <p className="text-[12px] text-gray-400 mb-2">
                행사일 : {review.workDays}일 | 주문 금액 : <span className="font-bold text-gray-600">{review.orderRange}</span>
              </p>
              {review.badge && (
                <span className="inline-block text-[11px] text-gray-500 bg-gray-100 px-2 py-1 rounded-full">{review.badge}</span>
              )}
              {review.proReply && (
                <div className="mt-3 bg-gray-50 rounded-xl p-4">
                  <div className="flex items-center gap-2 mb-2">
                    <span className="text-[13px] font-semibold text-gray-800">{pro.name}</span>
                    <span className="text-[12px] text-gray-400">{review.proReply.date}</span>
                  </div>
                  <p className="text-[13px] leading-[1.7] text-gray-700 whitespace-pre-line">{review.proReply.content}</p>
                </div>
              )}
            </div>
          ))}
        </div>

        <button
          onClick={() => router.push(`/pros/${pro.id}/reviews`)}
          className="w-full py-3.5 border border-gray-200 rounded-xl text-[14px] font-medium text-gray-700 hover:bg-gray-50 active:scale-[0.98] transition-all mt-5"
        >
          리뷰 전체보기
        </button>
      </div>

      {/* ─── Expandable panels ─── */}
      <div className="px-2.5 pt-8">
        {[
          { id: 'info', label: '서비스 정보', content: `• 카테고리: MC / 아나운서\n• 평균 작업 기간: 20일 이내\n• 커뮤니케이션: 1시간 이내 응답\n• 수정 횟수: 1회 포함\n• 취소·환불 정책: 환불 규정 참고` },
          { id: 'revision', label: '수정 및 재진행', content: `• 상품 구매 후 수정 횟수는 1회입니다.\n• 수정 요청은 작업 완료 전 요청 가능합니다.\n• 추가 수정이 필요한 경우 별도 협의가 필요합니다.` },
          { id: 'cancel', label: '취소 및 환불 규정', content: `• 작업 시작 전: 100% 환불\n• 작업 진행 중: 진행률에 따른 일부 환불\n• 작업 완료 후: 환불 불가\n※ 상세 규정은 프리티풀 이용약관을 따릅니다.` },
          { id: 'notice', label: '상품정보고시', content: `• 제공자: ${pro.name}\n• 서비스 제공방식: 온/오프라인\n• 결제 후 계약 내용 변경은 상호 협의에 의해서만 가능합니다.` },
        ].map((panel) => {
          const isOpen = expandedPanel === panel.id;
          return (
            <div key={panel.id} className="border-b border-gray-100 last:border-0">
              <button
                onClick={() => setExpandedPanel(isOpen ? null : panel.id)}
                className="w-full flex items-center justify-between py-4 text-left"
              >
                <span className="text-[15px] font-medium text-gray-900">{panel.label}</span>
                <ChevronDown size={20} className={`text-gray-400 transition-transform duration-300 ${isOpen ? 'rotate-180 text-[#3180F7]' : ''}`} />
              </button>
              <div
                className="overflow-hidden transition-all duration-500"
                style={{
                  maxHeight: isOpen ? 400 : 0,
                  opacity: isOpen ? 1 : 0,
                  transitionTimingFunction: 'cubic-bezier(0.22, 1, 0.36, 1)',
                }}
              >
                <div className="pb-4 text-[13px] text-gray-500 leading-[1.8] whitespace-pre-line">{panel.content}</div>
              </div>
            </div>
          );
        })}
      </div>

      {/* ─── Divider ─── */}
      <div className="h-2 bg-gray-50 mt-2" />

      {/* ─── 추천 사회자 ─── */}
      <div className="px-2.5 pt-8 pb-10">
        <h2 className="text-[17px] font-bold text-gray-900 leading-tight mb-4">사회자<br />인기 전문가 어때요?</h2>
        <div className="flex gap-3 overflow-x-auto scrollbar-hide -mx-2.5 px-2.5">
          {pro.recommendedPros.map((item) => (
            <Link key={item.id} href={`/pros/${item.id}`} className="shrink-0 w-[130px] group">
              <div className="relative rounded-xl overflow-hidden" style={{ aspectRatio: '3/4' }}>
                <Image src={item.image} alt={item.name} fill className="object-cover transition-transform duration-500 group-hover:scale-105" />
                <button
                  onClick={(e) => { e.preventDefault(); toggleCarouselFav(item.id); }}
                  className="absolute top-1.5 right-1.5 active:scale-90 transition-transform"
                >
                  <svg width="14" height="14" viewBox="0 0 20 20" fill="none"><path d="M1.85156 7.75662C1.85156 11.7173 5.12524 13.8279 7.52163 15.717C8.36726 16.3836 9.18173 17.0113 9.99619 17.0113C10.8107 17.0113 11.6251 16.3836 12.4707 15.717C14.8671 13.8279 18.1408 11.7173 18.1408 7.75662C18.1408 3.79594 13.6611 0.987106 9.99619 4.79486C6.33124 0.987106 1.85156 3.79594 1.85156 7.75662Z" fill={favoriteItems.has(item.id) ? '#FF4D4D' : 'rgba(0,0,0,0.3)'}/></svg>
                </button>
              </div>
              <div className="mt-1.5">
                {item.isPartner && <img src="/images/partners-badge.svg" alt="Partners" className="h-[18px] mb-0.5" />}
                <p className="text-[13px] font-semibold text-gray-900 leading-tight">{item.role} {item.name}</p>
                <div className="flex items-center gap-1 mt-0.5">
                  <StarRating value={parseFloat(item.rating.toFixed(1))} size={10} />
                  <span className="text-[11px] font-bold text-gray-900">{item.rating.toFixed(1)}</span>
                  <span className="text-[10px] text-gray-400">({item.reviews})</span>
                </div>
                <div className="flex flex-wrap gap-1 mt-1">
                  <span className="text-[9px] font-bold px-1.5 rounded-[4px] bg-primary-50 text-primary-600 flex items-center" style={{ height: 18 }}>경력{item.experience}년</span>
                  {item.tags.slice(0, 1).map((tag) => (
                    <span key={tag} className="text-[9px] font-medium px-1.5 rounded-[4px] bg-gray-100 text-gray-500 flex items-center" style={{ height: 18 }}>{tag}</span>
                  ))}
                </div>
              </div>
            </Link>
          ))}
        </div>
      </div>

      {/* ─── Bottom Fixed Bar ─── */}
      <div
        className="fixed bottom-0 left-0 right-0 z-40 pointer-events-none"
        style={{ paddingLeft: 16, paddingRight: 16, paddingBottom: 12 }}
      >
        {/* 블러 배경 (별도 레이어로 분리) */}
        <div
          className="absolute inset-0"
          style={{
            background: 'linear-gradient(to top, white 30%, rgba(255,255,255,0.9) 50%, rgba(255,255,255,0.5) 70%, rgba(255,255,255,0) 100%)',
            backdropFilter: 'blur(6px)',
            WebkitBackdropFilter: 'blur(6px)',
            maskImage: 'linear-gradient(to top, black 55%, transparent 100%)',
            WebkitMaskImage: 'linear-gradient(to top, black 55%, transparent 100%)',
          }}
        />
      <div className="relative pointer-events-auto pt-10">
        <div className="flex items-center gap-3 max-w-[680px] mx-auto">
          {/* Heart (원형) */}
          <button
            onClick={handleToggleFavorite}
            className="w-12 h-12 rounded-full border border-gray-200 bg-white flex items-center justify-center active:scale-90 transition-transform shrink-0 shadow-sm"
          >
            <Heart
              size={20}
              className={isFavorited ? 'fill-[#3180F7] text-[#3180F7]' : 'text-gray-400'}
              style={{ animation: isFavorited ? 'heartPop 0.4s cubic-bezier(0.34, 1.56, 0.64, 1)' : undefined }}
            />
          </button>

          {/* 문의하기 + 구매하기 묶음 (알약) */}
          <div className="relative flex-1">
            {/* 말풍선 — overflow-hidden 바깥 */}
            {showTooltip && (
              <div
                className="absolute -top-8 left-[25%] -translate-x-1/2 z-10"
                style={{ animation: 'tooltipBounce 2s ease-in-out infinite' }}
              >
                <div className="bg-[#3180F7] text-white text-[11px] font-semibold px-3 py-1.5 rounded-full whitespace-nowrap relative shadow-[0_4px_16px_rgba(49,128,247,0.4)]">
                  평균 응답 1시간 이내
                  <div className="absolute bottom-[-4px] left-1/2 -translate-x-1/2 w-2 h-2 bg-[#3180F7] rotate-45" />
                </div>
              </div>
            )}
            <div className="flex h-12 rounded-full overflow-hidden shadow-sm">
              <button
                disabled={openingChat}
                onClick={async () => {
                  setShowTooltip(false);
                  if (!authUser && localStorage.getItem('freetiful-logged-in') !== 'true') { setLoginModal(true); return; }
                  const nameParam = encodeURIComponent(pro.name || '');
                  const imgParam = encodeURIComponent(pro.profileImage || '');
                  const preWarmed = getPreWarmByProId(pro.id);
                  if (preWarmed?.roomId) {
                    router.push(`/chat/${preWarmed.roomId}?name=${nameParam}&img=${imgParam}`);
                    return;
                  }
                  // roomId 아직 없으면 버튼에 로딩 표시, createRoom 끝나면 바로 이동
                  setOpeningChat(true);
                  const pre = preWarmChat(pro.id);
                  const resolvedId = await pre.roomIdPromise;
                  if (resolvedId) {
                    router.push(`/chat/${resolvedId}?name=${nameParam}&img=${imgParam}`);
                  } else {
                    setOpeningChat(false);
                  }
                }}
                className="flex-1 bg-white border border-gray-200 border-r-0 rounded-l-full text-[14px] font-semibold text-gray-700 active:bg-gray-50 transition-colors disabled:opacity-70 flex items-center justify-center gap-2"
              >
                {openingChat ? (
                  <>
                    <div className="w-4 h-4 border-2 border-[#3180F7] border-t-transparent rounded-full animate-spin" />
                    열리는 중
                  </>
                ) : (
                  '문의하기'
                )}
              </button>
              <button
                onClick={handlePurchase}
                className="flex-1 bg-[#3180F7] rounded-r-full text-[14px] font-bold text-white active:scale-[0.98] transition-transform"
              >
                구매하기
              </button>
            </div>
          </div>
        </div>
      </div>
      </div>

      {/* ─── Image Modal (확대) ─── */}
      {imageModal && (
        <div
          className="fixed inset-0 z-[100] bg-black/95 flex items-center justify-center"
          onClick={() => setImageModal(null)}
          style={{ animation: 'modalFade 0.3s ease-out' }}
        >
          <button
            onClick={() => setImageModal(null)}
            className="absolute top-4 right-4 w-10 h-10 rounded-full bg-white/10 backdrop-blur-sm flex items-center justify-center text-white"
          >
            <X size={24} />
          </button>
          <Image src={imageModal} alt="" width={1200} height={1200} className="max-w-[95vw] max-h-[90vh] object-contain rounded-xl" />
        </div>
      )}

      {/* ─── Share Modal ─── */}
      {shareModal && (
        <div
          className="fixed inset-0 z-[100] bg-black/50 backdrop-blur-sm flex items-end sm:items-center justify-center"
          onClick={() => setShareModal(false)}
          style={{ animation: 'modalFade 0.3s ease-out' }}
        >
          <div
            className="w-full sm:max-w-md bg-white rounded-t-3xl sm:rounded-3xl p-6 pb-safe"
            onClick={(e) => e.stopPropagation()}
            style={{ animation: 'sheetUp 0.4s cubic-bezier(0.22, 1, 0.36, 1)' }}
          >
            <div className="w-10 h-1 rounded-full bg-gray-300 mx-auto mb-4 sm:hidden" />
            <h3 className="text-[18px] font-bold text-gray-900 mb-5">공유하기</h3>
            <button
              onClick={handleCopyLink}
              className="w-full flex items-center gap-3 py-4 px-4 hover:bg-gray-50 rounded-xl transition-colors"
            >
              <div className="w-11 h-11 rounded-full bg-[#EAF3FF] flex items-center justify-center">
                <Link2 size={20} className="text-[#3180F7]" />
              </div>
              <span className="text-[15px] font-medium text-gray-900">링크 복사</span>
            </button>
            <button
              onClick={() => setShareModal(false)}
              className="w-full mt-2 py-3.5 bg-gray-100 rounded-xl text-[14px] font-semibold text-gray-700"
            >
              닫기
            </button>
          </div>
        </div>
      )}

      {/* ─── Phone Modal ─── */}
      {phoneModal && (
        <div
          className="fixed inset-0 z-[100] bg-black/50 backdrop-blur-sm flex items-end sm:items-center justify-center"
          onClick={() => setPhoneModal(false)}
          style={{ animation: 'modalFade 0.3s ease-out' }}
        >
          <div
            className="w-full sm:max-w-md bg-white rounded-t-3xl sm:rounded-3xl p-6 pb-safe"
            onClick={(e) => e.stopPropagation()}
            style={{ animation: 'sheetUp 0.4s cubic-bezier(0.22, 1, 0.36, 1)' }}
          >
            <div className="w-10 h-1 rounded-full bg-gray-300 mx-auto mb-4 sm:hidden" />
            <div className="text-center py-4">
              <div className="w-16 h-16 rounded-full bg-[#EAF3FF] flex items-center justify-center mx-auto mb-4">
                <Phone size={28} className="text-[#3180F7]" />
              </div>
              <h3 className="text-[18px] font-bold text-gray-900 mb-2">전화 상담</h3>
              <p className="text-[14px] text-gray-500 mb-6">
                채팅으로 먼저 문의하시면<br />더 빠른 답변을 받을 수 있어요
              </p>
              <div className="flex gap-2">
                <button
                  onClick={() => setPhoneModal(false)}
                  className="flex-1 py-3.5 bg-gray-100 rounded-xl text-[14px] font-semibold text-gray-700"
                >
                  취소
                </button>
                <button
                  onClick={() => { setPhoneModal(false); router.push(`/chat/${pro.id}`); }}
                  className="flex-1 py-3.5 rounded-xl text-[14px] font-bold text-white bg-[#3180F7]"
                >
                  채팅 문의
                </button>
              </div>
            </div>
          </div>
        </div>
      )}

      {/* ─── Purchase Modal ─── */}
      {purchaseModal && (
        <div
          className="fixed inset-0 z-[100] bg-black/50 backdrop-blur-sm flex items-end sm:items-center justify-center"
          onClick={() => setPurchaseModal(false)}
          style={{ animation: 'modalFade 0.3s ease-out' }}
        >
          <div
            className="w-full sm:max-w-md bg-white rounded-t-3xl sm:rounded-3xl p-6 pb-safe"
            onClick={(e) => e.stopPropagation()}
            style={{ animation: 'sheetUp 0.4s cubic-bezier(0.22, 1, 0.36, 1)' }}
          >
            <div className="w-10 h-1 rounded-full bg-gray-300 mx-auto mb-4 sm:hidden" />
            <h3 className="text-[18px] font-bold text-gray-900 mb-4">구매 확인</h3>
            <div className="bg-gray-50 rounded-xl p-4 mb-5">
              <p className="text-[12px] text-gray-400 mb-1">{plan.label}</p>
              <p className="text-[15px] font-bold text-gray-900 mb-2">{plan.title}</p>
              <div className="flex items-end justify-between pt-3 border-t border-gray-200">
                <span className="text-[13px] text-gray-500">결제 금액</span>
                <span className="text-[22px] font-bold text-[#3180F7]">{plan.price.toLocaleString()}원</span>
              </div>
            </div>
            <p className="text-[12px] text-gray-400 mb-5 text-center">결제 시 수수료 10%(VAT포함)가 추가돼요</p>
            <div className="flex gap-2">
              <button
                onClick={() => setPurchaseModal(false)}
                className="flex-1 py-3.5 bg-gray-100 rounded-xl text-[14px] font-semibold text-gray-700"
              >
                취소
              </button>
              <button
                onClick={confirmPurchase}
                className="flex-1 py-3.5 rounded-xl text-[14px] font-bold text-white bg-[#3180F7]"
              >
                결제하기
              </button>
            </div>
          </div>
        </div>
      )}

      {/* ─── Reviews Full Modal ─── */}
      {reviewsModal && (
        <div
          className="fixed inset-0 z-[100] bg-black/50 backdrop-blur-sm flex items-end justify-center"
          onClick={() => setReviewsModal(false)}
          style={{ animation: 'modalFade 0.3s ease-out' }}
        >
          <div
            className="w-full max-w-lg bg-white rounded-t-3xl max-h-[85vh] overflow-y-auto pb-safe"
            onClick={(e) => e.stopPropagation()}
            style={{ animation: 'sheetUp 0.4s cubic-bezier(0.22, 1, 0.36, 1)' }}
          >
            <div className="sticky top-0 bg-white border-b border-gray-100 px-5 py-4 flex items-center justify-between z-10">
              <h3 className="text-[17px] font-bold text-gray-900">전체 리뷰 ({pro.reviewCount})</h3>
              <button onClick={() => setReviewsModal(false)}>
                <X size={22} className="text-gray-500" />
              </button>
            </div>
            <div className="px-5 py-4 space-y-6">
              {pro.reviews.map((review) => (
                <div key={review.id} className="pb-6 border-b border-gray-100 last:border-0">
                  <div className="flex items-center gap-2 mb-2">
                    <div className="w-9 h-9 rounded-full bg-gray-100 flex items-center justify-center text-[14px]">🚀</div>
                    <span className="text-[14px] text-gray-600">{review.name}</span>
                  </div>
                  <div className="flex items-center gap-1.5 mb-3">
                    <StarRating value={parseFloat(review.rating.toFixed(1))} size={14} />
                    <span className="text-[13px] font-bold text-gray-900">{review.rating.toFixed(1)}</span>
                    <span className="text-[12px] text-gray-300">|</span>
                    <span className="text-[12px] text-gray-400">{review.date}</span>
                  </div>
                  <p className="text-[14px] leading-[1.7] text-gray-800 mb-3 whitespace-pre-line">{review.content}</p>
                  <p className="text-[12px] text-gray-400">행사일 : {review.workDays}일 | 주문 금액 : {review.orderRange}</p>
                </div>
              ))}
            </div>
          </div>
        </div>
      )}

      {/* Premium animations */}
      {/* Login Modal */}
      {loginModal && (
        <div className="fixed inset-0 z-[100] flex items-end justify-center bg-black/40" onClick={() => setLoginModal(false)}>
          <div className="bg-white w-full max-w-md rounded-t-3xl px-6 pt-6 pb-8 animate-[slideUp_0.3s_ease]" onClick={(e) => e.stopPropagation()}>
            <div className="w-10 h-1 bg-gray-300 rounded-full mx-auto mb-5" />
            <h2 className="text-[20px] font-bold text-gray-900 text-center mb-1">로그인이 필요합니다</h2>
            <p className="text-[14px] text-gray-500 text-center mb-6">이 기능을 사용하려면 로그인해주세요</p>
            <div className="space-y-2.5">
              {['kakao', 'naver', 'google'].map((p) => (
                <button key={p} onClick={() => { localStorage.setItem('freetiful-logged-in', 'true'); localStorage.setItem('freetiful-user', JSON.stringify({ name: '', provider: p, createdAt: Date.now() })); localStorage.setItem('userRole', 'general'); window.location.href = '/onboarding'; }}
                  className={`w-full flex items-center justify-center gap-3 font-semibold py-3.5 rounded-xl active:scale-[0.98] transition-transform ${p === 'kakao' ? 'bg-[#FEE500] text-[#191919]' : p === 'naver' ? 'bg-[#03C75A] text-white' : 'bg-white text-gray-700 border border-gray-200'}`}
                >{p === 'kakao' ? '카카오로 계속하기' : p === 'naver' ? '네이버로 계속하기' : 'Google로 계속하기'}</button>
              ))}
            </div>
            <button onClick={() => setLoginModal(false)} className="w-full mt-4 text-[14px] text-gray-400 font-medium py-2 text-center">나중에 하기</button>
          </div>
          <style>{`@keyframes slideUp { from { transform: translateY(100%); } to { transform: translateY(0); } }`}</style>
        </div>
      )}

      <style dangerouslySetInnerHTML={{ __html: `
        @keyframes modalFade {
          0% { opacity: 0; }
          100% { opacity: 1; }
        }
        @keyframes sheetUp {
          0% { transform: translateY(100%); }
          100% { transform: translateY(0); }
        }
        @keyframes tooltipBounce {
          0%, 100% { transform: translateY(0); }
          50% { transform: translateY(-3px); }
        }
        @keyframes priceFadeUp {
          0% { opacity: 0; transform: translateY(8px); filter: blur(3px); }
          100% { opacity: 1; transform: translateY(0); filter: blur(0); }
        }
        @keyframes slideInLeft {
          0% { opacity: 0; transform: translateX(-12px); }
          100% { opacity: 1; transform: translateX(0); }
        }
        @keyframes primeShine {
          0%, 100% { box-shadow: 0 0 0 rgba(49,128,247,0); }
          50% { box-shadow: 0 0 16px rgba(49,128,247,0.4); }
        }
        @keyframes primeShineMove {
          0% { transform: translateX(-100%); }
          50%, 100% { transform: translateX(400%); }
        }
        @keyframes playPulse {
          0% { box-shadow: 0 0 0 0 rgba(255,255,255,0.5); }
          100% { box-shadow: 0 0 0 18px rgba(255,255,255,0); }
        }
        @keyframes bestBounce {
          0% { opacity: 0; transform: translateY(8px) scale(0.5); }
          100% { opacity: 1; transform: translateY(0) scale(1); }
        }
        @keyframes bestFloat {
          0%, 100% { transform: translateY(0); }
          50% { transform: translateY(-3px); }
        }
        @keyframes heartPop {
          0% { transform: scale(1); }
          50% { transform: scale(1.4); }
          100% { transform: scale(1); }
        }
        @keyframes doubleTapHeart {
          0% { transform: scale(0); opacity: 0; }
          15% { transform: scale(1.3); opacity: 1; }
          30% { transform: scale(1); opacity: 1; }
          70% { transform: scale(1); opacity: 1; }
          100% { transform: scale(1.1); opacity: 0; }
        }
        @keyframes buttonShine {
          0% { transform: translateX(-100%) skewX(-15deg); }
          50%, 100% { transform: translateX(450%) skewX(-15deg); }
        }
      `}} />
    </div>
  );
}
