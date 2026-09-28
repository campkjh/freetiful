'use client';

import { useState, useRef, useEffect } from 'react';
import { useRouter } from 'next/navigation';
import { ChevronRight, Plus, X, Image as ImageIcon, Check } from 'lucide-react';
import { motion, AnimatePresence } from 'framer-motion';
import toast from 'react-hot-toast';
import { prosApi } from '@/lib/api/pros.api';
import { buildWeddingServicesFromStorage } from '@/lib/wedding-plans';
import { QdBackIcon } from '../../my/_components/detail-ui';
import { RegisterShell, RgChip, RgCta, RgField } from '../_components/RegisterKit';

const LANGUAGES = [
  '영어', '일본어', '중국어', '러시아어',
  '아랍어', '힌디어', '프랑스어',
  '포르투갈어', '터키어이', '스페인어',
  '독일어', '자바어', '베트남어',
  '이탈리아어', '태국어', '광둥어',
  '뱅골어',
];

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

/** 라벨 옆 필수·선택 표시 */
function NeedTag({ optional }: { optional?: boolean }) {
  return optional
    ? <span className="ml-1.5 text-[13px] font-medium text-[#8B95A1]">선택</span>
    : <span className="ml-1.5 text-[13px] font-semibold text-[#3182F6]">필수</span>;
}

