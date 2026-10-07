'use client';

import { useState, useEffect, useRef } from 'react';
import Link from 'next/link';
import Image from 'next/image';
import { useRouter } from 'next/navigation';
import {
  ChevronRight, ChevronLeft, Shield, Briefcase, Download, MapPin, Phone, Mail,
  Clock, FileText, Send, X, Copy, Check,
} from 'lucide-react';
import toast from 'react-hot-toast';
import { useT } from '@/lib/biz/i18n';
import LanguageToggle from '@/components/biz/LanguageToggle';
import { CountUp, FadeUp, PhoneFrame, ScrollFillText, useInView } from '@/components/biz/biz-motion';

/*
 * 프리티풀 비즈(261008 사장 '토스 홈페이지처럼 디자인해줘') — 토스 홈의 디자인 어법만 따랐다:
 *  첫 화면 가득 영상 + 흰 큰 제목 · 스크롤에 맞춰 차오르는 문장 · 넉넉한 여백과 큰 숫자 · 따라오는 폰 화면 · 아래에서 떠오르는 등장.
 *  토스의 그림 · 영상 · 글꼴 · 문구 · 코드는 쓰지 않았다(저작물) — 영상은 2025 송년회 원본에서 14초(소리 없음) 잘라 낸 것,
 *  폰 화면은 프리티풀 앱 실제 화면(채팅은 가상 대화), 글꼴은 사이트 기본 Pretendard.
 *  섹션 id(회사소개 · 핵심서비스 · 연혁 · 자료실 · 오시는길 · 문의폼)는 그대로 — iOS 네이티브 하단 네비(__freetifulBizScroll)가 쓴다.
 */

const INK = '#191F28';
const BODY = '#4E5968';

/* ─── Map (OpenStreetMap iframe, no API key needed) ──────── */
function BizKakaoMap() {
  return (
    <iframe
      title="프리티풀 오시는길"
      src="https://www.openstreetmap.org/export/embed.html?bbox=126.9863%2C37.5553%2C127.0013%2C37.5653&layer=mapnik&marker=37.56029%2C126.99376"
      className="h-full w-full border-0"
      loading="lazy"
    />
  );
}

/* ─── 정보 줄(주소 · 전화 · 이메일 · 업무시간) — 복사 단추 ─────── */
function CopyableCard({ icon, label, value, copyable }: { icon: React.ReactNode; label: string; value: string; copyable: boolean }) {
  const [copied, setCopied] = useState(false);
  const handleCopy = () => {
    navigator.clipboard.writeText(value).then(() => {
      setCopied(true);
      setTimeout(() => setCopied(false), 2000);
    });
  };
  return (
    <div className="flex items-start gap-4 rounded-[20px] bg-[#F9FAFB] p-5 md:p-6">
      <div className="flex h-11 w-11 shrink-0 items-center justify-center rounded-[14px] bg-white text-[#3182F6]">{icon}</div>
      <div className="min-w-0 flex-1">
        <p className="text-[13px] font-semibold text-[#8B95A1]">{label}</p>
        <p className="mt-1 break-all text-[16px] font-medium leading-[1.5] text-[#333D4B]">{value}</p>
      </div>
      {copyable && (
        <button
          onClick={handleCopy}
          className="flex h-9 w-9 shrink-0 items-center justify-center rounded-[12px] text-[#B0B8C1] transition-colors hover:bg-white hover:text-[#3182F6]"
          title="복사"
          aria-label={`${label} 복사`}
        >
          {copied ? <Check className="h-4 w-4 text-[#03B26C]" /> : <Copy className="h-4 w-4" />}
        </button>
      )}
    </div>
  );
}

/* ─── Constants ───────────────────────────────────────────── */
const COMPANY_INFO = {
  name: '프리티풀',
  nameEn: 'Freetiful',
  ceo: '서나웅',
  established: '2024년',
  business: '프리랜서 진행자 매칭 플랫폼',
  experts: '1,000여 명',
  address: '서울시 중구 퇴계로36길 2, 충무로관 본관 130호',
  phone: '02-765-8882',
  email: 'freetiful2025@gmail.com',
  website: 'https://freetiful.com',
  blog: 'https://blog.naver.com/freetiful2025',
  instagram: 'freetiful_',
  youtube: 'https://www.youtube.com/@freetiful',
  tiktok: 'https://www.tiktok.com/@freetiful',
};

const NAV_SECTION_IDS = ['회사소개', '핵심서비스', '연혁', '자료실', '오시는길', '문의'] as const;

const NAV_SECTION_LABELS = {
  '회사소개':   { ko: '회사소개',   en: 'About',     ja: '会社紹介', zh: '公司简介' },
  '핵심서비스': { ko: '핵심서비스', en: 'Services',  ja: 'サービス', zh: '核心服务' },
  '연혁':       { ko: '연혁',       en: 'Milestones',ja: '沿革',     zh: '发展历程' },
  '자료실':     { ko: '자료실',     en: 'Resources', ja: '資料',     zh: '资料库' },
  '오시는길':   { ko: '오시는길',   en: 'Location',  ja: 'アクセス', zh: '地址' },
  '문의':       { ko: '문의',       en: 'Contact',   ja: 'お問合せ', zh: '联系' },
} as const;

const PROMO_IMAGES = [
  '/images/biz-promo/promo-1.jpeg', '/images/biz-promo/promo-2.jpeg', '/images/biz-promo/promo-3.jpeg',
  '/images/biz-promo/promo-4.jpeg', '/images/biz-promo/promo-5.jpeg', '/images/biz-promo/promo-6.jpeg',
  '/images/biz-promo/promo-7.jpeg', '/images/biz-promo/promo-8.jpeg', '/images/biz-promo/promo-9.jpeg',
  '/images/biz-promo/promo-10.jpeg', '/images/biz-promo/promo-11.jpeg', '/images/biz-promo/promo-12.jpeg',
  '/images/biz-promo/promo-13.jpeg', '/images/biz-promo/promo-14.jpeg',
];

