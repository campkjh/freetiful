'use client';

import { useState } from 'react';
import Link from 'next/link';
import {
  ArrowRight, Shield, BarChart3, Users, Building2,
  CheckCircle2, Star, ChevronRight, Award, Download,
  MapPin, Phone, Mail, Clock, Calendar, FileText,
  Send, User, Briefcase, Globe, Target, Heart,
} from 'lucide-react';

// ─── Company Info ─────────────────────────────────────────────
const COMPANY_INFO = {
  name: '주식회사 프리티풀',
  nameEn: 'Freetiful Inc.',
  ceo: '김정훈',
  established: '2024년 3월',
  business: '행사 전문가 매칭 플랫폼',
  employees: '15명',
  address: '서울특별시 강남구 테헤란로 123, 프리티풀 빌딩 8층',
  phone: '02-1234-5678',
  email: 'contact@freetiful.co.kr',
  website: 'www.freetiful.co.kr',
};

const HISTORY = [
  { year: '2026', events: ['AI 매칭 시스템 v2.0 출시', '누적 매칭 10,000건 달성', '시리즈 A 투자 유치'] },
  { year: '2025', events: ['모바일 앱 출시', '전문가 500명 등록', '부산/대구 지역 서비스 확대'] },
  { year: '2024', events: ['프리티풀 서비스 정식 런칭', '웨딩 MC 매칭 서비스 시작', '법인 설립'] },
];

const VALUES = [
  { icon: Target, title: '미션', desc: '모든 행사의 순간을 완벽하게 만드는 전문가 매칭 플랫폼' },
  { icon: Heart, title: '비전', desc: '대한민국 No.1 행사 전문가 플랫폼으로 성장' },
  { icon: Globe, title: '핵심가치', desc: '신뢰 · 전문성 · 혁신 · 고객중심' },
];

const FEATURES = [
  { icon: Users, title: '검증된 전문가 네트워크', desc: '엄격한 심사를 거친 MC, 가수, 쇼호스트', color: 'bg-primary-50 text-primary-500' },
  { icon: Shield, title: '안전한 에스크로 결제', desc: '행사 완료까지 결제금 안전 보호', color: 'bg-emerald-50 text-emerald-500' },
  { icon: BarChart3, title: 'AI 맞춤 매칭', desc: '조건 분석 기반 최적 전문가 추천', color: 'bg-violet-50 text-violet-500' },
  { icon: Award, title: '품질 보증', desc: '만족도 기반 전문가 등급 시스템', color: 'bg-amber-50 text-amber-500' },
];

const STATS = [
  { label: '누적 매칭', value: '10,000+', unit: '건' },
  { label: '등록 전문가', value: '500+', unit: '명' },
  { label: '고객 만족도', value: '4.9', unit: '/5.0' },
  { label: '재이용률', value: '92', unit: '%' },
];

const RESOURCES = [
  { title: '회사소개서', desc: '프리티풀 서비스 소개', icon: FileText, size: 'PDF · 5.2MB' },
  { title: 'CI 가이드라인', desc: '로고 및 브랜드 자산', icon: Download, size: 'ZIP · 12.8MB' },
  { title: '서비스 이용가이드', desc: '전문가 매칭 프로세스', icon: FileText, size: 'PDF · 3.1MB' },
  { title: '파트너 제안서', desc: '업체 제휴 안내', icon: Briefcase, size: 'PDF · 4.7MB' },
];

