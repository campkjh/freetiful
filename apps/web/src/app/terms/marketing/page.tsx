'use client';

import { useRouter } from 'next/navigation';
import { ChevronLeft } from 'lucide-react';

export default function MarketingConsentPage() {
  const router = useRouter();

  return (
    <div className="bg-white min-h-screen" style={{ letterSpacing: '-0.02em' }}>
      <div className="sticky top-0 z-10 bg-white border-b border-gray-100">
        <div className="flex items-center h-[52px] px-4">
          <button onClick={() => router.back()} className="p-1 -ml-1 active:scale-90 transition-transform">
            <ChevronLeft size={24} className="text-gray-900" />
          </button>
          <h1 className="text-[18px] font-bold text-gray-900 ml-1">마케팅 정보 수신동의</h1>
        </div>
      </div>

      <div className="px-4 py-6">
        <p className="text-[12px] text-gray-400 mb-6">마지막 업데이트 2026년 03월 22일</p>

        <div className="text-[13px] text-gray-600 leading-relaxed mb-6">
          <p>프리티풀(이하 &quot;회사&quot;)은 이용자에게 다양한 마케팅 정보를 제공하기 위하여 아래와 같이 개인정보를 수집·이용하고자 합니다. 내용을 확인하신 후 동의 여부를 결정하여 주시기 바랍니다.</p>
        </div>

        {/* 수집항목 */}
        <Section
          title="1. 수집항목"
          subtitle="Items Collected"
        >
          <Ol items={[
            '이름',
            '이메일 주소',
            '휴대전화번호',
          ]} />
        </Section>

        {/* 이용목적 */}
        <Section
          title="2. 이용목적"
          subtitle="Purpose of Use"
        >
          <Ol items={[
            '신규 서비스 및 이벤트 안내',
            '할인 쿠폰 및 프로모션 혜택 제공',
            '맞춤형 광고 및 콘텐츠 추천',
            '프로모션 참여 안내 및 결과 통보',
            '서비스 업데이트 및 기능 개선 소식 전달',
          ]} />
        </Section>

        {/* 수신채널 */}
        <Section
          title="3. 수신채널"
          subtitle="Communication Channels"
        >
          <table className="w-full mt-3 border border-gray-200 text-[13px]" style={{ borderRadius: 8, overflow: 'hidden' }}>
            <thead>
              <tr className="bg-gray-50">
                <th className="text-left px-3 py-2 font-bold text-gray-700 border-b border-gray-200 w-[120px]">수신 채널</th>
                <th className="text-left px-3 py-2 font-bold text-gray-700 border-b border-gray-200">수신 내용</th>
              </tr>
            </thead>
            <tbody>
              {[
                ['앱 푸시', '이벤트·프로모션 알림, 할인 쿠폰 안내, 맞춤 추천'],
                ['SMS / MMS', '이벤트 참여 안내, 한정 할인 쿠폰 발송, 서비스 소식'],
                ['이메일', '뉴스레터, 월간 혜택 안내, 신규 서비스 소개, 프로모션'],
                ['카카오 알림톡', '이벤트 당첨 안내, 쿠폰 발급 알림, 맞춤형 혜택 안내'],
              ].map(([channel, content], i) => (
                <tr key={i} className="border-b border-gray-100 last:border-0">
                  <td className="px-3 py-2 text-gray-900 font-medium">{channel}</td>
                  <td className="px-3 py-2 text-gray-600">{content}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </Section>

        {/* 보유기간 */}
        <Section
          title="4. 보유 및 이용 기간"
          subtitle="Retention Period"
        >
          <Ol items={[
            '동의 철회 시까지 보유·이용합니다.',
            '별도의 철회 요청이 없는 경우, 동의일로부터 2년간 보유하며, 이후 재동의를 요청합니다.',
            '재동의를 하지 않는 경우 해당 개인정보를 지체 없이 파기합니다.',
            '관련 법령에 따라 보존이 필요한 경우 해당 기간 동안 보관합니다.',
          ]} />
        </Section>

        {/* 동의 거부 권리 */}
        <Section
          title="5. 동의 거부 권리"
          subtitle="Right to Refuse Consent"
        >
          <div className="space-y-2 mt-1">
            <p>이용자는 마케팅 정보 수신에 대한 동의를 거부할 권리가 있습니다.</p>
            <p>마케팅 수신 동의는 <span className="font-bold text-gray-900">선택사항</span>이며, 동의를 거부하더라도 회사가 제공하는 기본 서비스(회원가입, 예약, 결제 등)의 이용에는 어떠한 제한도 없습니다.</p>
            <p>다만, 동의를 거부하신 경우 각종 이벤트, 할인 혜택, 프로모션 등의 유익한 정보를 받아보실 수 없습니다.</p>
          </div>
        </Section>

        {/* 수신 거부 방법 */}
        <Section
          title="6. 수신 거부 방법"
          subtitle="How to Opt Out"
        >
          <Ol items={[
            '앱 내 [마이페이지] > [알림 설정]에서 마케팅 수신을 해제할 수 있습니다.',
            '고객센터(이메일: Jaicylab0110@gmail.com)를 통해 수신 거부를 요청할 수 있습니다.',
            'SMS/MMS 수신 시 문자 내 포함된 수신거부 링크를 통해 즉시 해제할 수 있습니다.',
            '이메일 하단의 &quot;수신거부&quot; 링크를 클릭하여 해제할 수 있습니다.',
            '수신 거부 처리는 요청일로부터 최대 3영업일 이내에 완료됩니다.',
          ]} />
        </Section>

        {/* 안내사항 */}
        <Section
          title="7. 기타 안내사항"
          subtitle="Additional Information"
        >
          <div className="space-y-2 mt-1">
            <p>마케팅 수신 동의와 관련한 개인정보 처리에 관한 상세한 사항은 회사의 「개인정보 수집 및 이용약관」을 참고하여 주시기 바랍니다.</p>
            <p>마케팅 수신 동의 후에도 관련 법령에 따른 거래 관련 정보(결제 완료, 예약 확인, 서비스 변경 공지 등)는 수신 동의 여부와 관계없이 발송될 수 있습니다.</p>
          </div>
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
