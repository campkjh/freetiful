'use client';

import { useRouter } from 'next/navigation';
import { ChevronLeft } from 'lucide-react';

export default function ServiceTermsPage() {
  const router = useRouter();

  return (
    <div className="bg-white min-h-screen" style={{ letterSpacing: '-0.02em' }}>
      <div className="sticky top-0 z-10 bg-white border-b border-gray-100">
        <div className="flex items-center h-[52px] px-4">
          <button onClick={() => router.back()} className="p-1 -ml-1 active:scale-90 transition-transform">
            <ChevronLeft size={24} className="text-gray-900" />
          </button>
          <h1 className="text-[18px] font-bold text-gray-900 ml-1">서비스 이용약관</h1>
        </div>
      </div>

      <div className="px-4 py-6">
        {/* 제1조 */}
        <Section title="제1조 (목적)">
          <p>이 약관은 프리티풀(이하 &quot;회사&quot;)이 운영하는 전문가 중개 플랫폼(이하 &quot;서비스&quot;)을 통해 프리랜서와 고객 간에 이루어지는 거래를 지원하고, 이에 필요한 권리·의무 및 책임사항을 규정함을 목적으로 합니다.</p>
        </Section>

        {/* 제2조 */}
        <Section title="제2조 (용어의 정의)">
          <p>이 약관에서 사용하는 용어의 정의는 다음과 같습니다.</p>
          <table className="w-full mt-3 border border-gray-200 text-[13px]" style={{ borderRadius: 8, overflow: 'hidden' }}>
            <thead>
              <tr className="bg-gray-50">
                <th className="text-left px-3 py-2 font-bold text-gray-700 border-b border-gray-200 w-[100px]">용어</th>
                <th className="text-left px-3 py-2 font-bold text-gray-700 border-b border-gray-200">정의</th>
              </tr>
            </thead>
            <tbody>
              {[
                ['회원', '본 약관에 따라 회사와 서비스 이용계약을 체결하고, 회사가 제공하는 서비스를 이용하는 자'],
                ['프리랜서', '회사에 등록하여 고객에게 전문 서비스를 제공하는 자'],
                ['고객', '프리랜서의 전문 서비스를 신청하거나 이용하는 자'],
                ['거래', '프리랜서와 고객 간 체결된 서비스 용역 계약'],
                ['중개 서비스', '회사가 제공하는 프리랜서-고객 간 연결, 일정 조율, 결제 지원, 정보 제공 등 관련 기능 일체'],
              ].map(([term, def], i) => (
                <tr key={i} className="border-b border-gray-100 last:border-0">
                  <td className="px-3 py-2 font-bold text-gray-900 align-top">{term}</td>
                  <td className="px-3 py-2 text-gray-600">{def}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </Section>

        {/* 제3조 */}
        <Section title="제3조 (약관의 변경 및 효력)">
          <Ol items={[
            '회사는 관련 법령을 위반하지 않는 범위 내에서 이 약관을 개정할 수 있습니다.',
            '변경된 약관은 그 적용일자 및 개정 사유와 함께 서비스 내에 공지하며, 효력은 게시 시점 또는 공지된 적용일부터 발생합니다.',
            '회원은 변경된 약관에 동의하지 않을 경우 언제든지 플랫폼 이용을 중단할 수 있으며, 회원이 명시적으로 거부의 의사표시를 하지 아니하고 계속 서비스를 이용하는 경우에는 변경된 약관에 동의한 것으로 봅니다.',
          ]} />
        </Section>

        {/* 제4조 */}
        <Section title="제4조 (약관 외 준칙)">
          <Ol items={[
            '이 약관에서 정하지 아니한 사항에 대하여는 전자상거래법, 정보통신망법, 개인정보 보호법, 민법 등 관계 법령 및 회사가 정한 정책의 규정을 따릅니다.',
            '회사는 서비스 운영과 관련하여 별도의 운영정책, 이용지침 등을 제정할 수 있으며, 본 약관에 반하지 않는 범위 내에서 효력을 가집니다.',
            '회원은 회사가 제공하는 공지사항 및 운영정책을 숙지하고 준수하여야 합니다.',
          ]} />
        </Section>

        {/* 제5조 */}
        <Section title="제5조 (서비스 내용)">
          <p>회사가 제공하는 서비스는 다음 각 호와 같습니다.</p>
          <Ol items={[
            '프리랜서와 고객의 매칭 및 연결',
            '프로필 열람 및 조건 검색',
            '행사 일정 조율 및 계약 의사표시 기능',
            '계약 체결 및 결제 수단 제공',
            '리뷰 및 평점 시스템 제공',
            '기타 회사가 정하는 부가 서비스',
          ]} />
          <Notice text="회사는 통신판매중개자 또는 플랫폼 운영자로서 프리랜서와 고객 사이의 거래를 연결·지원하는 자이며, 개별 용역 계약의 직접 당사자는 프리랜서와 고객입니다." />
        </Section>

        {/* 제6조 */}
        <Section title="제6조 (이용계약의 체결 및 탈퇴)">
          <Ol items={[
            '회원가입은 본 약관에 동의하고 회사가 정한 절차에 따라 회원가입 신청 후, 회사의 승낙으로 이루어집니다.',
            '회사는 타인의 명의 또는 정보를 도용한 경우, 허위 정보를 기재한 경우, 관련 법령 또는 본 약관에 위반되는 목적으로 신청한 경우 등 회원가입 신청을 승낙하지 않거나 사후에 이용계약을 해지할 수 있습니다.',
            '회원은 언제든지 탈퇴를 요청할 수 있으며, 회사는 관련 법령 및 개인정보처리방침에 따라 이를 처리합니다.',
            '회원은 탈퇴 이후에도 탈퇴 전 체결한 용역 계약상 의무 및 책임을 계속 이행하여야 합니다.',
          ]} />
        </Section>

        {/* 제7조 */}
        <Section title="제7조 (프리랜서 등록 및 검증)">
          <Ol items={[
            '프리랜서는 실명, 연락처, 포트폴리오, 경력 등 회사가 요구하는 정보를 등록하여야 합니다.',
            '회사는 프리랜서가 등록한 정보에 대하여 검증을 요청하거나 관련 자료 제출을 요구할 수 있습니다.',
            '회사는 허위 또는 과장된 정보를 등록한 경우, 타인의 권리를 침해할 우려가 있는 경우 등 프리랜서 등록을 거절하거나 노출 제한, 이용 제한 또는 등록 해지를 할 수 있습니다.',
            '회사의 검증 또는 등록 승인은 프리랜서의 능력, 자격, 신뢰도 또는 서비스 완성을 완전히 보증하는 것은 아닙니다.',
          ]} />
        </Section>

        {/* 제8조 */}
        <Section title="제8조 (개인정보의 보호)">
          <Ol items={[
            '회사는 개인정보 보호법 등 관련 법령을 준수하며, 개인정보처리방침을 통해 수집·이용·보관·파기 등에 관한 내용을 제공합니다.',
            '회사는 서비스 제공에 필요한 최소한의 범위 내에서만 개인정보를 수집·이용하며, 회원의 동의 없이 제3자에게 제공하지 않습니다.',
            '회원은 자신의 개인정보에 대해 열람, 정정, 삭제를 요청할 수 있으며, 회사는 지체 없이 필요한 조치를 취합니다.',
            '회사는 개인정보 보호를 위해 기술적·관리적 보호조치를 시행합니다.',
            '개인정보처리방침은 본 약관과 동일한 효력을 가지며 서비스 내 별도로 게시됩니다.',
          ]} />
        </Section>

        {/* 제9조 */}
        <Section title="제9조 (계약 체결 및 회사의 지위)">
          <Ol items={[
            '프리랜서와 고객 간의 용역 계약은 플랫폼 내 기능을 통해 체결되며, 계약 당사자는 프리랜서와 고객입니다.',
            '회사는 거래의 체결을 지원하는 중개자일 뿐, 프리랜서 또는 고객을 대리하지 않습니다.',
            '회사는 필요 시 관련 자료 제공, 고객응대, 일정 확인 등 중립적인 분쟁 조정 지원을 할 수 있으나, 회사의 고의 또는 과실이 없는 한 개별 거래의 이행 자체에 대한 법적 책임은 부담하지 않습니다.',
          ]} />
        </Section>

        {/* 제10조 */}
        <Section title="제10조 (결제 및 수수료)">
          <Ol items={[
            '고객은 회사가 제공하는 플랫폼 내 결제 시스템 또는 외부 결제수단을 통해 서비스 이용료를 결제할 수 있습니다.',
            '회사는 거래 안정성 확보를 위하여 결제대금을 정산 전 보관하거나, 제휴 결제업체를 통하여 예치 또는 정산 절차를 진행할 수 있습니다.',
            '회사가 제공한 결제 수단 외의 직접 송금 또는 비공식 직거래 등은 금지됩니다.',
            '회사는 서비스 제공 및 플랫폼 운영의 대가로 별도의 수수료를 부과할 수 있으며, 구체적인 기준은 서비스 내에 고지합니다.',
          ]} />
        </Section>

        {/* 제11조 */}
        <Section title="제11조 (환불 및 청약철회)">
          <Ol items={[
            '고객 또는 프리랜서의 서비스 취소 요청은 회사가 정한 환불정책에 따르며, 서비스 내에 별도 게시됩니다.',
            '회원은 거래 체결 또는 결제 전에 환불정책, 취소 가능 기간, 위약금 기준, 수수료 반환 여부 등 주요 내용을 확인하여야 합니다.',
            '계약 체결 후 행사일 기준 일정 기간이 경과한 경우 위약금이 발생할 수 있으며, 수수료는 반환되지 않을 수 있습니다.',
            '청약철회가 가능한 경우 관련 법령에 따르며, 용역 제공이 개시된 경우 청약철회가 제한될 수 있습니다.',
          ]} />
          <table className="w-full mt-3 border border-gray-200 text-[13px]" style={{ borderRadius: 8, overflow: 'hidden' }}>
            <thead>
              <tr className="bg-gray-50">
                <th className="text-left px-3 py-2 font-bold text-gray-700 border-b border-gray-200">취소 시점</th>
                <th className="text-left px-3 py-2 font-bold text-gray-700 border-b border-gray-200">환불 비율</th>
              </tr>
            </thead>
            <tbody>
              {[
                ['행사 7일 전', '100% 환불'],
                ['행사 3~6일 전', '수수료 제외 환불'],
                ['행사 1~2일 전', '50% 환불'],
                ['행사 당일', '환불 불가'],
              ].map(([time, refund], i) => (
                <tr key={i} className="border-b border-gray-100 last:border-0">
                  <td className="px-3 py-2 text-gray-900 font-medium">{time}</td>
                  <td className="px-3 py-2 text-gray-600">{refund}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </Section>

        {/* 제12조 */}
        <Section title="제12조 (금지행위)">
          <p>회원은 서비스 이용 시 다음 각 호의 행위를 하여서는 안 됩니다.</p>
          <Ol items={[
            '타인의 개인정보를 무단 수집·이용·유출하는 행위',
            '허위 정보 제공, 타인의 명의 도용, 중복 가입 등 부정확한 정보 기재 행위',
            '회사 또는 제3자의 지식재산권 침해 행위',
            '외부 서비스로의 무단 유도, 상업적 목적의 링크 공유 등 유사 서비스 홍보 행위',
            '음란물, 불법정보, 악성 프로그램의 유포 행위',
            '회원의 서비스 이용을 방해하거나 불쾌감을 주는 행위',
            '회사의 동의 없이 서비스를 재판매, 전송, 복제, 배포하는 행위',
            '플랫폼을 통하지 아니하고 직접 거래를 유도하거나 회사의 정산·수수료 체계를 우회하는 행위',
            '기타 관련 법령 및 사회질서에 반하는 행위',
          ]} />
        </Section>

        {/* 제13조 */}
        <Section title="제13조 (이용제한 및 손해배상)">
          <Ol items={[
            '회사는 회원이 본 약관 또는 운영정책을 위반한 경우 경고, 게시물 삭제, 이용정지, 회원자격 제한 또는 이용계약 해지 등의 조치를 취할 수 있습니다.',
            '회원의 귀책사유로 회사 또는 제3자에게 손해가 발생한 경우, 해당 회원은 관련 법령에 따라 그 손해를 배상하여야 합니다.',
            '회사가 회원의 위반행위로 인하여 제3자로부터 손해배상청구 등을 받는 경우, 해당 회원은 자신의 책임과 비용으로 회사를 면책시키고 손해를 배상하여야 합니다.',
          ]} />
        </Section>

        {/* 제14조 */}
        <Section title="제14조 (지식재산권)">
          <Ol items={[
            '회사가 제작하거나 제공하는 콘텐츠에 대한 저작권 및 지식재산권은 회사에 귀속됩니다.',
            '프리랜서 또는 회원이 플랫폼에 등록한 콘텐츠에 대한 저작권은 원칙적으로 해당 회원에게 귀속됩니다.',
            '회원은 회사에게 서비스 운영, 홍보, 검색 노출 등을 위하여 필요한 범위 내에서 해당 콘텐츠를 비독점적·무상으로 사용할 수 있는 권한을 부여합니다.',
            '회사는 제3항의 권한을 합리적으로 필요한 범위 내에서만 행사하며, 콘텐츠의 저작권 자체를 취득하는 것은 아닙니다.',
          ]} />
        </Section>

        {/* 제15조 */}
        <Section title="제15조 (분쟁 해결)">
          <Ol items={[
            '프리랜서와 고객 간 분쟁은 원칙적으로 당사자 간 협의를 통해 해결합니다.',
            '회사는 중립적 조정 자료를 제공하거나 사실확인에 협조할 수 있으나, 개별 분쟁의 결과에 대한 법적 책임은 지지 않습니다.',
            '회사와 회원은 분쟁 발생 시 원만한 해결을 위하여 상호 성실히 협의합니다.',
          ]} />
        </Section>

        {/* 제16조 */}
        <Section title="제16조 (면책 및 책임 제한)">
          <Ol items={[
            '회사는 중개 플랫폼으로서 프리랜서와 고객 간 거래의 체결을 지원하며, 개별 용역의 실제 수행, 이행, 결과에 관하여는 해당 거래 당사자가 책임을 부담합니다.',
            '프리랜서의 지각, 무단불참, 서비스 불만족 등 개별 거래상 문제는 원칙적으로 당사자 간에 해결하여야 합니다.',
            '회사는 천재지변, 정전, 통신장애 등 불가항력적 사유로 인한 서비스 제공의 중단에 대하여 책임을 지지 않습니다.',
            '회사는 회사의 고의 또는 과실로 인하여 회원에게 손해가 발생한 경우 관련 법령에 따라 책임을 부담합니다.',
          ]} />
        </Section>

        {/* 제17조 */}
        <Section title="제17조 (관할법원 및 준거법)">
          <Ol items={[
            '이 약관과 관련한 회사와 회원 간의 분쟁에는 대한민국 법을 적용합니다.',
            '이 약관 또는 서비스 이용과 관련하여 분쟁이 발생한 경우에는 관련 법령에 따른 관할법원을 제1심 관할법원으로 합니다.',
          ]} />
        </Section>

        {/* 부칙 */}
        <div className="mt-6 pt-4 border-t border-gray-200">
          <p className="text-[13px] text-gray-400">부칙: 이 약관은 2026년 3월 22일부터 시행합니다.</p>
        </div>
      </div>
    </div>
  );
}

function Section({ title, children }: { title: string; children: React.ReactNode }) {
  return (
    <div className="mb-6">
      <h2 className="text-[15px] font-bold text-gray-900 mb-2">{title}</h2>
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
