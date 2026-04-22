'use client';

import { useState, useEffect, useRef } from 'react';
import Link from 'next/link';
import Image from 'next/image';
import { ChevronRight, X } from 'lucide-react';
import LanguageToggle from '@/components/biz/LanguageToggle';
import { useT } from '@/lib/biz/i18n';

/* ─── Scroll-Reveal ───────────────────────────────────────── */
function useReveal() {
  const ref = useRef<HTMLDivElement>(null);
  const [visible, setVisible] = useState(false);
  useEffect(() => {
    const el = ref.current;
    if (!el) return;
    const ob = new IntersectionObserver(
      ([e]) => { if (e.isIntersecting) setVisible(true); },
      { threshold: 0.15 },
    );
    ob.observe(el);
    return () => ob.disconnect();
  }, []);
  return { ref, visible };
}

function Reveal({ children, delay = 0, className = '' }: { children: React.ReactNode; delay?: number; className?: string }) {
  const { ref, visible } = useReveal();
  return (
    <div
      ref={ref}
      className={`transition-all duration-700 ease-out ${visible ? 'translate-y-0 opacity-100 blur-0' : 'translate-y-10 opacity-0 blur-[4px]'} ${className}`}
      style={{ transitionDelay: `${delay}ms` }}
    >
      {children}
    </div>
  );
}

/* ─── Menu items ─────────────────────────────────────────── */
const MENU_ITEMS = [
  { label: 'CEO 인사말', href: '/biz/ceo' },
  { label: '연혁', href: '/biz/history' },
  { label: '인재채용', href: '/careers' },
  { label: '주요소식', href: '/biz', hash: '자료실' },
  { label: '자주묻는질문', href: '/biz/faq' },
  { label: '고객사', href: '/biz/clients' },
];

/* ─── Clients Data ───────────────────────────────────────── */
const CLIENT_CATEGORIES = [
  { id: 'all', label: '전체' },
  { id: 'broadcast', label: '방송/미디어' },
  { id: 'corporate', label: '기업' },
  { id: 'wedding', label: '웨딩/이벤트' },
  { id: 'education', label: '교육/협회' },
  { id: 'public', label: '공공기관' },
];

const CLIENTS = [
  // 방송/미디어
  { name: 'KBS', category: 'broadcast', desc: '한국방송공사', color: 'from-red-500 to-rose-600' },
  { name: 'SBS', category: 'broadcast', desc: 'SBS 미디어그룹', color: 'from-blue-600 to-blue-700' },
  { name: 'MBC', category: 'broadcast', desc: '문화방송', color: 'from-green-500 to-emerald-600' },
  { name: 'tvN', category: 'broadcast', desc: 'CJ ENM', color: 'from-lime-500 to-green-600' },
  { name: 'JTBC', category: 'broadcast', desc: '중앙일보 미디어', color: 'from-sky-500 to-blue-600' },
  { name: 'YTN', category: 'broadcast', desc: '연합뉴스TV', color: 'from-red-600 to-red-700' },

  // 기업
  { name: '삼성전자', category: 'corporate', desc: '제품 런칭 이벤트', color: 'from-blue-500 to-indigo-600' },
  { name: '현대자동차', category: 'corporate', desc: '신차 발표회', color: 'from-slate-600 to-slate-800' },
  { name: 'LG전자', category: 'corporate', desc: '기업 세미나', color: 'from-red-500 to-pink-600' },
  { name: 'SK텔레콤', category: 'corporate', desc: '기술 컨퍼런스', color: 'from-red-500 to-rose-600' },
  { name: '카카오', category: 'corporate', desc: '기업 행사', color: 'from-yellow-500 to-amber-600' },
  { name: '네이버', category: 'corporate', desc: '개발자 컨퍼런스', color: 'from-green-500 to-emerald-600' },
  { name: '쿠팡', category: 'corporate', desc: '사내 이벤트', color: 'from-orange-500 to-red-500' },
  { name: '배달의민족', category: 'corporate', desc: '브랜드 행사', color: 'from-cyan-500 to-teal-600' },

  // 웨딩/이벤트
  { name: '더채플앳청담', category: 'wedding', desc: '프리미엄 웨딩홀', color: 'from-pink-400 to-rose-500' },
  { name: '그랜드하얏트', category: 'wedding', desc: '호텔 웨딩', color: 'from-amber-600 to-yellow-700' },
  { name: '신라호텔', category: 'wedding', desc: '호텔 행사', color: 'from-amber-500 to-orange-600' },
  { name: '롯데호텔', category: 'wedding', desc: '컨벤션 행사', color: 'from-red-500 to-rose-600' },
  { name: 'JW메리어트', category: 'wedding', desc: '국제 행사', color: 'from-slate-500 to-gray-700' },
  { name: '아모리스홀', category: 'wedding', desc: '웨딩 전문', color: 'from-violet-400 to-purple-500' },

  // 교육/협회
  { name: '한국아나운서협회', category: 'education', desc: '아나운서 교육 파트너', color: 'from-indigo-500 to-violet-600' },
  { name: '서울대학교', category: 'education', desc: '대학 행사', color: 'from-blue-600 to-blue-800' },
  { name: '연세대학교', category: 'education', desc: '학술 컨퍼런스', color: 'from-blue-500 to-indigo-600' },
  { name: '고려대학교', category: 'education', desc: '축제/행사', color: 'from-red-600 to-red-800' },
  { name: '한국MC협회', category: 'education', desc: 'MC 교육 파트너', color: 'from-teal-500 to-emerald-600' },

  // 공공기관
  { name: '서울특별시', category: 'public', desc: '시 주최 행사', color: 'from-blue-500 to-blue-700' },
  { name: '문화체육관광부', category: 'public', desc: '정부 행사', color: 'from-blue-600 to-indigo-700' },
  { name: '한국관광공사', category: 'public', desc: '관광 홍보 행사', color: 'from-green-500 to-teal-600' },
  { name: '대한상공회의소', category: 'public', desc: '비즈니스 포럼', color: 'from-slate-600 to-gray-700' },
  { name: '한국무역협회', category: 'public', desc: '전시/박람회', color: 'from-blue-500 to-cyan-600' },
];

