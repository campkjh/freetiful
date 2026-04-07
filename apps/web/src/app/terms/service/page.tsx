'use client';

import { ArrowLeft } from 'lucide-react';
import { useRouter } from 'next/navigation';

export default function ServiceTermsPage() {
  const router = useRouter();

  return (
    <div className="bg-white min-h-screen max-w-lg mx-auto">
      <div className="flex items-center px-4 h-14 border-b border-gray-100 sticky top-0 bg-white z-10">
        <button onClick={() => router.back()} className="p-1"><ArrowLeft size={22} /></button>
        <h1 className="text-base font-bold ml-3">서비스 이용약관</h1>
      </div>
      <div className="px-4 py-6 text-sm text-gray-700 leading-relaxed space-y-4">
        <h2 className="font-bold text-base text-gray-900">제1조 (목적)</h2>
        <p>이 약관은 프리티풀(이하 &quot;회사&quot;)이 제공하는 웨딩 전문가 매칭 서비스(이하 &quot;서비스&quot;)의 이용과 관련하여 회사와 회원 간의 권리, 의무 및 책임사항을 규정함을 목적으로 합니다.</p>

        <h2 className="font-bold text-base text-gray-900">제2조 (정의)</h2>
        <p>1. &quot;회원&quot;이란 본 약관에 동의하고 회사가 제공하는 서비스를 이용하는 자를 말합니다.</p>
        <p>2. &quot;전문가 회원&quot;이란 회사의 심사를 거쳐 서비스를 통해 전문 서비스를 제공하는 회원을 말합니다.</p>
        <p>3. &quot;견적&quot;이란 전문가 회원이 일반 회원의 요청에 따라 서비스 제공 조건과 금액을 제안하는 것을 말합니다.</p>

        <h2 className="font-bold text-base text-gray-900">제3조 (약관의 효력)</h2>
        <p>본 약관은 서비스를 이용하고자 하는 모든 회원에 대해 그 효력이 발생합니다. 회사는 필요한 경우 약관을 변경할 수 있으며, 변경된 약관은 서비스 내 공지 후 7일이 경과한 때부터 효력이 발생합니다.</p>

        <h2 className="font-bold text-base text-gray-900">제4조 (서비스의 제공)</h2>
        <p>회사는 다음과 같은 서비스를 제공합니다:</p>
        <ul className="list-disc pl-5 space-y-1">
          <li>웨딩 전문가 검색 및 프로필 열람</li>
          <li>견적 요청 및 매칭 서비스</li>
          <li>채팅을 통한 상담 서비스</li>
          <li>결제 및 에스크로 서비스</li>
          <li>리뷰 및 평가 서비스</li>
        </ul>

        <h2 className="font-bold text-base text-gray-900">제5조 (회원가입)</h2>
        <p>서비스 이용을 희망하는 자는 회사가 정한 가입 양식에 따라 회원정보를 기입한 후 본 약관에 동의함으로써 회원가입을 신청합니다.</p>

        <h2 className="font-bold text-base text-gray-900">제6조 (결제 및 환불)</h2>
        <p>1. 서비스 이용에 따른 결제는 회사가 지정한 결제 수단을 통해 이루어집니다.</p>
        <p>2. 에스크로 방식으로 결제가 진행되며, 서비스 완료 확인 후 전문가에게 정산됩니다.</p>
        <p>3. 환불은 서비스 시작 전까지 전액 환불이 가능하며, 서비스 시작 후에는 회사의 환불 정책에 따릅니다.</p>

        <p className="text-gray-400 text-xs pt-6">시행일: 2026년 1월 1일</p>
      </div>
    </div>
  );
}
