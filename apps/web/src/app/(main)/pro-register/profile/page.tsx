'use client';

import { useState, useRef, useEffect } from 'react';
import { useRouter } from 'next/navigation';
import { ChevronLeft, ChevronDown, Plus, X, Image as ImageIcon, CheckCircle, Check } from 'lucide-react';
import { motion, AnimatePresence } from 'framer-motion';
import toast from 'react-hot-toast';
import { prosApi } from '@/lib/api/pros.api';
import { buildWeddingServicesFromStorage } from '@/lib/wedding-plans';

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
  const [videoError, setVideoError] = useState('');
  const [selectedLanguages, setSelectedLanguages] = useState<string[]>([]);
  const [description, setDescription] = useState('');
  const [videos, setVideos] = useState<string[]>([]);
  const [videoInput, setVideoInput] = useState('');
  const [showVideoInput, setShowVideoInput] = useState(false);
  const [showYoutubeSearch, setShowYoutubeSearch] = useState(false);
  const [ytChannelQuery, setYtChannelQuery] = useState('');
  const [ytChannels, setYtChannels] = useState<{ id: string; title: string; thumbnail: string; description: string }[]>([]);
  const [ytVideos, setYtVideos] = useState<{ id: string; title: string; thumbnail: string }[]>([]);
  const [ytSelectedChannel, setYtSelectedChannel] = useState<string | null>(null);
  const [ytLoading, setYtLoading] = useState(false);
  const userName = typeof window !== 'undefined' ? localStorage.getItem('proRegister_name') || '' : '';

  const [showConfirm, setShowConfirm] = useState(false);
  const [showSuccess, setShowSuccess] = useState(false);
  const [submitting, setSubmitting] = useState(false);
  const [videoUploading, setVideoUploading] = useState(false);
  const [videoUploadProgress, setVideoUploadProgress] = useState(0);
  const editorRef = useRef<HTMLDivElement>(null);
  const colorInputRef = useRef<HTMLInputElement>(null);
  const imageInputRef = useRef<HTMLInputElement>(null);
  const videoFileInputRef = useRef<HTMLInputElement>(null);

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

  // ─── AI 상세페이지 자동 생성 ───
  const [aiLoading, setAiLoading] = useState(false);
  const handleAiGenerate = async () => {
    if (aiLoading) return;
    setAiLoading(true);
    try {
      const { aiApi } = await import('@/lib/api/ai.api');
      // 업로드된 사진 (base64 data URL 만 전달)
      const photosRaw: string[] = (() => {
        try { return JSON.parse(localStorage.getItem('proRegister_photos') || '[]'); }
        catch { return []; }
      })();
      const imageDataUrls = photosRaw.filter((p) => typeof p === 'string' && p.startsWith('data:image/')).slice(0, 4);
      const out = await aiApi.generateProfile({
        name: userName || undefined,
        category: localStorage.getItem('proRegister_category') || '사회자',
        careerYears: careerYears ? parseInt(careerYears) : undefined,
        languages: selectedLanguages,
        keywords: intro || undefined,
        imageDataUrls,
      });
      // 에디터에 상세 HTML 주입 + state 동기화
      if (out.detailHtml) {
        setDescription(out.detailHtml);
        if (editorRef.current) editorRef.current.innerHTML = out.detailHtml;
      }
      // 빈 필드만 채움
      if (!intro && out.shortIntro) setIntro(out.shortIntro);
      // 스크롤하여 에디터로 이동
      setTimeout(() => editorRef.current?.scrollIntoView({ behavior: 'smooth', block: 'center' }), 100);

      // 히어로 이미지는 별도 요청 (15-30초 소요) — 텍스트는 이미 반영됨
      try {
        const hero = await aiApi.generateHeroImage({
          name: userName || undefined,
          category: localStorage.getItem('proRegister_category') || '사회자',
          keywords: intro || out.shortIntro,
          imageDataUrls,
        });
        if (hero.url && editorRef.current) {
          const imgTag = `<img src="${hero.url}" alt="${userName || '사회자'} 프로필" style="max-width:100%;height:auto;border-radius:12px;margin-bottom:12px;" />`;
          const currentHtml = editorRef.current.innerHTML;
          editorRef.current.innerHTML = imgTag + currentHtml;
          setDescription(imgTag + currentHtml);
        }
      } catch {
        // 이미지 실패는 텍스트 결과에 영향 없음 — silently skip
      }
    } catch (e: any) {
      const msg = e?.response?.data?.message || e?.message || '알 수 없는 오류';
      alert(`AI 생성 실패: ${msg}`);
    } finally {
      setAiLoading(false);
    }
  };

  const careerYearsOptions = Array.from({ length: 30 }, (_, i) => `${i + 1}년`);

  const toggleLanguage = (lang: string) => {
    setSelectedLanguages(prev =>
      prev.includes(lang) ? prev.filter(l => l !== lang) : [...prev, lang]
    );
  };

  const searchYtChannels = async () => {
    if (!ytChannelQuery.trim()) return;
    setYtLoading(true);
    setYtChannels([]);
    setYtVideos([]);
    setYtSelectedChannel(null);
    try {
      const res = await fetch(`/api/youtube?action=searchChannels&q=${encodeURIComponent(ytChannelQuery)}`);
      const data = await res.json();
      setYtChannels(data.channels || []);
    } catch {} finally { setYtLoading(false); }
  };

  const loadYtVideos = async (channelId: string) => {
    setYtSelectedChannel(channelId);
    setYtLoading(true);
    try {
      const res = await fetch(`/api/youtube?action=channelVideos&channelId=${channelId}`);
      const data = await res.json();
      setYtVideos(data.videos || []);
    } catch {} finally { setYtLoading(false); }
  };

  const selectYtVideo = (videoId: string) => {
    const url = `https://www.youtube.com/watch?v=${videoId}`;
    if (!videos.includes(url)) {
      setVideos(prev => [...prev, url]);
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

  const isUploadedVideoUrl = (url: string) => !extractYouTubeId(url) && url.includes('/uploads/');

  const onVideoFileSelected = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    e.target.value = '';
    if (!file || videoUploading) return;
    setVideoUploading(true);
    setVideoUploadProgress(0);
    try {
      const { url } = await prosApi.uploadVideo(file, {
        onUploadProgress: (evt) => {
          if (evt.total) setVideoUploadProgress(Math.round((evt.loaded / evt.total) * 100));
        },
      });
      if (url) setVideos(prev => [...prev, url]);
    } catch (err: any) {
      const msg = err?.response?.data?.message || err?.message || '알 수 없는 오류';
      toast.error(`동영상 업로드 실패: ${msg}`);
    } finally {
      setVideoUploading(false);
      setVideoUploadProgress(0);
    }
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
        {/* Progress bar */}
        <div className="relative h-[3px] bg-gray-100 rounded-full overflow-hidden mb-2">
          <motion.div
            className="absolute left-0 top-0 h-full bg-[#3180F7] rounded-full"
            initial={{ width: 0 }}
            animate={{ width: `${(6 / 6) * 100}%` }}
            transition={{ duration: 0.6, ease: 'easeOut' }}
          />
        </div>
        <motion.h1
          className="text-2xl font-bold text-gray-900"
          initial={{ opacity: 0, y: 10 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ duration: 0.4 }}
        >
          사회자 프로필 <span className="text-[11px] text-gray-400">6/6</span>
        </motion.h1>
      </div>

      {/* Scrollable Content */}
      <div className="flex-1 overflow-y-auto px-6">
        <motion.div
          variants={staggerContainer}
          initial="initial"
          animate="animate"
        >
          {/* [필수]사회자 소개 */}
          <motion.div className="py-4" variants={staggerItem}>
            <p className="text-sm text-gray-500 mb-2">[필수]사회자 소개</p>
            {intro && <label className="text-xs text-[#3180F7] mb-1 block">한줄평소개</label>}
            <input
              type="text"
              value={intro}
              onChange={(e) => setIntro(e.target.value)}
              placeholder="자기소개를 작성해주세요."
              className={`w-full pb-2 outline-none text-gray-900 text-[16px] font-semibold placeholder:text-gray-400 ${
                intro ? 'border-b-2 border-[#3180F7]' : 'border-b border-gray-300'
              } focus:border-b-2 focus:border-[#3180F7]`}
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
            <div className="flex items-center justify-between mb-3">
              <p className="text-sm font-bold text-gray-900">[선택]상세설명</p>
            </div>

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
                className="min-h-32 outline-none text-gray-900 text-[16px] [&_img]:max-w-full [&_img]:h-auto [&_img]:rounded-lg [&_img]:my-2"
                onInput={(e) => setDescription(e.currentTarget.innerHTML)}
              />
              {!description && (
                <span className="absolute top-0 left-0 text-gray-300 text-sm pointer-events-none select-none">
                  상세페이지
                </span>
              )}
            </div>
          </motion.div>

          {/* [선택]사회자소개영상 */}
          <motion.div className="py-4 border-b border-gray-200" variants={staggerItem}>
            <p className="text-sm font-bold text-gray-900 mb-3">[선택]사회자소개영상</p>

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
                    <motion.p initial={{ opacity: 0, y: -4 }} animate={{ opacity: 1, y: 0 }} exit={{ opacity: 0 }} className="text-[12px] text-[#3180F7] font-medium mt-1.5 ml-1">{videoError}</motion.p>
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
                        <div className="w-12 h-12 rounded-full bg-[#3180F7] flex items-center justify-center shadow-lg">
                          <div className="w-0 h-0 border-l-[14px] border-l-white border-y-[8px] border-y-transparent ml-1" />
                        </div>
                      </div>
                    </div>
                  </motion.div>
                )}
              </div>
            ) : (
              <div className="flex gap-2 mb-3">
                <motion.button
                  onClick={() => setShowVideoInput(true)}
                  className="flex-1 flex items-center justify-between border border-gray-200 rounded-xl px-3 py-2.5 bg-[#F9F9F9]"
                  whileTap={{ scale: 0.98 }}
                >
                  <span className="text-[14px] text-gray-400">링크 직접 입력</span>
                  <Plus size={16} className="text-gray-400" />
                </motion.button>
                <motion.button
                  onClick={() => setShowYoutubeSearch(true)}
                  className="flex items-center gap-1.5 border border-blue-200 rounded-xl px-3 py-2.5 bg-blue-50/50"
                  whileTap={{ scale: 0.98 }}
                >
                  <svg width="16" height="16" viewBox="0 0 24 24" fill="none"><rect x="2" y="4" width="20" height="16" rx="4" fill="#3180F7"/><path d="M10 8.5v7l6-3.5-6-3.5z" fill="white"/></svg>
                  <span className="text-[13px] text-[#3180F7] font-semibold">검색</span>
                </motion.button>
                <motion.button
                  onClick={() => { if (!videoUploading) videoFileInputRef.current?.click(); }}
                  disabled={videoUploading}
                  className="flex items-center gap-1.5 border border-blue-200 rounded-xl px-3 py-2.5 bg-blue-50/50 disabled:opacity-60"
                  whileTap={videoUploading ? {} : { scale: 0.98 }}
                >
                  {videoUploading ? (
                    <>
                      <div className="w-4 h-4 border-2 border-[#3180F7] border-t-transparent rounded-full animate-spin" />
                      <span className="text-[13px] text-[#3180F7] font-semibold tabular-nums">{videoUploadProgress}%</span>
                    </>
                  ) : (
                    <>
                      <Plus size={16} className="text-[#3180F7]" />
                      <span className="text-[13px] text-[#3180F7] font-semibold">동영상 파일</span>
                    </>
                  )}
                </motion.button>
              </div>
            )}
            <input
              ref={videoFileInputRef}
              type="file"
              accept="video/*"
              className="hidden"
              onChange={onVideoFileSelected}
            />
            {videoUploading && (
              <div className="mb-3">
                <div className="h-1.5 bg-gray-100 rounded-full overflow-hidden">
                  <div className="h-full bg-[#3180F7] rounded-full transition-all" style={{ width: `${videoUploadProgress}%` }} />
                </div>
                <p className="text-[12px] text-gray-400 mt-1">동영상 업로드 중... {videoUploadProgress}%</p>
              </div>
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
                    {/* Uploaded video preview */}
                    {!ytId && isUploadedVideoUrl(url) && (
                      <video
                        src={url + '#t=0.1'}
                        preload="metadata"
                        muted
                        playsInline
                        className="w-full max-h-[280px] rounded-xl bg-black object-contain"
                      />
                    )}
                    <div className="flex items-center justify-between px-3 py-2">
                      <span className="text-[12px] text-gray-500 truncate flex-1">{url.length > 35 ? url.slice(0, 35) + '...' : url}</span>
                      <motion.button
                        onClick={() => removeVideo(index)}
                        whileTap={{ scale: 0.9 }}
                        className="text-[12px] text-[#3180F7] font-bold shrink-0 ml-2"
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

      {/* YouTube 채널 검색 페이지 */}
      <AnimatePresence>
        {showYoutubeSearch && (
          <motion.div
            className="fixed inset-0 z-50 bg-white flex flex-col"
            initial={{ x: '100%' }}
            animate={{ x: 0 }}
            exit={{ x: '100%' }}
            transition={{ type: 'spring', stiffness: 300, damping: 30 }}
          >
            {/* Header */}
            <div className="shrink-0 px-4 pt-4 pb-3 border-b border-gray-100">
              <div className="flex items-center gap-3 mb-3">
                <motion.button onClick={() => { setShowYoutubeSearch(false); setYtChannels([]); setYtVideos([]); setYtSelectedChannel(null); setYtChannelQuery(''); }} whileTap={{ scale: 0.9 }}>
                  <ChevronLeft size={24} className="text-gray-900" />
                </motion.button>
                <h2 className="text-[18px] font-bold text-gray-900">YouTube 영상 검색</h2>
              </div>
              {/* Search input */}
              <div className="flex gap-2">
                <div className="flex-1 relative">
                  <input
                    type="text"
                    value={ytChannelQuery}
                    onChange={(e) => setYtChannelQuery(e.target.value)}
                    onKeyDown={(e) => e.key === 'Enter' && searchYtChannels()}
                    placeholder="채널명을 검색하세요"
                    className="w-full h-11 bg-gray-50 border border-gray-200 rounded-xl pl-4 pr-4 outline-none text-[16px] text-gray-900 placeholder:text-gray-400 focus:border-[#3180F7] transition-colors"
                    autoFocus
                  />
                </div>
                <motion.button
                  whileTap={{ scale: 0.95 }}
                  onClick={searchYtChannels}
                  className="h-11 px-4 bg-[#3180F7] text-white rounded-xl text-[14px] font-bold shrink-0"
                >
                  검색
                </motion.button>
              </div>
            </div>

            {/* Content */}
            <div className="flex-1 overflow-y-auto">
              {ytLoading && (
                <div className="flex items-center justify-center py-12">
                  <div className="w-6 h-6 border-2 border-[#3180F7] border-t-transparent rounded-full animate-spin" />
                </div>
              )}

              {/* Channel results */}
              {!ytSelectedChannel && ytChannels.length > 0 && !ytLoading && (
                <div className="p-4">
                  <p className="text-[12px] text-gray-400 font-bold uppercase mb-3">채널 선택</p>
                  <div className="space-y-2">
                    {ytChannels.map((ch) => (
                      <motion.button
                        key={ch.id}
                        whileTap={{ scale: 0.98 }}
                        onClick={() => loadYtVideos(ch.id)}
                        className="w-full flex items-center gap-3 p-3 rounded-xl border border-gray-100 hover:bg-gray-50 transition-colors text-left"
                      >
                        <img src={ch.thumbnail} alt="" className="w-10 h-10 rounded-full object-cover bg-gray-200" />
                        <div className="flex-1 min-w-0">
                          <p className="text-[15px] font-semibold text-gray-900 truncate">{ch.title}</p>
                          <p className="text-[12px] text-gray-400 truncate">{ch.description}</p>
                        </div>
                        <ChevronDown size={16} className="text-gray-400 -rotate-90 shrink-0" />
                      </motion.button>
                    ))}
                  </div>
                </div>
              )}

              {/* Video results */}
              {ytSelectedChannel && ytVideos.length > 0 && !ytLoading && (
                <div className="p-4">
                  <div className="flex items-center justify-between mb-3">
                    <p className="text-[12px] text-gray-400 font-bold uppercase">영상 선택</p>
                    <motion.button
                      whileTap={{ scale: 0.95 }}
                      onClick={() => { setYtSelectedChannel(null); setYtVideos([]); }}
                      className="text-[12px] text-[#3180F7] font-semibold"
                    >
                      채널 다시 선택
                    </motion.button>
                  </div>
                  <div className="space-y-3">
                    {ytVideos.map((v) => {
                      const alreadyAdded = videos.includes(`https://www.youtube.com/watch?v=${v.id}`);
                      return (
                        <motion.button
                          key={v.id}
                          whileTap={{ scale: 0.98 }}
                          onClick={() => { if (!alreadyAdded) selectYtVideo(v.id); }}
                          className={`w-full rounded-xl overflow-hidden border text-left transition-all ${alreadyAdded ? 'border-[#3180F7] bg-blue-50/30' : 'border-gray-100'}`}
                        >
                          <div className="relative w-full" style={{ paddingBottom: '56.25%' }}>
                            <img src={v.thumbnail} alt="" className="absolute inset-0 w-full h-full object-cover" />
                            {alreadyAdded && (
                              <>
                                <div className="absolute inset-0 bg-[#3180F7]/10" />
                                <motion.div
                                  initial={{ scale: 0 }}
                                  animate={{ scale: 1 }}
                                  transition={{ type: 'spring', stiffness: 400, damping: 15 }}
                                  className="absolute top-2 right-2 w-7 h-7 bg-[#3180F7] rounded-full flex items-center justify-center shadow-md"
                                >
                                  <Check size={16} className="text-white stroke-[3]" />
                                </motion.div>
                              </>
                            )}
                          </div>
                          <div className="p-3">
                            <p className="text-[14px] font-semibold text-gray-900 line-clamp-2">{v.title}</p>
                          </div>
                        </motion.button>
                      );
                    })}
                  </div>
                </div>
              )}

              {/* Empty state */}
              {!ytLoading && ytChannels.length === 0 && !ytSelectedChannel && ytChannelQuery && (
                <p className="text-center text-gray-400 text-[14px] py-12">검색 결과가 없습니다</p>
              )}
              {!ytLoading && !ytChannelQuery && ytChannels.length === 0 && (
                <div className="flex flex-col items-center py-16">
                  <svg width="48" height="48" viewBox="0 0 24 24" fill="none"><rect x="2" y="4" width="20" height="16" rx="4" fill="#DBEAFE"/><path d="M10 8.5v7l6-3.5-6-3.5z" fill="#3180F7"/></svg>
                  <p className="text-[14px] text-gray-500 mt-4">채널명을 검색해주세요</p>
                  <p className="text-[12px] text-gray-400 mt-1">검색 후 영상을 선택할 수 있습니다</p>
                </div>
              )}
            </div>

            {/* Bottom: 선택 완료 */}
            {videos.length > 0 && (
              <div className="shrink-0 p-4 pb-8 bg-white border-t border-gray-100">
                <motion.button
                  onClick={() => { setShowYoutubeSearch(false); setYtChannels([]); setYtVideos([]); setYtSelectedChannel(null); setYtChannelQuery(''); }}
                  whileTap={{ scale: 0.96 }}
                  className="w-full py-4 bg-[#3180F7] text-white rounded-2xl font-bold text-[16px]"
                >
                  완료 ({videos.length}개 영상)
                </motion.button>
              </div>
            )}
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
              <p className="text-sm text-[#3180F7] mb-1 font-medium">
                허위로 작성된 프로필일 경우 영구제재가 이루어질 수 있습니다.
              </p>
              <p className="text-sm text-gray-500 mb-6">
                심사기간은 최대 7일이며, 결과는 알림으로 안내드립니다.
              </p>
              <motion.button
                disabled={submitting}
                onClick={async () => {
                  if (submitting) return;
                  setSubmitting(true);
                  // localStorage 캐시 (UI 표시용)
                  localStorage.setItem('proRegistrationComplete', 'pending');
                  localStorage.setItem('proRegister_intro', intro);
                  localStorage.setItem('proRegister_careerYears', careerYears);
                  localStorage.setItem('proRegister_languages', JSON.stringify(selectedLanguages));
                  localStorage.setItem('proRegister_videos', JSON.stringify(videos));
                  localStorage.setItem('proRegister_description', description);

                  // 서버에 실제 proProfile 생성/업데이트 (status=pending)
                  let submitSucceeded = false;
                  let submitError: any = null;
                  try {
                    const photos: string[] = JSON.parse(localStorage.getItem('proRegister_photos') || '[]');
                    const mainPhotoIndex = parseInt(localStorage.getItem('proRegister_mainPhotoIndex') || '0') || 0;
                    const services = buildWeddingServicesFromStorage();

                    let registeredRegions: string[] | undefined = undefined;
                    try {
                      const stored = JSON.parse(localStorage.getItem('proRegister_selectedRegions') || '[]');
                      if (Array.isArray(stored) && stored.length > 0) registeredRegions = stored;
                    } catch {}
                    const submitResponse: any = await prosApi.submitRegistration({
                      name: localStorage.getItem('proRegister_name') || undefined,
                      phone: localStorage.getItem('proRegister_phone') || undefined,
                      gender: localStorage.getItem('proRegister_gender') || undefined,
                      shortIntro: intro || undefined,
                      careerYears: careerYears ? parseInt(careerYears) || undefined : undefined,
                      youtubeUrl: videos.filter(Boolean).join('\n') || undefined,
                      detailHtml: description || undefined,
                      photos: photos.length > 0 ? photos : undefined,
                      mainPhotoIndex,
                      services: services.length > 0 ? services : undefined,
                      languages: selectedLanguages.length > 0 ? selectedLanguages : undefined,
                      category: localStorage.getItem('proRegister_category') || undefined,
                      regions: registeredRegions,
                    });
                    submitSucceeded = true;
                    // 백엔드 응답에 user가 포함됨 → auth store 즉시 갱신 + discovery 캐시 무효화
                    try {
                      const { useAuthStore } = await import('@/lib/store/auth.store');
                      const newImg = submitResponse?.user?.profileImageUrl;
                      const cur = useAuthStore.getState().user;
                      if (newImg && cur) {
                        useAuthStore.getState().setUser({ ...cur, profileImageUrl: newImg });
                      }
                      // 홈/사회자 리스트에 최신 프로필 이미지 반영
                      const { invalidateProCache } = await import('@/lib/api/discovery.api');
                      invalidateProCache();
                      try { localStorage.removeItem('freetiful-pros-cache'); localStorage.removeItem('freetiful-pros-cache-v6'); } catch {}
                    } catch {}
                  } catch (e: any) {
                    submitError = e;
                    console.error('submitRegistration failed', e);
                  }
                  setSubmitting(false);
                  setShowConfirm(false);
                  if (submitSucceeded) {
                    setShowSuccess(true);
                  } else {
                    const msg = submitError?.response?.data?.message || submitError?.message || '서버 저장 중 오류가 발생했습니다.';
                    toast.error(`신청 실패: ${msg}`, { duration: 4000 });
                  }
                }}
                className="w-full py-4 bg-[#3180F7] text-white rounded-2xl font-bold text-base mb-3 flex items-center justify-center gap-2 disabled:opacity-70"
                whileTap={submitting ? {} : { scale: 0.97 }}
              >
                {submitting ? (
                  <>
                    <div className="w-5 h-5 border-2 border-white border-t-transparent rounded-full animate-spin" />
                    제출 중...
                  </>
                ) : (
                  '제출'
                )}
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
              onClick={() => { router.push('/main'); }}
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
