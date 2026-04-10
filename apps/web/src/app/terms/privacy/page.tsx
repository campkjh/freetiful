'use client';

import { useRouter } from 'next/navigation';
import { ChevronLeft } from 'lucide-react';

export default function PrivacyPolicyPage() {
  const router = useRouter();

  return (
    <div className="bg-white min-h-screen" style={{ letterSpacing: '-0.02em' }}>
      <div className="sticky top-0 z-10 bg-white border-b border-gray-100">
        <div className="flex items-center h-[52px] px-4">
          <button onClick={() => router.back()} className="p-1 -ml-1 active:scale-90 transition-transform">
            <ChevronLeft size={24} className="text-gray-900" />
          </button>
          <h1 className="text-[18px] font-bold text-gray-900 ml-1">개인정보 수집 및 이용약관</h1>
        </div>
      </div>

      <div className="px-4 py-6">
        <p className="text-[12px] text-gray-400 mb-6">마지막 업데이트 2026년 03월 22일</p>

        <div className="text-[13px] text-gray-600 leading-relaxed mb-6">
          <p>프리티풀(이하 &quot;회사&quot;)은 이용자의 개인정보 보호를 중요하게 생각하며, 관련 법령을 준수합니다.</p>
        </div>

        {/* 제1조 */}
        <Section
          title="제1조. 수집하는 개인정보 항목 및 수집 방법"
          subtitle="Article 1. Categories of Personal Information Collected and Methods of Collection"
        >
          <Ol items={[
            '회원가입 시: 이름, 이메일, 비밀번호, 휴대전화번호',
            '선택항목: 생년월일, 성별',
            '프리랜서 등록 시: 프로필 사진, 경력, 자기소개, 포트폴리오',
            '자동 수집: IP 주소, 접속 로그, 쿠키, 브라우저 정보, 기기 정보',
          ]} />
        </Section>

        {/* 제2조 */}
        <Section
          title="제2조. 개인정보의 이용 목적"
          subtitle="Article 2. Purpose of Using Personal Information"
        >
          <Ol items={[
            '회원가입 및 본인 인증',
            '고객과 프리랜서 간 매칭, 예약, 계약 체결 지원',
            '정산, 세금신고, 전자영수증 발행',
            '고객문의 응대 및 민원 처리',
            '법령 및 이용약관 위반 시 제재 조치',
            '서비스 품질 개선 및 통계 분석',
            '마케팅, 이벤트 및 광고성 정보 제공 (별도 동의 시)',
          ]} />
        </Section>

        {/* 제3조 */}
        <Section
          title="제3조. 개인정보 보유 및 이용 기간"
          subtitle="Article 3. Retention and Usage Period of Personal Information"
        >
          <table className="w-full mt-3 border border-gray-200 text-[13px]" style={{ borderRadius: 8, overflow: 'hidden' }}>
            <thead>
              <tr className="bg-gray-50">
                <th className="text-left px-3 py-2 font-bold text-gray-700 border-b border-gray-200">항목</th>
                <th className="text-left px-3 py-2 font-bold text-gray-700 border-b border-gray-200">보유 기간</th>
                <th className="text-left px-3 py-2 font-bold text-gray-700 border-b border-gray-200">근거 법령</th>
              </tr>
            </thead>
            <tbody>
              {[
                ['계약/청약철회/서비스 이용 기록', '5년', '전자상거래법'],
                ['대금 결제 및 재화 공급 기록', '5년', '전자상거래법'],
                ['소비자 불만/분쟁처리 기록', '3년', '전자상거래법'],
                ['전자금융 거래 기록', '5년', '전자금융거래법'],
                ['로그인 기록(IP 등)', '3개월', '통신비밀보호법'],
              ].map(([item, period, law], i) => (
                <tr key={i} className="border-b border-gray-100 last:border-0">
                  <td className="px-3 py-2 text-gray-900 font-medium">{item}</td>
                  <td className="px-3 py-2 text-gray-600">{period}</td>
                  <td className="px-3 py-2 text-gray-600">{law}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </Section>

        {/* 제4조 */}
        <Section
          title="제4조. 개인정보 제3자 제공"
          subtitle="Article 4. Provision of Personal Information to Third Parties"
        >
          <Ol items={[
            '법령에 의한 경우',
            '수사기관의 적법한 요청이 있는 경우',
            '이용자가 별도로 동의한 경우',
          ]} />
        </Section>

        {/* 제5조 */}
        <Section
          title="제5조. 개인정보 처리의 위탁"
          subtitle="Article 5. Entrustment of Personal Information Processing"
        >
          <table className="w-full mt-3 border border-gray-200 text-[13px]" style={{ borderRadius: 8, overflow: 'hidden' }}>
            <thead>
              <tr className="bg-gray-50">
                <th className="text-left px-3 py-2 font-bold text-gray-700 border-b border-gray-200 w-[140px]">수탁자</th>
                <th className="text-left px-3 py-2 font-bold text-gray-700 border-b border-gray-200">위탁 업무</th>
              </tr>
            </thead>
            <tbody>
              {[
                ['NHN Cloud 등', '문자/이메일 발송, 알림 및 본인 확인'],
                ['토스페이먼츠', '결제 및 정산'],
                ['Amazon Web Services 등', '서버 운영 및 데이터 저장'],
              ].map(([trustee, task], i) => (
                <tr key={i} className="border-b border-gray-100 last:border-0">
                  <td className="px-3 py-2 text-gray-900 font-medium">{trustee}</td>
                  <td className="px-3 py-2 text-gray-600">{task}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </Section>

        {/* 제6조 */}
        <Section
          title="제6조. 이용자의 권리 및 행사 방법"
          subtitle="Article 6. User Rights and How to Exercise Them"
        >
          <Ol items={[
            '열람, 정정, 삭제, 처리정지 요청 가능',
            '이메일 또는 고객센터를 통해 요청',
            '본인 확인 절차 후 지체 없이 처리',
          ]} />
        </Section>

        {/* 제7조 */}
        <Section
          title="제7조. 개인정보의 파기"
          subtitle="Article 7. Destruction of Personal Information"
        >
          <Ol items={[
            '전자적 파일: 복구 불가능한 기술로 영구 삭제',
            '종이 문서: 분쇄기 또는 소각 방식',
          ]} />
        </Section>

        {/* 제8조 */}
        <Section
          title="제8조. 개인정보의 보호 조치 (Google OAuth 포함)"
          subtitle="Article 8. Protective Measures for Personal Information (Including Google OAuth)"
        >
          <div className="space-y-3 mt-1">
            <div>
              <p className="font-bold text-gray-900 text-[13px] mb-1">8-1. 기술적 보호조치</p>
              <p>암호화 저장, HTTPS/SSL, OAuth 토큰 보호, 자동 로그아웃</p>
            </div>
            <div>
              <p className="font-bold text-gray-900 text-[13px] mb-1">8-2. 관리적 보호조치</p>
              <p>최소 접근 원칙, 정기 보안 점검, API 접근 통제</p>
            </div>
            <div>
              <p className="font-bold text-gray-900 text-[13px] mb-1">8-3. 물리적 보호조치</p>
              <p>클라우드 보안, 출입 통제</p>
            </div>
            <div>
              <p className="font-bold text-gray-900 text-[13px] mb-1">8-4. Google OAuth Limited Use 준수</p>
              <Notice text="회사는 Google API 서비스 사용 시 Google API Services User Data Policy(제한된 사용 요건 포함)를 준수합니다." />
            </div>
          </div>
        </Section>

        {/* 제9조 */}
        <Section
          title="제9조. 개인정보 보호책임자"
          subtitle="Article 9. Privacy Officer"
        >
          <div className="mt-1 space-y-1">
            <p>성명: 김정훈</p>
            <p>직위: 이사, 운영관리팀</p>
            <p>이메일: Jaicylab0110@gmail.com</p>
          </div>
        </Section>

        {/* 제10조 */}
        <Section
          title="제10조. 고지 및 변경"
          subtitle="Article 10. Notification and Changes"
        >
          <p>법령 또는 정책 변경 시 플랫폼 내 공지사항을 통해 안내합니다.</p>
        </Section>

        {/* 부칙 */}
        <div className="mt-6 pt-4 border-t border-gray-200">
          <p className="text-[13px] text-gray-400">부칙: 이 약관은 2026년 3월 22일부터 시행합니다.</p>
        </div>
      </div>
    </div>
  );
}

function Section({ title, subtitle, children }: { title: string; subtitle: string; children: React.ReactNode }) {
  return (
    <div className="mb-6">
      <h2 className="text-[15px] font-bold text-gray-900 mb-0.5">{title}</h2>
      <p className="text-[11px] text-gray-400 mb-2">{subtitle}</p>
      <div className="text-[13px] text-gray-600 leading-relaxed space-y-2">{children}</div>
    </div>
  );
}

function Ol({ items }: { items: string[] }) {
  return (
    <ol className="space-y-1.5 mt-1">
      {items.map((item, i) => (
        <li key={i} className="flex gap-2">
          <span className="text-gray-400 shrink-0">{i + 1}.</span>
          <span>{item}</span>
        </li>
      ))}
    </ol>
  );
}

function Notice({ text }: { text: string }) {
  return (
    <div className="mt-3 px-3 py-2.5 bg-gray-50 text-[12px] text-gray-500 leading-relaxed" style={{ borderRadius: 8 }}>
      {text}
    </div>
  );
}