// 54개 기업 로고를 6줄에 9개씩 겹치지 않게 분배
const ALL_BIZ_LOGOS = [
  '/images/company-logos/ARxaH4OpVaUc1UjpOv2UhQ8hgPGt-JH64gkcWcIAGz4XfVyiy1LAog-99r2v_a3zax4EEZzaMKE5l2tFcQ7i7A.svg',
  '/images/company-logos/BRqtD2yZxxRP08TEpNXXNlHvXxtA9Dck7kO4rNAiyud7WyX1EudEU0Y7XpRaIi0eGipOIqU1iZRx06TjD87Bu_8PuSHC-vYi2expOi_ie9INQgZ_8lkfsq7WCiYGssRZvARyM-hmOKkZEOhr4vxl6Q.svg',
  '/images/company-logos/BzBaSlPhUQvUgTbep2YBg19b6coNL8iXPJp-BBD6f4z-rfsdylm8zOJnrkRmUWdJoQgJIDNuh7LnNaUeJ_B8Q32S11shONnXjdlQTFLz_5LSzLoW5D7pmuYXc99y6tWUOByfVz00-KNaJ9YAXRk2Eg.svg',
  '/images/company-logos/CTCL5r-2Lrik1gBj6n7B0qyIP13vlZUsO_9YpcjuK8Hr8gUiNH33HhuUpwYDmywHYEBZencD5-2p_cJIfunWiqJXR16H5tsIW3hL6qiUK4o3afLmSrpCAf85-c-TDMmsTZRiKr9kWrRUGmMuKFNXlQ.svg',
  '/images/company-logos/D8d0CAJYg56wMGb2nqUnU5thBBSBSisClhYH5WA_KfgBzdgzgn4Tb-Wd8VtH17Nsal4NkSk9XZ2SwUgLUuhVVg.svg',
  '/images/company-logos/EL-GmGKqmm_1_UI1I1HmCwdRis9GIdUfq0tBhZlKnvvB51kv2Wn0hFOfrApbJwh68wKSsYejtF7VN4Htuk2beb2mBOKIBpIM7NphrfKxnZWtfymCW5185hIVDb5q1_GmhJPNTV4GXIWat2Uw7SUHcw.svg',
  '/images/company-logos/FIN9iKw1Cdlcw0qdsLudvODTjrdndKbpbhu2rrzXy_MHd5LgMZBsbXaErtn_kNzWxM6iTiR7rJlKDcOV0TJ5UO7kwpWLap2PqskFK8q7Lb4kbHzAlpLii3vrpXzQbKneH9d2GEmKXMNl6VrkeepcXQ.svg',
  '/images/company-logos/Fbc3OBO5lnF_aljwIte4mbdQIFVsutSyv5oZ3_JZ5vZ5_Ez_Se0pe47JqRTjOZBqtlFGxYQXYzlG820nGt_M4of6r_OTf2hzjBGAa4UbekunDcLTFOXnG8Moc_cIMDhrABFn_g42rUoQk6FTMBErqg.svg',
  '/images/company-logos/Fbe6yAmPhTGyBpbFnJrzWROlvct5aNx2TBIUKqyiunO_iZdfvBKbFzh7FVPmqRQpeRfEKA-pz-QeTLTsfVj7NxKMy8mEN8NUKbf9r0p4VlGyHGibJqXQKEBS-4NE0QWMgj4CvofMTvCYXMovp3WWNg.svg',
  '/images/company-logos/GwHvDSCNafSHnRiZNqDMJOvThTG4_8QJgEFMZC3jlpTg_e_IMR2WWQcB4W641zxOwU219ER8opVMfaK8uhdrl-F69hJn02bChdq-cAheQjLEjDthTLEr4gaXwc4V8ZDNYdfj319zkwONKucgD_G05w.svg',
  '/images/company-logos/Kl7O19oIwFHCfL2QV05oLVVoL684vmbcbpFHyQCiQRiYr7Dgb18bXQM9qY__l0rm0dlPJKRTqAcwaqRcmvg_m0mVOvVfkrcdjER-1QOvtudPOP8len_6uFgfriIGYpYVBjmCyJ0RAHKe7JjZ1soeWw.svg',
  '/images/company-logos/N_7oK9jBqgd4o6MM1imyAIM0lZK2Rsr_oc9HDG8WRllhnrld37ChFRXkVZA5aMK-PSrkr9Y9LBrKuF0mQCMGP09WApahFXbjqTh-Rpw7fYqHkc2f7CKt7xCTc2OG0y1e1LPxvAqnwH4XOpxyWIyMMg.svg',
  '/images/company-logos/PV5QhQJrjCNrlEkK4HE-Myx-FNqaklavtwzZAzm_tVkUiX5U0kp-Ujm4vqKipQmsZj86CgDo_HVBtEEFgMCWIyrR7zWurNboYJJdW60duDKqWBF0ci_KpyXJ2-goGoXSB2_RmNotjMlducSl0kt_aA.svg',
  '/images/company-logos/Qqb24ODKcfgDz0dpJRti2CqDr9MThAod9YacFPOKifdbjvhBkviT1LgksZ5bxp92WDj3AsUa0h214Ln6fv3ejj1UxiP4hJfpPfq_u5Ae217Thzzkv3FqP9hDDBDGaNNBHJ1ypWViORlHmkucr_Elng.svg',
  '/images/company-logos/RDynDFYidWJ6Plgi-NOQnlBIMy3xfHiR0zgdLhyrv0PKCdBdstgmskNWU9s6MZ9iKGqbCRe8kK1zELijChT4yyIT285FNArduGoMzOK6nr3Jia0qu7Prqzk2awOznbMlKYQyxTaA_eSLDVRDyQFZpg.svg',
  '/images/company-logos/0kIrqSx6FQ6AZtryR8Rii4lXBGrvITgNfRhhiLfi2aVr-Uqg1l5bOMa4Vi3THlnZYVns6hi5Y75mBhXXS4r6dBfKvn1HPMRq10Gh8NrRBcZE0Pd7zOeDm9WYfDEvAaCZSVD12nCLfeJdkz9WXPnZ3w.svg',
  '/images/company-logos/1GPWKc37T7Qz08E07p9sDg0F4rYPxg_qbmh5CSSxrdDTQoy6hCl6k-UgoySwKANqEm0jCWiZjyMqaLUxX31_3RyRiW1yQ2L5zYtA6WzN7s5Zxy31rQSDGIotP0yP2rU6jhAVfxvxFl__q_NPEuRKAg.svg',
  '/images/company-logos/4nJH1a9BfVA9ilPdwu120VbDd-ERloXHcOus1u88Xhvpql-0zhgPSW9dj3zZKGKlGVEfqJwFPQLWwtXGYmft8KGikSA2N0n3yojcWKfrmKWyZ3dLtYmBFcKkeTn8CDL7HarNcbkEmB8AYP76lHFDTg.svg',
  '/images/company-logos/5bZLn7_cvlKQnqzT0_0hMSHeq0y1K-YgT4X40IT9qxQClHZTU3fHCuuIyI7JSjm7MmtDrWs1KBx7VtHyTk4rrbhhAhWa-EpxfAJwkoVV9vrn7DLNFlXNy6zNfET5B7ohb0ULDDwO99agnC9QOW7lKA.svg',
  '/images/company-logos/7JPcHcbSryZEH9UhI0PnkdfR30SZvvoSyV7ynaBncTLEwBYWfUrG4IdzrpmjvAKS2a06vY7ReLjl6MGktfk6NaRQrN-tHBcs3GbLIDJ4x5s_O4NXZYGeNFUdkjS5iJJidsmP7fXHqWo7RlGL9mbNgg.svg',
  '/images/company-logos/7K5Bmcq7qiQ6Eud7OD2A2hTmRHTxkShb8lmf3EVD4alegph6WnxOEzfOYxM0LDCXkfT_vVZ9_Hjk_XXaRJlTsMPB9epfyN8kUFonEnB4GTiHlonXo_oKqJs4AR9MJhtmsVX8j90IdFvH1Ujko6XLOQ.svg',
  '/images/company-logos/8iC8ebMvPPfZeTUkj9VBmsrPUw4lPJp9ITlR115EWv0ULvgo-S_CtNWa2TNlKwzqNS_KGPNo6xFnF_UxcRLylG-HIYXXoRmhDQUjoZvi8kTTM3-1l5hd558xNYS5PlZxUCI3j1XXJbcotsBxfHIeNQ.svg',
  '/images/company-logos/SRrqBgHlAil9jg2n7I4SZkLRwUcDf3bN51-iBsr1XI6-4a52MvSjP0EHo3CZVsDIXLkpG2FF-yj5P50n6D37IdfQdt-VN7OqAuH4QnmjXnD76Tomw6YDwsCJzUz29pBTReqT3XzKyXDg1V7bUd7ESQ.svg',
  '/images/company-logos/U4btAF6fKzlMyx9V0YciDz02RYAMbqpypTkUZjxYxE2LTOl9GYED7b76bOg8IXDfq16Er1Lc9ugCJpjWkovcWHgVfqHBd_TvxltZBFYmSSV1m8QMnkoIHR6Tywr3rwxBl48dWmnpOcgI9H9TeSFsow.svg',
  '/images/company-logos/-DYSKPXdCLcjcK4M44l9Za7ZgNQJR6-HT-yUvfPCCsoLqVEpndF3htzCH6cF_5sfNhc_KDDRXfbfTckyikUOuDYh8yGBlWNImoehI7PxTiNB8hj-MI7wj1cTbC7O98nRpdTYXkqgV3mqiKbSjKa9eQ.svg',
  '/images/company-logos/UdBMIeaNY-f9X2gSNVhgxANC0H0qiODudLXatPoQjcSUpWgdrsaFw_-L7EEU_0IhP1S6YHN3O4rm29ZOkM3P7fmR9rupS6eKviyXKfbKIMZ40EJnLVuAfhABaiEwPQUOHr5ElOSVFJSGfXQAf7FGBQ.svg',
  '/images/company-logos/W-Vzx_gdMaygn9LC-dNJuYIwz1dmiuk3LQMq9Pz692djzQ4OJeChfUYwkz393ioiyF0PUoh3aLTsw9qUs3hye41a8pueOhabVVgQxgrqfzN3uWlb6dIlJRracrtHx89cSXymXSF7gFOLl5BYrPXHcQ.svg',
  '/images/company-logos/WSvPMQh9MwaVyaaVkcJPXPAiHlt12lq_eWCs90KgbdOR6eMxcx2pcunmCoAYdAdKZfWiYd5v0k14ipyy2pulf9Eyks272dwhRCaso4mg63ZPh37yiQdgMnJGR-31GGXLA-zITyEy5h5LnReY7bc1zA.svg',
  '/images/company-logos/XXLbXSTUNd81exsQZBpIUQ1IC0deGb2wn7k8XnBs90slAobx4aULfeAyNNgktrdj-Xq-zHReZp5V_AQg1Xz4mKil6JqQnJx1Gvw4OBIbbCvxjBvL8MwFZ9inQ4rZ4vvwbuqdJ9hj2EN81Bv-LfLaFA.svg',
  '/images/company-logos/X_a20hnOPysVQ2Ybud5BiG9JsePpQUlAgZ7I7k75OlqQ8Jjbds4mEYR6MtxSN6BiigG6NX7zzA8FHq65y0En9A.svg',
  '/images/company-logos/Y2LNYrBudEa_mY0hs5l96vum89cGWqz6VURoh1IE9aw_IEhYDrXz6b0O06n5DLk-pt7_jWtOlsCTmoYb0PSN1kBJxv5LngLUpuC38B-CzvqNXaNJbkXxdlyswVkxGKHa2lZrq_7ciWKJCel_ddn_Fw.svg',
  '/images/company-logos/_U8AZPEKrsCgmI1EUdrRRU2o0rIak0dD3YcYb9E-mbUIWCJgySxaZrD1fFIwBaH-DJHTqeYAnL21qOcrduPq77vjh7JGHfC2z-BBrLrug3CL3njFD4x-xXDe89OAI5QCiMnKS3LN3RKFCmT8Yz_Yww.svg',
  '/images/company-logos/bTM6JHPFAd0TpQVfLybhadM48U9brNK0kr0RZPccZbU-8ZydayEHX19VoisuMNT4RXwlW4ReYpecuv-WALAmfUTxMg2UAA-dMPbuI4AExhpEY7ZgdiGAABBuc2VUpzXun8FdUeGryg7k6OJTfeaVLw.svg',
  '/images/company-logos/bzyX-bcOszBIyZp4I9fXQHBFCFJlDtVZ5NAQb3ipvPR8xehdx99F-xWHDTsVUbM8pEujQv1TQTTrXD7A3Xaaba9t-GOg2yNCBMg7hOg0SIPDGyOWqaSUu3VEY17h1JzvHNtpDPWW7Hs7aA6kUQ0MQw.svg',
  '/images/company-logos/ezX7tL2KZPta0ZvP1Lkh_OEXPbdgEfRygo9kCyM6vcb8JBEagUiFXb22DZl_vszRJjZO9skUXjyliiatyZDDrIrbcTzCCTYenibs7LacOErXMCZq_3C3GA6psClsFYu2Q9T_ioSus-WY3ie67qYG5w.svg',
  '/images/company-logos/fSD1BTd2CtrHz6EOr23a-JtJf_xlusDFuqwHTrrG_Ana3MZO0gD6Z0RxLLG56Wu26d5_eUAtRN71BnavVSNjVhvWQfUYxxFP6SpORqui38vEkw0pEBy9D8sPMnvKROtnKcz9JY7E4R13G-5-whvCvA.svg',
  '/images/company-logos/fSIkZyWM4rM1gidxaCFUQ18r872Dm4xWpkZ-rFUz89PpjWylA8hmh39lEg-29Z7Ok5k9BqXFXL8b95YAEJfChb5RCN6MDIdRxJWHrJVZ9r5Q6P-7SfXNt95Fkc6EGSveca4iFCOARq7mIJF_plvv_A.svg',
  '/images/company-logos/fx6sKNDVDFsbOENLe-xTfc1KM8m5bvpjGu6zacCGE9LmgG905q2XR7mqVwmYwhdTTNBOHguEhWr0O71Zyk8oFRDg3iXQp68IQ-v4oe1-1kSud1cDyCHESwPOEMRiZVjzMlImqZ3Y_6jwFrOH1PyfnA.svg',
  '/images/company-logos/gQQBEDoS4V9wEzN-pj8dTe3V90azRcnv9wEVO3sxVQ76hOji4FinhMT-BZExwiOFhthnYBwEZR98A1ledzfgGQuHMloSpNtMAJ2aEvwhvlB_gwIIfpE08qtHptw_EznuI4YicbPYt708m7jGGsrO0Q.svg',
  '/images/company-logos/hVgF57hJ3xB0lWARAqgbKzF11iF_jHKPcy54Eatniz_PFt7nn-VH2zQRz93Lrzr14E07XvB2NeeHPH9_Tlxe75PO0-Sm1eByKRVeSEh9CAz-vzvDx1S69XMAP8d5YC_8skzq_6gt2qzVNxtS0F_bxA.svg',
  '/images/company-logos/lJaLPyiCksy4rKDEV86j9XqTd1QnIaiSPRZseWCttzMNixmZoBoggD7_wObo5aWy-30Xq22vNOgK7iwlobpvnO_PQIhrntTuBobFXVSjz9whoeU1IBExjolEGGdMydMmqKS6urghRnD2XACePGbp0A.svg',
  '/images/company-logos/mrnlNZzBeFxCorw5B0VjguNwYyRwYOZeMdp_UjoG5y7mbvBrkiv7hm0F8fiFsuUuyo8B83Uqv1Gz-v5Oe0FvoWZcBLoKuuZ88v9TkwFFzEGmApWGQiCCCCpR8ykp5nOGhOpYHt7tiAAyDFiy8_GknQ.svg',
  '/images/company-logos/n8d4p6AMfV8YVZiX5mst1veEfo9S7-y2GSe9ar-wGOEIa7y9w2mHQGm-a7w4BKzArAwN-Mhhv_jkfZfh1gc4aQ.svg',
  '/images/company-logos/nzX7hfiNDhzsZ5CC1dEpPbS84Ic2VNMBA4KAv-MfUcyYAlE_xhBUMhNq35nxuu-spWifKWjVzP_Q1jBbUAL4faNd2JlExARVqQeJkhOFGYJy0ZzAMkDFYqT83_MiQS5Rj1bRHdE8I2yVdtpeQYYwAg.svg',
  '/images/company-logos/oGx8Lf-pK-fz_NQBIQ6z0pJB386NEHT88b0IbG-WIuBmV5uzV1Ryi958B1bU0C0djwVNOZ-J7McjnTTz5EiVajLJz9Vfp2_vc6sFQ_gWgzzh8vRe6Mk1SNiAwRtcP-L-uE8bkMOeK5DE0JRd-O3aRA.svg',
  '/images/company-logos/p-10BFRQN-_hRreerH2X6Y1rzrcspaEiODZ0m9n3VonlNG_3KoJbQQo_i_aIEr56siCqXNmeOcfLSReRQsdB0w.svg',
  '/images/company-logos/tURiQcsQ4gqf5yehCIeBxoqAPAp8kbvJCFHt3pnJy5cf2d27mEVfyAwQtWdTT1aJP1wjS_dJlZzdGEk7P9fcrHezTDlrqqIb-ZQnXIkOgcp-S37Yit2UBGVMPyf6eUae605-0LzI5GdO3wQ0GRxRjg.svg',
  '/images/company-logos/uDLH9KAZCQMK2nqJyLEVJ9UzXnKO7uVJYZ4mgZMRS7m8wy6u7X2et3QHKDwYKNdhKoqjDWdMrhzpPpC9H1_L8Q-KOZwPbdcd3WdTSgJs-6g5N0zlZj3D-hgnY0s-VcAcLRTR1zgAwbD_bByywC802Q.svg',
  '/images/company-logos/wIbC6OJ5H0FmZ5ljUXYISpzR8H-x7weQqVldRanCw9g64JL4tUoxQamNgG_w_byq-wfm_gU--v1HdcKRG-0OMCVkZ1GI3EVnpUQ0fQAByE-nRXkPxhtx8emKKE0MSgw5T3MNYJ3Gju1j_Iqf7oImSg.svg',
  '/images/company-logos/y1AlwExMBWcxyTKygmw8EVoS0g_9Y_pLgbPEhUkc25b_h-4yTyiaVLSkVL0HjhFbX6cyQML4Uvk2LQYndy2Cs8Cys7FcUr8PqXwh9fRC0h8GtKB8nCZwaSWx3AFt-TdtPpWzytnx9w6owHJcAjeFEQ.svg',
  '/images/company-logos/ywnQTrlMBh8nsZsYJ-5WCT1d26iSqwxByWYPRIUtq4s2vJKvt_U1BxswLhWhvPg1txioQ7jtlSQ020q6ox0FVPVb8QXxK6rRYUO1mPoU9jEDg2qqGJoES4flW6d3opZKTcO7T1214OlUS6ch_RCUBA.svg',
  '/images/company-logos/zO55rSFFBt8SWtnaLX8pZ4KB6WlImBmSYRCCEAteo5NEAPrOKqtDmSGRDk2EXZUmiyPhdFCOKnkaCZ2BstnHa-h_Xz49IZDf1_R7H4gVSBEzRF4gZkgC6riVGwIDJnBd_Y7JbT_454w-PswxOT1OVw.svg',
];
const BIZ_LOGO_ROWS = Array.from({ length: 6 }, (_, i) => ALL_BIZ_LOGOS.slice(i * 9, i * 9 + 9));

const INTRO_IMAGES = [
  '/images/intro-1.png',
  '/images/intro-ios2.png',
  '/images/intro-ios3.png',
  '/images/intro-ios5.png',
  '/images/intro-ios6.png',
  '/images/intro-ios7.png',
  '/images/intro-ios8.png',
  '/images/intro-ios9.png',
];

