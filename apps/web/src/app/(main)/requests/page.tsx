'use client';

import { useState } from 'react';

type TabType = '전체' | '다수' | '단일' | '보관';

const MOCK_REQUESTS = [
  {
    id: 1, type: '다수문의', date: '2026년03월29일 일요일 12시19분',
    name: '김승호', price: '30만원',
    eventDate: '2026년12월20일 일요일 2시40분',
    location: '서울 송파구 올림픽로35다길 42\n더 베네치아',
    note: '',
  },
  {
    id: 2, type: '다수문의', date: '2026년03월29일 일요일 12시19분',
    name: '김승호', price: '30만원',
    eventDate: '2026년12월20일 일요일 2시40분',
    location: '서울 송파구 올림픽로35다길 42\n더 베네치아',
    note: '',
  },
  {
    id: 3, type: '단일문의', date: '2026년03월28일 토요일 10시00분',
    name: '이지은', price: '50만원',
    eventDate: '2026년11월15일 토요일 3시00분',
    location: '서울 강남구 테헤란로 152\n강남파이낸스센터',
    note: '마이크 준비 부탁드립니다.',
  },
  {
    id: 4, type: '단일문의', date: '2026년03월27일 금요일 14시30분',
    name: '박민준', price: '45만원',
    eventDate: '2026년10월10일 토요일 11시00분',
    location: '경기 성남시 분당구 판교로 256\n코리아디자인센터',
    note: '',
  },
  {
    id: 5, type: '다수문의', date: '2026년03월26일 목요일 09시15분',
    name: '최수진', price: '35만원',
    eventDate: '2026년09월05일 토요일 2시00분',
    location: '서울 마포구 상암산로 34\nMBC 신사옥',
    note: '행사 진행 경험 많은 분 선호합니다.',
  },
  {
    id: 6, type: '보관', date: '2026년03월25일 수요일 16시45분',
    name: '정태양', price: '25만원',
    eventDate: '2026년08월20일 목요일 6시00분',
    location: '부산 해운대구 센텀서로 30\n벡스코',
    note: '',
  },
  {
    id: 7, type: '다수문의', date: '2026년03월24일 화요일 11시00분',
    name: '한예슬', price: '60만원',
    eventDate: '2026년07월12일 일요일 1시00분',
    location: '서울 중구 을지로 30\n페럼타워',
    note: '영어 진행 가능한 분 선호합니다.',
  },
  {
    id: 8, type: '단일문의', date: '2026년03월23일 월요일 13시20분',
    name: '강동원', price: '40만원',
    eventDate: '2026년06월28일 일요일 4시00분',
    location: '인천 연수구 컨벤시아대로 165\n송도컨벤시아',
    note: '',
  },
  {
    id: 9, type: '다수문의', date: '2026년03월22일 일요일 15시00분',
    name: '오세진', price: '55만원',
    eventDate: '2026년05월23일 토요일 12시00분',
    location: '서울 서초구 강남대로 27\n양재 aT센터',
    note: '결혼식 사회 경험 필수입니다.',
  },
  {
    id: 10, type: '보관', date: '2026년03월21일 토요일 08시30분',
    name: '윤서연', price: '20만원',
    eventDate: '2026년04월18일 토요일 2시00분',
    location: '서울 종로구 율곡로 99\n서울시립미술관',
    note: '',
  },
  {
    id: 11, type: '단일문의', date: '2026년03월20일 금요일 17시00분',
    name: '임현식', price: '38만원',
    eventDate: '2026년03월30일 월요일 10시00분',
    location: '서울 영등포구 국제금융로 10\nIFC몰',
    note: '기업 행사 진행 경험자 우대',
  },
  {
    id: 12, type: '다수문의', date: '2026년03월19일 목요일 12시00분',
    name: '신지훈', price: '42만원',
    eventDate: '2026년04월05일 일요일 3시00분',
    location: '경기 고양시 일산동구 한류월드로 250\nKINTEX',
    note: '',
  },
];

const TABS: TabType[] = ['전체', '다수', '단일', '보관'];
const PAGE_SIZE = 10;