export default function BizPage() {
  const [activeTab, setActiveTab] = useState('company');
  const [formData, setFormData] = useState({
    company: '', name: '', phone: '', email: '', type: '', message: '',
  });
  const [formSubmitted, setFormSubmitted] = useState(false);

  const tabs = [
    { id: 'company', label: '회사소개' },
    { id: 'history', label: '연혁' },
    { id: 'resources', label: '자료실' },
    { id: 'contact', label: '오시는길' },
    { id: 'inquiry', label: '기업문의' },
  ];

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    setFormSubmitted(true);
    setTimeout(() => setFormSubmitted(false), 3000);
  };

  return (
    <div className="min-h-screen bg-white">
      {/* Header */}
      <div className="sticky top-0 z-10 bg-white border-b border-gray-100">
        <div className="px-4 py-4">
          <h1 className="text-[22px] font-bold text-gray-900">Freetiful</h1>
          <p className="text-[13px] text-gray-400 mt-0.5">행사 전문가 매칭 플랫폼</p>
        </div>
        {/* Tab Navigation */}
        <div className="flex overflow-x-auto scrollbar-hide px-4 pb-0 gap-1">
          {tabs.map((tab) => (
            <button
              key={tab.id}
              onClick={() => setActiveTab(tab.id)}
              className={`shrink-0 text-[13px] font-semibold px-4 py-2.5 border-b-2 transition-all ${
                activeTab === tab.id
                  ? 'border-primary-500 text-primary-500'
                  : 'border-transparent text-gray-400 hover:text-gray-600'
              }`}
            >
              {tab.label}
            </button>
          ))}
        </div>
      </div>

      {/* ─── 회사소개 Tab ─────────────────────────────────────── */}
      {activeTab === 'company' && (
        <div className="px-4 py-6 space-y-8">
          {/* Hero */}
          <div className="text-center py-8">
            <div className="w-16 h-16 bg-primary-50 rounded-2xl flex items-center justify-center mx-auto mb-4">
              <Building2 size={32} className="text-primary-500" />
            </div>
            <h2 className="text-[24px] font-bold text-gray-900 mb-2">프리티풀</h2>
            <p className="text-[15px] text-gray-500 leading-relaxed">
              모든 행사의 순간을<br />완벽하게 만드는 전문가 매칭 플랫폼
            </p>
          </div>

          {/* CEO 인사말 */}
          <div className="bg-gray-50 rounded-2xl p-5">
            <h3 className="text-[16px] font-bold text-gray-900 mb-3">CEO 인사말</h3>
            <div className="flex gap-4">
              <div className="w-16 h-16 rounded-full bg-primary-100 flex items-center justify-center shrink-0">
                <User size={28} className="text-primary-500" />
              </div>
              <div>
                <p className="text-[14px] text-gray-600 leading-relaxed mb-2">
                  프리티풀은 모든 분의 특별한 순간을 더욱 빛나게 만들어 드리기 위해 탄생했습니다.
                  검증된 전문가와 AI 기반 맞춤 매칭으로, 최고의 행사 경험을 약속드립니다.
                </p>
                <p className="text-[13px] font-semibold text-gray-900">대표이사 {COMPANY_INFO.ceo}</p>
              </div>
            </div>
          </div>

          {/* Mission / Vision / Values */}
          <div className="space-y-3">
            {VALUES.map((v) => (
              <div key={v.title} className="flex items-start gap-3 p-4 bg-white border border-gray-100 rounded-2xl">
                <div className="w-10 h-10 rounded-xl bg-primary-50 flex items-center justify-center shrink-0">
                  <v.icon size={20} className="text-primary-500" />
                </div>
                <div>
                  <h4 className="text-[14px] font-bold text-gray-900">{v.title}</h4>
                  <p className="text-[13px] text-gray-500 mt-0.5">{v.desc}</p>
                </div>
              </div>
            ))}
          </div>

          {/* Stats */}
          <div className="grid grid-cols-2 gap-3">
            {STATS.map((s) => (
              <div key={s.label} className="bg-gray-50 rounded-2xl p-4 text-center">
                <p className="text-[24px] font-bold text-primary-500">{s.value}<span className="text-[14px] text-gray-400">{s.unit}</span></p>
                <p className="text-[12px] text-gray-500 mt-1">{s.label}</p>
              </div>
            ))}
          </div>

          {/* Features */}
          <div>
            <h3 className="text-[16px] font-bold text-gray-900 mb-3">핵심 서비스</h3>
            <div className="grid grid-cols-2 gap-3">
              {FEATURES.map((f) => (
                <div key={f.title} className="p-4 bg-white border border-gray-100 rounded-2xl">
                  <div className={`w-10 h-10 rounded-xl ${f.color} flex items-center justify-center mb-3`}>
                    <f.icon size={20} />
                  </div>
                  <h4 className="text-[13px] font-bold text-gray-900">{f.title}</h4>
                  <p className="text-[11px] text-gray-400 mt-1">{f.desc}</p>
                </div>
              ))}
            </div>
          </div>

          {/* Company Info Table */}
          <div>
            <h3 className="text-[16px] font-bold text-gray-900 mb-3">기업 정보</h3>
            <div className="border border-gray-100 rounded-2xl overflow-hidden">
              {[
                ['회사명', COMPANY_INFO.name],
                ['영문명', COMPANY_INFO.nameEn],
                ['대표이사', COMPANY_INFO.ceo],
                ['설립일', COMPANY_INFO.established],
                ['사업분야', COMPANY_INFO.business],
                ['임직원수', COMPANY_INFO.employees],
                ['주소', COMPANY_INFO.address],
                ['대표전화', COMPANY_INFO.phone],
                ['이메일', COMPANY_INFO.email],
              ].map(([label, value], i) => (
                <div key={label} className={`flex px-4 py-3 ${i > 0 ? 'border-t border-gray-50' : ''}`}>
                  <span className="text-[13px] font-semibold text-gray-500 w-[80px] shrink-0">{label}</span>
                  <span className="text-[13px] text-gray-900 flex-1">{value}</span>
                </div>
              ))}
            </div>
          </div>
        </div>
      )}

      {/* ─── 연혁 Tab ─────────────────────────────────────────── */}
      {activeTab === 'history' && (
        <div className="px-4 py-6">
          <h2 className="text-[20px] font-bold text-gray-900 mb-6">연혁</h2>
          <div className="relative">
            {/* Timeline line */}
            <div className="absolute left-[18px] top-2 bottom-2 w-[2px] bg-gray-100" />
            <div className="space-y-8">
              {HISTORY.map((h) => (
                <div key={h.year} className="relative pl-12">
                  {/* Dot */}
                  <div className="absolute left-[12px] top-1 w-[14px] h-[14px] rounded-full bg-primary-500 border-[3px] border-white shadow-sm" />
                  <h3 className="text-[18px] font-bold text-primary-500 mb-3">{h.year}</h3>
                  <div className="space-y-2">
                    {h.events.map((event, i) => (
                      <div key={i} className="flex items-center gap-2">
                        <CheckCircle2 size={14} className="text-emerald-500 shrink-0" />
                        <span className="text-[14px] text-gray-700">{event}</span>
                      </div>
                    ))}
                  </div>
                </div>
              ))}
            </div>
          </div>
        </div>
      )}

      {/* ─── 자료실 Tab ───────────────────────────────────────── */}
      {activeTab === 'resources' && (
        <div className="px-4 py-6">
          <h2 className="text-[20px] font-bold text-gray-900 mb-2">자료실</h2>
          <p className="text-[13px] text-gray-400 mb-6">프리티풀의 공식 자료를 다운로드하세요</p>
          <div className="space-y-3">
            {RESOURCES.map((r) => (
              <button
                key={r.title}
                className="w-full flex items-center gap-4 p-4 bg-white border border-gray-100 rounded-2xl text-left hover:bg-gray-50 active:scale-[0.98] transition-all"
              >
                <div className="w-12 h-12 rounded-xl bg-primary-50 flex items-center justify-center shrink-0">
                  <r.icon size={22} className="text-primary-500" />
                </div>
                <div className="flex-1 min-w-0">
                  <h4 className="text-[14px] font-bold text-gray-900">{r.title}</h4>
                  <p className="text-[12px] text-gray-400 mt-0.5">{r.desc}</p>
                </div>
                <div className="text-right shrink-0">
                  <Download size={18} className="text-gray-400 mb-1" />
                  <p className="text-[10px] text-gray-400">{r.size}</p>
                </div>
              </button>
            ))}
          </div>
        </div>
      )}

      {/* ─── 오시는길 Tab ─────────────────────────────────────── */}
      {activeTab === 'contact' && (
        <div className="px-4 py-6 space-y-6">
          <h2 className="text-[20px] font-bold text-gray-900 mb-2">오시는길</h2>

          {/* Map placeholder */}
          <div className="w-full h-[200px] bg-gray-100 rounded-2xl flex items-center justify-center">
            <div className="text-center">
              <MapPin size={32} className="text-gray-300 mx-auto mb-2" />
              <p className="text-[13px] text-gray-400">지도 영역</p>
            </div>
          </div>

          {/* Address info */}
          <div className="space-y-3">
            {[
              { icon: MapPin, label: '주소', value: COMPANY_INFO.address },
              { icon: Phone, label: '대표전화', value: COMPANY_INFO.phone },
              { icon: Mail, label: '이메일', value: COMPANY_INFO.email },
              { icon: Clock, label: '업무시간', value: '평일 09:00 - 18:00 (주말/공휴일 휴무)' },
            ].map((item) => (
              <div key={item.label} className="flex items-start gap-3 p-3 bg-gray-50 rounded-xl">
                <item.icon size={18} className="text-primary-500 mt-0.5 shrink-0" />
                <div>
                  <p className="text-[12px] font-semibold text-gray-500">{item.label}</p>
                  <p className="text-[14px] text-gray-900 mt-0.5">{item.value}</p>
                </div>
              </div>
            ))}
          </div>

          {/* Directions */}
          <div className="bg-gray-50 rounded-2xl p-4">
            <h3 className="text-[14px] font-bold text-gray-900 mb-3">교통편 안내</h3>
            <div className="space-y-2 text-[13px] text-gray-600">
              <p><span className="font-semibold text-blue-500">🚇 지하철</span> 2호선 강남역 3번 출구 도보 5분</p>
              <p><span className="font-semibold text-green-500">🚌 버스</span> 강남역 정류장 하차 (146, 341, 360)</p>
              <p><span className="font-semibold text-gray-500">🅿️ 주차</span> 건물 지하 주차장 이용 (2시간 무료)</p>
            </div>
          </div>
        </div>
      )}

      {/* ─── 기업문의 Tab ─────────────────────────────────────── */}
      {activeTab === 'inquiry' && (
        <div className="px-4 py-6">
          <h2 className="text-[20px] font-bold text-gray-900 mb-2">기업문의</h2>
          <p className="text-[13px] text-gray-400 mb-6">제휴, 대량 의뢰, 기업 행사 등 문의해 주세요</p>

          {formSubmitted ? (
            <div className="text-center py-16">
              <div className="w-16 h-16 bg-emerald-50 rounded-full flex items-center justify-center mx-auto mb-4">
                <CheckCircle2 size={32} className="text-emerald-500" />
              </div>
              <h3 className="text-[18px] font-bold text-gray-900 mb-2">문의가 접수되었습니다</h3>
              <p className="text-[14px] text-gray-500">영업일 기준 1~2일 내 담당자가 연락드리겠습니다</p>
            </div>
          ) : (
            <form onSubmit={handleSubmit} className="space-y-4">
              {/* 회사명 */}
              <div>
                <label className="text-[13px] font-semibold text-gray-700 block mb-1.5">회사명 *</label>
                <input
                  type="text"
                  required
                  placeholder="회사명을 입력해 주세요"
                  value={formData.company}
                  onChange={(e) => setFormData({ ...formData, company: e.target.value })}
                  className="w-full h-[44px] bg-gray-50 rounded-xl px-4 text-[14px] text-gray-900 placeholder-gray-400 outline-none focus:ring-2 focus:ring-primary-200 border border-gray-100"
                />
              </div>

              {/* 담당자명 */}
              <div>
                <label className="text-[13px] font-semibold text-gray-700 block mb-1.5">담당자명 *</label>
                <input
                  type="text"
                  required
                  placeholder="담당자 성함을 입력해 주세요"
                  value={formData.name}
                  onChange={(e) => setFormData({ ...formData, name: e.target.value })}
                  className="w-full h-[44px] bg-gray-50 rounded-xl px-4 text-[14px] text-gray-900 placeholder-gray-400 outline-none focus:ring-2 focus:ring-primary-200 border border-gray-100"
                />
              </div>

              {/* 연락처 / 이메일 */}
              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className="text-[13px] font-semibold text-gray-700 block mb-1.5">연락처 *</label>
                  <input
                    type="tel"
                    required
                    placeholder="010-0000-0000"
                    value={formData.phone}
                    onChange={(e) => setFormData({ ...formData, phone: e.target.value })}
                    className="w-full h-[44px] bg-gray-50 rounded-xl px-4 text-[14px] text-gray-900 placeholder-gray-400 outline-none focus:ring-2 focus:ring-primary-200 border border-gray-100"
                  />
                </div>
                <div>
                  <label className="text-[13px] font-semibold text-gray-700 block mb-1.5">이메일 *</label>
                  <input
                    type="email"
                    required
                    placeholder="email@company.com"
                    value={formData.email}
                    onChange={(e) => setFormData({ ...formData, email: e.target.value })}
                    className="w-full h-[44px] bg-gray-50 rounded-xl px-4 text-[14px] text-gray-900 placeholder-gray-400 outline-none focus:ring-2 focus:ring-primary-200 border border-gray-100"
                  />
                </div>
              </div>

              {/* 문의유형 */}
              <div>
                <label className="text-[13px] font-semibold text-gray-700 block mb-1.5">문의유형</label>
                <select
                  value={formData.type}
                  onChange={(e) => setFormData({ ...formData, type: e.target.value })}
                  className="w-full h-[44px] bg-gray-50 rounded-xl px-4 text-[14px] text-gray-900 outline-none focus:ring-2 focus:ring-primary-200 border border-gray-100"
                >
                  <option value="">선택해 주세요</option>
                  <option value="partnership">제휴 문의</option>
                  <option value="enterprise">기업 행사 의뢰</option>
                  <option value="bulk">대량 의뢰</option>
                  <option value="advertisement">광고/마케팅</option>
                  <option value="other">기타</option>
                </select>
              </div>

              {/* 문의내용 */}
              <div>
                <label className="text-[13px] font-semibold text-gray-700 block mb-1.5">문의내용 *</label>
                <textarea
                  required
                  rows={5}
                  placeholder="문의 내용을 상세히 작성해 주세요"
                  value={formData.message}
                  onChange={(e) => setFormData({ ...formData, message: e.target.value })}
                  className="w-full bg-gray-50 rounded-xl px-4 py-3 text-[14px] text-gray-900 placeholder-gray-400 outline-none focus:ring-2 focus:ring-primary-200 border border-gray-100 resize-none"
                />
              </div>

              {/* Submit */}
              <button
                type="submit"
                className="w-full h-[48px] bg-primary-500 text-white text-[15px] font-bold rounded-xl hover:bg-primary-600 active:scale-[0.98] transition-all flex items-center justify-center gap-2"
              >
                <Send size={18} />
                문의하기
              </button>

              <p className="text-[11px] text-gray-400 text-center">
                문의 접수 후 영업일 기준 1~2일 내 담당자가 연락드립니다
              </p>
            </form>
          )}
        </div>
      )}
    </div>
  );
}