const HISTORY_DATA = [
  { year: '2026', events: [
    { ko: '01월 프리티풀 브랜드 공식 론칭', en: 'Jan · Official brand launch',                ja: '1月 Freetiful ブランド公式ローンチ',      zh: '1月 Freetiful 品牌正式发布' },
    { ko: '01월 전문 행사인력 매칭 플랫폼 출시', en: 'Jan · Event talent matching platform launched', ja: '1月 プロイベント人材マッチングプラットフォーム開始', zh: '1月 专业活动人才匹配平台上线' },
    { ko: '02월 전문투자기관으로부터 Seed 투자 유치', en: 'Feb · Secured Seed investment from VC', ja: '2月 専門投資機関よりシード投資調達',      zh: '2月 从专业投资机构获得种子轮投资' },
    { ko: '02월 제휴업체 300여 곳과 전략적 파트너십 체결', en: 'Feb · Strategic partnerships with 300+ affiliates', ja: '2月 提携先 300 社と戦略的パートナーシップ締結', zh: '2月 与 300 余家合作伙伴建立战略合作' },
    { ko: '03월 벤처기업 인증 획득',          en: 'Mar · Certified as Venture Company',     ja: '3月 ベンチャー企業認証取得',               zh: '3月 获得风险企业认证' },
    { ko: '03월 프리티풀 정식 서비스 운영 개시', en: 'Mar · Official service operation begins', ja: '3月 Freetiful 正式サービス運営開始',     zh: '3月 Freetiful 正式运营' },
    { ko: '05월 신용보증기금 성장지원 기업 선정', en: 'May · Selected for KODIT growth support program', ja: '5月 信用保証基金の成長支援企業に選定', zh: '5月 入选信用保证基金成长支持企业' },
    { ko: '06월 빌라드지디 웨딩홀 & 한국웨딩협회 제휴 체결', en: 'Jun · Partnership with Villa de GD Wedding Hall & Korea Wedding Association', ja: '6月 ヴィラ・ド・ジディ ウェディングホール&韓国ウェディング協会と提携', zh: '6月 与Villa de GD婚礼会馆和韩国婚礼协会签署合作' },
  ]},
  { year: '2025', events: [
    { ko: '12월 주식회사 커넥트풀 설립', en: 'Dec · Connectful Inc. founded', ja: '12月 株式会社 Connectful 設立', zh: '12月 Connectful 株式会社成立' },
  ]},
];

/** 앱으로 보는 섭외 — 따라오는 폰 화면(프리티풀 앱 실제 화면, 채팅은 가상 대화) */
const FEATURES = [
  {
    key: 'pros',
    screen: '/images/biz-v2/screens/pros.webp',
    title: { ko: '오직 검증된 진행자만', en: 'Only verified hosts', ja: '検証済みの司会者だけ', zh: '只有经过认证的主持人' },
    desc: {
      ko: '방송사 출신이거나 실제 진행 경력이 확인된 진행자만 프로필을 열 수 있어요.',
      en: 'Only hosts with a broadcasting background or confirmed event experience can open a profile.',
      ja: '放送局出身、または実際の司会経歴が確認された司会者だけがプロフィールを公開できます。',
      zh: '只有广播电视台出身或经核实拥有实际主持经验的主持人才能开设资料。',
    },
  },
  {
    key: 'profile',
    screen: '/images/biz-v2/screens/profile.webp',
    title: { ko: '프로필로 꼼꼼하게 비교', en: 'Compare profiles in detail', ja: 'プロフィールでじっくり比較', zh: '通过资料仔细比较' },
    desc: {
      ko: '진행 영상과 사진, 경력과 진행 분야를 한 화면에서 보고 골라요.',
      en: 'See hosting videos, photos, career and specialties on a single screen.',
      ja: '司会動画や写真、経歴や得意分野をひとつの画面で確認して選べます。',
      zh: '在一个页面查看主持视频、照片、经历和擅长领域后再选择。',
    },
  },
  {
    key: 'reviews',
    screen: '/images/biz-v2/screens/reviews.webp',
    title: { ko: '6가지 항목의 실제 후기', en: 'Real reviews on six criteria', ja: '6項目のリアルな口コミ', zh: '六个维度的真实评价' },
    desc: {
      ko: '경력 · 만족도 · 구성력 · 위트 · 발성 · 이미지, 행사를 마친 고객의 평가로 비교해요.',
      en: 'Career, satisfaction, structure, wit, voice and image — compare by ratings from clients after their events.',
      ja: '経歴・満足度・構成力・ウィット・発声・イメージ。イベントを終えたお客様の評価で比較できます。',
      zh: '经历、满意度、组织力、幽默感、发声、形象——依据活动结束后客户的评价进行比较。',
    },
  },
  {
    key: 'chat',
    screen: '/images/biz-v2/screens/chat.webp',
    title: { ko: '채팅으로 바로 견적', en: 'Quotes right in chat', ja: 'チャットですぐに見積もり', zh: '聊天即可获取报价' },
    desc: {
      ko: '행사 날짜와 장소를 남기면 진행자가 직접 견적을 보내요. 일정 조율도 채팅 한 번이면 끝나요.',
      en: 'Leave your event date and venue, and hosts send quotes directly. Scheduling takes just one chat.',
      ja: 'イベントの日程と会場を残すと、司会者が直接見積もりを送ります。日程調整もチャットひとつで完了します。',
      zh: '留下活动日期和地点,主持人会直接发送报价。日程协调也只需一次聊天。',
    },
  },
] as const;

/* ─── 앱 화면 띠(자동으로 흐름) ─────────────────────────────── */
function AppScreenMarquee({ images, speed = 40 }: { images: string[]; speed?: number }) {
  const doubled = [...images, ...images, ...images];
  return (
    <div className="relative overflow-clip py-6">
      <div className="pointer-events-none absolute bottom-0 left-0 top-0 z-10 w-24 bg-gradient-to-r from-white to-transparent md:w-40" />
      <div className="pointer-events-none absolute bottom-0 right-0 top-0 z-10 w-24 bg-gradient-to-l from-white to-transparent md:w-40" />
      <div className="flex items-center gap-5 px-4 md:gap-6" style={{ animation: `marquee-left ${speed}s linear infinite`, width: 'max-content' }}>
        {doubled.map((src, i) => (
          <div key={`${src}-${i}`} className="relative flex-shrink-0">
            <div className="overflow-hidden rounded-[24px] bg-[#F2F4F6] shadow-[0_12px_40px_-12px_rgba(0,27,55,0.18)]" style={{ width: 200, height: 434 }}>
              <Image src={src} alt="App Screen" width={200} height={434} className="h-full w-full object-cover" />
            </div>
          </div>
        ))}
      </div>
    </div>
  );
}

/**
 * 앱 기능 — 넓은 화면: 왼쪽 글 4칸(스크롤하면 지금 칸만 진해짐) · 오른쪽 따라오는 폰(지금 칸 화면으로 스르르 바뀜).
 * 좁은 화면: 글 → 폰 차례로.
 */
function FeatureShowcase() {
  const t = useT();
  const [active, setActive] = useState(0);
  const refs = useRef<(HTMLDivElement | null)[]>([]);
  useEffect(() => {
    const obs = refs.current.map((el, i) => {
      if (!el) return null;
      const ob = new IntersectionObserver(([e]) => { if (e.isIntersecting) setActive(i); }, { rootMargin: '-45% 0px -45% 0px' });
      ob.observe(el);
      return ob;
    });
    return () => obs.forEach((o) => o?.disconnect());
  }, []);
  const screens = FEATURES.map((f) => ({ src: f.screen, alt: t(f.title) }));
  return (
    <>
      <div className="hidden md:grid md:grid-cols-[minmax(0,1fr)_minmax(0,440px)] md:gap-12 lg:gap-20">
        <div>
          {FEATURES.map((f, i) => {
            const on = active === i;
            return (
              <div key={f.key} ref={(el) => { refs.current[i] = el; }} className="flex min-h-[80vh] flex-col justify-center">
                <p className="text-[17px] font-semibold tabular-nums transition-colors duration-500" style={{ color: on ? '#3182F6' : '#D1D6DB' }}>{String(i + 1).padStart(2, '0')}</p>
                <h3 className="mt-3 text-[40px] font-bold leading-[1.3] tracking-[-0.035em] transition-colors duration-500 lg:text-[48px]" style={{ color: on ? INK : '#D1D6DB' }}>{t(f.title)}</h3>
                <p className="mt-5 max-w-[460px] break-keep text-[19px] leading-[1.7] transition-colors duration-500" style={{ color: on ? BODY : '#D1D6DB' }}>{t(f.desc)}</p>
              </div>
            );
          })}
        </div>
        <div className="relative">
          <div className="sticky top-0 flex h-screen items-center justify-center">
            <PhoneFrame screens={screens} active={active} className="w-[min(300px,calc((100vh-140px)*0.43))]" />
          </div>
        </div>
      </div>
      <div className="space-y-24 md:hidden">
        {FEATURES.map((f, i) => (
          <div key={f.key}>
            <FadeUp>
              <p className="text-[15px] font-semibold tabular-nums text-[#3182F6]">{String(i + 1).padStart(2, '0')}</p>
              <h3 className="mt-2 text-[28px] font-bold leading-[1.35] tracking-[-0.03em]" style={{ color: INK }}>{t(f.title)}</h3>
              <p className="mt-3 break-keep text-[17px] leading-[1.7]" style={{ color: BODY }}>{t(f.desc)}</p>
            </FadeUp>
            <FadeUp delay={120} className="mt-10 flex justify-center">
              <PhoneFrame screens={[screens[i]]} className="w-[240px]" />
            </FadeUp>
          </div>
        ))}
      </div>
    </>
  );
}

/** 2025 송년회 — 어두운 칸 가득, 영상은 화면에 들어오면 소리 없이 재생(조절 막대 있음) */
function ReceptionSection() {
  const { ref, inView } = useInView<HTMLElement>({ threshold: 0.35, once: false });
  const videoRef = useRef<HTMLVideoElement>(null);
  useEffect(() => {
    const v = videoRef.current;
    if (!v) return;
    if (inView) v.play().catch(() => {});
    else v.pause();
  }, [inView]);
  return (
    <section ref={ref} className="relative overflow-hidden bg-[#0B0C0E] text-white">
      <div className="absolute inset-0">
        <Image src="/images/img-8838-1.png" alt="" fill className="object-cover opacity-[0.16]" />
        <div className="absolute inset-0 bg-gradient-to-b from-black/70 via-[#0B0C0E]/60 to-[#0B0C0E]" />
      </div>
      <div className="relative z-10 mx-auto max-w-[1140px] px-6 py-[120px] md:px-10 md:py-[180px]">
        <div className="flex flex-col items-center gap-8 md:gap-10">
          <FadeUp>
            <Image src="/images/frame-1707488417.svg" alt="2025 Year-End Reception" width={272} height={161} className="w-[260px] opacity-95 brightness-0 invert md:w-[380px]" />
          </FadeUp>
          <FadeUp delay={200}>
            <Image src="/images/group-1707482062.svg" alt="Freetiful" width={176} height={30} className="w-[150px] opacity-50 brightness-0 invert md:w-[190px]" />
          </FadeUp>
        </div>
        <FadeUp delay={250} className="mt-14 md:mt-20">
          <div className="overflow-hidden rounded-[24px] bg-black shadow-[0_0_120px_rgba(255,255,255,0.06)] md:rounded-[32px]">
            <video ref={videoRef} className="aspect-video w-full" controls playsInline preload="metadata" muted>
              <source src="/images/KakaoTalk_Video_2026-04-08-21-53-11-1.mp4#t=0.5" type="video/mp4" />
            </video>
          </div>
        </FadeUp>
        <div className="mt-14 flex items-center gap-4">
          <div className="h-px flex-1 bg-gradient-to-r from-transparent to-white/10" />
          <span className="text-[11px] font-medium text-white/25">FREETIFUL 2025</span>
          <div className="h-px flex-1 bg-gradient-to-l from-transparent to-white/10" />
        </div>
      </div>
    </section>
  );
}