export default function RequestsPage() {
  const [activeTab, setActiveTab] = useState<TabType>('전체');
  const [visibleCount, setVisibleCount] = useState(PAGE_SIZE);

  const filtered = MOCK_REQUESTS.filter((r) => {
    if (activeTab === '전체') return true;
    if (activeTab === '다수') return r.type === '다수문의';
    if (activeTab === '단일') return r.type === '단일문의';
    if (activeTab === '보관') return r.type === '보관';
    return true;
  });

  const counts = {
    전체: MOCK_REQUESTS.length,
    다수: MOCK_REQUESTS.filter(r => r.type === '다수문의').length,
    단일: MOCK_REQUESTS.filter(r => r.type === '단일문의').length,
    보관: MOCK_REQUESTS.filter(r => r.type === '보관').length,
  };

  const visible = filtered.slice(0, visibleCount);
  const hasMore = filtered.length > visibleCount;

  const handleTabChange = (tab: TabType) => {
    setActiveTab(tab);
    setVisibleCount(PAGE_SIZE);
  };

  return (
    <div className="min-h-screen bg-gray-100">
      {/* Header */}
      <div className="px-4 pt-14 pb-4 bg-gray-100">
        <h1 className="text-2xl font-bold text-gray-900">새의뢰</h1>
      </div>

      {/* Filter Tabs */}
      <div className="px-4 pb-4 flex gap-2">
        {TABS.map((tab) => (
          <button
            key={tab}
            onClick={() => handleTabChange(tab)}
            className={`px-4 py-2 rounded-full text-sm font-medium transition-all ${
              activeTab === tab
                ? 'bg-gray-900 text-white'
                : 'bg-white text-gray-500 border border-gray-200'
            }`}
          >
            {tab} {counts[tab]}
          </button>
        ))}
      </div>

      {/* Request Cards */}
      <div className="px-4 space-y-3 pb-28">
        {visible.map((req) => (
          <div key={req.id} className="bg-white rounded-2xl p-5">
            {/* Date & Type */}
            <p className="text-xs text-gray-400 mb-1">{req.type} {req.date}</p>

            {/* Name */}
            <p className="text-lg font-bold mb-4">
              <span className="text-[#3180F7]">{req.name}</span>님의 의뢰
            </p>

            {/* 견적가 */}
            <div className="mb-3">
              <p className="text-xs text-gray-400 mb-0.5">견적가</p>
              <p className="text-xl font-bold text-gray-900">{req.price}</p>
            </div>

            {/* 행사일 */}
            <div className="mb-3">
              <p className="text-xs text-gray-400 mb-0.5">행사일</p>
              <p className="text-xl font-bold text-gray-900">{req.eventDate}</p>
            </div>

            {/* 행사장소 */}
            <div className="mb-3">
              <p className="text-xs text-gray-400 mb-0.5">행사장소</p>
              <p className="text-xl font-bold text-gray-900 whitespace-pre-line">{req.location}</p>
            </div>

            {/* 요청사항 */}
            <div className="mb-5">
              <p className="text-xs text-gray-400 mb-0.5">요청사항</p>
              {req.note ? (
                <p className="text-base text-gray-900">{req.note}</p>
              ) : null}
            </div>

            {/* Buttons */}
            <div className="flex gap-3 mb-4">
              <button className="flex-1 py-4 bg-[#3180F7] text-white rounded-2xl font-bold text-base">
                견적보내기
              </button>
              <button className="flex-1 py-4 bg-gray-100 text-gray-700 rounded-2xl font-bold text-base">
                보관
              </button>
            </div>

            {/* 행사장 길찾기 */}
            <a
              href={`https://map.naver.com/v5/search/${encodeURIComponent(req.location.replace('\n', ' '))}`}
              target="_blank"
              rel="noopener noreferrer"
              className="flex items-center justify-center gap-2"
            >
              <div className="w-7 h-7 rounded-full bg-[#03C75A] flex items-center justify-center shrink-0">
                <span className="text-white font-black text-sm leading-none">N</span>
              </div>
              <span className="text-sm font-medium text-gray-700">행사장 길찾기</span>
            </a>
          </div>
        ))}

        {/* 더보기 */}
        {hasMore && (
          <div className="flex justify-center pt-2 pb-4">
            <button
              onClick={() => setVisibleCount(prev => prev + PAGE_SIZE)}
              className="px-10 py-3 bg-gray-200 text-gray-600 rounded-full font-medium text-sm"
            >
              더보기
            </button>
          </div>
        )}
      </div>
    </div>
  );
}
