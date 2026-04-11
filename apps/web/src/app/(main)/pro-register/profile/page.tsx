'use client';

import { useState, useRef, useEffect } from 'react';
import { useRouter } from 'next/navigation';
import { ChevronLeft, ChevronDown, Plus, X, Image as ImageIcon, CheckCircle } from 'lucide-react';
import { motion, AnimatePresence, LayoutGroup } from 'framer-motion';

const COMPANY_LOGOS: string[] = [
  '/images/기업로고/ARxaH4OpVaUc1UjpOv2UhQ8hgPGt-JH64gkcWcIAGz4XfVyiy1LAog-99r2v_a3zax4EEZzaMKE5l2tFcQ7i7A.svg',
  '/images/기업로고/BRqtD2yZxxRP08TEpNXXNlHvXxtA9Dck7kO4rNAiyud7WyX1EudEU0Y7XpRaIi0eGipOIqU1iZRx06TjD87Bu_8PuSHC-vYi2expOi_ie9INQgZ_8lkfsq7WCiYGssRZvARyM-hmOKkZEOhr4vxl6Q.svg',
  '/images/기업로고/BzBaSlPhUQvUgTbep2YBg19b6coNL8iXPJp-BBD6f4z-rfsdylm8zOJnrkRmUWdJoQgJIDNuh7LnNaUeJ_B8Q32S11shONnXjdlQTFLz_5LSzLoW5D7pmuYXc99y6tWUOByfVz00-KNaJ9YAXRk2Eg.svg',
  '/images/기업로고/D8d0CAJYg56wMGb2nqUnU5thBBSBSisClhYH5WA_KfgBzdgzgn4Tb-Wd8VtH17Nsal4NkSk9XZ2SwUgLUuhVVg.svg',
  '/images/기업로고/EL-GmGKqmm_1_UI1I1HmCwdRis9GIdUfq0tBhZlKnvvB51kv2Wn0hFOfrApbJwh68wKSsYejtF7VN4Htuk2beb2mBOKIBpIM7NphrfKxnZWtfymCW5185hIVDb5q1_GmhJPNTV4GXIWat2Uw7SUHcw.svg',
  '/images/기업로고/FIN9iKw1Cdlcw0qdsLudvODTjrdndKbpbhu2rrzXy_MHd5LgMZBsbXaErtn_kNzWxM6iTiR7rJlKDcOV0TJ5UO7kwpWLap2PqskFK8q7Lb4kbHzAlpLii3vrpXzQbKneH9d2GEmKXMNl6VrkeepcXQ.svg',
  '/images/기업로고/Fbc3OBO5lnF_aljwIte4mbdQIFVsutSyv5oZ3_JZ5vZ5_Ez_Se0pe47JqRTjOZBqtlFGxYQXYzlG820nGt_M4of6r_OTf2hzjBGAa4UbekunDcLTFOXnG8Moc_cIMDhrABFn_g42rUoQk6FTMBErqg.svg',
  '/images/기업로고/GwHvDSCNafSHnRiZNqDMJOvThTG4_8QJgEFMZC3jlpTg_e_IMR2WWQcB4W641zxOwU219ER8opVMfaK8uhdrl-F69hJn02bChdq-cAheQjLEjDthTLEr4gaXwc4V8ZDNYdfj319zkwONKucgD_G05w.svg',
  '/images/기업로고/Kl7O19oIwFHCfL2QV05oLVVoL684vmbcbpFHyQCiQRiYr7Dgb18bXQM9qY__l0rm0dlPJKRTqAcwaqRcmvg_m0mVOvVfkrcdjER-1QOvtudPOP8len_6uFgfriIGYpYVBjmCyJ0RAHKe7JjZ1soeWw.svg',
  '/images/기업로고/N_7oK9jBqgd4o6MM1imyAIM0lZK2Rsr_oc9HDG8WRllhnrld37ChFRXkVZA5aMK-PSrkr9Y9LBrKuF0mQCMGP09WApahFXbjqTh-Rpw7fYqHkc2f7CKt7xCTc2OG0y1e1LPxvAqnwH4XOpxyWIyMMg.svg',
  '/images/기업로고/PV5QhQJrjCNrlEkK4HE-Myx-FNqaklavtwzZAzm_tVkUiX5U0kp-Ujm4vqKipQmsZj86CgDo_HVBtEEFgMCWIyrR7zWurNboYJJdW60duDKqWBF0ci_KpyXJ2-goGoXSB2_RmNotjMlducSl0kt_aA.svg',
  '/images/기업로고/Qqb24ODKcfgDz0dpJRti2CqDr9MThAod9YacFPOKifdbjvhBkviT1LgksZ5bxp92WDj3AsUa0h214Ln6fv3ejj1UxiP4hJfpPfq_u5Ae217Thzzkv3FqP9hDDBDGaNNBHJ1ypWViORlHmkucr_Elng.svg',
  '/images/기업로고/RDynDFYidWJ6Plgi-NOQnlBIMy3xfHiR0zgdLhyrv0PKCdBdstgmskNWU9s6MZ9iKGqbCRe8kK1zELijChT4yyIT285FNArduGoMzOK6nr3Jia0qu7Prqzk2awOznbMlKYQyxTaA_eSLDVRDyQFZpg.svg',
  '/images/기업로고/SRrqBgHlAil9jg2n7I4SZkLRwUcDf3bN51-iBsr1XI6-4a52MvSjP0EHo3CZVsDIXLkpG2FF-yj5P50n6D37IdfQdt-VN7OqAuH4QnmjXnD76Tomw6YDwsCJzUz29pBTReqT3XzKyXDg1V7bUd7ESQ.svg',
  '/images/기업로고/U4btAF6fKzlMyx9V0YciDz02RYAMbqpypTkUZjxYxE2LTOl9GYED7b76bOg8IXDfq16Er1Lc9ugCJpjWkovcWHgVfqHBd_TvxltZBFYmSSV1m8QMnkoIHR6Tywr3rwxBl48dWmnpOcgI9H9TeSFsow.svg',
  '/images/기업로고/W-Vzx_gdMaygn9LC-dNJuYIwz1dmiuk3LQMq9Pz692djzQ4OJeChfUYwkz393ioiyF0PUoh3aLTsw9qUs3hye41a8pueOhabVVgQxgrqfzN3uWlb6dIlJRracrtHx89cSXymXSF7gFOLl5BYrPXHcQ.svg',
  '/images/기업로고/WSvPMQh9MwaVyaaVkcJPXPAiHlt12lq_eWCs90KgbdOR6eMxcx2pcunmCoAYdAdKZfWiYd5v0k14ipyy2pulf9Eyks272dwhRCaso4mg63ZPh37yiQdgMnJGR-31GGXLA-zITyEy5h5LnReY7bc1zA.svg',
  '/images/기업로고/X_a20hnOPysVQ2Ybud5BiG9JsePpQUlAgZ7I7k75OlqQ8Jjbds4mEYR6MtxSN6BiigG6NX7zzA8FHq65y0En9A.svg',
  '/images/기업로고/Y2LNYrBudEa_mY0hs5l96vum89cGWqz6VURoh1IE9aw_IEhYDrXz6b0O06n5DLk-pt7_jWtOlsCTmoYb0PSN1kBJxv5LngLUpuC38B-CzvqNXaNJbkXxdlyswVkxGKHa2lZrq_7ciWKJCel_ddn_Fw.svg',
  '/images/기업로고/bTM6JHPFAd0TpQVfLybhadM48U9brNK0kr0RZPccZbU-8ZydayEHX19VoisuMNT4RXwlW4ReYpecuv-WALAmfUTxMg2UAA-dMPbuI4AExhpEY7ZgdiGAABBuc2VUpzXun8FdUeGryg7k6OJTfeaVLw.svg',
  '/images/기업로고/bzyX-bcOszBIyZp4I9fXQHBFCFJlDtVZ5NAQb3ipvPR8xehdx99F-xWHDTsVUbM8pEujQv1TQTTrXD7A3Xaaba9t-GOg2yNCBMg7hOg0SIPDGyOWqaSUu3VEY17h1JzvHNtpDPWW7Hs7aA6kUQ0MQw.svg',
  '/images/기업로고/ezX7tL2KZPta0ZvP1Lkh_OEXPbdgEfRygo9kCyM6vcb8JBEagUiFXb22DZl_vszRJjZO9skUXjyliiatyZDDrIrbcTzCCTYenibs7LacOErXMCZq_3C3GA6psClsFYu2Q9T_ioSus-WY3ie67qYG5w.svg',
  '/images/기업로고/fSD1BTd2CtrHz6EOr23a-JtJf_xlusDFuqwHTrrG_Ana3MZO0gD6Z0RxLLG56Wu26d5_eUAtRN71BnavVSNjVhvWQfUYxxFP6SpORqui38vEkw0pEBy9D8sPMnvKROtnKcz9JY7E4R13G-5-whvCvA.svg',
  '/images/기업로고/gQQBEDoS4V9wEzN-pj8dTe3V90azRcnv9wEVO3sxVQ76hOji4FinhMT-BZExwiOFhthnYBwEZR98A1ledzfgGQuHMloSpNtMAJ2aEvwhvlB_gwIIfpE08qtHptw_EznuI4YicbPYt708m7jGGsrO0Q.svg',
  '/images/기업로고/hVgF57hJ3xB0lWARAqgbKzF11iF_jHKPcy54Eatniz_PFt7nn-VH2zQRz93Lrzr14E07XvB2NeeHPH9_Tlxe75PO0-Sm1eByKRVeSEh9CAz-vzvDx1S69XMAP8d5YC_8skzq_6gt2qzVNxtS0F_bxA.svg',
  '/images/기업로고/lJaLPyiCksy4rKDEV86j9XqTd1QnIaiSPRZseWCttzMNixmZoBoggD7_wObo5aWy-30Xq22vNOgK7iwlobpvnO_PQIhrntTuBobFXVSjz9whoeU1IBExjolEGGdMydMmqKS6urghRnD2XACePGbp0A.svg',
  '/images/기업로고/mrnlNZzBeFxCorw5B0VjguNwYyRwYOZeMdp_UjoG5y7mbvBrkiv7hm0F8fiFsuUuyo8B83Uqv1Gz-v5Oe0FvoWZcBLoKuuZ88v9TkwFFzEGmApWGQiCCCCpR8ykp5nOGhOpYHt7tiAAyDFiy8_GknQ.svg',
  '/images/기업로고/n8d4p6AMfV8YVZiX5mst1veEfo9S7-y2GSe9ar-wGOEIa7y9w2mHQGm-a7w4BKzArAwN-Mhhv_jkfZfh1gc4aQ.svg',
  '/images/기업로고/nzX7hfiNDhzsZ5CC1dEpPbS84Ic2VNMBA4KAv-MfUcyYAlE_xhBUMhNq35nxuu-spWifKWjVzP_Q1jBbUAL4faNd2JlExARVqQeJkhOFGYJy0ZzAMkDFYqT83_MiQS5Rj1bRHdE8I2yVdtpeQYYwAg.svg',
  '/images/기업로고/oGx8Lf-pK-fz_NQBIQ6z0pJB386NEHT88b0IbG-WIuBmV5uzV1Ryi958B1bU0C0djwVNOZ-J7McjnTTz5EiVajLJz9Vfp2_vc6sFQ_gWgzzh8vRe6Mk1SNiAwRtcP-L-uE8bkMOeK5DE0JRd-O3aRA.svg',
  '/images/기업로고/p-10BFRQN-_hRreerH2X6Y1rzrcspaEiODZ0m9n3VonlNG_3KoJbQQo_i_aIEr56siCqXNmeOcfLSReRQsdB0w.svg',
  '/images/기업로고/tURiQcsQ4gqf5yehCIeBxoqAPAp8kbvJCFHt3pnJy5cf2d27mEVfyAwQtWdTT1aJP1wjS_dJlZzdGEk7P9fcrHezTDlrqqIb-ZQnXIkOgcp-S37Yit2UBGVMPyf6eUae605-0LzI5GdO3wQ0GRxRjg.svg',
  '/images/기업로고/uDLH9KAZCQMK2nqJyLEVJ9UzXnKO7uVJYZ4mgZMRS7m8wy6u7X2et3QHKDwYKNdhKoqjDWdMrhzpPpC9H1_L8Q-KOZwPbdcd3WdTSgJs-6g5N0zlZj3D-hgnY0s-VcAcLRTR1zgAwbD_bByywC802Q.svg',
  '/images/기업로고/y1AlwExMBWcxyTKygmw8EVoS0g_9Y_pLgbPEhUkc25b_h-4yTyiaVLSkVL0HjhFbX6cyQML4Uvk2LQYndy2Cs8Cys7FcUr8PqXwh9fRC0h8GtKB8nCZwaSWx3AFt-TdtPpWzytnx9w6owHJcAjeFEQ.svg',
  '/images/기업로고/ywnQTrlMBh8nsZsYJ-5WCT1d26iSqwxByWYPRIUtq4s2vJKvt_U1BxswLhWhvPg1txioQ7jtlSQ020q6ox0FVPVb8QXxK6rRYUO1mPoU9jEDg2qqGJoES4flW6d3opZKTcO7T1214OlUS6ch_RCUBA.svg',
  '/images/기업로고/zO55rSFFBt8SWtnaLX8pZ4KB6WlImBmSYRCCEAteo5NEAPrOKqtDmSGRDk2EXZUmiyPhdFCOKnkaCZ2BstnHa-h_Xz49IZDf1_R7H4gVSBEzRF4gZkgC6riVGwIDJnBd_Y7JbT_454w-PswxOT1OVw.svg',
];

