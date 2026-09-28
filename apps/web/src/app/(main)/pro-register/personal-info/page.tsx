'use client';

import { useState, useEffect } from 'react';
import { useRouter } from 'next/navigation';
import { ChevronDown } from 'lucide-react';
import { motion, AnimatePresence } from 'framer-motion';
import { RegisterShell, RgChip, RgCta, RgField, RgOption } from '../_components/RegisterKit';

const WEDDING_TAGS = ['결혼식', '돌잔치', '회갑/칠순', '상견례'];
const EVENT_TAGS = ['기업행사', '컨퍼런스/세미나', '체육대회', '송년회/시무식', '레크리에이션', '팀빌딩', '라이브커머스', '기업PT', '축제/페스티벌', '공식행사'];
const OTHER_TAGS = ['레슨/클래스', '쇼호스트', '축가/연주'];
/** 전문영역 칩 묶음(줄 제목 + 칩) */
const TAG_GROUPS = [
  { label: '웨딩 · 가족행사', tags: WEDDING_TAGS },
  { label: '기업 · 공식행사', tags: EVENT_TAGS },
  { label: '기타', tags: OTHER_TAGS },
];

export default function PersonalInfoPage() {
  const router = useRouter();
  const [name, setName] = useState(() => {
    if (typeof window !== 'undefined') return localStorage.getItem('proRegister_name') || '';
    return '';
  });
  const [phone, setPhone] = useState(() => {
    if (typeof window !== 'undefined') return localStorage.getItem('proRegister_phone') || '';
    return '';
  });
  const [gender, setGender] = useState(() => {
    if (typeof window !== 'undefined') return localStorage.getItem('proRegister_gender') || '';
    return '';
  });
  const [category, setCategory] = useState(() => {
    if (typeof window !== 'undefined') return localStorage.getItem('proRegister_category') || '';
    return '';
  });
  const [selectedCategories, setSelectedCategories] = useState<string[]>(() => {
    if (typeof window !== 'undefined') {
      const saved = localStorage.getItem('proRegister_selectedCategories');
      return saved ? JSON.parse(saved) : [];
    }
    return [];
  });
  const [showGenderSheet, setShowGenderSheet] = useState(false);
  const [showCategorySheet, setShowCategorySheet] = useState(false);
  const [toast, setToast] = useState('');

  useEffect(() => { localStorage.setItem('proRegister_name', name); }, [name]);
  useEffect(() => { localStorage.setItem('proRegister_phone', phone); }, [phone]);
  useEffect(() => { localStorage.setItem('proRegister_gender', gender); }, [gender]);
  useEffect(() => { localStorage.setItem('proRegister_category', category); }, [category]);
  useEffect(() => { localStorage.setItem('proRegister_selectedCategories', JSON.stringify(selectedCategories)); }, [selectedCategories]);

  const displayCategory = () => {
    return category || '';
  };

  const validatePhone = (phoneNumber: string) => /^010-\d{4}-\d{4}$/.test(phoneNumber);

  const toggleCategory = (cat: string) => {
    setSelectedCategories(prev => prev.includes(cat) ? prev.filter(c => c !== cat) : [...prev, cat]);
  };

  const formatPhoneNumber = (value: string) => {
    const numbers = value.replace(/[^\d]/g, '').slice(0, 11);
    if (numbers.length <= 3) return numbers;
    if (numbers.length <= 7) return `${numbers.slice(0, 3)}-${numbers.slice(3)}`;
    return `${numbers.slice(0, 3)}-${numbers.slice(3, 7)}-${numbers.slice(7)}`;
  };

  const isFormValid = name && phone && gender && category && selectedCategories.length > 0;

  const handleNext = () => {
    if (!isFormValid) return;
    if (!validatePhone(phone)) {
      setToast('올바른 휴대폰 양식이 아닙니다.');
      setTimeout(() => setToast(''), 3000);
      return;
    }
    router.push('/pro-register/regions');
  };

  return (
    <>
      <RegisterShell step={2} title="개인정보" cta={<RgCta disabled={!isFormValid} onClick={handleNext}>다음</RgCta>}>
        <RgField label="이름">
          <input
            type="text"
            value={name}
            onChange={(e) => { if (e.target.value.length <= 4) setName(e.target.value); }}
            maxLength={4}
            placeholder="이름 (최대 4자)"
            className="qd-input"
          />
        </RgField>

        <RgField label="전화번호">
          <input
            type="tel"
            value={phone}
            onChange={(e) => setPhone(formatPhoneNumber(e.target.value))}
            placeholder="010-0000-0000"
            className="qd-input"
          />
        </RgField>

        <RgField label="성별">
          <SheetField value={gender} placeholder="성별을 선택해주세요" open={showGenderSheet} onClick={() => setShowGenderSheet(true)} />
        </RgField>

        <RgField label="사회자분류">
          <SheetField value={displayCategory()} placeholder="사회자분류를 선택해주세요" open={showCategorySheet} onClick={() => setShowCategorySheet(true)} />
        </RgField>

        <RgField label={<>전문영역<span className="ml-1.5 text-[13px] font-semibold text-[#3182F6]">필수</span></>}>
          <p className="mb-4 text-[13px] leading-[1.5] text-[#8B95A1]">가능한 분야를 모두 선택해주세요</p>
          <div className="space-y-5">
            {TAG_GROUPS.map((group) => (
              <div key={group.label}>
                <p className="mb-2.5 text-[13px] font-medium text-[#8B95A1]">{group.label}</p>
                <div className="flex flex-wrap gap-2">
                  {group.tags.map((cat) => (
                    <RgChip key={cat} on={selectedCategories.includes(cat)} onClick={() => toggleCategory(cat)}>
                      {cat}
                    </RgChip>
                  ))}
                </div>
              </div>
            ))}
          </div>
        </RgField>
      </RegisterShell>

      {/* 토스트 — 앱 공통 토스트(AppToaster)와 같은 흰 유리 알약, 오류라 빨간 글자. 가운데 정렬은 감싼 칸이 맡는다(framer transform 이 translate 를 덮어써서) */}
      <AnimatePresence>
        {toast && (
          <div className="pointer-events-none fixed inset-x-0 top-6 z-50 flex justify-center px-4">
            <motion.div
              initial={{ opacity: 0, y: -16, scale: 0.96 }}
              animate={{ opacity: 1, y: 0, scale: 1 }}
              exit={{ opacity: 0, y: -12, scale: 0.96 }}
              transition={{ type: 'spring', stiffness: 420, damping: 30 }}
              role="alert"
              className="rounded-[20px] border-[0.6px] border-[#E5E9F0]/90 bg-white/[.92] px-[18px] py-[13px] text-[14px] font-bold leading-[1.35] text-[#E5484D] shadow-[0_18px_42px_rgba(15,23,42,0.14)] backdrop-blur-[18px]"
            >
              {toast}
            </motion.div>
          </div>
        )}
      </AnimatePresence>

      {/* 성별 선택 바텀시트 — 등장·퇴장은 framer 가 맡아 ft 자체 CSS 애니는 끔 */}
      <AnimatePresence>
        {showGenderSheet && (
          <motion.div
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            className="ft-scrim"
            style={{ animation: 'none' }}
            onClick={() => setShowGenderSheet(false)}
          >
            <motion.div
              initial={{ y: '100%' }}
              animate={{ y: 0 }}
              exit={{ y: '100%' }}
              transition={{ type: 'spring', stiffness: 300, damping: 30 }}
              className="ft-sheet"
              style={{ animation: 'none' }}
              role="dialog"
              aria-modal="true"
              onClick={(e) => e.stopPropagation()}
            >
              <div className="ft-grab" aria-hidden="true" />
              <h2 className="ft-title">성별을 선택해주세요.</h2>
              <div className="rg-list mt-6" role="radiogroup" aria-label="성별">
                {['남성', '여성'].map((g) => (
                  <RgOption key={g} role="radio" on={gender === g} onClick={() => { setGender(g); setShowGenderSheet(false); }} label={g} />
                ))}
              </div>
            </motion.div>
          </motion.div>
        )}
      </AnimatePresence>

      {/* 사회자분류 선택 바텀시트 — 등장·퇴장은 framer 가 맡아 ft 자체 CSS 애니는 끔 */}
      <AnimatePresence>
        {showCategorySheet && (
          <motion.div
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            className="ft-scrim"
            style={{ animation: 'none' }}
            onClick={() => setShowCategorySheet(false)}
          >
            <motion.div
              initial={{ y: '100%' }}
              animate={{ y: 0 }}
              exit={{ y: '100%' }}
              transition={{ type: 'spring', stiffness: 300, damping: 30 }}
              className="ft-sheet"
              style={{ animation: 'none' }}
              role="dialog"
              aria-modal="true"
              onClick={(e) => e.stopPropagation()}
            >
              <div className="ft-grab" aria-hidden="true" />
              <h2 className="ft-title">사회자분류를 선택해주세요.</h2>
              <p className="ft-desc">선택한 사회자분류로 활동이 가능합니다.</p>
              <div className="rg-list mt-6" role="radiogroup" aria-label="사회자분류">
                {['사회자', '쇼호스트', '축가/연주'].map((item) => (
                  <RgOption key={item} role="radio" on={category === item} onClick={() => { setCategory(item); setShowCategorySheet(false); }} label={item} />
                ))}
              </div>
            </motion.div>
          </motion.div>
        )}
      </AnimatePresence>
    </>
  );
}

/** 시트로 고르는 칸 — 입력칸(.qd-input)과 같은 모양 + 꺾쇠. 시트가 떠 있는 동안은 파란 테두리·꺾쇠 뒤집힘 */
function SheetField({ value, placeholder, open, onClick }: { value: string; placeholder: string; open: boolean; onClick: () => void }) {
  return (
    <button
      type="button"
      onClick={onClick}
      aria-haspopup="dialog"
      aria-expanded={open}
      className="qd-input flex items-center justify-between gap-3 text-left"
      style={open ? { borderColor: '#3182F6' } : undefined}
    >
      <span className={`min-w-0 truncate ${value ? 'text-[#191F28]' : 'text-[#B0B8C1]'}`}>{value || placeholder}</span>
      <ChevronDown size={20} className={`flex-none text-[#B0B8C1] transition-transform duration-200 ${open ? 'rotate-180' : ''}`} />
    </button>
  );
}