/* ─── Page ─────────────────────────────────────────────────── */
export default function BizPage() {
  const t = useT();
  const router = useRouter();
  const [activeSection, setActiveSection] = useState('회사소개');
  const [inquiry, setInquiry] = useState({ company: '', name: '', phone: '', email: '', type: '', message: '' });
  const [inquiryFile, setInquiryFile] = useState<File | null>(null);
  const [sending, setSending] = useState(false);

  const openInquiryMail = () => {
    window.location.href = 'mailto:support@freetiful.com?subject=' + encodeURIComponent('[Freetiful Biz] 기업 문의') + '&body=' + encodeURIComponent('안녕하세요, Freetiful 기업 서비스에 대해 문의드립니다.\n\n회사명:\n담당자명:\n연락처:\n\n문의 내용:\n');
  };
  const [scrollY, setScrollY] = useState(0);
  const [heroH, setHeroH] = useState(800);
  const heroRef = useRef<HTMLElement>(null);
  const [previewFile, setPreviewFile] = useState<string | null>(null);
  const [bizNavExpanding, setBizNavExpanding] = useState(false);
  const [bizNavCollapsing, setBizNavCollapsing] = useState(false);
  const [inquiryBubbleHidden, setInquiryBubbleHidden] = useState(false);
  const [mobileMenuOpen, setMobileMenuOpen] = useState(false);

  useEffect(() => {
    const h = () => setScrollY(window.scrollY);
    h();
    window.addEventListener('scroll', h, { passive: true });
    return () => window.removeEventListener('scroll', h);
  }, []);
  // 첫 화면 높이 — 머리줄이 영상 위(투명 · 흰 글자)인지, 지나서(흰 바탕 · 검은 글자)인지
  useEffect(() => {
    const m = () => setHeroH(heroRef.current?.offsetHeight || window.innerHeight);
    m();
    window.addEventListener('resize', m);
    return () => window.removeEventListener('resize', m);
  }, []);
  const overHero = scrollY < heroH - 64;

  // 스크롤 위치에 따라 activeSection 자동 업데이트 — 화면 가운데 얇은 띠에 걸친 섹션이 지금 섹션
  // (예전 threshold 0.3 은 화면보다 훨씬 긴 섹션(핵심서비스)에선 한 번도 안 걸려 '회사소개'에 머물렀다)
  useEffect(() => {
    const sectionIds = ['회사소개', '핵심서비스', '연혁', '자료실', '오시는길', '문의폼'];
    const ob = new IntersectionObserver(
      (entries) => {
        entries.forEach((entry) => {
          if (entry.isIntersecting) {
            setActiveSection(entry.target.id === '문의폼' ? '문의' : entry.target.id);
          }
        });
      },
      { rootMargin: '-48% 0px -50% 0px', threshold: 0 },
    );
    sectionIds.forEach((id) => {
      const el = document.getElementById(id);
      if (el) ob.observe(el);
    });
    return () => ob.disconnect();
  }, []);

  // 플랫폼에서 비즈로 왔을 때 펼쳐지는 애니메이션
  useEffect(() => {
    const from = sessionStorage.getItem('nav-transition');
    if (from === 'from-platform') {
      setBizNavExpanding(true);
      sessionStorage.removeItem('nav-transition');
      const timer = setTimeout(() => setBizNavExpanding(false), 600);
      return () => clearTimeout(timer);
    }
    return undefined;
  }, []);

  function scrollTo(id: string) {
    setActiveSection(id);
    const el = document.getElementById(id);
    if (!el) return;
    // 문의폼은 페이지 최하단이므로 마지막 위치까지 스크롤 — 중간 섹션이 sticky로 걸리지 않음
    if (id === '문의폼') {
      window.scrollTo({ top: el.offsetTop - 20, behavior: 'smooth' });
    } else {
      el.scrollIntoView({ behavior: 'smooth' });
    }
  }

  // 네이티브(iOS) 비즈 하단 네비 → 섹션 스크롤 브리지
  useEffect(() => {
    (window as unknown as { __freetifulBizScroll?: (id: string) => void }).__freetifulBizScroll = (id: string) => {
      try { scrollTo(id); } catch { /* noop */ }
    };
    return () => { try { delete (window as unknown as { __freetifulBizScroll?: unknown }).__freetifulBizScroll; } catch { /* noop */ } };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  async function handleInquiry(e: React.FormEvent) {
    e.preventDefault();
    if (!inquiry.name || !inquiry.phone || !inquiry.message) {
      toast.error(t({ ko: '필수 항목을 입력해주세요', en: 'Please fill in the required fields', ja: '必須項目を入力してください', zh: '请填写必填项' }));
      return;
    }
    setSending(true);

    try {
      const formData = new FormData();
      formData.append('company', inquiry.company);
      formData.append('name', inquiry.name);
      formData.append('phone', inquiry.phone);
      formData.append('email', inquiry.email);
      formData.append('type', inquiry.type);
      formData.append('message', inquiry.message);
      if (inquiryFile) formData.append('file', inquiryFile);

      const res = await fetch('/api/inquiry', { method: 'POST', body: formData });
      if (res.ok) {
        setInquiry({ company: '', name: '', phone: '', email: '', type: '', message: '' });
        setInquiryFile(null);
        router.push('/biz/complete');
        return;
      } else {
        const data = await res.json();
        toast.error(data.error || t({ ko: '문의 접수에 실패했습니다', en: 'Failed to submit inquiry', ja: 'お問合せの送信に失敗しました', zh: '咨询提交失败' }));
      }
    } catch {
      toast.error('문의 접수에 실패했습니다. 잠시 후 다시 시도해주세요.');
    } finally {
      setSending(false);
    }
  }

  const inputCls = 'h-14 w-full rounded-[14px] border border-transparent bg-[#F2F4F6] px-4 text-[16px] text-[#191F28] outline-none transition-all placeholder-[#B0B8C1] focus:border-[#3182F6] focus:bg-white focus:ring-4 focus:ring-[#3182F6]/10';
  const eyebrowCls = 'text-[15px] font-semibold text-[#3182F6] md:text-[17px]';
  const h2Cls = 'text-[32px] font-bold leading-[1.32] tracking-[-0.035em] text-[#191F28] md:text-[56px]';
  const leadCls = 'break-keep text-[17px] leading-[1.7] text-[#4E5968] md:text-[20px]';

  return (
    // overflow-x: clip — hidden 이면 이 칸이 스크롤 칸이 돼 앱 기능 칸의 따라오는 폰(sticky)이 멈추지 않는다
    <div className="min-h-screen overflow-x-clip bg-white text-[#191F28]">

      {/* ─── 머리줄 — 영상 위에선 투명 · 흰 글자, 지나면 흰 바탕 · 검은 글자 ───── */}
      <header
        className="fixed left-0 right-0 top-0 z-50 transition-[background-color,box-shadow] duration-300"
        style={{
          backgroundColor: overHero ? 'transparent' : 'rgba(255,255,255,0.92)',
          boxShadow: overHero ? 'none' : '0 1px 0 #F2F4F6',
          backdropFilter: overHero ? 'none' : 'saturate(180%) blur(16px)',
          WebkitBackdropFilter: overHero ? 'none' : 'saturate(180%) blur(16px)',
        }}
      >
        <div className="mx-auto flex h-[60px] max-w-[1140px] items-center justify-between px-5 md:px-10">
          <Link href="/biz" aria-label="Freetiful Biz">
            <Image
              src="/images/logo-prettyful.svg"
              alt="Freetiful"
              width={112}
              height={32}
              className="transition-[filter] duration-300"
              style={{ width: 112, height: 'auto', filter: overHero ? 'brightness(0) invert(1)' : 'none' }}
            />
          </Link>

          <nav className="hidden items-center gap-1 md:flex" aria-label="섹션">
            {NAV_SECTION_IDS.filter((n) => n !== '문의').map((n) => {
              const on = activeSection === n && !overHero;
              return (
                <button
                  key={n}
                  onClick={() => scrollTo(n)}
                  className="rounded-[10px] px-3.5 py-2 text-[15px] font-semibold transition-colors"
                  style={{ color: overHero ? (on ? '#fff' : 'rgba(255,255,255,0.78)') : on ? INK : '#6B7684' }}
                >
                  {t(NAV_SECTION_LABELS[n])}
                </button>
              );
            })}
          </nav>

          <div className="flex items-center gap-1.5">
            <LanguageToggle tone={overHero ? 'light' : 'dark'} />
            <button
              onClick={() => scrollTo('문의폼')}
              className="hidden h-9 items-center rounded-[10px] bg-[#3182F6] px-4 text-[14px] font-semibold text-white transition-colors hover:bg-[#1B64DA] md:inline-flex"
            >
              {t({ ko: '문의하기', en: 'Contact Us', ja: 'お問合せ', zh: '联系我们' })}
            </button>
            <button
              className="flex h-9 w-9 flex-col items-center justify-center gap-[5px]"
              onClick={() => setMobileMenuOpen(true)}
              aria-label={t({ ko: '메뉴', en: 'Menu', ja: 'メニュー', zh: '菜单' })}
            >
              {[20, 20, 14].map((w, i) => (
                <span key={i} className="block h-[2px] rounded-full transition-colors duration-300" style={{ width: w, backgroundColor: overHero ? '#fff' : INK }} />
              ))}
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
            className="absolute right-0 top-0 flex h-full w-[300px] flex-col bg-white shadow-2xl"
            style={{ animation: 'menuSlideIn 0.35s cubic-bezier(0.16, 1, 0.3, 1)' }}
          >
            <div className="flex items-center justify-between px-6 pb-4 pt-6">
              <span className="text-[17px] font-bold text-[#191F28]">{t({ ko: '메뉴', en: 'Menu', ja: 'メニュー', zh: '菜单' })}</span>
              <button onClick={() => setMobileMenuOpen(false)} className="flex h-9 w-9 items-center justify-center rounded-full hover:bg-[#F2F4F6]" aria-label="닫기">
                <X className="h-5 w-5 text-[#8B95A1]" />
              </button>
            </div>
            <div className="flex flex-1 flex-col gap-1 px-4 py-2">
              {[
                { label: t({ ko: 'CEO 인사말', en: "CEO's Message", ja: 'CEO 挨拶', zh: 'CEO 致辞' }), href: '/biz/ceo' },
                { label: t({ ko: '연혁', en: 'Milestones', ja: '沿革', zh: '发展历程' }), href: '/biz/history' },
                { label: t({ ko: '인재채용', en: 'Careers', ja: '採用情報', zh: '人才招聘' }), href: '/careers' },
                { label: t({ ko: '주요소식', en: 'News', ja: 'お知らせ', zh: '主要消息' }), action: () => { scrollTo('자료실'); setMobileMenuOpen(false); } },
                { label: t({ ko: '자주묻는질문', en: 'FAQ', ja: 'よくある質問', zh: '常见问题' }), href: '/biz/faq' },
                { label: t({ ko: '고객사', en: 'Clients', ja: '取引先', zh: '客户' }), href: '/biz/clients' },
              ].map((item) =>
                item.href ? (
                  <Link
                    key={item.label}
                    href={item.href}
                    className="flex items-center justify-between rounded-[14px] px-3 py-4 text-[16px] font-semibold text-[#333D4B] transition-colors hover:bg-[#F9FAFB] active:bg-[#F2F4F6]"
                    onClick={() => setMobileMenuOpen(false)}
                  >
                    {item.label}
                    <ChevronRight className="h-4 w-4 text-[#C4CAD1]" />
                  </Link>
                ) : (
                  <button
                    key={item.label}
                    onClick={item.action}
                    className="flex items-center justify-between rounded-[14px] px-3 py-4 text-left text-[16px] font-semibold text-[#333D4B] transition-colors hover:bg-[#F9FAFB] active:bg-[#F2F4F6]"
                  >
                    {item.label}
                    <ChevronRight className="h-4 w-4 text-[#C4CAD1]" />
                  </button>
                )
              )}
            </div>
            <div className="px-6 pb-8">
              <button
                onClick={() => { openInquiryMail(); setMobileMenuOpen(false); }}
                className="h-14 w-full rounded-[16px] bg-[#3182F6] text-[16px] font-bold text-white transition-transform active:scale-[0.98]"
              >
                {t({ ko: '문의하기', en: 'Contact Us', ja: 'お問合せ', zh: '联系我们' })}
              </button>
            </div>
          </div>
        </div>
      )}

      {/* ═══ 첫 화면 — 가득 찬 행사 영상 + 흰 큰 제목 ═════════════════ */}
      <section ref={heroRef} className="relative flex h-[100svh] min-h-[560px] items-center justify-center overflow-hidden bg-[#0B0C0E]">
        <video
          className="absolute inset-0 h-full w-full object-cover"
          src="/images/biz-v2/hero-loop.mp4"
          poster="/images/biz-v2/hero-poster.jpg"
          autoPlay
          muted
          loop
          playsInline
          aria-hidden="true"
        />
        <div className="absolute inset-0" style={{ background: 'linear-gradient(180deg, rgba(0,0,0,0.55) 0%, rgba(0,0,0,0.38) 45%, rgba(0,0,0,0.62) 100%)' }} />

        <div className="relative z-10 px-6 text-center">
          <p className="mb-5 text-[12px] font-semibold tracking-[0.08em] text-white/70 md:text-[13px]" style={{ animation: 'bizHeroUp 1s cubic-bezier(0.22,1,0.36,1) 0.05s both' }}>FREELANCER MC MATCHING PLATFORM</p>
          <h1 className="break-keep text-[38px] font-bold leading-[1.26] tracking-[-0.035em] text-white md:text-[76px]">
            <span className="block" style={{ animation: 'bizHeroUp 1.1s cubic-bezier(0.22,1,0.36,1) 0.15s both' }}>
              {t({ ko: '검증된 전문 진행자로', en: 'Trusted MC experts', ja: '検証されたプロ司会者で', zh: '经过认证的专业主持人' })}
            </span>
            <span className="block" style={{ animation: 'bizHeroUp 1.1s cubic-bezier(0.22,1,0.36,1) 0.4s both' }}>
              {t({ ko: '기업행사의 품격을 높이다', en: 'Elevate your corporate events', ja: '企業イベントの品格を高める', zh: '提升企业活动品格' })}
            </span>
          </h1>
          <p className="mx-auto mt-6 max-w-[560px] break-keep text-[16px] leading-[1.65] text-white/75 md:mt-8 md:text-[19px]" style={{ animation: 'bizHeroUp 1.1s cubic-bezier(0.22,1,0.36,1) 0.65s both' }}>
            {t({
              ko: 'KBS · SBS · MBC 방송사 출신 검증된 아나운서, MC, 쇼호스트',
              en: 'Verified announcers, MCs, and show hosts from KBS · SBS · MBC',
              ja: 'KBS · SBS · MBC 放送局出身の認証済みアナウンサー、MC、ショーホスト',
              zh: '来自 KBS · SBS · MBC 广播公司的认证主播、MC、购物主持人',
            })}<br />
            {t({
              ko: '전국 1,000여 명의 전문 진행자와 맞춤 매칭합니다.',
              en: 'Matched from a nationwide network of 1,000+ professionals.',
              ja: '全国1,000名以上のプロ司会者とカスタムマッチング。',
              zh: '与全国 1,000 余名专业主持人精准匹配。',
            })}
          </p>
          <div className="mt-10 flex justify-center gap-3" style={{ animation: 'bizHeroUp 1.1s cubic-bezier(0.22,1,0.36,1) 0.85s both' }}>
            <button onClick={() => scrollTo('문의폼')} className="h-14 rounded-[16px] bg-white px-7 text-[16px] font-bold text-[#191F28] transition-transform hover:bg-white/90 active:scale-[0.97] md:px-9 md:text-[17px]">
              {t({ ko: '기업 문의하기', en: 'Business Inquiry', ja: '法人お問合せ', zh: '企业咨询' })}
            </button>
            <button onClick={() => scrollTo('핵심서비스')} className="h-14 rounded-[16px] bg-white/15 px-7 text-[16px] font-bold text-white backdrop-blur-md transition-colors hover:bg-white/25 md:px-9 md:text-[17px]">
              {t({ ko: '서비스 알아보기', en: 'Learn More', ja: 'サービスを見る', zh: '了解服务' })}
            </button>
          </div>
        </div>

        {/* 아래로 — 마우스 휠 모양(모바일은 하단 네비가 덮어서 뺀다) */}
        <div className="absolute bottom-8 left-1/2 z-10 hidden -translate-x-1/2 md:block" aria-hidden="true">
          <div className="flex h-[38px] w-[24px] justify-center rounded-full border-2 border-white/50 pt-[7px]">
            <span className="block h-[7px] w-[3px] rounded-full bg-white/80" style={{ animation: 'bizWheel 1.6s ease-in-out infinite' }} />
          </div>
        </div>
      </section>

      {/* eslint-disable-next-line react/no-danger */}
      <style dangerouslySetInnerHTML={{ __html: `
        @keyframes marquee-left { 0% { transform: translateX(0); } 100% { transform: translateX(-50%); } }
        @keyframes marquee-right { 0% { transform: translateX(-50%); } 100% { transform: translateX(0); } }
        @keyframes bizHeroUp { from { opacity: 0; transform: translate3d(0, 28px, 0); } to { opacity: 1; transform: none; } }
        @keyframes bizWheel { 0% { opacity: 0; transform: translateY(0); } 30% { opacity: 1; } 80% { opacity: 0; transform: translateY(9px); } 100% { opacity: 0; } }
        @keyframes promoScroll { 0% { transform: translateX(0); } 100% { transform: translateX(-33.333%); } }
        @keyframes bizLogoScroll { 0% { transform: translateX(0); } 100% { transform: translateX(-33.333%); } }
        @media (prefers-reduced-motion: reduce) { [style*="bizHeroUp"] { animation: none !important; } }
      `}} />

      {/* ═══ 모바일 사이드 섹션 인디케이터 — 첫 화면을 지나서만 ═════════ */}
      <div
        className="fixed right-3 top-1/2 z-40 flex -translate-y-1/2 flex-col items-end gap-3 transition-opacity duration-500 md:hidden"
        style={{ opacity: overHero ? 0 : 1, pointerEvents: overHero ? 'none' : 'auto' }}
      >
        {NAV_SECTION_IDS.map((name) => {
          const isActive = activeSection === name;
          return (
            <button
              key={name}
              onClick={() => scrollTo(name === '문의' ? '문의폼' : name)}
              className="flex items-center gap-2 transition-all duration-300"
              aria-label={t(NAV_SECTION_LABELS[name])}
            >
              {isActive && (
                <span className="rounded-full border border-[#F2F4F6] bg-white/90 px-2 py-0.5 text-[10px] font-bold text-[#333D4B] shadow-sm backdrop-blur-sm">
                  {t(NAV_SECTION_LABELS[name])}
                </span>
              )}
              <span className={`block rounded-full transition-all duration-300 ${isActive ? 'h-[18px] w-[6px] bg-[#191F28]' : 'h-[5px] w-[5px] bg-[#D1D6DB]'}`} />
            </button>
          );
        })}
      </div>

      {/* ═══ 회사소개 ═══════════════════════════════════════════ */}
      <section id="회사소개" className="pt-[120px] md:pt-[180px]">
        <div className="mx-auto max-w-[1140px] px-6 md:px-10">
          {/* 차오르는 문장 */}
          <div className="text-center">
            <FadeUp><p className={eyebrowCls}>ABOUT US</p></FadeUp>
            <ScrollFillText
              className="mt-5 break-keep text-[30px] font-bold leading-[1.4] tracking-[-0.035em] md:mt-6 md:text-[56px]"
              lines={t({
                ko: ['여러분의 소중한 시간을', '아름다운 순간으로 만드는', '진행자들이 모였어요'],
                en: ['A pool of hosts who turn', 'your precious time', 'into beautiful moments'],
                ja: ['皆様の大切な時間を', '美しい瞬間に変える', '司会者が集まりました'],
                zh: ['汇聚将您宝贵的时光', '化为美好瞬间的', '专业主持人'],
              })}
            />
          </div>

          {/* 소개 글 + 대표 진행자 */}
          <div className="mt-24 grid items-center gap-12 md:mt-36 md:grid-cols-[minmax(0,1fr)_minmax(0,460px)] md:gap-16">
            <FadeUp>
              <h2 className={h2Cls}>
                {t<React.ReactNode>({
                  ko: <>프리티풀을<br />소개합니다</>,
                  en: <>Introducing<br />Freetiful</>,
                  ja: <>Freetiful を<br />ご紹介します</>,
                  zh: <>Freetiful<br />公司简介</>,
                })}
              </h2>
              <p className={`mt-7 ${leadCls}`}>
                {t<React.ReactNode>({
                  ko: <>프리랜서 진행자 전문 매칭플랫폼 프리티풀입니다. 프리티풀은 <strong className="font-semibold text-[#191F28]">Freelancer, Beautiful, 그리고 Pool</strong>이라는 세 단어에서 유래된 이름처럼, 여러분의 소중한 시간을 아름다운 순간으로 만들어드리는 프리랜서 진행자들이 모여 있는 플랫폼입니다.</>,
                  en: <>Freetiful is a specialized matching platform for freelance event hosts. The name comes from the three words <strong className="font-semibold text-[#191F28]">Freelancer, Beautiful, and Pool</strong> — a curated pool of professionals who turn your precious moments into beautiful memories.</>,
                  ja: <>Freetiful はフリーランス司会者専門のマッチングプラットフォームです。<strong className="font-semibold text-[#191F28]">Freelancer、Beautiful、Pool</strong> の三つの単語から生まれた名前の通り、皆様の大切な時間を美しい瞬間に変えるフリーランス司会者が集まるプラットフォームです。</>,
                  zh: <>Freetiful 是专业的自由主持人匹配平台。名称源自 <strong className="font-semibold text-[#191F28]">Freelancer、Beautiful、Pool</strong> 三个单词——汇聚优秀自由主持人的人才库,将您珍贵的时刻变为美好的回忆。</>,
                })}
              </p>
              <p className={`mt-5 ${leadCls}`}>
                {t<React.ReactNode>({
                  ko: <>결혼식·돌잔치 등의 가족행사부터 기업행사·국제행사, 체육대회·레크리에이션 진행까지 전국 <strong className="font-semibold text-[#191F28]">1,000여 명의 아나운서, MC, 쇼호스트</strong>들과 함께하고 있습니다. KBS, SBS, MBC 지상파 3사를 포함하여 각 방송사 출신의 검증된 사회자만을 고객과 연결합니다.</>,
                  en: <>From family events like weddings and first-birthdays to corporate events, international conferences, sports events, and team-building activities, we work with <strong className="font-semibold text-[#191F28]">over 1,000 announcers, MCs, and show hosts</strong> nationwide. We only connect clients with verified hosts from Korea&apos;s top broadcasters including KBS, SBS, and MBC.</>,
                  ja: <>結婚式・初誕生日などの家族イベントから、企業イベント・国際イベント、体育大会・レクリエーションまで、全国 <strong className="font-semibold text-[#191F28]">1,000名以上のアナウンサー、MC、ショーホスト</strong> と共に活動しています。KBS、SBS、MBC の地上波3社をはじめ、放送局出身の認証済み司会者のみをお客様に紹介します。</>,
                  zh: <>从婚礼、周岁宴等家庭活动,到企业活动、国际活动、体育赛事、团建活动,我们与全国 <strong className="font-semibold text-[#191F28]">1,000 余名主播、MC、购物主持人</strong> 合作。仅将 KBS、SBS、MBC 三大电视台等广播公司出身的认证主持人介绍给客户。</>,
                })}
              </p>
            </FadeUp>
            <FadeUp delay={150}>
              <div className="relative overflow-hidden rounded-[32px] bg-gradient-to-b from-[#EEF5FF] to-[#F9FAFB]">
                <Image src="/images/biz-about-hosts.png" alt="프리티풀 대표 전문 사회자" width={840} height={840} className="h-auto w-full object-contain" />
              </div>
            </FadeUp>
          </div>

          {/* 큰 숫자 */}
          <div className="mt-24 grid grid-cols-2 gap-x-6 gap-y-12 border-t border-[#F2F4F6] pt-14 md:mt-32 md:grid-cols-4 md:pt-20">
            {[
              { num: 1000, suffix: '+', label: t({ ko: '검증된 진행자', en: 'Verified Hosts', ja: '認証済み司会者', zh: '认证主持人' }) },
              { num: 13000, suffix: '+', label: t({ ko: '결혼식 사회 경력', en: 'Weddings Hosted', ja: '結婚式司会実績', zh: '婚礼主持经验' }) },
              { num: 8, suffix: t({ ko: '개', en: '', ja: '分野', zh: '个' }), label: t({ ko: '서비스 분야', en: 'Service Areas', ja: 'サービス分野', zh: '服务领域' }) },
              { num: 3, suffix: t({ ko: '사', en: '', ja: '局', zh: '家' }), label: t({ ko: '지상파 방송사 출신', en: 'Major Broadcasters', ja: '地上波放送局出身', zh: '主流广播公司出身' }) },
            ].map((s, i) => (
              <FadeUp key={i} delay={i * 90}>
                <p className="text-[15px] font-semibold text-[#8B95A1] md:text-[17px]">{s.label}</p>
                <p className="mt-2 text-[36px] font-bold leading-none tracking-[-0.03em] text-[#191F28] tabular-nums md:text-[56px]">
                  <CountUp target={s.num} suffix={s.suffix} />
                </p>
              </FadeUp>
            ))}
          </div>
        </div>

        {/* 행사 사진 띠 */}
        <FadeUp className="mt-24 overflow-hidden md:mt-32">
          <div className="flex gap-4 md:gap-5" style={{ width: 'max-content', animation: 'promoScroll 70s linear infinite' }}>
            {[...PROMO_IMAGES, ...PROMO_IMAGES, ...PROMO_IMAGES].map((src, i) => (
              <div key={i} className="h-[220px] w-[300px] shrink-0 overflow-hidden rounded-[24px] md:h-[320px] md:w-[440px] md:rounded-[28px]">
                {/* eslint-disable-next-line @next/next/no-img-element */}
                <img src={src} alt="프리티풀 행사" loading="lazy" className="h-full w-full object-cover transition-transform duration-700 hover:scale-[1.04]" />
              </div>
            ))}
          </div>
        </FadeUp>

        {/* 함께한 기업 */}
        <div className="mx-auto max-w-[1140px] px-6 pt-24 md:px-10 md:pt-36">
          <FadeUp className="text-center">
            <p className={eyebrowCls}>OUR PARTNERS</p>
            <h3 className={`mt-4 ${h2Cls}`}>
              {t<React.ReactNode>({
                ko: <>프리티풀 사회자들과<br />함께한 기업</>,
                en: <>Companies that trust<br />our professionals</>,
                ja: <>Freetiful 専門家と<br />共にした企業</>,
                zh: <>与 Freetiful 专家<br />合作的企业</>,
              })}
            </h3>
          </FadeUp>
        </div>
        <div className="relative mt-14 space-y-4 overflow-hidden pb-[120px] md:mt-20 md:space-y-5 md:pb-[180px]">
          <div className="pointer-events-none absolute bottom-0 left-0 top-0 z-10 w-16 bg-gradient-to-r from-white to-transparent md:w-40" />
          <div className="pointer-events-none absolute bottom-0 right-0 top-0 z-10 w-16 bg-gradient-to-l from-white to-transparent md:w-40" />
          {BIZ_LOGO_ROWS.map((rowLogos, row) => {
            const repeated = [...rowLogos, ...rowLogos, ...rowLogos];
            const direction = row % 2 === 0 ? 'normal' : 'reverse';
            const speed = 70 + row * 8;
            return (
              <div key={row} className="flex items-center gap-8 md:gap-12" style={{ width: 'max-content', animation: `bizLogoScroll ${speed}s linear infinite ${direction}` }}>
                {repeated.map((logo, i) => (
                  <div key={i} className="flex h-[34px] w-[90px] shrink-0 items-center justify-center opacity-40 grayscale transition-all duration-300 hover:opacity-90 hover:grayscale-0 md:h-[40px] md:w-[110px]">
                    {/* eslint-disable-next-line @next/next/no-img-element */}
                    <img src={logo} alt="" loading="lazy" className="max-h-full max-w-full object-contain" />
                  </div>
                ))}
              </div>
            );
          })}
        </div>
      </section>

      {/* ═══ 핵심서비스 — 앱으로 보는 섭외 · 영상 · 앱 화면 ═══════════════ */}
      <section id="핵심서비스" className="bg-white">
        <div className="mx-auto max-w-[1140px] px-6 pt-[120px] md:px-10 md:pt-[180px]">
          <FadeUp className="text-center">
            <p className={eyebrowCls}>SERVICE</p>
            <h2 className={`mt-4 break-keep ${h2Cls}`}>
              {t<React.ReactNode>({
                ko: <>검증부터 섭외까지<br />앱 하나로 간편하게</>,
                en: <>From vetting to booking,<br />all in one app</>,
                ja: <>検証からブッキングまで<br />アプリひとつで簡単に</>,
                zh: <>从审核到预约<br />一个应用轻松搞定</>,
              })}
            </h2>
            <p className={`mx-auto mt-6 max-w-[620px] ${leadCls}`}>
              {t({
                ko: '직관적인 앱으로 진행자를 비교하고, 채팅으로 바로 섭외하세요.',
                en: 'Compare hosts in an intuitive app and book them right in chat.',
                ja: '直感的なアプリで司会者を比較し、チャットですぐに依頼できます。',
                zh: '在直观的应用中比较主持人,通过聊天即刻预约。',
              })}
            </p>
          </FadeUp>
          <div className="mt-20 md:mt-10">
            <FeatureShowcase />
          </div>
        </div>

        {/* 홍보 영상 */}
        <div className="bg-[#F9FAFB] py-[120px] md:py-[160px]">
          <div className="mx-auto max-w-[1140px] px-6 md:px-10">
            <FadeUp className="text-center">
              <p className={eyebrowCls}>PROMOTION VIDEO</p>
              <h2 className={`mt-4 break-keep ${h2Cls}`}>{t({
                ko: '프리티풀을 영상으로 만나보세요',
                en: 'Watch Freetiful in action',
                ja: 'Freetiful を動画でご覧ください',
                zh: '通过视频了解 Freetiful',
              })}</h2>
            </FadeUp>
            <div className="mt-14 grid gap-6 md:mt-20 md:grid-cols-2 md:gap-8">
              {[
                {
                  src: '/images/KakaoTalk_Video_2026-04-08-23-05-28.mp4#t=0.5',
                  tag: 'PLATFORM',
                  title: t({ ko: '프리티풀 플랫폼 소개', en: 'Freetiful Platform Overview', ja: 'Freetiful プラットフォーム紹介', zh: 'Freetiful 平台简介' }),
                  desc: t({ ko: 'KBS·SBS·MBC 방송사 출신 검증된 진행자, 전국 1,000여 명과 함께하는 매칭 플랫폼', en: 'A matching platform with 1,000+ verified hosts from KBS·SBS·MBC', ja: 'KBS・SBS・MBC出身の認証済み司会者 1,000名以上と共に歩むマッチングプラットフォーム', zh: '汇聚来自 KBS·SBS·MBC 的 1,000 余名认证主持人的匹配平台' }),
                },
                {
                  src: '/images/KakaoTalk_Video_2026-04-13-10-12-55.mp4#t=0.5',
                  tag: 'APPLICATION',
                  title: t({ ko: '프리티풀 어플리케이션 소개', en: 'Freetiful App Overview', ja: 'Freetiful アプリ紹介', zh: 'Freetiful 应用程序简介' }),
                  desc: t({ ko: '검증된 사회자를 직관적으로 비교하고, 실시간 소통으로 간편하게 매칭하세요', en: 'Compare verified hosts intuitively and match instantly with real-time chat', ja: '認証済み司会者を直感的に比較し、リアルタイムチャットで簡単にマッチング', zh: '直观比较认证主持人,通过实时聊天轻松匹配' }),
                },
              ].map((v, i) => (
                <FadeUp key={v.tag} delay={i * 120}>
                  <div className="overflow-hidden rounded-[28px] bg-white shadow-[0_20px_50px_-24px_rgba(0,27,55,0.18)]">
                    <video className="aspect-video w-full bg-black" controls playsInline preload="metadata" muted>
                      <source src={v.src} type="video/mp4" />
                    </video>
                    <div className="p-6 md:p-8">
                      <span className="text-[13px] font-semibold text-[#3182F6]">{v.tag}</span>
                      <h3 className="mt-2 text-[20px] font-bold tracking-[-0.02em] text-[#191F28] md:text-[24px]">{v.title}</h3>
                      <p className="mt-2 break-keep text-[15px] leading-[1.65] text-[#6B7684] md:text-[16px]">{v.desc}</p>
                    </div>
                  </div>
                </FadeUp>
              ))}
            </div>
          </div>
        </div>

        {/* 앱 화면 */}
        <div className="pb-[100px] pt-[120px] md:pb-[140px] md:pt-[160px]">
          <FadeUp className="mx-auto max-w-[1140px] px-6 text-center md:px-10">
            <p className={eyebrowCls}>APP SCREENS</p>
            <h2 className={`mt-4 break-keep ${h2Cls}`}>{t({
              ko: '직관적인 앱으로 간편하게',
              en: 'Simple, intuitive app experience',
              ja: '直感的なアプリで簡単に',
              zh: '直观应用,简便体验',
            })}</h2>
          </FadeUp>
          <FadeUp delay={150} className="mt-12 md:mt-16">
            <AppScreenMarquee images={INTRO_IMAGES} speed={90} />
          </FadeUp>
        </div>
      </section>

      {/* ═══ 2025 송년회 RECEPTION ═════════════════════════════ */}
      <ReceptionSection />

      {/* ═══ 연혁 ═══════════════════════════════════════════════ */}
      <section id="연혁" className="bg-white py-[120px] md:py-[180px]">
        <div className="mx-auto max-w-[1140px] px-6 md:px-10">
          <FadeUp>
            <p className={eyebrowCls}>MILESTONES</p>
            <h2 className={`mt-4 ${h2Cls}`}>{t({ ko: '성장의 발자취', en: 'Our Growth Journey', ja: '成長の足跡', zh: '成长足迹' })}</h2>
          </FadeUp>

          <div className="mt-14 md:mt-20">
            {HISTORY_DATA.map((h) => (
              <div key={h.year} className="grid gap-6 border-t border-[#E5E8EB] py-12 md:grid-cols-[260px_minmax(0,1fr)] md:gap-10 md:py-16">
                <FadeUp>
                  <p className="text-[52px] font-bold leading-none tracking-[-0.04em] text-[#3182F6] tabular-nums md:sticky md:top-28 md:text-[72px]">{h.year}</p>
                </FadeUp>
                <ul className="space-y-5 md:space-y-6">
                  {h.events.map((event, i) => (
                    <FadeUp key={i} delay={Math.min(i, 6) * 60}>
                      <li className="flex gap-4">
                        <span className="mt-[11px] h-[7px] w-[7px] shrink-0 rounded-full bg-[#C4CAD1] md:mt-[13px]" />
                        <span className="break-keep text-[17px] font-medium leading-[1.6] text-[#333D4B] md:text-[20px]">{t(event)}</span>
                      </li>
                    </FadeUp>
                  ))}
                </ul>
              </div>
            ))}
          </div>

          {/* 로드맵 */}
          <FadeUp className="mt-20 md:mt-28">
            <p className={eyebrowCls}>ROADMAP</p>
          </FadeUp>
          <div className="mt-8 grid gap-4 md:grid-cols-3 md:gap-5">
            {[
              { phase: '01', title: t({ ko: '사회자 매칭 플랫폼 고도화', en: 'Matching Platform Upgrade', ja: 'マッチングプラットフォーム高度化', zh: '专家匹配平台升级' }), desc: t({ ko: 'AI 매칭 정확도 향상, 사회자 카테고리 확장', en: 'Improve AI matching accuracy and expand expert categories', ja: 'AIマッチング精度向上、専門家カテゴリー拡大', zh: '提高AI匹配准确度,扩展专家类别' }) },
              { phase: '02', title: t({ ko: '전국 서비스 확대', en: 'Nationwide Service Expansion', ja: '全国サービス拡大', zh: '全国服务扩展' }), desc: t({ ko: '수도권 중심에서 전국 서비스 커버리지 확장', en: 'Expand coverage from capital region to nationwide', ja: '首都圏中心から全国サービスへ拡大', zh: '从首都圈扩展至全国服务覆盖' }) },
              { phase: '03', title: t({ ko: '종합 행사 솔루션', en: 'Total Event Solution', ja: '総合イベントソリューション', zh: '综合活动解决方案' }), desc: t({ ko: '기획·공간·사회자·장비까지 원스톱 행사 플랫폼으로 진화', en: 'Evolve into a one-stop event platform covering planning, venues, experts, and equipment', ja: '企画・会場・専門家・機材まで、ワンストップイベントプラットフォームへ進化', zh: '发展为涵盖策划、场地、专家、设备的一站式活动平台' }) },
            ].map((p, i) => (
              <FadeUp key={p.phase} delay={i * 100}>
                <div className="h-full rounded-[28px] bg-[#F9FAFB] p-7 md:p-9">
                  <span className="text-[34px] font-bold leading-none tracking-[-0.03em] text-[#D1D6DB] tabular-nums md:text-[44px]">{p.phase}</span>
                  <h3 className="mt-6 break-keep text-[20px] font-bold tracking-[-0.02em] text-[#191F28] md:text-[22px]">{p.title}</h3>
                  <p className="mt-2 break-keep text-[15px] leading-[1.65] text-[#6B7684] md:text-[16px]">{p.desc}</p>
                </div>
              </FadeUp>
            ))}
          </div>
        </div>
      </section>

      {/* ═══ 자료실 ═══════════════════════════════════════════ */}
      <section id="자료실" className="bg-[#F9FAFB] py-[120px] md:py-[160px]">
        <div className="mx-auto max-w-[1140px] px-6 md:px-10">
          <FadeUp>
            <p className={eyebrowCls}>RESOURCES</p>
            <h2 className={`mt-4 ${h2Cls}`}>{t({ ko: '자료실', en: 'Resources', ja: '資料室', zh: '资料库' })}</h2>
          </FadeUp>

          <div className="mt-12 grid gap-3 md:mt-16 md:grid-cols-2 md:gap-4">
            {[
              { icon: <Download className="h-5 w-5" />, title: 'CI', desc: 'SVG', file: '/images/CI.svg' },
              { icon: <Download className="h-5 w-5" />, title: t({ ko: 'BI 가이드라인', en: 'BI Guideline', ja: 'BI ガイドライン', zh: 'BI 指南' }), desc: 'PDF', file: '/images/freetiful_bi.pdf' },
              { icon: <FileText className="h-5 w-5" />, title: t({ ko: '서비스 이용가이드', en: 'Service Guide', ja: 'サービス利用ガイド', zh: '服务使用指南' }), desc: t({ ko: '웹 가이드', en: 'Web Guide', ja: 'Webガイド', zh: '网页指南' }), file: '#핵심서비스' },
              { icon: <Briefcase className="h-5 w-5" />, title: t({ ko: '파트너 제안서', en: 'Partner Proposal', ja: 'パートナー提案書', zh: '合作伙伴提案' }), desc: t({ ko: '제휴 안내', en: 'Partnership', ja: '提携案内', zh: '合作指南' }), file: '#문의폼' },
              { icon: <Shield className="h-5 w-5" />, title: t({ ko: '개인정보처리방침', en: 'Privacy Policy', ja: 'プライバシーポリシー', zh: '隐私政策' }), desc: '', file: 'privacy' },
            ].map((item, i) => (
              <FadeUp key={i} delay={i * 70}>
                <button
                  onClick={() => {
                    if (item.file === 'privacy') { router.push('/terms/privacy'); return; }
                    if (item.file.startsWith('#')) {
                      document.querySelector(item.file)?.scrollIntoView({ behavior: 'smooth', block: 'start' });
                      return;
                    }
                    setPreviewFile(item.file);
                  }}
                  className="group flex w-full items-center gap-4 rounded-[20px] bg-white p-5 text-left transition-colors hover:bg-white/70 md:p-6"
                >
                  <div className="flex h-12 w-12 shrink-0 items-center justify-center rounded-[16px] bg-[#E8F3FF] text-[#3182F6]">{item.icon}</div>
                  <p className="flex-1 text-[17px] font-semibold text-[#191F28]">{item.title}</p>
                  {item.desc && <span className="text-[13px] font-medium text-[#8B95A1]">{item.desc}</span>}
                  <ChevronRight className="h-5 w-5 text-[#C4CAD1] transition-transform group-hover:translate-x-1" />
                </button>
              </FadeUp>
            ))}
          </div>
        </div>
      </section>

      {/* ═══ 오시는길 ═══════════════════════════════════════════ */}
      <section id="오시는길" className="bg-white py-[120px] md:py-[160px]">
        <div className="mx-auto max-w-[1140px] px-6 md:px-10">
          <FadeUp>
            <p className={eyebrowCls}>LOCATION</p>
            <h2 className={`mt-4 ${h2Cls}`}>{t({ ko: '오시는길', en: 'How to Find Us', ja: 'アクセス', zh: '地理位置' })}</h2>
          </FadeUp>

          <FadeUp delay={100} className="mt-12 md:mt-16">
            <div className="h-[300px] w-full overflow-hidden rounded-[28px] bg-[#F2F4F6] md:h-[420px]">
              <BizKakaoMap />
            </div>
          </FadeUp>

          <div className="mt-6 grid gap-3 md:grid-cols-2 md:gap-4">
            {[
              { icon: <MapPin className="h-5 w-5" />, label: t({ ko: '주소', en: 'Address', ja: '住所', zh: '地址' }), value: COMPANY_INFO.address, copyable: true },
              { icon: <Phone className="h-5 w-5" />, label: t({ ko: '대표전화', en: 'Phone', ja: '代表電話', zh: '代表电话' }), value: COMPANY_INFO.phone, copyable: true },
              { icon: <Mail className="h-5 w-5" />, label: t({ ko: '이메일', en: 'Email', ja: 'メール', zh: '邮箱' }), value: COMPANY_INFO.email, copyable: true },
              { icon: <Clock className="h-5 w-5" />, label: t({ ko: '업무시간', en: 'Business Hours', ja: '営業時間', zh: '营业时间' }), value: t({ ko: '평일 09:00 - 18:00 (주말/공휴일 휴무)', en: 'Weekdays 09:00 - 18:00 (Closed weekends/holidays)', ja: '平日 09:00 - 18:00 (週末/祝日休み)', zh: '工作日 09:00 - 18:00 (周末/节假日休息)' }), copyable: false },
            ].map((item, i) => (
              <FadeUp key={i} delay={i * 70}>
                <CopyableCard icon={item.icon} label={item.label} value={item.value} copyable={item.copyable} />
              </FadeUp>
            ))}
          </div>

          <FadeUp delay={150}>
            <div className="mt-4 rounded-[20px] bg-[#F9FAFB] p-6">
              <p className="mb-4 text-[13px] font-semibold text-[#8B95A1]">{t({ ko: '교통편 안내', en: 'GETTING HERE', ja: '交通案内', zh: '交通指南' })}</p>
              <div className="space-y-3 text-[15px] text-[#4E5968] md:text-[16px]">
                <p><span className="font-bold text-[#3182F6]">{t({ ko: '지하철', en: 'Subway', ja: '地下鉄', zh: '地铁' })}</span> — {t({ ko: '1호선·3호선·5호선 종로3가역 도보 5분', en: '5-min walk from Jongno 3-ga Station (Lines 1·3·5)', ja: '1号線・3号線・5号線 鍾路3街駅 徒歩5分', zh: '1号线·3号线·5号线 钟路3街站步行5分钟' })}</p>
                <p><span className="font-bold text-[#03B26C]">{t({ ko: '버스', en: 'Bus', ja: 'バス', zh: '公交' })}</span> — {t({ ko: '종로6가 정류장 하차', en: 'Get off at Jongno 6-ga stop', ja: '鍾路6街バス停下車', zh: '钟路6街站下车' })}</p>
              </div>
            </div>
          </FadeUp>
        </div>
      </section>

      {/* ═══ 기업문의 — 큰 마무리 문장 ════════════════════════════ */}
      <section className="relative overflow-hidden bg-[#F9FAFB] py-[120px] md:py-[180px]">
        <div className="relative z-10 mx-auto max-w-[900px] px-6 text-center">
          <FadeUp className="flex justify-center">
            <Image src="/images/mc-characters.png" alt="MC Characters" width={400} height={300} className="w-[240px] md:w-[320px]" />
          </FadeUp>
          <FadeUp delay={100}>
            <h2 className={`mt-10 break-keep ${h2Cls}`}>
              {t<React.ReactNode>({
                ko: <>당신의 특별한 순간,<br /><span className="text-[#3182F6]">프리티풀</span>과 함께하세요</>,
                en: <>Your special moments,<br />with <span className="text-[#3182F6]">Freetiful</span></>,
                ja: <>あなたの特別な瞬間、<br /><span className="text-[#3182F6]">Freetiful</span> と共に</>,
                zh: <>您的特别时刻,<br />与 <span className="text-[#3182F6]">Freetiful</span> 同行</>,
              })}
            </h2>
            <p className={`mx-auto mt-6 max-w-[560px] ${leadCls}`}>
              {t<React.ReactNode>({
                ko: <>아나운서·MC 섭외부터 행사기획까지<br />검증된 사회자가 함께합니다.</>,
                en: <>From booking announcers and MCs to full event planning,<br />verified professionals are with you.</>,
                ja: <>アナウンサー・MC のブッキングからイベント企画まで、<br />認証済みの専門家がサポートします。</>,
                zh: <>从主播、MC 预约到活动策划,<br />认证专业人士全程陪同。</>,
              })}
            </p>
          </FadeUp>
          <FadeUp delay={220} className="mt-10 flex justify-center">
            <button
              onClick={() => scrollTo('문의폼')}
              className="inline-flex h-14 items-center gap-2 rounded-[16px] bg-[#3182F6] px-8 text-[17px] font-bold text-white transition-colors hover:bg-[#1B64DA] active:scale-[0.98]"
            >
              <Send className="h-4 w-4" />
              {t({ ko: '지금 문의하기', en: 'Contact Now', ja: '今すぐお問合せ', zh: '立即咨询' })}
            </button>
          </FadeUp>
        </div>
      </section>

      {/* ═══ 문의 폼 ═══════════════════════════════════════════ */}
      <section id="문의폼" className="bg-white py-[120px] md:py-[160px]">
        <div id="문의" className="mx-auto max-w-[640px] px-6">
          <FadeUp className="text-center">
            <p className={eyebrowCls}>INQUIRY FORM</p>
            <h2 className={`mt-4 ${h2Cls}`}>{t({ ko: '기업 문의', en: 'Business Inquiry', ja: '法人お問合せ', zh: '企业咨询' })}</h2>
          </FadeUp>

          <FadeUp delay={120}>
            <form onSubmit={handleInquiry} className="mt-12 space-y-3">
              <div className="grid grid-cols-2 gap-3">
                <input className={inputCls} placeholder={t({ ko: '회사명', en: 'Company', ja: '会社名', zh: '公司名称' })} value={inquiry.company} onChange={(e) => setInquiry({ ...inquiry, company: e.target.value })} />
                <input className={inputCls} placeholder={t({ ko: '담당자명 *', en: 'Contact Name *', ja: '担当者名 *', zh: '联系人 *' })} value={inquiry.name} onChange={(e) => setInquiry({ ...inquiry, name: e.target.value })} required />
              </div>
              <div className="grid grid-cols-2 gap-3">
                <input className={inputCls} placeholder={t({ ko: '연락처 *', en: 'Phone *', ja: '連絡先 *', zh: '联系电话 *' })} value={inquiry.phone} onChange={(e) => setInquiry({ ...inquiry, phone: e.target.value })} required />
                <input className={inputCls} placeholder={t({ ko: '이메일', en: 'Email', ja: 'メール', zh: '邮箱' })} value={inquiry.email} onChange={(e) => setInquiry({ ...inquiry, email: e.target.value })} />
              </div>
              <select
                value={inquiry.type}
                onChange={(e) => setInquiry({ ...inquiry, type: e.target.value })}
                className={`${inputCls} ${inquiry.type ? '' : 'text-[#B0B8C1]'}`}
              >
                <option value="">{t({ ko: '문의유형 선택', en: 'Select inquiry type', ja: 'お問合せ種別を選択', zh: '选择咨询类型' })}</option>
                <option value="wedding">{t({ ko: '결혼식 사회자 섭외', en: 'Wedding MC Booking', ja: '結婚式司会者の依頼', zh: '婚礼主持人预约' })}</option>
                <option value="enterprise">{t({ ko: '기업행사 / 공식행사', en: 'Corporate / Official Event', ja: '企業イベント / 公式行事', zh: '企业活动 / 官方活动' })}</option>
                <option value="festival">{t({ ko: '축제 / 체육대회', en: 'Festival / Sports Event', ja: 'フェスティバル / 体育大会', zh: '节庆 / 体育赛事' })}</option>
                <option value="broadcast">{t({ ko: '방송 / 라이브커머스', en: 'Broadcast / Live Commerce', ja: '放送 / ライブコマース', zh: '广播 / 直播电商' })}</option>
                <option value="partnership">{t({ ko: '제휴 / 파트너십', en: 'Partnership', ja: '提携 / パートナーシップ', zh: '合作 / 合作伙伴' })}</option>
                <option value="other">{t({ ko: '기타', en: 'Other', ja: 'その他', zh: '其他' })}</option>
              </select>
              <textarea className={`${inputCls} h-36 resize-none py-4`} placeholder={t({ ko: '문의 내용 *', en: 'Message *', ja: 'お問合せ内容 *', zh: '咨询内容 *' })} value={inquiry.message} onChange={(e) => setInquiry({ ...inquiry, message: e.target.value })} required />
              {/* 파일 첨부 */}
              <div className="flex items-center gap-3">
                <label className="flex cursor-pointer items-center gap-2 rounded-[12px] bg-[#F2F4F6] px-4 py-3 text-[15px] font-medium text-[#4E5968] transition-colors hover:bg-[#E5E8EB]">
                  <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"><path d="M21.44 11.05l-9.19 9.19a6 6 0 01-8.49-8.49l9.19-9.19a4 4 0 015.66 5.66l-9.2 9.19a2 2 0 01-2.83-2.83l8.49-8.48" /></svg>
                  {t({ ko: '파일 첨부', en: 'Attach File', ja: 'ファイル添付', zh: '附件' })}
                  <input type="file" className="hidden" onChange={(e) => setInquiryFile(e.target.files?.[0] || null)} />
                </label>
                {inquiryFile && (
                  <div className="flex items-center gap-2 rounded-[10px] bg-[#F9FAFB] px-3 py-2 text-[14px] text-[#4E5968]">
                    <span className="max-w-[200px] truncate">{inquiryFile.name}</span>
                    <button type="button" onClick={() => setInquiryFile(null)} className="text-[#B0B8C1] hover:text-[#F04452]" aria-label="첨부 지우기">
                      <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"><path d="M18 6L6 18M6 6l12 12" /></svg>
                    </button>
                  </div>
                )}
              </div>
              <button
                type="submit"
                disabled={sending}
                className="mt-2 flex h-14 w-full items-center justify-center gap-2 rounded-[16px] bg-[#3182F6] text-[17px] font-bold text-white transition-colors hover:bg-[#1B64DA] active:scale-[0.99] disabled:opacity-50"
              >
                <Send className="h-4 w-4" /> {sending ? t({ ko: '전송 중...', en: 'Sending...', ja: '送信中...', zh: '发送中...' }) : t({ ko: '문의하기', en: 'Submit', ja: 'お問合せ', zh: '提交' })}
              </button>
              <p className="pt-1 text-center text-[13px] text-[#8B95A1]">{t({
                ko: '문의 접수 후 영업일 기준 1~2일 내 담당자가 연락드립니다',
                en: 'We will get back to you within 1-2 business days',
                ja: 'お問合せ後、営業日 1~2 日以内に担当者よりご連絡いたします',
                zh: '收到咨询后,我们将在 1-2 个工作日内回复您',
              })}</p>
            </form>
          </FadeUp>
        </div>
      </section>

      {/* ═══ Footer ═══════════════════════════════════════════ */}
      <footer className="bg-[#F9FAFB] py-14 pb-32 md:pb-16">
        <div className="mx-auto max-w-[1140px] px-6 md:px-10">
          <div className="flex flex-col gap-8 md:flex-row md:items-start md:justify-between">
            <div>
              <p className="text-[17px] font-bold text-[#333D4B]">Freetiful <span className="text-[13px] font-medium text-[#8B95A1]">for Business</span></p>
              <p className="mt-3 text-[13px] leading-[1.7] text-[#8B95A1]">{COMPANY_INFO.name} | {t({ ko: '대표', en: 'CEO', ja: '代表', zh: '代表' })} {COMPANY_INFO.ceo} | T {COMPANY_INFO.phone} | E {COMPANY_INFO.email}</p>
              <p className="mt-1 text-[12px] text-[#B0B8C1]">Copyright &copy; Freetiful Inc. All rights reserved.</p>
            </div>
            <div className="flex flex-wrap gap-x-5 gap-y-2 text-[14px] font-medium text-[#6B7684]">
              <a href={COMPANY_INFO.blog} target="_blank" rel="noopener noreferrer" className="transition-colors hover:text-[#191F28]">{t({ ko: '블로그', en: 'Blog', ja: 'ブログ', zh: '博客' })}</a>
              <a href={`https://instagram.com/${COMPANY_INFO.instagram}`} target="_blank" rel="noopener noreferrer" className="transition-colors hover:text-[#191F28]">{t({ ko: '인스타그램', en: 'Instagram', ja: 'Instagram', zh: 'Instagram' })}</a>
              <a href={COMPANY_INFO.youtube} target="_blank" rel="noopener noreferrer" className="transition-colors hover:text-[#191F28]">{t({ ko: '유튜브', en: 'YouTube', ja: 'YouTube', zh: 'YouTube' })}</a>
              <a href={COMPANY_INFO.tiktok} target="_blank" rel="noopener noreferrer" className="transition-colors hover:text-[#191F28]">{t({ ko: '틱톡', en: 'TikTok', ja: 'TikTok', zh: 'TikTok' })}</a>
              <Link href="/terms/privacy" className="transition-colors hover:text-[#191F28]">{t({ ko: '개인정보처리방침', en: 'Privacy Policy', ja: 'プライバシーポリシー', zh: '隐私政策' })}</Link>
              <Link href="/careers" className="transition-colors hover:text-[#191F28]">{t({ ko: '인재채용', en: 'Careers', ja: '採用情報', zh: '人才招聘' })}</Link>
              <Link href="/main" className="transition-colors hover:text-[#191F28]">{t({ ko: '홈으로', en: 'Home', ja: 'ホーム', zh: '返回首页' })}</Link>
            </div>
          </div>
        </div>
      </footer>

      {/* ═══ 모바일 바텀 네비게이션 ═══════════════════════════ */}
      <nav
        data-native-biz-nav
        className="pb-safe fixed bottom-0 left-0 right-0 z-50 px-4 md:hidden"
      >
        <div className="mx-auto mb-2 max-w-lg" style={{ display: 'flex', justifyContent: 'flex-start' }}>
          <div
            className="border border-gray-100/60 bg-white/90 shadow-[0_-4px_30px_rgba(0,0,0,0.08)] backdrop-blur-2xl transition-all duration-500"
            style={{
              width: bizNavCollapsing ? 60 : '100%',
              maxWidth: bizNavCollapsing ? 60 : 512,
              height: 60,
              borderRadius: 9999,
              // 접힘 애니메이션 때만 클립 — 평소엔 visible 라야 문의 버튼 위 말풍선이 안 잘림
              overflow: bizNavCollapsing ? 'hidden' : 'visible',
              transition: bizNavCollapsing
                ? 'width 0.5s cubic-bezier(0.34, 1.56, 0.64, 1), max-width 0.5s cubic-bezier(0.34, 1.56, 0.64, 1)'
                : 'none',
              ...(bizNavExpanding ? { animation: 'bizPillExpand 0.6s cubic-bezier(0.34, 1.56, 0.64, 1) forwards' } : {}),
            }}
          >
            <div className="flex h-full items-center px-2">
              {/* 홈 이동 버튼 */}
              <button
                onClick={() => {
                  sessionStorage.setItem('nav-transition', 'from-biz');
                  setBizNavCollapsing(true);
                  setTimeout(() => router.push('/main'), 500);
                }}
                className={`-ml-1 flex h-[48px] w-[48px] shrink-0 items-center justify-center rounded-full transition-all duration-500 active:scale-90 ${bizNavCollapsing ? 'bg-transparent text-white' : 'bg-gray-100 text-gray-400 hover:bg-gray-200'}`}
                aria-label={t({ ko: '홈으로', en: 'Home', ja: 'ホーム', zh: '返回首页' })}
              >
                <ChevronLeft className="h-5 w-5" />
              </button>

              {/* 네비 아이템들 */}
              <div className="flex flex-1 items-center justify-around">
                {[
                  { id: '회사소개', iconSrc: '/images/company-intro.svg', label: t({ ko: '회사소개', en: 'About', ja: '会社紹介', zh: '公司简介' }) },
                  { id: '핵심서비스', iconSrc: '/images/service.svg', label: t({ ko: '서비스', en: 'Services', ja: 'サービス', zh: '服务' }) },
                  { id: '자료실', iconSrc: '/images/resources.svg', label: t({ ko: '자료실', en: 'Resources', ja: '資料', zh: '资料' }) },
                  { id: '문의', iconSrc: '/images/inquiry.svg', label: t({ ko: '문의하기', en: 'Contact Us', ja: 'お問合せ', zh: '联系咨询' }) },
                ].map((item, idx) => {
                  const isInquiry = item.id === '문의';
                  return (
                    <button
                      key={item.id}
                      onClick={() => {
                        scrollTo(isInquiry ? '문의폼' : item.id);
                        if (isInquiry) setInquiryBubbleHidden(true);
                      }}
                      className={`relative flex flex-col items-center gap-0.5 rounded-2xl px-3 py-1.5 transition-all active:scale-90 ${isInquiry ? '' : 'text-gray-400 hover:text-gray-700'}`}
                      style={{
                        opacity: bizNavCollapsing ? 0 : 1,
                        transform: bizNavCollapsing ? 'scale(0.5)' : (bizNavExpanding ? undefined : 'scale(1)'),
                        filter: bizNavCollapsing ? 'blur(4px)' : 'blur(0px)',
                        transition: bizNavCollapsing
                          ? `opacity 0.25s ease ${idx * 0.03}s, transform 0.25s ease ${idx * 0.03}s, filter 0.25s ease ${idx * 0.03}s`
                          : 'opacity 0.3s ease, transform 0.3s ease, filter 0.3s ease',
                        ...(bizNavExpanding ? { animation: `bizIconAppear 0.4s cubic-bezier(0.34, 1.56, 0.64, 1) ${0.25 + idx * 0.08}s both` } : {}),
                      }}
                    >
                      {isInquiry ? (
                        <div
                          className="relative h-5 w-5"
                          style={{
                            WebkitMask: `url(${item.iconSrc}) no-repeat center / contain`,
                            mask: `url(${item.iconSrc}) no-repeat center / contain`,
                            background: 'linear-gradient(90deg, #0052B5, #111111, #0052B5)',
                            backgroundSize: '200% 100%',
                            animation: 'iconGradientShift 2s linear infinite',
                          }}
                        />
                      ) : (
                        <Image src={item.iconSrc} alt={item.label} width={20} height={20} className="opacity-60" />
                      )}
                      <span
                        className="whitespace-nowrap text-[9px] font-medium"
                        style={isInquiry ? {
                          background: 'linear-gradient(90deg, #0052B5, #111111, #0052B5)',
                          backgroundSize: '200% 100%',
                          WebkitBackgroundClip: 'text',
                          WebkitTextFillColor: 'transparent',
                          backgroundClip: 'text',
                          animation: 'textGradientShift 2s linear infinite',
                          fontWeight: 700,
                        } : {}}
                      >
                        {item.label}
                      </span>
                      {/* 문의하기 말풍선 — 문의 버튼 바로 위에 고정(화면 비율 무관) */}
                      {isInquiry && !inquiryBubbleHidden && !bizNavCollapsing && (
                        <div
                          className="pointer-events-none absolute bottom-full left-1/2 mb-2 -translate-x-1/2 whitespace-nowrap"
                          style={{
                            animation: 'bubbleBoingOnce 1.2s cubic-bezier(0.34, 1.56, 0.64, 1) 0.3s both, bubbleFloat 2.8s ease-in-out 1.5s infinite',
                            zIndex: 51,
                          }}
                        >
                          <div className="relative rounded-full border border-gray-100 bg-white px-3 py-1.5 shadow-[0_4px_12px_rgba(0,0,0,0.12)]">
                            <span
                              className="text-[11px] font-bold"
                              style={{
                                background: 'linear-gradient(90deg, #111111, #0052B5, #111111)',
                                backgroundSize: '200% 100%',
                                WebkitBackgroundClip: 'text',
                                WebkitTextFillColor: 'transparent',
                                backgroundClip: 'text',
                                animation: 'textGradientShift 2.5s ease-in-out infinite',
                              }}
                            >
                              문의하기
                            </span>
                            <div className="absolute -bottom-[4px] left-1/2 h-2 w-2 -translate-x-1/2 rotate-45 border-b border-r border-gray-100 bg-white" />
                          </div>
                        </div>
                      )}
                    </button>
                  );
                })}
              </div>
            </div>
          </div>
        </div>
      </nav>

      {/* Biz nav transition keyframes */}
      <style dangerouslySetInnerHTML={{ __html: `
        @keyframes bizPillExpand {
          0% { width: 60px; max-width: 60px; filter: blur(0px); }
          15% { filter: blur(3px); }
          50% { filter: blur(1px); }
          70% { width: 105%; max-width: 530px; filter: blur(0px); }
          100% { width: 100%; max-width: 512px; filter: blur(0px); }
        }
        @keyframes bizIconAppear {
          0% { opacity: 0; transform: scale(0.3) translateY(4px); filter: blur(4px); }
          60% { opacity: 1; transform: scale(1.1) translateY(-1px); filter: blur(0px); }
          100% { opacity: 1; transform: scale(1) translateY(0); filter: blur(0px); }
        }
        @keyframes bubbleBoingOnce {
          0% { transform: scale(0) translateY(6px); opacity: 0; }
          50% { transform: scale(1.15) translateY(-2px); opacity: 1; }
          70% { transform: scale(0.95) translateY(0); }
          85% { transform: scale(1.05) translateY(-1px); }
          100% { transform: scale(1) translateY(0); opacity: 1; }
        }
        @keyframes bubbleFloat {
          0%, 100% { transform: translateY(0); }
          50% { transform: translateY(-3px); }
        }
        @keyframes textGradientShift {
          0% { background-position: 0% 50%; }
          100% { background-position: 200% 50%; }
        }
        @keyframes iconGradientShift {
          0% { background-position: 0% 50%; }
          100% { background-position: 200% 50%; }
        }
        @keyframes menuSlideIn {
          0% { transform: translateX(100%); }
          100% { transform: translateX(0); }
        }
        @keyframes menuOverlayIn {
          0% { opacity: 0; }
          100% { opacity: 1; }
        }
      `}} />

      {/* ═══ 파일 미리보기 모달 ═══════════════════════════════ */}
      {previewFile && (
        <div className="fixed inset-0 z-[100] flex items-center justify-center bg-black/50 p-4 backdrop-blur-sm" onClick={() => setPreviewFile(null)}>
          <div className="relative flex max-h-[90vh] w-full max-w-[900px] animate-[scaleIn_0.2s_ease-out] flex-col overflow-hidden rounded-[24px] bg-white shadow-2xl" onClick={(e) => e.stopPropagation()}>
            <div className="flex items-center justify-between border-b border-[#F2F4F6] px-6 py-4">
              <p className="text-[16px] font-bold text-[#191F28]">{previewFile.split('/').pop()}</p>
              <div className="flex items-center gap-2">
                <a
                  href={previewFile}
                  download
                  className="flex items-center gap-1.5 rounded-[10px] bg-[#3182F6] px-4 py-2 text-[13px] font-bold text-white transition-all hover:bg-[#1B64DA] active:scale-95"
                >
                  <Download className="h-3.5 w-3.5" />
                  다운로드
                </a>
                <button onClick={() => setPreviewFile(null)} className="rounded-[10px] p-2 transition-colors hover:bg-[#F2F4F6]" aria-label="닫기">
                  <X className="h-5 w-5 text-[#8B95A1]" />
                </button>
              </div>
            </div>
            <div className="flex min-h-[400px] flex-1 items-center justify-center overflow-auto bg-[#F9FAFB] p-4">
              {previewFile.endsWith('.svg') ? (
                // eslint-disable-next-line @next/next/no-img-element
                <img src={previewFile} alt="CI" className="max-h-[70vh] max-w-full object-contain" />
              ) : previewFile.endsWith('.pdf') ? (
                <iframe src={previewFile} className="h-[70vh] w-full rounded-lg border-0" />
              ) : (
                // eslint-disable-next-line @next/next/no-img-element
                <img src={previewFile} alt="Preview" className="max-h-[70vh] max-w-full object-contain" />
              )}
            </div>
          </div>
        </div>
      )}

      <style>{`@keyframes scaleIn { from { opacity: 0; transform: scale(0.95); } to { opacity: 1; transform: scale(1); } }`}</style>
    </div>
  );
}