const LANGUAGES = [
  '영어', '일본어', '중국어', '러시아어',
  '아랍어', '힌디어', '프랑스어',
  '포르투갈어', '터키어이', '스페인어',
  '독일어', '자바어', '베트남어',
  '이탈리아어', '태국어', '광둥어',
  '뱅골어',
];

const fadeIn = {
  initial: { opacity: 0, y: 16 },
  animate: { opacity: 1, y: 0 },
  transition: { duration: 0.4 },
};

const staggerContainer = {
  animate: {
    transition: {
      staggerChildren: 0.07,
    },
  },
};

const staggerItem = {
  initial: { opacity: 0, y: 16 },
  animate: { opacity: 1, y: 0, transition: { duration: 0.35 } },
};

const bottomSheetVariants = {
  hidden: { y: '100%' },
  visible: {
    y: 0,
    transition: { type: 'spring', damping: 28, stiffness: 300 },
  },
  exit: {
    y: '100%',
    transition: { type: 'spring', damping: 28, stiffness: 300 },
  },
};

export default function ProfilePage() {
  const router = useRouter();
  const [intro, setIntro] = useState('');
  const [careerYears, setCareerYears] = useState('');
  const [awardInput, setAwardInput] = useState('');
  const [awardYear, setAwardYear] = useState('');
  const [awardMonth, setAwardMonth] = useState('');
  const [showAwardYear, setShowAwardYear] = useState(false);
  const [showAwardMonth, setShowAwardMonth] = useState(false);
  const [awardList, setAwardList] = useState<{ text: string; year: string; month: string }[]>([]);
  const [videoError, setVideoError] = useState('');
  const [selectedCategories, setSelectedCategories] = useState<string[]>([]);
  const [selectedLanguages, setSelectedLanguages] = useState<string[]>([]);
  const [description, setDescription] = useState('');
  const [videos, setVideos] = useState<string[]>([]);
  const [videoInput, setVideoInput] = useState('');
  const [showVideoInput, setShowVideoInput] = useState(false);
  const FAQ_CATEGORIES = ['서비스정보', '수정 및 재진행', '취소 및 환불 규정', '상품정보 고시'] as const;
  const FAQ_DEFAULTS: Record<string, string> = {
    '서비스정보': '전문 사회자가 행사 당일 현장에서 사회를 진행합니다. 사전 미팅을 통해 행사 진행 순서를 조율하며, 신랑신부님의 요청에 맞춰 맞춤형 진행을 제공합니다.',
    '수정 및 재진행': '행사 진행 대본은 행사 3일 전까지 수정 가능합니다. 행사 당일 현장 상황에 따른 즉석 수정은 무료로 제공됩니다.',
    '취소 및 환불 규정': '행사 7일 전 취소 시 전액 환불, 3일 전 취소 시 50% 환불, 당일 취소 시 환불 불가합니다. 천재지변 등 불가항력적인 사유의 경우 별도 협의합니다.',
    '상품정보 고시': '서비스 제공자: 프리티풀 등록 전문 사회자\n서비스 형태: 행사 현장 사회 진행\n이용 조건: 사전 예약 필수\n취소/환불 조건: 취소 및 환불 규정 참조',
  };
  const [faqContents, setFaqContents] = useState<Record<string, string>>({ ...FAQ_DEFAULTS });
  const [activeFaqTab, setActiveFaqTab] = useState<string>('서비스정보');

  const [showConfirm, setShowConfirm] = useState(false);
  const [showSuccess, setShowSuccess] = useState(false);
  const [showCompanySheet, setShowCompanySheet] = useState(false);
  const [companySearch, setCompanySearch] = useState('');
  const editorRef = useRef<HTMLDivElement>(null);
  const colorInputRef = useRef<HTMLInputElement>(null);
  const imageInputRef = useRef<HTMLInputElement>(null);

  const execFormat = (command: string, value?: string) => {
    document.execCommand(command, false, value);
    editorRef.current?.focus();
  };

  const handleImageInsert = () => {
    imageInputRef.current?.click();
  };

  const onImageSelected = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;
    const reader = new FileReader();
    reader.onload = () => {
      const base64 = reader.result as string;
      editorRef.current?.focus();
      document.execCommand('insertImage', false, base64);
      setDescription(editorRef.current?.innerHTML || '');
    };
    reader.readAsDataURL(file);
    e.target.value = '';
  };

  const [isFormValid, setIsFormValid] = useState(false);
  useEffect(() => {
    setIsFormValid(intro.trim() !== '');
  }, [intro]);

  const careerYearsOptions = Array.from({ length: 30 }, (_, i) => `${i + 1}년`);

  const filteredCompanies = COMPANY_LOGOS;

  const toggleCategory = (cat: string) => {
    setSelectedCategories(prev =>
      prev.includes(cat) ? prev.filter(c => c !== cat) : [...prev, cat]
    );
  };

  const toggleLanguage = (lang: string) => {
    setSelectedLanguages(prev =>
      prev.includes(lang) ? prev.filter(l => l !== lang) : [...prev, lang]
    );
  };

  const addAward = () => {
    if (awardInput.trim()) {
      setAwardList(prev => [...prev, { text: awardInput.trim(), year: awardYear, month: awardMonth }]);
      setAwardInput('');
      setAwardYear('');
      setAwardMonth('');
    }
  };

  const extractYouTubeId = (url: string): string | null => {
    const patterns = [
      /(?:youtube\.com\/watch\?v=|youtu\.be\/|youtube\.com\/embed\/|youtube\.com\/shorts\/)([a-zA-Z0-9_-]{11})/,
    ];
    for (const p of patterns) {
      const m = url.match(p);
      if (m) return m[1];
    }
    return null;
  };

  const addVideo = () => {
    const id = extractYouTubeId(videoInput.trim());
    if (!id) {
      setVideoError('유효한 유튜브 링크를 입력해주세요');
      return;
    }
    setVideoError('');
    setVideos(prev => [...prev, videoInput.trim()]);
    setVideoInput('');
    setShowVideoInput(false);
  };

  const removeVideo = (index: number) => {
    setVideos(prev => prev.filter((_, i) => i !== index));
  };

  const updateFaqContent = (category: string, value: string) => {
    setFaqContents(prev => ({ ...prev, [category]: value }));
  };

  return (
    <div className="fixed inset-0 h-[100dvh] flex flex-col bg-white">
      {/* Header */}
      <div className="shrink-0 px-6 pt-4 pb-6">
        <motion.button
          onClick={() => router.back()}
          className="mb-4"
          whileTap={{ scale: 0.92 }}
        >
          <ChevronLeft size={24} className="text-gray-900" />
        </motion.button>
        <motion.h1
          className="text-2xl font-bold text-gray-900"
          initial={{ opacity: 0, y: 10 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ duration: 0.4 }}
        >
          전문가 프로필
        </motion.h1>
      </div>

      {/* Scrollable Content */}
      <div className="flex-1 overflow-y-auto px-6">
        <motion.div
          variants={staggerContainer}
          initial="initial"
          animate="animate"
        >
          {/* [필수]전문가 소개 */}
          <motion.div className="py-4" variants={staggerItem}>
            <p className="text-sm text-gray-500 mb-2">[필수]전문가 소개</p>
            <label className="text-xs text-[#3180F7] mb-1 block">한줄평소개</label>
            <input
              type="text"
              value={intro}
              onChange={(e) => setIntro(e.target.value)}
              placeholder="자기소개를 작성해주세요."
              className="w-full border-b-2 border-[#3180F7] pb-2 outline-none text-gray-900 text-xl font-semibold"
            />
          </motion.div>

          {/* 경력 - horizontal scrollable pills */}
          <motion.div className="py-4 border-b border-gray-200" variants={staggerItem}>
            <p className="text-sm font-bold text-gray-900 mb-3">경력</p>
            <div className="flex gap-2 overflow-x-auto pb-2 scrollbar-hide">
              {careerYearsOptions.map((year) => (
                <motion.button
                  key={year}
                  onClick={() => setCareerYears(year)}
                  className={`shrink-0 px-4 py-2 rounded-full text-sm font-medium transition-colors ${
                    careerYears === year
                      ? 'bg-[#3180F7] text-white'
                      : 'bg-gray-100 text-gray-500'
                  }`}
                  whileTap={{ scale: 0.92 }}
                >
                  {year}
                </motion.button>
              ))}
            </div>
          </motion.div>

          {/* 수상 내역 */}
          <motion.div className="py-4 border-b border-gray-200" variants={staggerItem}>
            <p className="text-sm font-bold text-gray-900 mb-4">수상 내역</p>

            {/* 등록된 수상 내역 */}
            {awardList.length > 0 && (
              <div className="space-y-2.5 mb-4">
                {awardList.map((award, index) => (
                  <motion.div
                    key={index}
                    initial={{ opacity: 0, y: 8 }}
                    animate={{ opacity: 1, y: 0 }}
                    className="flex items-start gap-3 p-3.5 bg-white border border-gray-100 rounded-2xl shadow-sm"
                  >
                    {/* 날짜 태그 */}
                    <div className="shrink-0 w-[52px] h-[52px] rounded-xl bg-gradient-to-br from-[#3180F7] to-[#60A5FA] flex flex-col items-center justify-center">
                      {award.year ? (
                        <>
                          <span className="text-[11px] text-white/70 font-medium leading-none">{award.year}</span>
                          <span className="text-[16px] text-white font-bold leading-tight">{award.month ? `${award.month}월` : ''}</span>
                        </>
                      ) : (
                        <svg width="18" height="18" viewBox="0 0 24 24" fill="none"><path d="M12 2l2.4 7.2H22l-6 4.8 2.4 7.2L12 16.4l-6.4 4.8 2.4-7.2-6-4.8h7.6L12 2z" fill="white"/></svg>
                      )}
                    </div>
                    <div className="flex-1 min-w-0 pt-0.5">
                      <p className="text-[15px] font-semibold text-gray-900 leading-snug">{award.text}</p>
                    </div>
                    <motion.button whileTap={{ scale: 0.85 }} onClick={() => setAwardList(prev => prev.filter((_, i) => i !== index))} className="shrink-0 mt-1">
                      <X size={16} className="text-gray-300" />
                    </motion.button>
                  </motion.div>
                ))}
              </div>
            )}

            {/* 입력 영역 — 카드 스타일 */}
            <div className="bg-gray-50 rounded-2xl p-4">
              {/* 연도/월 선택 — 인라인 */}
              <div className="flex gap-2 mb-3">
                <div className="relative flex-1">
                  <motion.button
                    whileTap={{ scale: 0.97 }}
                    onClick={() => { setShowAwardYear(!showAwardYear); setShowAwardMonth(false); }}
                    className="w-full h-11 px-4 rounded-xl bg-white border border-gray-200 flex items-center justify-between text-[14px] font-medium"
                  >
                    <span className={awardYear ? 'text-gray-900' : 'text-gray-400'}>{awardYear ? `${awardYear}년` : '연도'}</span>
                    <motion.span animate={{ rotate: showAwardYear ? 180 : 0 }} transition={{ duration: 0.2 }}>
                      <ChevronDown size={14} className="text-gray-400" />
                    </motion.span>
                  </motion.button>
                  <AnimatePresence>
                    {showAwardYear && (
                      <motion.div
                        initial={{ opacity: 0, y: -4 }}
                        animate={{ opacity: 1, y: 0 }}
                        exit={{ opacity: 0, y: -4 }}
                        transition={{ duration: 0.15 }}
                        className="absolute top-12 left-0 right-0 max-h-[180px] overflow-y-auto bg-white rounded-xl border border-gray-100 shadow-xl z-30 scrollbar-hide"
                      >
                        {Array.from({ length: 30 }, (_, i) => `${2026 - i}`).map((y) => (
                          <button
                            key={y}
                            onClick={() => { setAwardYear(y); setShowAwardYear(false); }}
                            className={`w-full px-4 py-2.5 text-left text-[14px] transition-colors first:rounded-t-xl last:rounded-b-xl ${
                              awardYear === y ? 'bg-[#3180F7] text-white font-bold' : 'text-gray-700 hover:bg-blue-50'
                            }`}
                          >
                            {y}년
                          </button>
                        ))}
                      </motion.div>
                    )}
                  </AnimatePresence>
                </div>
                <div className="relative w-[90px]">
                  <motion.button
                    whileTap={{ scale: 0.97 }}
                    onClick={() => { setShowAwardMonth(!showAwardMonth); setShowAwardYear(false); }}
                    className="w-full h-11 px-4 rounded-xl bg-white border border-gray-200 flex items-center justify-between text-[14px] font-medium"
                  >
                    <span className={awardMonth ? 'text-gray-900' : 'text-gray-400'}>{awardMonth ? `${awardMonth}월` : '월'}</span>
                    <motion.span animate={{ rotate: showAwardMonth ? 180 : 0 }} transition={{ duration: 0.2 }}>
                      <ChevronDown size={14} className="text-gray-400" />
                    </motion.span>
                  </motion.button>
                  <AnimatePresence>
                    {showAwardMonth && (
                      <motion.div
                        initial={{ opacity: 0, y: -4 }}
                        animate={{ opacity: 1, y: 0 }}
                        exit={{ opacity: 0, y: -4 }}
                        transition={{ duration: 0.15 }}
                        className="absolute top-12 left-0 right-0 max-h-[180px] overflow-y-auto bg-white rounded-xl border border-gray-100 shadow-xl z-30 scrollbar-hide"
                      >
                        {Array.from({ length: 12 }, (_, i) => `${i + 1}`).map((m) => (
                          <button
                            key={m}
                            onClick={() => { setAwardMonth(m); setShowAwardMonth(false); }}
                            className={`w-full px-4 py-2.5 text-left text-[14px] transition-colors first:rounded-t-xl last:rounded-b-xl ${
                              awardMonth === m ? 'bg-[#3180F7] text-white font-bold' : 'text-gray-700 hover:bg-blue-50'
                            }`}
                          >
                            {m}월
                          </button>
                        ))}
                      </motion.div>
                    )}
                  </AnimatePresence>
                </div>
              </div>

              {/* 수상명 입력 + 추가 버튼 */}
              <div className="flex items-center gap-2">
                <input
                  type="text"
                  value={awardInput}
                  onChange={(e) => setAwardInput(e.target.value)}
                  onKeyDown={(e) => e.key === 'Enter' && addAward()}
                  placeholder="수상명을 입력해주세요"
                  className="flex-1 h-11 bg-white border border-gray-200 rounded-xl px-4 outline-none text-[15px] text-gray-900 placeholder:text-gray-400 focus:border-[#3180F7] transition-colors"
                />
                <motion.button
                  whileTap={{ scale: 0.9 }}
                  onClick={addAward}
                  animate={{
                    backgroundColor: awardInput.trim() ? '#3180F7' : '#E5E7EB',
                    color: awardInput.trim() ? '#FFFFFF' : '#9CA3AF',
                  }}
                  transition={{ duration: 0.2 }}
                  className="shrink-0 h-11 px-5 rounded-xl text-[14px] font-bold"
                >
                  추가
                </motion.button>
              </div>
            </div>
          </motion.div>

          {/* [선택]기업이력 - opens company search modal */}
          <motion.div className="py-4 border-b border-gray-200" variants={staggerItem}>
            <p className="text-sm font-bold text-gray-900 mb-3">[선택]기업이력</p>
            {selectedCategories.length > 0 && (
              <div className="flex flex-wrap gap-2 mb-3">
                {selectedCategories.map((logo) => (
                  <div
                    key={logo}
                    className="relative w-[72px] h-[48px] rounded-lg border border-[#3180F7]/30 bg-white p-1.5 flex items-center justify-center"
                  >
                    <img src={logo} alt="" className="w-full h-full object-contain" />
                    <button onClick={() => toggleCategory(logo)} className="absolute -top-1.5 -right-1.5 w-4 h-4 bg-gray-400 rounded-full flex items-center justify-center">
                      <X size={8} className="text-white" />
                    </button>
                  </div>
                ))}
              </div>
            )}
            <motion.button
              onClick={() => setShowCompanySheet(true)}
              className="w-full border border-gray-200 rounded-lg px-3 py-3 bg-[#F9F9F9] text-left flex items-center justify-between"
              whileTap={{ scale: 0.98 }}
            >
              <span className="text-sm text-gray-400">기업이력 검색 및 선택</span>
              <Plus size={16} className="text-gray-400" />
            </motion.button>
          </motion.div>

          {/* [선택]언어 */}
          <motion.div className="py-4 border-b border-gray-200" variants={staggerItem}>
            <p className="text-sm font-bold text-gray-900 mb-3">[선택]언어</p>
            <div className="flex flex-wrap gap-2">
              {LANGUAGES.map((lang) => (
                <label key={lang} className="flex items-center gap-1.5 cursor-pointer">
                  <div
                    onClick={() => toggleLanguage(lang)}
                    className={`w-5 h-5 rounded flex items-center justify-center border-2 shrink-0 ${
                      selectedLanguages.includes(lang)
                        ? 'bg-[#3180F7] border-[#3180F7]'
                        : 'bg-white border-gray-300'
                    }`}
                  >
                    {selectedLanguages.includes(lang) && (
                      <svg width="10" height="8" viewBox="0 0 10 8" fill="none">
                        <path d="M1 4L3.5 6.5L9 1" stroke="white" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"/>
                      </svg>
                    )}
                  </div>
                  <span className="text-sm text-gray-700">{lang}</span>
                </label>
              ))}
            </div>
          </motion.div>

          {/* [선택]상세설명 */}
          <motion.div className="py-4 border-b border-gray-200" variants={staggerItem}>
            <p className="text-sm font-bold text-gray-900 mb-3">[선택]상세설명</p>

            {/* Toolbar */}
            <div className="bg-[#F9F9F9] rounded-2xl px-4 py-3 mb-4 flex items-center gap-1 flex-wrap">
              {/* Bold */}
              <button
                onMouseDown={(e) => { e.preventDefault(); execFormat('bold'); }}
                className="w-8 h-8 flex items-center justify-center font-bold text-gray-800 text-sm rounded hover:bg-gray-200"
              >B</button>
              {/* Italic */}
              <button
                onMouseDown={(e) => { e.preventDefault(); execFormat('italic'); }}
                className="w-8 h-8 flex items-center justify-center italic text-gray-800 text-sm rounded hover:bg-gray-200"
              >I</button>
              {/* Underline */}
              <button
                onMouseDown={(e) => { e.preventDefault(); execFormat('underline'); }}
                className="w-8 h-8 flex items-center justify-center underline text-gray-800 text-sm rounded hover:bg-gray-200"
              >U</button>

              <div className="w-px h-5 bg-gray-300 mx-1" />

              {/* Align Left */}
              <button
                onMouseDown={(e) => { e.preventDefault(); execFormat('justifyLeft'); }}
                className="w-8 h-8 flex items-center justify-center text-gray-800 rounded hover:bg-gray-200"
              >
                <svg width="16" height="14" viewBox="0 0 16 14" fill="currentColor">
                  <rect x="0" y="0" width="16" height="2" rx="1"/>
                  <rect x="0" y="6" width="10" height="2" rx="1"/>
                  <rect x="0" y="12" width="13" height="2" rx="1"/>
                </svg>
              </button>
              {/* Align Center */}
              <button
                onMouseDown={(e) => { e.preventDefault(); execFormat('justifyCenter'); }}
                className="w-8 h-8 flex items-center justify-center text-gray-800 rounded hover:bg-gray-200"
              >
                <svg width="16" height="14" viewBox="0 0 16 14" fill="currentColor">
                  <rect x="0" y="0" width="16" height="2" rx="1"/>
                  <rect x="3" y="6" width="10" height="2" rx="1"/>
                  <rect x="1.5" y="12" width="13" height="2" rx="1"/>
                </svg>
              </button>
              {/* Align Right */}
              <button
                onMouseDown={(e) => { e.preventDefault(); execFormat('justifyRight'); }}
                className="w-8 h-8 flex items-center justify-center text-gray-800 rounded hover:bg-gray-200"
              >
                <svg width="16" height="14" viewBox="0 0 16 14" fill="currentColor">
                  <rect x="0" y="0" width="16" height="2" rx="1"/>
                  <rect x="6" y="6" width="10" height="2" rx="1"/>
                  <rect x="3" y="12" width="13" height="2" rx="1"/>
                </svg>
              </button>
              {/* Justify */}
              <button
                onMouseDown={(e) => { e.preventDefault(); execFormat('justifyFull'); }}
                className="w-8 h-8 flex items-center justify-center text-gray-800 rounded hover:bg-gray-200"
              >
                <svg width="16" height="14" viewBox="0 0 16 14" fill="currentColor">
                  <rect x="0" y="0" width="16" height="2" rx="1"/>
                  <rect x="0" y="6" width="16" height="2" rx="1"/>
                  <rect x="0" y="12" width="16" height="2" rx="1"/>
                </svg>
              </button>

              {/* Bullet List */}
              <button
                onMouseDown={(e) => { e.preventDefault(); execFormat('insertUnorderedList'); }}
                className="w-8 h-8 flex items-center justify-center text-gray-800 rounded hover:bg-gray-200"
              >
                <svg width="16" height="14" viewBox="0 0 16 14" fill="currentColor">
                  <circle cx="1.5" cy="1.5" r="1.5"/>
                  <rect x="5" y="0.5" width="11" height="2" rx="1"/>
                  <circle cx="1.5" cy="7" r="1.5"/>
                  <rect x="5" y="6" width="11" height="2" rx="1"/>
                  <circle cx="1.5" cy="12.5" r="1.5"/>
                  <rect x="5" y="11.5" width="11" height="2" rx="1"/>
                </svg>
              </button>
              {/* Ordered List */}
              <button
                onMouseDown={(e) => { e.preventDefault(); execFormat('insertOrderedList'); }}
                className="w-8 h-8 flex items-center justify-center text-gray-800 rounded hover:bg-gray-200"
              >
                <svg width="16" height="14" viewBox="0 0 16 14" fill="currentColor">
                  <text x="0" y="4" fontSize="4.5" fontFamily="sans-serif">1.</text>
                  <rect x="6" y="0.5" width="10" height="2" rx="1"/>
                  <text x="0" y="9" fontSize="4.5" fontFamily="sans-serif">2.</text>
                  <rect x="6" y="6" width="10" height="2" rx="1"/>
                  <text x="0" y="14" fontSize="4.5" fontFamily="sans-serif">3.</text>
                  <rect x="6" y="11.5" width="10" height="2" rx="1"/>
                </svg>
              </button>

              <div className="w-px h-5 bg-gray-300 mx-1" />

              {/* Color Picker */}
              <button
                onMouseDown={(e) => { e.preventDefault(); colorInputRef.current?.click(); }}
                className="w-8 h-8 flex items-center justify-center text-gray-800 rounded hover:bg-gray-200"
              >
                <svg width="16" height="16" viewBox="0 0 16 16" fill="none">
                  <path d="M2 13.5V11l7-7 2.5 2.5-7 7H2z" fill="currentColor"/>
                  <path d="M10.5 3.5L12 2l2 2-1.5 1.5L10.5 3.5z" fill="currentColor"/>
                  <circle cx="13.5" cy="13.5" r="2" fill="#3180F7"/>
                </svg>
              </button>
              <input
                ref={colorInputRef}
                type="color"
                className="hidden"
                onChange={(e) => execFormat('foreColor', e.target.value)}
              />

              {/* Image Insert */}
              <button
                onMouseDown={(e) => { e.preventDefault(); handleImageInsert(); }}
                className="w-8 h-8 flex items-center justify-center text-gray-800 rounded hover:bg-gray-200"
              >
                <ImageIcon size={16} />
              </button>
              <input
                ref={imageInputRef}
                type="file"
                accept="image/*"
                className="hidden"
                onChange={onImageSelected}
              />

              {/* Font Size */}
              <button
                className="w-8 h-8 flex items-center justify-center text-gray-800 rounded hover:bg-gray-200"
              >
                <span className="text-xs font-bold leading-none">T<span className="text-[10px]">t</span></span>
              </button>
            </div>

            {/* Editable Content */}
            <div className="relative min-h-32">
              <div
                ref={editorRef}
                contentEditable
                suppressContentEditableWarning
                className="min-h-32 outline-none text-gray-900 text-sm [&_img]:max-w-full [&_img]:h-auto [&_img]:rounded-lg [&_img]:my-2"
                onInput={(e) => setDescription(e.currentTarget.innerHTML)}
              />
              {!description && (
                <span className="absolute top-0 left-0 text-gray-300 text-sm pointer-events-none select-none">
                  상세페이지
                </span>
              )}
            </div>
          </motion.div>

          {/* [선택]전문가소개영상 */}
          <motion.div className="py-4 border-b border-gray-200" variants={staggerItem}>
            <p className="text-sm font-bold text-gray-900 mb-3">[선택]전문가소개영상</p>

            {/* 링크 추가 입력 */}
            {showVideoInput ? (
              <div className="mb-3">
                <div className="flex items-center gap-2 border border-gray-200 rounded-xl px-3 py-2.5">
                  <input
                    type="text"
                    value={videoInput}
                    onChange={(e) => { setVideoInput(e.target.value); setVideoError(''); }}
                    placeholder="유튜브 링크를 입력해주세요"
                    className="flex-1 outline-none text-[16px] text-gray-900 placeholder:text-gray-400"
                    autoFocus
                  />
                  <motion.button onClick={addVideo} whileTap={{ scale: 0.92 }} className="text-[#3180F7] text-[14px] font-bold shrink-0">추가</motion.button>
                  <motion.button onClick={() => { setShowVideoInput(false); setVideoInput(''); setVideoError(''); }} whileTap={{ scale: 0.92 }} className="text-gray-400">
                    <X size={16} />
                  </motion.button>
                </div>
                {/* Error */}
                <AnimatePresence>
                  {videoError && (
                    <motion.p initial={{ opacity: 0, y: -4 }} animate={{ opacity: 1, y: 0 }} exit={{ opacity: 0 }} className="text-[12px] text-red-500 font-medium mt-1.5 ml-1">{videoError}</motion.p>
                  )}
                </AnimatePresence>
                {/* Live preview */}
                {videoInput && extractYouTubeId(videoInput) && (
                  <motion.div initial={{ opacity: 0, height: 0 }} animate={{ opacity: 1, height: 'auto' }} className="mt-3 rounded-xl overflow-hidden">
                    <div className="relative w-full" style={{ paddingBottom: '56.25%' }}>
                      <img
                        src={`https://img.youtube.com/vi/${extractYouTubeId(videoInput)}/mqdefault.jpg`}
                        alt="preview"
                        className="absolute inset-0 w-full h-full object-cover rounded-xl"
                      />
                      <div className="absolute inset-0 flex items-center justify-center">
                        <div className="w-12 h-12 rounded-full bg-red-600 flex items-center justify-center shadow-lg">
                          <div className="w-0 h-0 border-l-[14px] border-l-white border-y-[8px] border-y-transparent ml-1" />
                        </div>
                      </div>
                    </div>
                  </motion.div>
                )}
              </div>
            ) : (
              <motion.button
                onClick={() => setShowVideoInput(true)}
                className="flex items-center justify-between w-full border border-gray-200 rounded-xl px-3 py-2.5 mb-3 bg-[#F9F9F9]"
                whileTap={{ scale: 0.98 }}
              >
                <span className="text-[14px] text-gray-400">유튜브 링크 추가</span>
                <Plus size={16} className="text-gray-400" />
              </motion.button>
            )}

            {/* 비디오 목록 — with preview thumbnails */}
            {videos.length > 0 && (
              <div className="space-y-3">
                {videos.map((url, index) => {
                  const ytId = extractYouTubeId(url);
                  return (
                  <motion.div key={index} initial={{ opacity: 0, y: 8 }} animate={{ opacity: 1, y: 0 }} className="rounded-xl border border-gray-100 overflow-hidden">
                    {/* Thumbnail preview */}
                    {ytId && (
                      <div className="relative w-full" style={{ paddingBottom: '56.25%' }}>
                        <img
                          src={`https://img.youtube.com/vi/${ytId}/mqdefault.jpg`}
                          alt="thumb"
                          className="absolute inset-0 w-full h-full object-cover"
                        />
                        <div className="absolute inset-0 flex items-center justify-center">
                          <div className="w-10 h-10 rounded-full bg-black/50 flex items-center justify-center">
                            <div className="w-0 h-0 border-l-[10px] border-l-white border-y-[6px] border-y-transparent ml-0.5" />
                          </div>
                        </div>
                        <span className="absolute top-2 left-2 bg-black/60 text-white text-[11px] font-bold px-2 py-0.5 rounded-full">{index + 1}</span>
                      </div>
                    )}
                    <div className="flex items-center justify-between px-3 py-2">
                      <span className="text-[12px] text-gray-500 truncate flex-1">{url.length > 35 ? url.slice(0, 35) + '...' : url}</span>
                      <motion.button
                        onClick={() => removeVideo(index)}
                        whileTap={{ scale: 0.9 }}
                        className="text-[12px] text-red-500 font-bold shrink-0 ml-2"
                      >
                        삭제
                      </motion.button>
                    </div>
                  </motion.div>
                  );
                })}
              </div>
            )}
          </motion.div>

          {/* [필수]전문가 FAQ */}
          <motion.div className="py-4 border-b border-gray-200" variants={staggerItem}>
            <p className="text-sm font-bold text-gray-900 mb-3">[필수]전문가 FAQ</p>

            {/* 탭 목록 */}
            <LayoutGroup>
              <div className="flex gap-2 mb-4 overflow-x-auto pb-1 scrollbar-hide">
                {FAQ_CATEGORIES.map((cat) => (
                  <motion.button
                    key={cat}
                    onClick={() => setActiveFaqTab(cat)}
                    className={`relative shrink-0 px-4 py-2 rounded-full text-xs font-medium transition-colors ${
                      activeFaqTab === cat
                        ? 'text-white'
                        : 'bg-gray-100 text-gray-500'
                    }`}
                    whileTap={{ scale: 0.92 }}
                  >
                    {activeFaqTab === cat && (
                      <motion.div
                        layoutId="faqActiveTab"
                        className="absolute inset-0 bg-gray-900 rounded-full"
                        transition={{ type: 'spring', stiffness: 400, damping: 30 }}
                      />
                    )}
                    <span className="relative z-10">{cat}</span>
                  </motion.button>
                ))}
              </div>
            </LayoutGroup>

            {/* 활성 FAQ 내용 편집 */}
            <div>
              <p className="text-sm font-semibold text-gray-700 mb-2">{activeFaqTab}</p>
              <textarea
                value={faqContents[activeFaqTab] || ''}
                onChange={(e) => updateFaqContent(activeFaqTab, e.target.value)}
                placeholder="내용을 작성해주세요"
                className="w-full outline-none text-gray-900 placeholder:text-gray-400 text-sm resize-none bg-gray-50 rounded-xl p-4 leading-relaxed"
                rows={5}
              />
            </div>
          </motion.div>

          {/* Bottom spacer so content isn't hidden behind the fixed footer */}
          <div className="h-4" />
        </motion.div>
      </div>

      {/* Fixed Bottom Button */}
      <div className="shrink-0 p-6 pb-8 bg-white">
        <motion.button
          onClick={() => isFormValid && setShowConfirm(true)}
          disabled={!isFormValid}
          className="w-full py-4 rounded-2xl font-bold text-base"
          animate={{
            backgroundColor: isFormValid ? '#3180F7' : '#F3F4F6',
            color: isFormValid ? '#FFFFFF' : '#9CA3AF',
          }}
          transition={{ duration: 0.3 }}
          whileTap={isFormValid ? { scale: 0.97 } : {}}
        >
          제출
        </motion.button>
      </div>

      {/* 기업이력 검색 — 전체 페이지 덮기 */}
      <AnimatePresence>
        {showCompanySheet && (
          <motion.div
            className="fixed inset-0 z-50 bg-white flex flex-col"
            initial={{ x: '100%' }}
            animate={{ x: 0 }}
            exit={{ x: '100%' }}
            transition={{ type: 'spring', stiffness: 300, damping: 30 }}
          >
            {/* Header */}
            <div className="shrink-0 px-4 pt-4 pb-3 border-b border-gray-100">
              <div className="flex items-center gap-3 mb-4">
                <motion.button onClick={() => setShowCompanySheet(false)} whileTap={{ scale: 0.9 }}>
                  <ChevronLeft size={24} className="text-gray-900" />
                </motion.button>
                <h2 className="text-[18px] font-bold text-gray-900">기업이력 선택</h2>
              </div>
              <p className="text-[13px] text-gray-400 mt-1">진행한 기업의 로고를 선택해주세요</p>
              {selectedCategories.length > 0 && (
                <p className="text-[13px] text-[#3180F7] font-bold mt-2">{selectedCategories.length}개 선택됨</p>
              )}
            </div>

            {/* Logo Grid */}
            <div className="flex-1 overflow-y-auto px-4 py-4">
              <div className="grid grid-cols-3 gap-3">
                {filteredCompanies.map((logo, i) => {
                  const selected = selectedCategories.includes(logo);
                  return (
                    <motion.button
                      key={i}
                      initial={{ opacity: 0, scale: 0.9 }}
                      animate={{ opacity: 1, scale: 1 }}
                      transition={{ delay: i * 0.02 }}
                      whileTap={{ scale: 0.93 }}
                      onClick={() => toggleCategory(logo)}
                      className={`relative aspect-[3/2] rounded-xl border-2 flex items-center justify-center p-3 transition-all ${
                        selected ? 'border-[#3180F7] bg-blue-50/50 shadow-sm' : 'border-gray-100 bg-white'
                      }`}
                    >
                      <img src={logo} alt="" className="w-full h-full object-contain" />
                      {selected && (
                        <motion.div
                          initial={{ scale: 0 }}
                          animate={{ scale: 1 }}
                          className="absolute top-1.5 right-1.5 w-5 h-5 rounded-full bg-[#3180F7] flex items-center justify-center"
                        >
                          <svg width="10" height="8" viewBox="0 0 10 8" fill="none"><path d="M1 4L3.5 6.5L9 1" stroke="white" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"/></svg>
                        </motion.div>
                      )}
                    </motion.button>
                  );
                })}
              </div>
            </div>

            {/* Bottom button */}
            <div className="shrink-0 p-4 pb-8 bg-white border-t border-gray-100">
              <motion.button
                onClick={() => setShowCompanySheet(false)}
                whileTap={{ scale: 0.96 }}
                className="w-full py-4 bg-[#3180F7] text-white rounded-2xl font-bold text-[16px]"
              >
                선택 완료 ({selectedCategories.length}개)
              </motion.button>
            </div>
          </motion.div>
        )}
      </AnimatePresence>

      {/* 제출 확인 바텀시트 */}
      <AnimatePresence>
        {showConfirm && (
          <div className="fixed inset-0 z-50 flex items-end" onClick={() => setShowConfirm(false)}>
            <motion.div
              className="absolute inset-0 bg-black/50"
              initial={{ opacity: 0 }}
              animate={{ opacity: 1 }}
              exit={{ opacity: 0 }}
            />
            <motion.div
              className="relative bg-white rounded-t-3xl w-full p-6 pb-10"
              variants={bottomSheetVariants}
              initial="hidden"
              animate="visible"
              exit="exit"
              onClick={(e) => e.stopPropagation()}
            >
              <div className="w-12 h-1 bg-gray-300 rounded-full mx-auto mb-6" />
              <h2 className="text-xl font-bold mb-2">정말로 제출하시겠습니까?</h2>
              <p className="text-sm text-red-500 mb-1 font-medium">
                허위로 작성된 프로필일 경우 영구제재가 이루어질 수 있습니다.
              </p>
              <p className="text-sm text-gray-500 mb-6">
                심사기간은 최대 7일이며, 결과는 알림으로 안내드립니다.
              </p>
              <motion.button
                onClick={() => {
                  localStorage.setItem('proRegistrationComplete', 'pending');
                  setShowConfirm(false);
                  setShowSuccess(true);
                }}
                className="w-full py-4 bg-[#3180F7] text-white rounded-2xl font-bold text-base mb-3"
                whileTap={{ scale: 0.97 }}
              >
                제출
              </motion.button>
              <motion.button
                onClick={() => setShowConfirm(false)}
                className="w-full py-4 text-gray-500 font-medium text-base"
                whileTap={{ scale: 0.97 }}
              >
                취소
              </motion.button>
            </motion.div>
          </div>
        )}
      </AnimatePresence>

      {/* 제출 완료 페이지 */}
      <AnimatePresence>
        {showSuccess && (
          <motion.div
            className="fixed inset-0 z-[60] bg-white flex flex-col items-center justify-center px-6"
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            transition={{ duration: 0.3 }}
          >
            <motion.div
              initial={{ scale: 0 }}
              animate={{ scale: 1 }}
              transition={{ type: 'spring', stiffness: 300, damping: 20, delay: 0.15 }}
              className="mb-6"
            >
              <CheckCircle size={72} className="text-[#3180F7]" />
            </motion.div>
            <motion.h2
              className="text-2xl font-bold text-gray-900 mb-3"
              initial={{ opacity: 0, y: 12 }}
              animate={{ opacity: 1, y: 0 }}
              transition={{ delay: 0.25 }}
            >
              제출이 완료되었습니다!
            </motion.h2>
            <motion.p
              className="text-base text-gray-500 text-center mb-10"
              initial={{ opacity: 0, y: 12 }}
              animate={{ opacity: 1, y: 0 }}
              transition={{ delay: 0.35 }}
            >
              7일 이내에 승인 결과를 알려드립니다
            </motion.p>
            <motion.button
              onClick={() => { router.push('/home'); }}
              className="w-full py-4 bg-[#3180F7] text-white rounded-2xl font-bold text-base"
              initial={{ opacity: 0, y: 12 }}
              animate={{ opacity: 1, y: 0 }}
              transition={{ delay: 0.45 }}
              whileTap={{ scale: 0.97 }}
            >
              확인
            </motion.button>
          </motion.div>
        )}
      </AnimatePresence>
    </div>
  );
}