/* ─── Partner Logos (from /images/company-logos/) ────────── */
const PARTNER_LOGOS = [
  '-DYSKPXdCLcjcK4M44l9Za7ZgNQJR6-HT-yUvfPCCsoLqVEpndF3htzCH6cF_5sfNhc_KDDRXfbfTckyikUOuDYh8yGBlWNImoehI7PxTiNB8hj-MI7wj1cTbC7O98nRpdTYXkqgV3mqiKbSjKa9eQ.svg',
  '0kIrqSx6FQ6AZtryR8Rii4lXBGrvITgNfRhhiLfi2aVr-Uqg1l5bOMa4Vi3THlnZYVns6hi5Y75mBhXXS4r6dBfKvn1HPMRq10Gh8NrRBcZE0Pd7zOeDm9WYfDEvAaCZSVD12nCLfeJdkz9WXPnZ3w.svg',
  '1GPWKc37T7Qz08E07p9sDg0F4rYPxg_qbmh5CSSxrdDTQoy6hCl6k-UgoySwKANqEm0jCWiZjyMqaLUxX31_3RyRiW1yQ2L5zYtA6WzN7s5Zxy31rQSDGIotP0yP2rU6jhAVfxvxFl__q_NPEuRKAg.svg',
  '4nJH1a9BfVA9ilPdwu120VbDd-ERloXHcOus1u88Xhvpql-0zhgPSW9dj3zZKGKlGVEfqJwFPQLWwtXGYmft8KGikSA2N0n3yojcWKfrmKWyZ3dLtYmBFcKkeTn8CDL7HarNcbkEmB8AYP76lHFDTg.svg',
  '5bZLn7_cvlKQnqzT0_0hMSHeq0y1K-YgT4X40IT9qxQClHZTU3fHCuuIyI7JSjm7MmtDrWs1KBx7VtHyTk4rrbhhAhWa-EpxfAJwkoVV9vrn7DLNFlXNy6zNfET5B7ohb0ULDDwO99agnC9QOW7lKA.svg',
  '7JPcHcbSryZEH9UhI0PnkdfR30SZvvoSyV7ynaBncTLEwBYWfUrG4IdzrpmjvAKS2a06vY7ReLjl6MGktfk6NaRQrN-tHBcs3GbLIDJ4x5s_O4NXZYGeNFUdkjS5iJJidsmP7fXHqWo7RlGL9mbNgg.svg',
  '7K5Bmcq7qiQ6Eud7OD2A2hTmRHTxkShb8lmf3EVD4alegph6WnxOEzfOYxM0LDCXkfT_vVZ9_Hjk_XXaRJlTsMPB9epfyN8kUFonEnB4GTiHlonXo_oKqJs4AR9MJhtmsVX8j90IdFvH1Ujko6XLOQ.svg',
  '8iC8ebMvPPfZeTUkj9VBmsrPUw4lPJp9ITlR115EWv0ULvgo-S_CtNWa2TNlKwzqNS_KGPNo6xFnF_UxcRLylG-HIYXXoRmhDQUjoZvi8kTTM3-1l5hd558xNYS5PlZxUCI3j1XXJbcotsBxfHIeNQ.svg',
  'ARxaH4OpVaUc1UjpOv2UhQ8hgPGt-JH64gkcWcIAGz4XfVyiy1LAog-99r2v_a3zax4EEZzaMKE5l2tFcQ7i7A.svg',
  'BRqtD2yZxxRP08TEpNXXNlHvXxtA9Dck7kO4rNAiyud7WyX1EudEU0Y7XpRaIi0eGipOIqU1iZRx06TjD87Bu_8PuSHC-vYi2expOi_ie9INQgZ_8lkfsq7WCiYGssRZvARyM-hmOKkZEOhr4vxl6Q.svg',
  'BzBaSlPhUQvUgTbep2YBg19b6coNL8iXPJp-BBD6f4z-rfsdylm8zOJnrkRmUWdJoQgJIDNuh7LnNaUeJ_B8Q32S11shONnXjdlQTFLz_5LSzLoW5D7pmuYXc99y6tWUOByfVz00-KNaJ9YAXRk2Eg.svg',
  'CTCL5r-2Lrik1gBj6n7B0qyIP13vlZUsO_9YpcjuK8Hr8gUiNH33HhuUpwYDmywHYEBZencD5-2p_cJIfunWiqJXR16H5tsIW3hL6qiUK4o3afLmSrpCAf85-c-TDMmsTZRiKr9kWrRUGmMuKFNXlQ.svg',
  'D8d0CAJYg56wMGb2nqUnU5thBBSBSisClhYH5WA_KfgBzdgzgn4Tb-Wd8VtH17Nsal4NkSk9XZ2SwUgLUuhVVg.svg',
  'EL-GmGKqmm_1_UI1I1HmCwdRis9GIdUfq0tBhZlKnvvB51kv2Wn0hFOfrApbJwh68wKSsYejtF7VN4Htuk2beb2mBOKIBpIM7NphrfKxnZWtfymCW5185hIVDb5q1_GmhJPNTV4GXIWat2Uw7SUHcw.svg',
  'FIN9iKw1Cdlcw0qdsLudvODTjrdndKbpbhu2rrzXy_MHd5LgMZBsbXaErtn_kNzWxM6iTiR7rJlKDcOV0TJ5UO7kwpWLap2PqskFK8q7Lb4kbHzAlpLii3vrpXzQbKneH9d2GEmKXMNl6VrkeepcXQ.svg',
  'Fbc3OBO5lnF_aljwIte4mbdQIFVsutSyv5oZ3_JZ5vZ5_Ez_Se0pe47JqRTjOZBqtlFGxYQXYzlG820nGt_M4of6r_OTf2hzjBGAa4UbekunDcLTFOXnG8Moc_cIMDhrABFn_g42rUoQk6FTMBErqg.svg',
  'Fbe6yAmPhTGyBpbFnJrzWROlvct5aNx2TBIUKqyiunO_iZdfvBKbFzh7FVPmqRQpeRfEKA-pz-QeTLTsfVj7NxKMy8mEN8NUKbf9r0p4VlGyHGibJqXQKEBS-4NE0QWMgj4CvofMTvCYXMovp3WWNg.svg',
  'GwHvDSCNafSHnRiZNqDMJOvThTG4_8QJgEFMZC3jlpTg_e_IMR2WWQcB4W641zxOwU219ER8opVMfaK8uhdrl-F69hJn02bChdq-cAheQjLEjDthTLEr4gaXwc4V8ZDNYdfj319zkwONKucgD_G05w.svg',
  'Kl7O19oIwFHCfL2QV05oLVVoL684vmbcbpFHyQCiQRiYr7Dgb18bXQM9qY__l0rm0dlPJKRTqAcwaqRcmvg_m0mVOvVfkrcdjER-1QOvtudPOP8len_6uFgfriIGYpYVBjmCyJ0RAHKe7JjZ1soeWw.svg',
  'N_7oK9jBqgd4o6MM1imyAIM0lZK2Rsr_oc9HDG8WRllhnrld37ChFRXkVZA5aMK-PSrkr9Y9LBrKuF0mQCMGP09WApahFXbjqTh-Rpw7fYqHkc2f7CKt7xCTc2OG0y1e1LPxvAqnwH4XOpxyWIyMMg.svg',
  'PV5QhQJrjCNrlEkK4HE-Myx-FNqaklavtwzZAzm_tVkUiX5U0kp-Ujm4vqKipQmsZj86CgDo_HVBtEEFgMCWIyrR7zWurNboYJJdW60duDKqWBF0ci_KpyXJ2-goGoXSB2_RmNotjMlducSl0kt_aA.svg',
  'Qqb24ODKcfgDz0dpJRti2CqDr9MThAod9YacFPOKifdbjvhBkviT1LgksZ5bxp92WDj3AsUa0h214Ln6fv3ejj1UxiP4hJfpPfq_u5Ae217Thzzkv3FqP9hDDBDGaNNBHJ1ypWViORlHmkucr_Elng.svg',
  'RDynDFYidWJ6Plgi-NOQnlBIMy3xfHiR0zgdLhyrv0PKCdBdstgmskNWU9s6MZ9iKGqbCRe8kK1zELijChT4yyIT285FNArduGoMzOK6nr3Jia0qu7Prqzk2awOznbMlKYQyxTaA_eSLDVRDyQFZpg.svg',
  'SRrqBgHlAil9jg2n7I4SZkLRwUcDf3bN51-iBsr1XI6-4a52MvSjP0EHo3CZVsDIXLkpG2FF-yj5P50n6D37IdfQdt-VN7OqAuH4QnmjXnD76Tomw6YDwsCJzUz29pBTReqT3XzKyXDg1V7bUd7ESQ.svg',
  'U4btAF6fKzlMyx9V0YciDz02RYAMbqpypTkUZjxYxE2LTOl9GYED7b76bOg8IXDfq16Er1Lc9ugCJpjWkovcWHgVfqHBd_TvxltZBFYmSSV1m8QMnkoIHR6Tywr3rwxBl48dWmnpOcgI9H9TeSFsow.svg',
  'UdBMIeaNY-f9X2gSNVhgxANC0H0qiODudLXatPoQjcSUpWgdrsaFw_-L7EEU_0IhP1S6YHN3O4rm29ZOkM3P7fmR9rupS6eKviyXKfbKIMZ40EJnLVuAfhABaiEwPQUOHr5ElOSVFJSGfXQAf7FGBQ.svg',
  'W-Vzx_gdMaygn9LC-dNJuYIwz1dmiuk3LQMq9Pz692djzQ4OJeChfUYwkz393ioiyF0PUoh3aLTsw9qUs3hye41a8pueOhabVVgQxgrqfzN3uWlb6dIlJRracrtHx89cSXymXSF7gFOLl5BYrPXHcQ.svg',
  'WSvPMQh9MwaVyaaVkcJPXPAiHlt12lq_eWCs90KgbdOR6eMxcx2pcunmCoAYdAdKZfWiYd5v0k14ipyy2pulf9Eyks272dwhRCaso4mg63ZPh37yiQdgMnJGR-31GGXLA-zITyEy5h5LnReY7bc1zA.svg',
  'XXLbXSTUNd81exsQZBpIUQ1IC0deGb2wn7k8XnBs90slAobx4aULfeAyNNgktrdj-Xq-zHReZp5V_AQg1Xz4mKil6JqQnJx1Gvw4OBIbbCvxjBvL8MwFZ9inQ4rZ4vvwbuqdJ9hj2EN81Bv-LfLaFA.svg',
  'X_a20hnOPysVQ2Ybud5BiG9JsePpQUlAgZ7I7k75OlqQ8Jjbds4mEYR6MtxSN6BiigG6NX7zzA8FHq65y0En9A.svg',
  'Y2LNYrBudEa_mY0hs5l96vum89cGWqz6VURoh1IE9aw_IEhYDrXz6b0O06n5DLk-pt7_jWtOlsCTmoYb0PSN1kBJxv5LngLUpuC38B-CzvqNXaNJbkXxdlyswVkxGKHa2lZrq_7ciWKJCel_ddn_Fw.svg',
  '_U8AZPEKrsCgmI1EUdrRRU2o0rIak0dD3YcYb9E-mbUIWCJgySxaZrD1fFIwBaH-DJHTqeYAnL21qOcrduPq77vjh7JGHfC2z-BBrLrug3CL3njFD4x-xXDe89OAI5QCiMnKS3LN3RKFCmT8Yz_Yww.svg',
  'bTM6JHPFAd0TpQVfLybhadM48U9brNK0kr0RZPccZbU-8ZydayEHX19VoisuMNT4RXwlW4ReYpecuv-WALAmfUTxMg2UAA-dMPbuI4AExhpEY7ZgdiGAABBuc2VUpzXun8FdUeGryg7k6OJTfeaVLw.svg',
  'bzyX-bcOszBIyZp4I9fXQHBFCFJlDtVZ5NAQb3ipvPR8xehdx99F-xWHDTsVUbM8pEujQv1TQTTrXD7A3Xaaba9t-GOg2yNCBMg7hOg0SIPDGyOWqaSUu3VEY17h1JzvHNtpDPWW7Hs7aA6kUQ0MQw.svg',
  'ezX7tL2KZPta0ZvP1Lkh_OEXPbdgEfRygo9kCyM6vcb8JBEagUiFXb22DZl_vszRJjZO9skUXjyliiatyZDDrIrbcTzCCTYenibs7LacOErXMCZq_3C3GA6psClsFYu2Q9T_ioSus-WY3ie67qYG5w.svg',
  'fSD1BTd2CtrHz6EOr23a-JtJf_xlusDFuqwHTrrG_Ana3MZO0gD6Z0RxLLG56Wu26d5_eUAtRN71BnavVSNjVhvWQfUYxxFP6SpORqui38vEkw0pEBy9D8sPMnvKROtnKcz9JY7E4R13G-5-whvCvA.svg',
  'fSIkZyWM4rM1gidxaCFUQ18r872Dm4xWpkZ-rFUz89PpjWylA8hmh39lEg-29Z7Ok5k9BqXFXL8b95YAEJfChb5RCN6MDIdRxJWHrJVZ9r5Q6P-7SfXNt95Fkc6EGSveca4iFCOARq7mIJF_plvv_A.svg',
  'fx6sKNDVDFsbOENLe-xTfc1KM8m5bvpjGu6zacCGE9LmgG905q2XR7mqVwmYwhdTTNBOHguEhWr0O71Zyk8oFRDg3iXQp68IQ-v4oe1-1kSud1cDyCHESwPOEMRiZVjzMlImqZ3Y_6jwFrOH1PyfnA.svg',
  'gQQBEDoS4V9wEzN-pj8dTe3V90azRcnv9wEVO3sxVQ76hOji4FinhMT-BZExwiOFhthnYBwEZR98A1ledzfgGQuHMloSpNtMAJ2aEvwhvlB_gwIIfpE08qtHptw_EznuI4YicbPYt708m7jGGsrO0Q.svg',
  'hVgF57hJ3xB0lWARAqgbKzF11iF_jHKPcy54Eatniz_PFt7nn-VH2zQRz93Lrzr14E07XvB2NeeHPH9_Tlxe75PO0-Sm1eByKRVeSEh9CAz-vzvDx1S69XMAP8d5YC_8skzq_6gt2qzVNxtS0F_bxA.svg',
  'lJaLPyiCksy4rKDEV86j9XqTd1QnIaiSPRZseWCttzMNixmZoBoggD7_wObo5aWy-30Xq22vNOgK7iwlobpvnO_PQIhrntTuBobFXVSjz9whoeU1IBExjolEGGdMydMmqKS6urghRnD2XACePGbp0A.svg',
  'mrnlNZzBeFxCorw5B0VjguNwYyRwYOZeMdp_UjoG5y7mbvBrkiv7hm0F8fiFsuUuyo8B83Uqv1Gz-v5Oe0FvoWZcBLoKuuZ88v9TkwFFzEGmApWGQiCCCCpR8ykp5nOGhOpYHt7tiAAyDFiy8_GknQ.svg',
  'n8d4p6AMfV8YVZiX5mst1veEfo9S7-y2GSe9ar-wGOEIa7y9w2mHQGm-a7w4BKzArAwN-Mhhv_jkfZfh1gc4aQ.svg',
  'nzX7hfiNDhzsZ5CC1dEpPbS84Ic2VNMBA4KAv-MfUcyYAlE_xhBUMhNq35nxuu-spWifKWjVzP_Q1jBbUAL4faNd2JlExARVqQeJkhOFGYJy0ZzAMkDFYqT83_MiQS5Rj1bRHdE8I2yVdtpeQYYwAg.svg',
  'oGx8Lf-pK-fz_NQBIQ6z0pJB386NEHT88b0IbG-WIuBmV5uzV1Ryi958B1bU0C0djwVNOZ-J7McjnTTz5EiVajLJz9Vfp2_vc6sFQ_gWgzzh8vRe6Mk1SNiAwRtcP-L-uE8bkMOeK5DE0JRd-O3aRA.svg',
  'p-10BFRQN-_hRreerH2X6Y1rzrcspaEiODZ0m9n3VonlNG_3KoJbQQo_i_aIEr56siCqXNmeOcfLSReRQsdB0w.svg',
  'tURiQcsQ4gqf5yehCIeBxoqAPAp8kbvJCFHt3pnJy5cf2d27mEVfyAwQtWdTT1aJP1wjS_dJlZzdGEk7P9fcrHezTDlrqqIb-ZQnXIkOgcp-S37Yit2UBGVMPyf6eUae605-0LzI5GdO3wQ0GRxRjg.svg',
  'uDLH9KAZCQMK2nqJyLEVJ9UzXnKO7uVJYZ4mgZMRS7m8wy6u7X2et3QHKDwYKNdhKoqjDWdMrhzpPpC9H1_L8Q-KOZwPbdcd3WdTSgJs-6g5N0zlZj3D-hgnY0s-VcAcLRTR1zgAwbD_bByywC802Q.svg',
  'wIbC6OJ5H0FmZ5ljUXYISpzR8H-x7weQqVldRanCw9g64JL4tUoxQamNgG_w_byq-wfm_gU--v1HdcKRG-0OMCVkZ1GI3EVnpUQ0fQAByE-nRXkPxhtx8emKKE0MSgw5T3MNYJ3Gju1j_Iqf7oImSg.svg',
  'y1AlwExMBWcxyTKygmw8EVoS0g_9Y_pLgbPEhUkc25b_h-4yTyiaVLSkVL0HjhFbX6cyQML4Uvk2LQYndy2Cs8Cys7FcUr8PqXwh9fRC0h8GtKB8nCZwaSWx3AFt-TdtPpWzytnx9w6owHJcAjeFEQ.svg',
  'ywnQTrlMBh8nsZsYJ-5WCT1d26iSqwxByWYPRIUtq4s2vJKvt_U1BxswLhWhvPg1txioQ7jtlSQ020q6ox0FVPVb8QXxK6rRYUO1mPoU9jEDg2qqGJoES4flW6d3opZKTcO7T1214OlUS6ch_RCUBA.svg',
  'zO55rSFFBt8SWtnaLX8pZ4KB6WlImBmSYRCCEAteo5NEAPrOKqtDmSGRDk2EXZUmiyPhdFCOKnkaCZ2BstnHa-h_Xz49IZDf1_R7H4gVSBEzRF4gZkgC6riVGwIDJnBd_Y7JbT_454w-PswxOT1OVw.svg',
];

