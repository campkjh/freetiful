'use client';

import { useState, useRef, useEffect } from 'react';
import { useRouter } from 'next/navigation';
import { ChevronLeft, ChevronDown, Plus, X } from 'lucide-react';

const COMPANY_CATEGORIES = [
  '한국가스안전공사', '한국경제',
  '한국장학재단', '행정안전부', '현대아산',
  '현대홈쇼핑', '현대자동차', '현대중공업',
  '현대백화점', '현대건설', '현대제철',
  '현대모비스', '현대엔지니어링',
  '현대리바트', '현대상선', '현대오토에버',
  '현대카드', '현대해상', '현대위아',
  '현대제뉴인', '현대엘렉트릭',
  '현대프리미엄아울렛', '현대자동차그룹',
  '현대차증권', '현대종합상사',
  '현대해양화재보험', '현대차서비스',
  '현대스틸산업', '현대산업개발',
];

const LANGUAGES = [
  '영어', '일본어', '중국어', '러시아어',
  '아랍어', '힌디어', '프랑스어',
  '포르투갈어', '터키어이', '스페인어',
  '독일어', '자바어', '베트남어',
  '이탈리아어', '태국어', '광둥어',
  '뱅골어',
];

export default function ProfilePage() {
  const router = useRouter();
  const [intro, setIntro] = useState('');
  const [mainCareer, setMainCareer] = useState('');
  const [careerYears, setCareerYears] = useState('');
  const [showCareerDropdown, setShowCareerDropdown] = useState(false);
  const [awardInput, setAwardInput] = useState('');
  const [awardList, setAwardList] = useState<string[]>([]);
  const [selectedCategories, setSelectedCategories] = useState<string[]>([]);
  const [selectedLanguages, setSelectedLanguages] = useState<string[]>([]);
  const [description, setDescription] = useState('');
  const [videos, setVideos] = useState<string[]>([]);
  const [videoInput, setVideoInput] = useState('');
  const [showVideoInput, setShowVideoInput] = useState(false);
  const [faqs, setFaqs] = useState([{ id: 1, question: '', answer: '' }]);
  const [activeFaqTab, setActiveFaqTab] = useState(1);

  const [showConfirm, setShowConfirm] = useState(false);
  const editorRef = useRef<HTMLDivElement>(null);
  const colorInputRef = useRef<HTMLInputElement>(null);

  const execFormat = (command: string, value?: string) => {
    document.execCommand(command, false, value);
    editorRef.current?.focus();
  };

  const [isFormValid, setIsFormValid] = useState(false);
  useEffect(() => {
    setIsFormValid(intro.trim() !== '' && faqs.some(faq => faq.question.trim() !== ''));
  }, [intro, faqs]);

  const careerYearsOptions = Array.from({ length: 30 }, (_, i) => `${i + 1}년`);

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
      setAwardList(prev => [...prev, awardInput.trim()]);
      setAwardInput('');
    }
  };

  const addVideo = () => {
    if (videoInput.trim()) {
      setVideos(prev => [...prev, videoInput.trim()]);
      setVideoInput('');
      setShowVideoInput(false);
    }
  };

  const removeVideo = (index: number) => {
    setVideos(prev => prev.filter((_, i) => i !== index));
  };

  const addFaq = () => {
    const newId = faqs.length + 1;
    setFaqs(prev => [...prev, { id: newId, question: '', answer: '' }]);
    setActiveFaqTab(newId);
  };

  const updateFaq = (id: number, field: 'question' | 'answer', value: string) => {
    setFaqs(prev => prev.map(faq => faq.id === id ? { ...faq, [field]: value } : faq));
  };

  const deleteFaq = (id: number) => {
    setFaqs(prev => {
      const filtered = prev.filter(faq => faq.id !== id);
      if (activeFaqTab === id && filtered.length > 0) {
        setActiveFaqTab(filtered[filtered.length - 1].id);
      }
      return filtered;
    });
  };

  const activeFaq = faqs.find(faq => faq.id === activeFaqTab);

  return (
    <div className="min-h-screen bg-white pb-28">
      {/* Header */}
      <div className="px-6 pt-12 pb-6">
        <button onClick={() => router.back()} className="mb-10">
          <ChevronLeft size={24} className="text-gray-900" />
        </button>
        <h1 className="text-2xl font-bold text-gray-900">전문가 프로필</h1>
      </div>

      <div className="px-6">
        {/* [필수]전문가 소개 */}
        <div className="py-4">
          <p className="text-sm text-gray-500 mb-2">[필수]전문가 소개</p>
          <label className="text-xs text-[#3180F7] mb-1 block">한줄평소개</label>
          <input
            type="text"
            value={intro}
            onChange={(e) => setIntro(e.target.value)}
            placeholder="자기소개를 작성해주세요."
            className="w-full border-b-2 border-[#3180F7] pb-2 outline-none text-gray-900 text-xl font-semibold"
          />
        </div>

        {/* 주요이력 */}
        <div className="py-4">
          <input
            type="text"
            value={mainCareer}
            onChange={(e) => setMainCareer(e.target.value)}
            placeholder="주요이력"
            className="w-full border-b border-gray-300 pb-2 outline-none text-gray-900 placeholder:text-gray-400 text-xl font-semibold"
          />
        </div>

        {/* 경력 */}
        <div className="py-4 border-b border-gray-200">
          <div className="relative">
            <button
              onClick={() => setShowCareerDropdown(!showCareerDropdown)}
              className="w-full outline-none text-left text-xl font-semibold flex items-center justify-between"
            >
              <span className={careerYears ? 'text-gray-900' : 'text-gray-400'}>
                {careerYears || '경력'}
              </span>
              <ChevronDown size={20} className="text-gray-400" />
            </button>
            {showCareerDropdown && (
              <div className="absolute top-full left-0 right-0 mt-2 max-h-48 overflow-y-auto bg-white border border-gray-200 rounded-lg shadow-lg z-10">
                {careerYearsOptions.map((year) => (
                  <button
                    key={year}
                    onClick={() => { setCareerYears(year); setShowCareerDropdown(false); }}
                    className="w-full px-4 py-3 text-left hover:bg-gray-50 text-gray-900 text-sm"
                  >
                    {year}
                  </button>
                ))}
              </div>
            )}
          </div>
        </div>

        {/* 수상 내역 */}
        <div className="py-4 border-b border-gray-200">
          <div className="flex items-center gap-2">
            <input
              type="text"
              value={awardInput}
              onChange={(e) => setAwardInput(e.target.value)}
              onKeyPress={(e) => e.key === 'Enter' && addAward()}
              placeholder="수상 내역을 입력해주세요"
              className="flex-1 outline-none text-gray-900 placeholder:text-gray-400 text-xl font-semibold"
            />
          </div>
          {awardList.length > 0 && (
            <div className="mt-3 space-y-1">
              {awardList.map((award, index) => (
                <p key={index} className="text-sm text-gray-700">{award}</p>
              ))}
            </div>
          )}
        </div>

        {/* [선택]기업이력 */}
        <div className="py-4 border-b border-gray-200">
          <p className="text-sm font-bold text-gray-900 mb-3">[선택]기업이력</p>
          <div className="flex flex-wrap gap-2">
            {COMPANY_CATEGORIES.map((cat) => (
              <label key={cat} className="flex items-center gap-1.5 cursor-pointer">
                <div
                  onClick={() => toggleCategory(cat)}
                  className={`w-5 h-5 rounded flex items-center justify-center border-2 shrink-0 ${
                    selectedCategories.includes(cat)
                      ? 'bg-[#3180F7] border-[#3180F7]'
                      : 'bg-white border-gray-300'
                  }`}
                >
                  {selectedCategories.includes(cat) && (
                    <svg width="10" height="8" viewBox="0 0 10 8" fill="none">
                      <path d="M1 4L3.5 6.5L9 1" stroke="white" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"/>
                    </svg>
                  )}
                </div>
                <span className="text-sm text-gray-700">{cat}</span>
              </label>
            ))}
          </div>
        </div>

        {/* [선택]언어 */}
        <div className="py-4 border-b border-gray-200">
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
        </div>

        {/* [선택]상세설명 */}
        <div className="py-4 border-b border-gray-200">
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
              className="min-h-32 outline-none text-gray-900 text-sm"
              onInput={(e) => setDescription(e.currentTarget.innerHTML)}
            />
            {!description && (
              <span className="absolute top-0 left-0 text-gray-300 text-sm pointer-events-none select-none">
                상세페이지
              </span>
            )}
          </div>
        </div>

        {/* [선택]전문가기술·재정상 */}
        <div className="py-4 border-b border-gray-200">
          <p className="text-sm font-bold text-gray-900 mb-3">[선택]전문가소개영상</p>

          {/* 링크 추가 입력 */}
          {showVideoInput ? (
            <div className="flex items-center gap-2 mb-3 border border-gray-200 rounded-lg px-3 py-2">
              <input
                type="text"
                value={videoInput}
                onChange={(e) => setVideoInput(e.target.value)}
                placeholder="유튜브 링크를 입력해주세요"
                className="flex-1 outline-none text-sm text-gray-900 placeholder:text-gray-400"
                autoFocus
              />
              <button onClick={addVideo} className="text-[#3180F7] text-sm font-medium shrink-0">추가</button>
              <button onClick={() => { setShowVideoInput(false); setVideoInput(''); }} className="text-gray-400">
                <X size={16} />
              </button>
            </div>
          ) : (
            <button
              onClick={() => setShowVideoInput(true)}
              className="flex items-center justify-between w-full border border-gray-200 rounded-lg px-3 py-2 mb-3 bg-[#F9F9F9]"
            >
              <span className="text-sm text-gray-400">유튜브 링크 추가</span>
              <Plus size={16} className="text-gray-400" />
            </button>
          )}

          {/* 비디오 목록 */}
          {videos.length > 0 && (
            <div className="space-y-3">
              {videos.map((url, index) => (
                <div key={index} className="flex items-center gap-3 border-b border-gray-100 pb-3">
                  <span className="text-sm text-gray-500 w-4">{index + 1}</span>
                  <div className="w-10 h-10 bg-gray-200 rounded overflow-hidden shrink-0">
                    <img
                      src={`https://img.youtube.com/vi/${url.split('v=')[1]?.split('&')[0]}/default.jpg`}
                      alt="thumb"
                      className="w-full h-full object-cover"
                      onError={(e) => { (e.target as HTMLImageElement).style.display = 'none'; }}
                    />
                  </div>
                  <span className="flex-1 text-sm text-gray-600 truncate">{url.length > 20 ? url.slice(0, 20) + '...' : url}</span>
                  <button className="text-sm text-gray-500 shrink-0">수정</button>
                  <button
                    onClick={() => removeVideo(index)}
                    className="text-sm text-white bg-red-400 px-3 py-1 rounded-lg shrink-0"
                  >
                    삭제
                  </button>
                </div>
              ))}
            </div>
          )}
        </div>

        {/* [필수]전문가 FAQ */}
        <div className="py-4 border-b border-gray-200">
          <p className="text-sm font-bold text-gray-900 mb-3">[필수]전문가 FAQ</p>

          {/* 탭 목록 */}
          <div className="flex gap-2 mb-4 flex-wrap">
            <button
              onClick={addFaq}
              className="w-10 h-10 rounded-full border-2 border-dashed border-gray-300 flex items-center justify-center text-gray-400"
            >
              <Plus size={16} />
            </button>
            {[...faqs].reverse().map((faq) => (
              <button
                key={faq.id}
                onClick={() => setActiveFaqTab(faq.id)}
                className={`px-4 py-2 rounded-full text-xs font-medium ${
                  activeFaqTab === faq.id
                    ? 'bg-gray-900 text-white'
                    : 'bg-white text-gray-400 border-2 border-dashed border-gray-300'
                }`}
              >
                질문{faq.id}
              </button>
            ))}
          </div>

          {/* 활성 FAQ 입력 */}
          {activeFaq && (
            <div>
              {/* 질문 제목 */}
              <div className="flex items-center justify-between gap-3 mb-4">
                <input
                  type="text"
                  value={activeFaq.question}
                  onChange={(e) => updateFaq(activeFaq.id, 'question', e.target.value)}
                  placeholder="질문제목"
                  className="flex-1 outline-none text-gray-900 placeholder:text-gray-400 font-bold text-base"
                />
                {activeFaq.question && (
                  <div className="flex gap-2 shrink-0">
                    <button className="text-sm text-gray-500">저장</button>
                    <button
                      onClick={() => deleteFaq(activeFaq.id)}
                      className="text-sm text-white bg-red-400 px-3 py-1 rounded-lg"
                    >
                      삭제
                    </button>
                  </div>
                )}
              </div>

              {/* 질문 답변 */}
              <div className="flex items-start justify-between gap-3">
                <textarea
                  value={activeFaq.answer}
                  onChange={(e) => updateFaq(activeFaq.id, 'answer', e.target.value)}
                  placeholder="질문 내용을 작성해주세요"
                  className="flex-1 outline-none text-gray-900 placeholder:text-gray-400 text-base resize-none"
                  rows={2}
                />
              </div>
            </div>
          )}
        </div>
      </div>

      {/* Next Button */}
      <div className="fixed bottom-0 left-0 right-0 p-6 pb-8 bg-white">
        <button
          onClick={() => isFormValid && setShowConfirm(true)}
          disabled={!isFormValid}
          className={`w-full py-4 rounded-2xl font-bold text-base transition-colors ${
            isFormValid
              ? 'bg-[#3180F7] text-white'
              : 'bg-blue-100 text-blue-300 cursor-not-allowed'
          }`}
        >
          다음
        </button>
      </div>

      {/* 제출 확인 바텀시트 */}
      {showConfirm && (
        <div className="fixed inset-0 bg-black/50 z-50 flex items-end" onClick={() => setShowConfirm(false)}>
          <div className="bg-white rounded-t-3xl w-full p-6 pb-10" onClick={(e) => e.stopPropagation()}>
            <div className="w-12 h-1 bg-gray-300 rounded-full mx-auto mb-6" />
            <h2 className="text-xl font-bold mb-2">프로필작성을 제출하시겠습니까?</h2>
            <p className="text-sm text-gray-500 mb-6">
              심사기간은 최대 일주일이며 허위로 작성된 프로필일 경우 영구제재가 이루어질 수 있습니다.
            </p>
            <button
              onClick={() => {
                localStorage.setItem('userRole', 'pro');
                localStorage.setItem('proRegistrationComplete', 'true');
                window.location.href = '/my';
              }}
              className="w-full py-4 bg-[#3180F7] text-white rounded-2xl font-bold text-base mb-3"
            >
              완료
            </button>
            <button
              onClick={() => setShowConfirm(false)}
              className="w-full py-4 text-gray-500 font-medium text-base"
            >
              취소
            </button>
          </div>
        </div>
      )}
    </div>
  );
}
