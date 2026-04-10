'use client';

import { useRouter } from 'next/navigation';
import { ChevronLeft } from 'lucide-react';

export default function ElectronicFinancePage() {
  const router = useRouter();

  return (
    <div className="bg-white min-h-screen" style={{ letterSpacing: '-0.02em' }}>
      <div className="sticky top-0 z-10 bg-white border-b border-gray-100">
        <div className="flex items-center h-[52px] px-4">
          <button onClick={() => router.back()} className="p-1 -ml-1 active:scale-90 transition-transform">
            <ChevronLeft size={24} className="text-gray-900" />
          </button>
          <h1 className="text-[18px] font-bold text-gray-900 ml-1">전자금융거래 이용약관</h1>
        </div>
      </div>

      <div className="px-4 py-6">
        <p className="text-[12px] text-gray-400 mb-6">마지막 업데이트 2026년 03월 22일</p>

        <div className="text-[13px] text-gray-600 leading-relaxed mb-6">
          <p>프리티풀(이하 &quot;회사&quot;)은 「전자금융거래법」 및 관련 법령에 따라 전자금융거래의 안전성과 신뢰성을 확보하고, 이용자의 권익을 보호하기 위하여 본 약관을 제정합니다.</p>
        </div>

        {/* 제1조 */}
        <Section
          title="제1조. 목적"
          subtitle="Article 1. Purpose"
        >
          <p>이 약관은 회사가 제공하는 전자금융거래 서비스(이하 &quot;서비스&quot;)를 이용함에 있어 회사와 이용자 간의 권리, 의무 및 책임사항, 기타 필요한 사항을 정함을 목적으로 합니다.</p>
        </Section>

        {/* 제2조 */}
        <Section
          title="제2조. 정의"
          subtitle="Article 2. Definitions"
        >
          <Ol items={[
            '"전자금융거래"란 회사가 전자적 장치를 통하여 금융상품 및 서비스를 제공하고 이용자가 이를 이용하는 거래를 말합니다.',
            '"전자지급수단"이란 전자자금이체, 직불전자지급수단, 선불전자지급수단, 전자화폐, 신용카드 등 전자적 방법으로 재화 또는 용역의 대가를 지급하는 수단을 말합니다.',
            '"접근매체"란 전자금융거래에 있어서 거래지시를 하거나 이용자 및 거래 내용의 진실성과 정확성을 확보하기 위하여 사용되는 수단 또는 정보를 말하며, 전자식 카드, 비밀번호, 생체인증 정보, 전자서명 등을 포함합니다.',
            '"거래지시"란 이용자가 전자금융거래 계약에 따라 회사에 대하여 전자금융거래의 처리를 지시하는 것을 말합니다.',
            '"이용자"란 전자금융거래를 위하여 회사와 체결한 계약에 따라 전자금융거래를 이용하는 자를 말합니다.',
          ]} />
        </Section>

        {/* 제3조 */}
        <Section
          title="제3조. 전자지급결제대행 서비스"
          subtitle="Article 3. Electronic Payment Gateway Services"
        >
          <Ol items={[
            '회사는 전자지급결제대행(PG) 서비스를 통해 이용자가 재화 또는 용역의 대가를 지급할 수 있도록 합니다.',
            '회사는 토스페이먼츠 등 전자결제 대행업체(PG사)를 통하여 신용카드, 계좌이체, 가상계좌, 간편결제 등의 결제수단을 제공합니다.',
            '에스크로(Escrow) 결제의 경우, 이용자가 서비스 이용을 확인한 후 대금이 프리랜서에게 지급됩니다. 이용자의 구매 확인 또는 자동 구매 확인 기간(서비스 완료 후 7일) 경과 시 대금이 정산됩니다.',
            '회사는 결제 과정에서 발생하는 개인정보를 「개인정보 보호법」 및 관련 법령에 따라 보호합니다.',
            '전자지급결제대행 서비스의 이용과 관련하여 회사는 이용자에게 결제 수단별 이용 한도, 수수료 등을 사전에 고지합니다.',
          ]} />
        </Section>

        {/* 제4조 */}
        <Section
          title="제4조. 접근매체의 관리"
          subtitle="Article 4. Management of Access Media"
        >
          <Ol items={[
            '회사는 전자금융거래를 위한 접근매체를 선정하여 이용자에게 발급하며, 접근매체의 발급 시 이용자의 신원을 확인합니다.',
            '이용자는 접근매체를 제3자에게 대여하거나 양도 또는 담보 목적으로 이용하여서는 안 됩니다.',
            '이용자는 접근매체의 분실, 도난, 위조, 변조 사실을 알게 된 경우 지체 없이 회사에 통지하여야 합니다.',
            '회사는 이용자의 비밀번호를 암호화하여 저장·관리하며, 비밀번호의 확인·변경은 이용자 본인만 가능합니다.',
            '회사는 이용자의 거래 안전을 위하여 본인 인증(SMS, 이메일, 생체인증 등) 절차를 운영합니다.',
            '이용자는 비밀번호를 정기적으로 변경하고, 타인이 추측하기 어려운 조합으로 설정하여야 합니다.',
          ]} />
        </Section>

        {/* 제5조 */}
        <Section
          title="제5조. 거래내역의 확인"
          subtitle="Article 5. Confirmation of Transaction Records"
        >
          <Ol items={[
            '회사는 이용자가 전자금융거래의 내역을 확인할 수 있도록 거래내역 조회 기능을 제공합니다.',
            '이용자는 서비스 내 결제 내역 화면에서 거래일시, 거래유형, 금액, 상대방 정보 등을 조회할 수 있습니다.',
            '회사는 「전자금융거래법」 제22조에 따라 전자금융거래에 관한 기록을 거래일로부터 5년간 보존합니다.',
            '보존하는 기록의 범위는 거래계좌의 명칭 또는 번호, 거래의 종류 및 금액, 거래 상대방에 관한 정보, 거래일시, 전자적 장치의 접속 기록, 해당 전자금융거래와 관련한 전자적 장치의 종류와 정보를 포함합니다.',
            '이용자가 서면으로 거래내역의 제공을 요청한 경우, 회사는 2주 이내에 해당 내역을 서면으로 제공합니다.',
          ]} />
        </Section>

        {/* 제6조 */}
        <Section
          title="제6조. 오류의 정정"
          subtitle="Article 6. Correction of Errors"
        >
          <Ol items={[
            '이용자는 전자금융거래에 오류가 있음을 안 때에는 해당 거래일로부터 30일 이내에 회사에 이의를 제기할 수 있습니다.',
            '회사는 이용자의 이의제기를 접수한 날로부터 15일 이내에 조사하여 그 결과를 이용자에게 통지합니다.',
            '조사에 시일이 소요되는 경우, 회사는 이용자에게 그 사유와 처리 예정 기한을 사전에 안내합니다.',
            '오류가 회사의 귀책사유로 발생한 경우, 회사는 지체 없이 해당 오류를 정정하고, 이용자에게 발생한 손해를 배상합니다.',
            '이용자의 귀책사유로 오류가 발생한 경우에도 회사는 이용자에게 그 원인과 처리 결과를 성실히 안내합니다.',
          ]} />
        </Section>

        {/* 제7조 */}
        <Section
          title="제7조. 회사의 책임"
          subtitle="Article 7. Liability of the Company"
        >
          <Ol items={[
            '접근매체의 위조나 변조로 발생한 사고에 대하여 이용자의 고의 또는 중과실이 없는 한 회사가 책임을 부담합니다.',
            '계약 체결 또는 거래지시의 전자적 전송이나 처리 과정에서 발생한 사고에 대하여 회사가 책임을 부담합니다.',
            '전자금융거래를 위한 전자적 장치 또는 「정보통신망 이용촉진 및 정보보호 등에 관한 법률」 제2조 제1항 제1호에 따른 정보통신망에 침입하여 거짓이나 그 밖의 부정한 방법으로 획득한 접근매체의 이용으로 발생한 사고에 대하여 회사가 책임을 부담합니다.',
            '회사의 시스템 장애, 전산 오류 등으로 인하여 이용자에게 손해가 발생한 경우 회사가 이를 배상합니다.',
            '다만, 천재지변, 전시, 사변 등 불가항력적 사유로 인한 경우에는 회사의 책임이 감면될 수 있습니다.',
          ]} />
        </Section>

        {/* 제8조 */}
        <Section
          title="제8조. 이용자의 책임"
          subtitle="Article 8. Liability of the User"
        >
          <Ol items={[
            '이용자가 접근매체를 제3자에게 대여하거나 그 사용을 위임한 경우 또는 양도·담보 목적으로 제공한 경우, 이로 인한 손해는 이용자가 부담합니다.',
            '이용자가 접근매체의 분실·도난을 알고도 회사에 통지하지 않거나 지체한 경우, 통지 이전에 발생한 손해에 대하여 이용자가 책임을 부담합니다.',
            '이용자가 비밀번호 등 접근매체를 관리 소홀로 인하여 제3자가 이용하게 된 경우, 해당 손해는 이용자가 부담합니다.',
            '회사가 보안 강화를 위해 제공하는 인증 수단(2단계 인증 등)의 이용을 이용자가 정당한 사유 없이 거부한 경우, 이로 인한 손해는 이용자가 부담할 수 있습니다.',
          ]} />
        </Section>

        {/* 제9조 */}
        <Section
          title="제9조. 분쟁처리 및 피해보상"
          subtitle="Article 9. Dispute Resolution and Damage Compensation"
        >
          <Ol items={[
            '이용자는 전자금융거래와 관련하여 분쟁이 발생한 경우 회사의 고객센터(이메일: Jaicylab0110@gmail.com)에 분쟁처리를 신청할 수 있습니다.',
            '회사는 분쟁처리 신청을 접수한 날로부터 15일 이내에 이용자에게 그 처리 결과를 통지합니다.',
            '이용자는 「전자금융거래법」 제51조에 따라 금융감독원의 금융분쟁조정위원회에 분쟁조정을 신청할 수 있습니다.',
            '회사는 「전자금융감독규정」에 따라 전자금융사고 발생 시 이용자에게 피해를 보상합니다.',
            '피해보상의 기준 및 절차는 「전자금융거래법」 및 관련 법령이 정하는 바에 따릅니다.',
          ]} />

          <table className="w-full mt-3 border border-gray-200 text-[13px]" style={{ borderRadius: 8, overflow: 'hidden' }}>
            <thead>
              <tr className="bg-gray-50">
                <th className="text-left px-3 py-2 font-bold text-gray-700 border-b border-gray-200">분쟁 유형</th>
                <th className="text-left px-3 py-2 font-bold text-gray-700 border-b border-gray-200">처리 기한</th>
                <th className="text-left px-3 py-2 font-bold text-gray-700 border-b border-gray-200">담당</th>
              </tr>
            </thead>
            <tbody>
              {[
                ['결제 오류', '15일 이내', '고객센터'],
                ['이중 결제', '15일 이내', '고객센터 / PG사'],
                ['미승인 거래', '30일 이내', '고객센터 / 금융기관'],
                ['환불 분쟁', '15일 이내', '고객센터'],
                ['기타 전자금융 사고', '30일 이내', '고객센터 / 금융감독원'],
              ].map(([type, period, dept], i) => (
                <tr key={i} className="border-b border-gray-100 last:border-0">
                  <td className="px-3 py-2 text-gray-900 font-medium">{type}</td>
                  <td className="px-3 py-2 text-gray-600">{period}</td>
                  <td className="px-3 py-2 text-gray-600">{dept}</td>
                </tr>
              ))}
            </tbody>
          </table>
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