const PARTNER_SVG_LOGOS = [
  'frame-1707490594.svg', 'frame-1707490595.svg', 'frame-1707490596.svg',
  'frame-1707490598.svg', 'frame-1707490599.svg', 'frame-1707490618.svg',
  'frame-1707490619.svg', 'frame-1707490620.svg', 'frame-1707490621.svg',
  'frame-1707490622.svg', 'frame-1707490623.svg', 'frame-1707490624.svg',
  'frame-1707490625.svg', 'frame-1707490626.svg', 'frame-1707490627.svg',
  'frame-1707490628.svg', 'frame-1707490629.svg', 'frame-1707490630.svg',
  'frame-1707490631.svg', 'frame-1707490632.svg',
];

/* ─── Page ─────────────────────────────────────────────────── */
export default function ClientsPage() {
  const t = useT();
  const [scrollY, setScrollY] = useState(0);
  const [mobileMenuOpen, setMobileMenuOpen] = useState(false);
  const [activeCategory, setActiveCategory] = useState('all');

  useEffect(() => {
    const h = () => setScrollY(window.scrollY);
    window.addEventListener('scroll', h, { passive: true });
    return () => window.removeEventListener('scroll', h);
  }, []);

  const filteredClients = activeCategory === 'all'
    ? CLIENTS
    : CLIENTS.filter((c) => c.category === activeCategory);

  return (
    <div className="min-h-screen bg-white text-gray-900 overflow-x-hidden">

      {/* ─── Floating Header ─────────────────────────────────── */}
      <header
        className="fixed top-0 left-0 right-0 z-50 flex justify-center transition-all duration-700 ease-out"
        style={{ padding: scrollY > 80 ? '12px 16px 0' : '0' }}
      >
        <div
          className={`flex items-center justify-between transition-all duration-700 ease-out ${
            scrollY > 80
              ? 'max-w-[720px] w-full h-[52px] px-4 bg-white/80 backdrop-blur-2xl shadow-lg border border-gray-200/60 rounded-full'
              : 'max-w-[1200px] w-full h-[60px] px-6 bg-transparent'
          }`}
        >
          <Link href="/biz" className="transition-all duration-700">
            <Image
              src="/images/logo-prettyful.svg"
              alt="Freetiful"
              width={scrollY > 80 ? 100 : 120}
              height={scrollY > 80 ? 30 : 35}
              className="transition-all duration-700"
              style={{ width: scrollY > 80 ? 100 : 120, height: 'auto' }}
            />
          </Link>

          <div className="flex items-center gap-1">
            <LanguageToggle />
            <button
              className="flex flex-col items-center justify-center gap-[5px] w-9 h-9"
              onClick={() => setMobileMenuOpen(true)}
            >
              <span className="block w-5 h-[2px] rounded-full bg-gray-900 transition-all duration-300" />
              <span className="block w-5 h-[2px] rounded-full bg-gray-900 transition-all duration-300" />
              <span className="block w-3.5 h-[2px] rounded-full bg-gray-900 transition-all duration-300" />
            </button>
          </div>
        </div>
      </header>

      {/* ═══ 모바일 메뉴 패널 ═══════════════════════════════════ */}
      {mobileMenuOpen && (
        <div className="fixed inset-0 z-[60]">
          <div
            className="absolute inset-0 bg-black/50 backdrop-blur-sm"
            onClick={() => setMobileMenuOpen(false)}
            style={{ animation: 'menuOverlayIn 0.3s ease-out' }}
          />
          <div
            className="absolute top-0 right-0 w-[280px] h-full bg-white shadow-2xl flex flex-col"
            style={{ animation: 'menuSlideIn 0.35s cubic-bezier(0.16, 1, 0.3, 1)' }}
          >
            <div className="flex items-center justify-between px-6 pt-6 pb-4">
              <span className="text-[14px] font-bold text-gray-900">{t({ ko: '메뉴', en: 'Menu', ja: 'メニュー', zh: '菜单' })}</span>
              <button onClick={() => setMobileMenuOpen(false)} className="w-8 h-8 flex items-center justify-center rounded-full hover:bg-gray-100">
                <X className="w-5 h-5 text-gray-500" />
              </button>
            </div>
            <div className="h-px bg-gray-100 mx-6" />
            <div className="flex-1 px-6 py-4 flex flex-col gap-1">
              {[
                { label: t({ ko: 'CEO 인사말',   en: "CEO's Message", ja: 'CEO 挨拶',         zh: 'CEO 致辞' }),     href: '/biz/ceo' },
                { label: t({ ko: '연혁',         en: 'Milestones',    ja: '沿革',             zh: '发展历程' }),      href: '/biz/history' },
                { label: t({ ko: '인재채용',     en: 'Careers',       ja: '採用情報',         zh: '人才招聘' }),      href: '/careers' },
                { label: t({ ko: '주요소식',     en: 'News',          ja: 'お知らせ',         zh: '主要消息' }),      href: '/biz', hash: '자료실' },
                { label: t({ ko: '자주묻는질문', en: 'FAQ',           ja: 'よくある質問',     zh: '常见问题' }),      href: '/biz/faq' },
                { label: t({ ko: '고객사',       en: 'Clients',       ja: '取引先',           zh: '客户' }),          href: '/biz/clients' },
              ].map((item) => (
                <Link
                  key={item.label}
                  href={item.hash ? `${item.href}#${item.hash}` : item.href}
                  className="flex items-center justify-between py-3.5 px-2 rounded-xl text-[15px] font-medium text-gray-700 hover:bg-gray-50 active:bg-gray-100 transition-colors"
                  onClick={() => setMobileMenuOpen(false)}
                >
                  {item.label}
                  <ChevronRight className="w-4 h-4 text-gray-300" />
                </Link>
              ))}
            </div>
            <div className="px-6 pb-8">
              <Link
                href="/biz#문의폼"
                className="block w-full py-3 bg-gray-900 text-white text-[14px] font-bold rounded-full text-center active:scale-95 transition-transform"
                onClick={() => setMobileMenuOpen(false)}
              >
                {t({ ko: '문의하기', en: 'Contact Us', ja: 'お問合せ', zh: '联系我们' })}
              </Link>
            </div>
          </div>
        </div>
      )}

      {/* ═══ Hero ═══════════════════════════════════════════════ */}
      <section className="relative flex min-h-[60vh] items-center justify-center pt-[60px] overflow-hidden">
        <div className="absolute inset-0 bg-gradient-to-br from-blue-50/60 via-white to-gray-50/40" />
        <div className="absolute inset-0 bg-gradient-to-b from-transparent via-transparent to-white" />

        <div className="relative z-10 text-center px-6">
          <Reveal>
            <p className="mb-5 text-[11px] font-bold tracking-[0.4em] text-gray-400">OUR CLIENTS</p>
          </Reveal>
          <Reveal delay={200}>
            <h1 className="text-[36px] font-black leading-[1.15] tracking-tight md:text-[56px]">
              {t({
                ko: <><span className="text-gray-900">함께하는 </span><span className="bg-gradient-to-r from-blue-600 to-blue-400 bg-clip-text text-transparent">고객사</span></>,
                en: <><span className="text-gray-900">Our </span><span className="bg-gradient-to-r from-blue-600 to-blue-400 bg-clip-text text-transparent">Clients</span></>,
                ja: <><span className="text-gray-900">共に歩む</span><span className="bg-gradient-to-r from-blue-600 to-blue-400 bg-clip-text text-transparent">取引先</span></>,
                zh: <><span className="text-gray-900">我们的</span><span className="bg-gradient-to-r from-blue-600 to-blue-400 bg-clip-text text-transparent">客户</span></>,
              }) as any}
            </h1>
          </Reveal>
          <Reveal delay={400}>
            <p className="mx-auto mt-4 max-w-[500px] text-[15px] leading-relaxed text-gray-400">
              {t({
                ko: <>대한민국 대표 기업, 기관, 방송사가 선택한<br />프리티풀의 전문 진행자 매칭 서비스</>,
                en: <>Trusted by Korea's leading companies,<br />institutions, and broadcasters</>,
                ja: <>韓国を代表する企業・機関・放送局が選ぶ<br />Freetiful のプロ司会者マッチングサービス</>,
                zh: <>韩国代表企业、机构、广播公司的共同选择<br />Freetiful 专业主持人匹配服务</>,
              }) as any}
            </p>
          </Reveal>
        </div>
      </section>

      {/* ═══ Stats ═══════════════════════════════════════════════ */}
      <section className="py-16">
        <div className="mx-auto max-w-[900px] px-6">
          <Reveal>
            <div className="grid grid-cols-2 md:grid-cols-4 gap-6">
              {[
                { num: '500+',   label: t({ ko: '누적 고객사',    en: 'Total Clients',      ja: '累計取引先',      zh: '累计客户' }) },
                { num: '2,000+', label: t({ ko: '진행 행사',      en: 'Events Hosted',      ja: '実施イベント',    zh: '举办活动' }) },
                { num: '98%',   label: t({ ko: '고객 만족도',    en: 'Client Satisfaction', ja: 'お客様満足度',    zh: '客户满意度' }) },
                { num: '1,000+', label: t({ ko: '전문 진행자',    en: 'Pro Hosts',          ja: 'プロ司会者',      zh: '专业主持人' }) },
              ].map((stat, i) => (
                <div key={i} className="text-center">
                  <p className="text-[32px] md:text-[40px] font-black bg-gradient-to-r from-blue-600 to-blue-400 bg-clip-text text-transparent">{stat.num}</p>
                  <p className="mt-1 text-[13px] text-gray-400 font-medium">{stat.label}</p>
                </div>
              ))}
            </div>
          </Reveal>
        </div>
      </section>

      {/* ═══ Partner Logo Grid ═══════════════════════════════════ */}
      <section className="py-24 bg-gray-50/60">
        <div className="mx-auto max-w-[1100px] px-6">
          <Reveal>
            <p className="text-[11px] font-bold tracking-[0.4em] text-blue-500">PARTNERS</p>
          </Reveal>
          <Reveal delay={100}>
            <h2 className="mt-3 text-[30px] font-black tracking-tight md:text-[38px]">{t({ ko: '파트너사', en: 'Partners', ja: 'パートナー企業', zh: '合作伙伴' })}</h2>
          </Reveal>
          <Reveal delay={200}>
            <p className="mt-3 text-[15px] text-gray-400 max-w-[500px]">{t({
              ko: '프리티풀과 함께 성장하는 기업들입니다',
              en: 'Companies growing together with Freetiful',
              ja: 'Freetiful と共に成長する企業です',
              zh: '与 Freetiful 共同成长的企业',
            })}</p>
          </Reveal>

          {/* 파트너사 SVG 로고 */}
          <div className="grid grid-cols-2 sm:grid-cols-3 md:grid-cols-4 lg:grid-cols-5 gap-5 mt-12">
            {PARTNER_SVG_LOGOS.map((logo, i) => (
              <Reveal key={logo} delay={i * 20}>
                <div className="group bg-white border border-gray-100 rounded-2xl p-6 flex items-center justify-center h-24 transition-all duration-300 hover:border-gray-200 hover:shadow-md">
                  <img
                    src={`/images/partners/${encodeURIComponent(logo)}`}
                    alt="파트너사 로고"
                    className="max-h-12 max-w-full object-contain opacity-70 group-hover:opacity-100 transition-opacity duration-300"
                  />
                </div>
              </Reveal>
            ))}
          </div>

          {/* 프리티풀 파트너스와 함께한 기업들 */}
          <Reveal delay={100}>
            <h3 className="mt-16 text-[22px] font-bold tracking-tight text-gray-900">{t({
              ko: '프리티풀 파트너스와 함께한 기업들',
              en: 'Companies that worked with Freetiful Partners',
              ja: 'Freetiful パートナーと共にした企業',
              zh: '与 Freetiful Partners 合作的企业',
            })}</h3>
          </Reveal>

          {/* 기업 로고 */}
          <div className="grid grid-cols-3 sm:grid-cols-4 md:grid-cols-6 lg:grid-cols-8 gap-4 mt-8">
            {PARTNER_LOGOS.map((logo, i) => (
              <Reveal key={logo} delay={i * 10}>
                <div className="group bg-white border border-gray-100 rounded-2xl p-4 flex items-center justify-center h-20 transition-all duration-300 hover:border-gray-200 hover:shadow-md">
                  <img
                    src={`/images/company-logos/${logo}`}
                    alt="기업 로고"
                    className="max-h-10 max-w-full object-contain opacity-60 group-hover:opacity-100 transition-opacity duration-300"
                  />
                </div>
              </Reveal>
            ))}
          </div>
        </div>
      </section>

      {/* ═══ Testimonials ═══════════════════════════════════════ */}
      <section className="py-24">
        <div className="mx-auto max-w-[900px] px-6">
          <Reveal>
            <p className="text-[11px] font-bold tracking-[0.4em] text-blue-500">TESTIMONIALS</p>
          </Reveal>
          <Reveal delay={100}>
            <h2 className="mt-3 text-[30px] font-black tracking-tight md:text-[38px]">{t({ ko: '고객 후기', en: 'Customer Reviews', ja: 'お客様の声', zh: '客户评价' })}</h2>
          </Reveal>

          <div className="mt-12 grid gap-6 md:grid-cols-2">
            {[
              {
                quote: t({ ko: '프리티풀 덕분에 회사 송년회를 완벽하게 진행할 수 있었습니다. 전문 MC의 진행이 행사의 품격을 한층 높여주었습니다.', en: "Thanks to Freetiful, our company's year-end party went perfectly. The professional MC elevated the quality of the event.", ja: 'Freetiful のおかげで会社の忘年会を完璧に進行できました。プロ MC の進行がイベントの品格をさらに高めてくれました。', zh: '多亏 Freetiful,我们公司的年会完美举办。专业 MC 的主持让活动更加高档。' }),
                author: t({ ko: '김OO', en: 'Mr. Kim', ja: '金OO', zh: '金先生' }),
                role: t({ ko: '대기업 인사팀 과장', en: 'HR Manager, Large Corp.', ja: '大手企業 人事部課長', zh: '大企业人事部课长' }),
                company: t({ ko: '삼성전자', en: 'Samsung Electronics', ja: 'サムスン電子', zh: '三星电子' }),
              },
              {
                quote: t({ ko: '결혼식 사회자를 고민하다가 프리티풀을 알게 되었어요. AI 매칭으로 딱 맞는 분을 만나 최고의 결혼식이 되었습니다.', en: 'I was looking for a wedding MC and discovered Freetiful. The AI matching found the perfect host and made my wedding unforgettable.', ja: '結婚式の司会者を悩んでいて Freetiful を知りました。AI マッチングでぴったりの方に出会い、最高の結婚式になりました。', zh: '为婚礼主持犹豫时发现了 Freetiful。AI 匹配为我找到了最合适的主持,成就了最棒的婚礼。' }),
                author: t({ ko: '이OO', en: 'Ms. Lee', ja: '李OO', zh: '李女士' }),
                role: t({ ko: '신부', en: 'Bride', ja: '新婦', zh: '新娘' }),
                company: t({ ko: '웨딩 고객', en: 'Wedding Client', ja: '結婚式のお客様', zh: '婚礼客户' }),
              },
              {
                quote: t({ ko: '신제품 런칭 이벤트에 전문 쇼호스트를 섭외했는데, 기대 이상이었습니다. 매칭부터 행사 당일까지 매니저 분의 케어가 훌륭했습니다.', en: "We booked a professional show host for our product launch — the result exceeded expectations. The manager's support from matching to event day was exceptional.", ja: '新製品ローンチイベントにプロショーホストを依頼しましたが、期待以上でした。マッチングからイベント当日までマネージャーの対応が素晴らしかったです。', zh: '为新品发布会邀请了专业购物主持人,效果超出预期。从匹配到活动当天,经理的服务都非常出色。' }),
                author: t({ ko: '박OO', en: 'Mr. Park', ja: '朴OO', zh: '朴先生' }),
                role: t({ ko: '마케팅 팀장', en: 'Marketing Lead', ja: 'マーケティングチームリーダー', zh: '营销团队负责人' }),
                company: t({ ko: 'IT기업', en: 'IT Company', ja: 'IT 企業', zh: 'IT 企业' }),
              },
              {
                quote: t({ ko: '학술 컨퍼런스 진행자를 급하게 구해야 했는데, 프리티풀에서 하루 만에 완벽한 분을 매칭해주셨습니다. 정말 감사합니다.', en: 'I urgently needed a host for an academic conference, and Freetiful matched a perfect candidate within one day. Truly grateful.', ja: '学術カンファレンスの司会者を急募しなければならず、Freetiful で 1 日で最適な方をマッチングしていただきました。本当に感謝しています。', zh: '紧急需要学术会议主持人,Freetiful 一天内就为我匹配到了最合适的人选。非常感谢。' }),
                author: t({ ko: '최OO', en: 'Mr. Choi', ja: '崔OO', zh: '崔先生' }),
                role: t({ ko: '학회 사무국장', en: 'Conference Director', ja: '学会事務局長', zh: '学会事务局长' }),
                company: t({ ko: '대학 연구기관', en: 'University Research', ja: '大学研究機関', zh: '大学研究机构' }),
              },
            ].map((tm, i) => (
              <Reveal key={i} delay={i * 100}>
                <div className="border border-gray-100 rounded-2xl p-7 transition-all hover:border-gray-200 hover:shadow-sm h-full flex flex-col">
                  <div className="text-[28px] text-blue-200 font-serif leading-none mb-3">&ldquo;</div>
                  <p className="text-[14px] leading-[1.8] text-gray-500 flex-1">{tm.quote}</p>
                  <div className="mt-5 pt-4 border-t border-gray-50 flex items-center gap-3">
                    <div className="w-10 h-10 rounded-full bg-gradient-to-br from-gray-200 to-gray-300 flex items-center justify-center">
                      <span className="text-[13px] font-bold text-gray-500">{tm.author.charAt(0)}</span>
                    </div>
                    <div>
                      <p className="text-[13px] font-bold text-gray-900">{tm.author}</p>
                      <p className="text-[11px] text-gray-400">{tm.role} · {tm.company}</p>
                    </div>
                  </div>
                </div>
              </Reveal>
            ))}
          </div>
        </div>
      </section>

      {/* ═══ CTA ═══════════════════════════════════════════════ */}
      <section className="py-24 bg-gray-50/60">
        <div className="mx-auto max-w-[600px] px-6 text-center">
          <Reveal>
            <h2 className="text-[28px] font-black tracking-tight md:text-[36px]">
              {t({
                ko: <>프리티풀과 함께<br /><span className="bg-gradient-to-r from-blue-600 to-blue-400 bg-clip-text text-transparent">성공적인 행사를 만들어보세요</span></>,
                en: <>With Freetiful,<br /><span className="bg-gradient-to-r from-blue-600 to-blue-400 bg-clip-text text-transparent">create a successful event</span></>,
                ja: <>Freetiful と共に<br /><span className="bg-gradient-to-r from-blue-600 to-blue-400 bg-clip-text text-transparent">成功するイベントを作りましょう</span></>,
                zh: <>携手 Freetiful<br /><span className="bg-gradient-to-r from-blue-600 to-blue-400 bg-clip-text text-transparent">打造成功的活动</span></>,
              }) as any}
            </h2>
          </Reveal>
          <Reveal delay={100}>
            <p className="mt-4 text-[14px] text-gray-400 leading-relaxed">
              {t({
                ko: <>검증된 전문 진행자와의 맞춤 매칭으로<br />어떤 행사든 완벽하게 만들어 드립니다.</>,
                en: <>Custom matching with verified professional hosts<br />makes any event perfect.</>,
                ja: <>認証済みのプロ司会者とのカスタムマッチングで<br />どんなイベントも完璧に仕上げます。</>,
                zh: <>通过与认证专业主持人的定制匹配,<br />任何活动都能完美呈现。</>,
              }) as any}
            </p>
          </Reveal>
          <Reveal delay={200}>
            <div className="mt-8 flex flex-col sm:flex-row justify-center gap-3">
              <Link
                href="/biz#문의폼"
                className="inline-flex items-center justify-center gap-2 bg-gray-900 px-8 py-3.5 text-[14px] font-bold text-white rounded-full transition-all hover:bg-gray-800 active:scale-95"
              >
                {t({ ko: '기업 문의하기', en: 'Business Inquiry', ja: '法人お問合せ', zh: '企业咨询' })}
              </Link>
              <Link
                href="/biz"
                className="inline-flex items-center justify-center gap-2 border border-gray-200 px-8 py-3.5 text-[14px] font-bold text-gray-500 rounded-full transition-all hover:border-gray-300 hover:text-gray-800 hover:bg-gray-50"
              >
                {t({ ko: '회사소개 보기', en: 'About Us', ja: '会社紹介を見る', zh: '查看公司简介' })}
              </Link>
            </div>
          </Reveal>
        </div>
      </section>

      {/* ═══ Footer ═══════════════════════════════════════════ */}
      <footer className="border-t border-gray-100 py-12 bg-white">
        <div className="mx-auto max-w-[1000px] px-6">
          <div className="flex flex-col gap-6 md:flex-row md:items-center md:justify-between">
            <div>
              <p className="text-[16px] font-black text-gray-900">Freetiful</p>
              <p className="mt-1 text-[11px] text-gray-300">{t({ ko: '프리티풀', en: 'Freetiful', ja: 'Freetiful', zh: 'Freetiful' })} | {t({ ko: '서울 중구 퇴계로 36길 2, 본관 130호', en: 'Rm 130, Main Bldg, 2 Toegye-ro 36-gil, Jung-gu, Seoul', ja: 'ソウル中区退渓路36ギル2 本館130号', zh: '首尔中区退溪路36街2号 本馆130号' })}</p>
              <p className="text-[10px] text-gray-200">Copyright &copy; Freetiful. All rights reserved.</p>
            </div>
            <div className="flex gap-4 text-[12px] text-gray-300">
              <Link href="/biz" className="transition-colors hover:text-gray-500">{t({ ko: '회사소개', en: 'About', ja: '会社紹介', zh: '公司简介' })}</Link>
              <Link href="/careers" className="transition-colors hover:text-gray-500">{t({ ko: '채용', en: 'Careers', ja: '採用', zh: '招聘' })}</Link>
              <Link href="/main" className="transition-colors hover:text-gray-500">{t({ ko: '홈으로', en: 'Home', ja: 'ホーム', zh: '返回首页' })}</Link>
            </div>
          </div>
        </div>
      </footer>

      {/* ─── Keyframes ─────────────────────────────────────────── */}
      {/* eslint-disable-next-line react/no-danger */}
      <div dangerouslySetInnerHTML={{ __html: `<style>
        @keyframes menuSlideIn {
          0% { transform: translateX(100%); }
          100% { transform: translateX(0); }
        }
        @keyframes menuOverlayIn {
          0% { opacity: 0; }
          100% { opacity: 1; }
        }
      </style>` }} />
    </div>
  );
}