/** 서식 막대 단추 — 누르는 동안 편집칸 포커스는 onMouseDown preventDefault 가 붙잡는다 */
const TOOL_BTN = 'flex h-9 w-9 items-center justify-center rounded-[10px] text-[#4E5968] transition-colors active:bg-[#E5E8EB] lg:hover:bg-[#EBEEF1]';
/** 영상 추가 보조 단추 — 연파랑 면 · 파란 글자 */
const WEAK_BTN = 'flex h-[52px] items-center justify-center gap-1.5 rounded-2xl bg-[#E8F3FF] text-[15px] font-semibold text-[#3182F6] transition-colors active:bg-[#DCEBFF] disabled:opacity-60';

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

  // 유튜브 검색 화면 닫기(뒤로 · 완료 공통) — 검색어·결과 비움
  const closeYoutubeSearch = () => {
    setShowYoutubeSearch(false); setYtChannels([]); setYtVideos([]); setYtSelectedChannel(null); setYtChannelQuery('');
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
    <>
      {/* 경력 칩 줄이 화면 끝까지 흐르므로 본문 가로 넘침은 잘라 둔다(들어오는 슬라이드 동안 가로 스크롤 안 생기게) */}
      <RegisterShell
        step={5}
        title="사회자 프로필"
        bodyClassName="overflow-x-hidden"
        cta={<RgCta disabled={!isFormValid} onClick={() => isFormValid && setShowConfirm(true)}>제출</RgCta>}
      >
        {/* 사회자 소개 */}
        <RgField label={<>사회자 소개<NeedTag /></>}>
          <input
            type="text"
            value={intro}
            onChange={(e) => setIntro(e.target.value)}
            placeholder="자기소개를 작성해주세요."
            className="qd-input"
          />
        </RgField>

        {/* 경력 — 옆으로 넘기는 칩, 본문 여백만큼 바깥으로 빼서 화면 끝까지 */}
        <RgField label="경력">
          <div className="-mx-6 flex gap-2 overflow-x-auto whitespace-nowrap px-6 scrollbar-hide [&>*]:flex-none">
            {careerYearsOptions.map((year) => (
              <RgChip key={year} on={careerYears === year} onClick={() => setCareerYears(year)}>
                {year}
              </RgChip>
            ))}
          </div>
        </RgField>

        {/* 언어 */}
        <RgField label={<>언어<NeedTag optional /></>}>
          <div className="flex flex-wrap gap-2">
            {LANGUAGES.map((lang) => (
              <RgChip key={lang} on={selectedLanguages.includes(lang)} onClick={() => toggleLanguage(lang)}>
                {lang}
              </RgChip>
            ))}
          </div>
        </RgField>

        {/* 상세설명 — 서식 막대 + 편집칸을 입력칸 한 상자로(쓰는 중이면 파란 테두리) */}
        <RgField label={<>상세설명<NeedTag optional /></>}>
          <div className="overflow-hidden rounded-2xl border-[1.5px] border-[#E5E8EB] bg-white transition-colors focus-within:border-[#3182F6]">
            {/* 서식 막대 */}
            <div className="flex flex-wrap items-center gap-0.5 border-b border-[#F2F4F6] bg-[#F9FAFB] px-2 py-1.5">
              <button type="button" aria-label="굵게" onMouseDown={(e) => { e.preventDefault(); execFormat('bold'); }} className={`${TOOL_BTN} text-[15px] font-bold`}>B</button>
              <button type="button" aria-label="기울임" onMouseDown={(e) => { e.preventDefault(); execFormat('italic'); }} className={`${TOOL_BTN} text-[15px] italic`}>I</button>
              <button type="button" aria-label="밑줄" onMouseDown={(e) => { e.preventDefault(); execFormat('underline'); }} className={`${TOOL_BTN} text-[15px] underline`}>U</button>

              <span className="mx-1 h-5 w-px bg-[#E5E8EB]" aria-hidden="true" />

              <button type="button" aria-label="왼쪽 정렬" onMouseDown={(e) => { e.preventDefault(); execFormat('justifyLeft'); }} className={TOOL_BTN}>
                <svg width="16" height="14" viewBox="0 0 16 14" fill="currentColor">
                  <rect x="0" y="0" width="16" height="2" rx="1"/>
                  <rect x="0" y="6" width="10" height="2" rx="1"/>
                  <rect x="0" y="12" width="13" height="2" rx="1"/>
                </svg>
              </button>
              <button type="button" aria-label="가운데 정렬" onMouseDown={(e) => { e.preventDefault(); execFormat('justifyCenter'); }} className={TOOL_BTN}>
                <svg width="16" height="14" viewBox="0 0 16 14" fill="currentColor">
                  <rect x="0" y="0" width="16" height="2" rx="1"/>
                  <rect x="3" y="6" width="10" height="2" rx="1"/>
                  <rect x="1.5" y="12" width="13" height="2" rx="1"/>
                </svg>
              </button>
              <button type="button" aria-label="오른쪽 정렬" onMouseDown={(e) => { e.preventDefault(); execFormat('justifyRight'); }} className={TOOL_BTN}>
                <svg width="16" height="14" viewBox="0 0 16 14" fill="currentColor">
                  <rect x="0" y="0" width="16" height="2" rx="1"/>
                  <rect x="6" y="6" width="10" height="2" rx="1"/>
                  <rect x="3" y="12" width="13" height="2" rx="1"/>
                </svg>
              </button>
              <button type="button" aria-label="양쪽 정렬" onMouseDown={(e) => { e.preventDefault(); execFormat('justifyFull'); }} className={TOOL_BTN}>
                <svg width="16" height="14" viewBox="0 0 16 14" fill="currentColor">
                  <rect x="0" y="0" width="16" height="2" rx="1"/>
                  <rect x="0" y="6" width="16" height="2" rx="1"/>
                  <rect x="0" y="12" width="16" height="2" rx="1"/>
                </svg>
              </button>

              <button type="button" aria-label="글머리 목록" onMouseDown={(e) => { e.preventDefault(); execFormat('insertUnorderedList'); }} className={TOOL_BTN}>
                <svg width="16" height="14" viewBox="0 0 16 14" fill="currentColor">
                  <circle cx="1.5" cy="1.5" r="1.5"/>
                  <rect x="5" y="0.5" width="11" height="2" rx="1"/>
                  <circle cx="1.5" cy="7" r="1.5"/>
                  <rect x="5" y="6" width="11" height="2" rx="1"/>
                  <circle cx="1.5" cy="12.5" r="1.5"/>
                  <rect x="5" y="11.5" width="11" height="2" rx="1"/>
                </svg>
              </button>
              <button type="button" aria-label="번호 목록" onMouseDown={(e) => { e.preventDefault(); execFormat('insertOrderedList'); }} className={TOOL_BTN}>
                <svg width="16" height="14" viewBox="0 0 16 14" fill="currentColor">
                  <text x="0" y="4" fontSize="4.5" fontFamily="sans-serif">1.</text>
                  <rect x="6" y="0.5" width="10" height="2" rx="1"/>
                  <text x="0" y="9" fontSize="4.5" fontFamily="sans-serif">2.</text>
                  <rect x="6" y="6" width="10" height="2" rx="1"/>
                  <text x="0" y="14" fontSize="4.5" fontFamily="sans-serif">3.</text>
                  <rect x="6" y="11.5" width="10" height="2" rx="1"/>
                </svg>
              </button>

              <span className="mx-1 h-5 w-px bg-[#E5E8EB]" aria-hidden="true" />

              <button type="button" aria-label="글자 색" onMouseDown={(e) => { e.preventDefault(); colorInputRef.current?.click(); }} className={TOOL_BTN}>
                <svg width="16" height="16" viewBox="0 0 16 16" fill="none">
                  <path d="M2 13.5V11l7-7 2.5 2.5-7 7H2z" fill="currentColor"/>
                  <path d="M10.5 3.5L12 2l2 2-1.5 1.5L10.5 3.5z" fill="currentColor"/>
                  <circle cx="13.5" cy="13.5" r="2" fill="#3182F6"/>
                </svg>
              </button>
              <input
                ref={colorInputRef}
                type="color"
                className="hidden"
                onChange={(e) => execFormat('foreColor', e.target.value)}
              />

              <button type="button" aria-label="사진 넣기" onMouseDown={(e) => { e.preventDefault(); handleImageInsert(); }} className={TOOL_BTN}>
                <ImageIcon size={16} />
              </button>
              <input
                ref={imageInputRef}
                type="file"
                accept="image/*"
                className="hidden"
                onChange={onImageSelected}
              />

              <button type="button" aria-label="글자 크기" className={TOOL_BTN}>
                <span className="text-xs font-bold leading-none">T<span className="text-[10px]">t</span></span>
              </button>
            </div>

            {/* 편집칸 */}
            <div className="relative">
              <div
                ref={editorRef}
                contentEditable
                suppressContentEditableWarning
                className="min-h-40 px-[18px] py-4 text-[16px] leading-[1.6] text-[#191F28] outline-none [&_img]:my-2 [&_img]:h-auto [&_img]:max-w-full [&_img]:rounded-lg"
                onInput={(e) => setDescription(e.currentTarget.innerHTML)}
              />
              {!description && (
                <span className="pointer-events-none absolute left-[18px] top-4 select-none text-[16px] leading-[1.6] text-[#B0B8C1]">
                  상세페이지
                </span>
              )}
            </div>
          </div>
        </RgField>

        {/* 사회자소개영상 */}
        <RgField label={<>사회자소개영상<NeedTag optional /></>}>
          {showVideoInput ? (
            <div>
              {/* 링크 입력 — 입력칸 안 오른쪽에 추가 · 닫기 */}
              <div className="relative">
                <input
                  type="text"
                  value={videoInput}
                  onChange={(e) => { setVideoInput(e.target.value); setVideoError(''); }}
                  placeholder="유튜브 링크를 입력해주세요"
                  className="qd-input"
                  style={{ paddingRight: 112 }}
                  autoFocus
                />
                <div className="absolute inset-y-0 right-2 flex items-center gap-0.5">
                  <button type="button" onClick={addVideo} className="h-10 rounded-xl px-3 text-[15px] font-semibold text-[#3182F6] transition-colors active:bg-[#E8F3FF]">
                    추가
                  </button>
                  <button
                    type="button"
                    onClick={() => { setShowVideoInput(false); setVideoInput(''); setVideoError(''); }}
                    aria-label="닫기"
                    className="flex h-10 w-10 items-center justify-center rounded-xl text-[#B0B8C1] transition-colors active:bg-[#F2F4F6]"
                  >
                    <X size={18} />
                  </button>
                </div>
              </div>
              {/* Error */}
              <AnimatePresence>
                {videoError && (
                  <motion.p initial={{ opacity: 0, y: -4 }} animate={{ opacity: 1, y: 0 }} exit={{ opacity: 0 }} className="rg-error">{videoError}</motion.p>
                )}
              </AnimatePresence>
              {/* Live preview */}
              {videoInput && extractYouTubeId(videoInput) && (
                <motion.div initial={{ opacity: 0, height: 0 }} animate={{ opacity: 1, height: 'auto' }} className="mt-3 overflow-hidden rounded-2xl">
                  <div className="relative w-full" style={{ paddingBottom: '56.25%' }}>
                    <img
                      src={`https://img.youtube.com/vi/${extractYouTubeId(videoInput)}/mqdefault.jpg`}
                      alt="preview"
                      className="absolute inset-0 h-full w-full object-cover"
                    />
                    <div className="absolute inset-0 flex items-center justify-center">
                      <div className="flex h-12 w-12 items-center justify-center rounded-full bg-[#3182F6] shadow-lg">
                        <div className="ml-1 h-0 w-0 border-y-[8px] border-l-[14px] border-y-transparent border-l-white" />
                      </div>
                    </div>
                  </div>
                </motion.div>
              )}
            </div>
          ) : (
            <div className="space-y-2">
              {/* 링크 직접 입력 — 입력칸 모양 단추 */}
              <button type="button" onClick={() => setShowVideoInput(true)} className="qd-input flex items-center justify-between gap-3 text-left">
                <span className="text-[#B0B8C1]">링크 직접 입력</span>
                <Plus size={20} className="flex-none text-[#B0B8C1]" />
              </button>
              <div className="grid grid-cols-2 gap-2">
                <button type="button" onClick={() => setShowYoutubeSearch(true)} className={WEAK_BTN}>
                  <svg width="18" height="18" viewBox="0 0 24 24" fill="none" aria-hidden="true"><rect x="2" y="4" width="20" height="16" rx="4" fill="#3182F6"/><path d="M10 8.5v7l6-3.5-6-3.5z" fill="white"/></svg>
                  검색
                </button>
                <button
                  type="button"
                  onClick={() => { if (!videoUploading) videoFileInputRef.current?.click(); }}
                  disabled={videoUploading}
                  className={WEAK_BTN}
                >
                  {videoUploading ? (
                    <>
                      <span className="h-4 w-4 animate-spin rounded-full border-2 border-[#3182F6] border-t-transparent" />
                      <span className="tabular-nums">{videoUploadProgress}%</span>
                    </>
                  ) : (
                    <>
                      <Plus size={18} strokeWidth={2.4} />
                      동영상 파일
                    </>
                  )}
                </button>
              </div>
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
            <div className="mt-3">
              <div className="h-1.5 overflow-hidden rounded-full bg-[#F2F4F6]">
                <div className="h-full rounded-full bg-[#3182F6] transition-all" style={{ width: `${videoUploadProgress}%` }} />
              </div>
              <p className="mt-1.5 text-[13px] text-[#8B95A1]">동영상 업로드 중... {videoUploadProgress}%</p>
            </div>
          )}

          {/* 비디오 목록 — with preview thumbnails */}
          {videos.length > 0 && (
            <div className="mt-3 space-y-3">
              {videos.map((url, index) => {
                const ytId = extractYouTubeId(url);
                return (
                  <motion.div key={index} initial={{ opacity: 0, y: 8 }} animate={{ opacity: 1, y: 0 }} className="overflow-hidden rounded-2xl border-[1.5px] border-[#E5E8EB]">
                    {/* Thumbnail preview */}
                    {ytId && (
                      <div className="relative w-full" style={{ paddingBottom: '56.25%' }}>
                        <img
                          src={`https://img.youtube.com/vi/${ytId}/mqdefault.jpg`}
                          alt="thumb"
                          className="absolute inset-0 h-full w-full object-cover"
                        />
                        <div className="absolute inset-0 flex items-center justify-center">
                          <div className="flex h-11 w-11 items-center justify-center rounded-full bg-black/50">
                            <div className="ml-0.5 h-0 w-0 border-y-[6px] border-l-[10px] border-y-transparent border-l-white" />
                          </div>
                        </div>
                        <span className="absolute left-2.5 top-2.5 flex h-6 min-w-[24px] items-center justify-center rounded-full bg-black/60 px-2 text-[12px] font-semibold text-white">{index + 1}</span>
                      </div>
                    )}
                    {/* Uploaded video preview */}
                    {!ytId && isUploadedVideoUrl(url) && (
                      <video
                        src={url + '#t=0.1'}
                        preload="metadata"
                        muted
                        playsInline
                        className="max-h-[280px] w-full bg-black object-contain"
                      />
                    )}
                    <div className="flex items-center justify-between gap-2 py-2.5 pl-4 pr-2.5">
                      <span className="min-w-0 flex-1 truncate text-[13px] text-[#8B95A1]">{url.length > 35 ? url.slice(0, 35) + '...' : url}</span>
                      <button
                        type="button"
                        onClick={() => removeVideo(index)}
                        className="h-8 flex-none rounded-lg bg-[#F2F4F6] px-3 text-[13px] font-semibold text-[#4E5968] transition-colors active:bg-[#E5E8EB]"
                      >
                        삭제
                      </button>
                    </div>
                  </motion.div>
                );
              })}
            </div>
          )}
        </RgField>
      </RegisterShell>

      {/* YouTube 채널 검색 페이지 — 오른쪽에서 밀려 들어온다 */}
      <AnimatePresence>
        {showYoutubeSearch && (
          <motion.div
            className="fixed inset-0 z-50 flex flex-col bg-white"
            style={{ height: '100dvh', letterSpacing: '-0.02em' }}
            initial={{ x: '100%' }}
            animate={{ x: 0 }}
            exit={{ x: '100%' }}
            transition={{ type: 'spring', stiffness: 300, damping: 30 }}
          >
            {/* 머리 — 퀵매칭 뒤로 화살표 */}
            <header className="flex h-14 flex-none items-center gap-1 pl-2 pr-5">
              <button type="button" onClick={closeYoutubeSearch} aria-label="뒤로가기" className="qd-back">
                <QdBackIcon />
              </button>
              <h2 className="text-[17px] font-semibold text-[#191F28]">YouTube 영상 검색</h2>
            </header>
            {/* Search input */}
            <div className="flex flex-none gap-2 border-b border-[#F2F4F6] px-5 pb-4">
              <input
                type="text"
                value={ytChannelQuery}
                onChange={(e) => setYtChannelQuery(e.target.value)}
                onKeyDown={(e) => e.key === 'Enter' && searchYtChannels()}
                placeholder="채널명을 검색하세요"
                className="qd-input min-w-0 flex-1"
                autoFocus
              />
              <button
                type="button"
                onClick={searchYtChannels}
                className="h-[60px] flex-none rounded-2xl bg-[#3182F6] px-5 text-[16px] font-semibold text-white transition-colors active:bg-[#2272EB]"
              >
                검색
              </button>
            </div>

            {/* Content */}
            <div className="min-h-0 flex-1 overflow-y-auto overscroll-contain">
              {ytLoading && (
                <div className="flex items-center justify-center py-12">
                  <div className="h-6 w-6 animate-spin rounded-full border-2 border-[#3182F6] border-t-transparent" />
                </div>
              )}

              {/* Channel results */}
              {!ytSelectedChannel && ytChannels.length > 0 && !ytLoading && (
                <div className="px-5 py-4">
                  <p className="mb-3 text-[13px] font-semibold text-[#8B95A1]">채널 선택</p>
                  <div className="rg-list">
                    {ytChannels.map((ch) => (
                      <button
                        key={ch.id}
                        type="button"
                        onClick={() => loadYtVideos(ch.id)}
                        className="flex min-h-[60px] w-full items-center gap-3 rounded-2xl border-[1.5px] border-[#E5E8EB] px-4 py-3 text-left transition-colors active:bg-[#F8F9FA]"
                      >
                        <img src={ch.thumbnail} alt="" className="h-11 w-11 flex-none rounded-full bg-[#F2F4F6] object-cover" />
                        <span className="min-w-0 flex-1">
                          <span className="block truncate text-[16px] font-semibold text-[#333D4B]">{ch.title}</span>
                          <span className="mt-0.5 block truncate text-[13px] text-[#8B95A1]">{ch.description}</span>
                        </span>
                        <ChevronRight size={18} className="flex-none text-[#B0B8C1]" />
                      </button>
                    ))}
                  </div>
                </div>
              )}

              {/* Video results */}
              {ytSelectedChannel && ytVideos.length > 0 && !ytLoading && (
                <div className="px-5 py-4">
                  <div className="mb-3 flex items-center justify-between">
                    <p className="text-[13px] font-semibold text-[#8B95A1]">영상 선택</p>
                    <button
                      type="button"
                      onClick={() => { setYtSelectedChannel(null); setYtVideos([]); }}
                      className="text-[13px] font-semibold text-[#3182F6]"
                    >
                      채널 다시 선택
                    </button>
                  </div>
                  <div className="space-y-3">
                    {ytVideos.map((v) => {
                      const alreadyAdded = videos.includes(`https://www.youtube.com/watch?v=${v.id}`);
                      return (
                        <button
                          key={v.id}
                          type="button"
                          aria-pressed={alreadyAdded}
                          onClick={() => { if (!alreadyAdded) selectYtVideo(v.id); }}
                          className={`w-full overflow-hidden rounded-2xl border-[1.5px] text-left transition-colors ${alreadyAdded ? 'border-[#3182F6] bg-[#EDF4FF]' : 'border-[#E5E8EB] active:bg-[#F8F9FA]'}`}
                        >
                          <div className="relative w-full" style={{ paddingBottom: '56.25%' }}>
                            <img src={v.thumbnail} alt="" className="absolute inset-0 h-full w-full object-cover" />
                            {alreadyAdded && (
                              <>
                                <div className="absolute inset-0 bg-[#3182F6]/10" />
                                <motion.div
                                  initial={{ scale: 0 }}
                                  animate={{ scale: 1 }}
                                  transition={{ type: 'spring', stiffness: 400, damping: 15 }}
                                  className="absolute right-2.5 top-2.5 flex h-7 w-7 items-center justify-center rounded-full bg-[#3182F6] shadow-md"
                                >
                                  <Check size={16} className="stroke-[3] text-white" />
                                </motion.div>
                              </>
                            )}
                          </div>
                          <div className="px-4 py-3">
                            <p className={`line-clamp-2 text-[15px] font-semibold ${alreadyAdded ? 'text-[#3182F6]' : 'text-[#333D4B]'}`}>{v.title}</p>
                          </div>
                        </button>
                      );
                    })}
                  </div>
                </div>
              )}

              {/* Empty state */}
              {!ytLoading && ytChannels.length === 0 && !ytSelectedChannel && ytChannelQuery && (
                <p className="py-12 text-center text-[15px] text-[#8B95A1]">검색 결과가 없습니다</p>
              )}
              {!ytLoading && !ytChannelQuery && ytChannels.length === 0 && (
                <div className="flex flex-col items-center py-16">
                  <svg width="48" height="48" viewBox="0 0 24 24" fill="none" aria-hidden="true"><rect x="2" y="4" width="20" height="16" rx="4" fill="#E8F3FF"/><path d="M10 8.5v7l6-3.5-6-3.5z" fill="#3182F6"/></svg>
                  <p className="mt-4 text-[15px] font-semibold text-[#4E5968]">채널명을 검색해주세요</p>
                  <p className="mt-1 text-[13px] text-[#8B95A1]">검색 후 영상을 선택할 수 있습니다</p>
                </div>
              )}
            </div>

            {/* Bottom: 선택 완료 */}
            {videos.length > 0 && (
              <div className="flex-none bg-white px-5 pt-2.5" style={{ paddingBottom: 'calc(env(safe-area-inset-bottom, 0px) + 16px)' }}>
                <RgCta onClick={closeYoutubeSearch}>완료 ({videos.length}개 영상)</RgCta>
              </div>
            )}
          </motion.div>
        )}
      </AnimatePresence>

      {/* 제출 확인 바텀시트 — 딤(아래 motion 배경)·시트 등장/퇴장은 framer 가 맡아 ft 자체 배경·CSS 애니는 끔 */}
      <AnimatePresence>
        {showConfirm && (
          <div className="ft-scrim" style={{ background: 'none', animation: 'none' }} onClick={() => setShowConfirm(false)}>
            <motion.div
              className="absolute inset-0 bg-black/40"
              initial={{ opacity: 0 }}
              animate={{ opacity: 1 }}
              exit={{ opacity: 0 }}
            />
            <motion.div
              className="ft-sheet"
              style={{ animation: 'none' }}
              role="dialog"
              aria-modal="true"
              variants={bottomSheetVariants}
              initial="hidden"
              animate="visible"
              exit="exit"
              onClick={(e) => e.stopPropagation()}
            >
              <div className="ft-grab" aria-hidden="true" />
              <h2 className="ft-title">정말로 제출하시겠습니까?</h2>
              <p className="ft-desc font-medium !text-[#3182F6]">
                허위로 작성된 프로필일 경우 영구제재가 이루어질 수 있습니다.
              </p>
              <p className="ft-desc">
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
                className="ft-btn primary mt-6 w-full"
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
                className="ft-btn secondary mt-2 w-full"
                whileTap={{ scale: 0.97 }}
              >
                취소
              </motion.button>
            </motion.div>
          </div>
        )}
      </AnimatePresence>

      {/* 제출 완료 페이지 — 퀵매칭 완료 화면 결: 파란 동그라미 체크가 톡 · 제목·설명 아래→위 페이드 · 아래 고정 버튼 */}
      <AnimatePresence>
        {showSuccess && (
          <motion.div
            className="fixed inset-0 z-[60] flex flex-col bg-white"
            style={{ height: '100dvh', letterSpacing: '-0.02em' }}
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            transition={{ duration: 0.3 }}
          >
            <div className="flex min-h-0 flex-1 flex-col items-center justify-center px-8 text-center">
              <motion.span
                initial={{ scale: 0 }}
                animate={{ scale: 1 }}
                transition={{ type: 'spring', stiffness: 300, damping: 20, delay: 0.15 }}
                className="flex h-[84px] w-[84px] items-center justify-center rounded-full bg-[#3182F6]"
              >
                <Check size={40} strokeWidth={3} className="text-white" />
              </motion.span>
              <h2 className="qd-a-title mt-[26px] text-[24px] font-semibold leading-[1.4] tracking-[-0.4px] text-[#191F28]" style={{ animationDelay: '.25s' }}>
                제출이 완료되었습니다!
              </h2>
              <p className="qd-a-sub mt-2.5 text-[15px] leading-[1.5] text-[#8B95A1]" style={{ animationDelay: '.4s' }}>
                7일 이내에 승인 결과를 알려드립니다
              </p>
            </div>
            <div className="qd-a-sub flex-none px-5 pt-2.5" style={{ animationDelay: '.55s', paddingBottom: 'calc(env(safe-area-inset-bottom, 0px) + 16px)' }}>
              <RgCta onClick={() => { router.push('/main'); }}>확인</RgCta>
            </div>
          </motion.div>
        )}
      </AnimatePresence>
    </>
  );
}
