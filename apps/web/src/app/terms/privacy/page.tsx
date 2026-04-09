'use client';

import { ArrowLeft } from 'lucide-react';
import { useRouter } from 'next/navigation';

export default function PrivacyPolicyPage() {
  const router = useRouter();

  return (
    <div className="bg-white min-h-screen max-w-lg mx-auto">
      <div className="flex items-center px-4 h-14 border-b border-gray-100 sticky top-0 bg-white z-10">
        <button onClick={() => router.back()} className="p-1"><ArrowLeft size={22} /></button>
        <h1 className="text-base font-bold ml-3">개인정보처리방침</h1>
      </div>
      <div className="px-4 py-6 text-sm text-gray-700 leading-relaxed space-y-4">
        <h2 className="font-bold text-base text-gray-900">1. 개인정보의 수집 및 이용 목적</h2>
        <p>회사는 다음의 목적을 위해 개인정보를 처리합니다:</p>
        <ul className="list-disc pl-5 space-y-1">
          <li>회원 가입 및 관리: 회원제 서비스 이용에 따른 본인확인, 회원자격 유지·관리</li>
          <li>서비스 제공: 전문가 매칭, 견적 발송, 결제 처리, 채팅 서비스 제공</li>
          <li>마케팅 및 광고: 이벤트 정보 및 참여기회 제공, 서비스 이용 통계</li>
        </ul>

        <h2 className="font-bold text-base text-gray-900">2. 수집하는 개인정보 항목</h2>
        <p><strong>필수항목:</strong> 이름, 이메일, 휴대폰번호, 비밀번호(이메일 가입 시)</p>
        <p><strong>선택항목:</strong> 프로필 이미지, 결혼 예정일, 행사 장소</p>
        <p><strong>자동수집:</strong> IP주소, 서비스 이용 기록, 접속 로그, 쿠키</p>

        <h2 className="font-bold text-base text-gray-900">3. 개인정보의 보유 및 이용 기간</h2>
        <p>회원 탈퇴 시까지 보유하며, 관련 법령에 따라 일정 기간 보존이 필요한 경우 해당 기간 동안 보관합니다.</p>
        <ul className="list-disc pl-5 space-y-1">
          <li>계약 또는 청약 철회: 5년 (전자상거래법)</li>
          <li>대금결제 및 재화 공급: 5년 (전자상거래법)</li>
          <li>소비자 불만 또는 분쟁 처리: 3년 (전자상거래법)</li>
          <li>접속 기록: 3개월 (통신비밀보호법)</li>
        </ul>

        <h2 className="font-bold text-base text-gray-900">4. 개인정보의 제3자 제공</h2>
        <p>회사는 원칙적으로 회원의 개인정보를 외부에 제공하지 않습니다. 다만, 회원의 동의가 있거나 법률에 특별한 규정이 있는 경우에 한해 제공할 수 있습니다.</p>

        <h2 className="font-bold text-base text-gray-900">5. 개인정보의 파기</h2>
        <p>개인정보 보유기간의 경과, 처리목적 달성 등 개인정보가 불필요하게 되었을 때에는 지체없이 해당 개인정보를 파기합니다.</p>

        <h2 className="font-bold text-base text-gray-900">6. 이용자의 권리</h2>
        <p>이용자는 언제든지 개인정보 열람, 정정, 삭제, 처리정지 요구 등의 권리를 행사할 수 있습니다.</p>

        <h2 className="font-bold text-base text-gray-900">7. 개인정보 보호책임자</h2>
        <p>성명: 김프리티 / 직위: 개인정보보호팀장</p>
        <p>이메일: privacy@freetiful.co.kr</p>

        <p className="text-gray-400 text-xs pt-6">시행일: 2026년 1월 1일</p>
      </div>
    </div>
  );
}
