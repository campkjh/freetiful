'use client';

import { useRouter } from 'next/navigation';
import { ChevronLeft } from 'lucide-react';

export default function ThirdPartyTermsPage() {
  const router = useRouter();

  return (
    <div className="bg-white min-h-screen" style={{ letterSpacing: '-0.02em' }}>
      <div className="sticky top-0 z-10 bg-white border-b border-gray-100">
        <div className="flex items-center h-[52px] px-4">
          <button onClick={() => router.back()} className="p-1 -ml-1 active:scale-90 transition-transform">
            <ChevronLeft size={24} className="text-gray-900" />
          </button>
          <h1 className="text-[18px] font-bold text-gray-900 ml-1">개인정보 제3자 제공 동의서</h1>
        </div>
      </div>

      <div className="px-4 py-6">
        <p className="text-[12px] text-gray-400 mb-4">마지막 업데이트 2026년 03월 22일</p>
        <p className="text-[13px] text-gray-600 leading-relaxed mb-6">
          프리티풀(이하 &quot;회사&quot;)은 「개인정보 보호법」 제17조 및 제18조 등의 관련 법령에 따라, 이용자의 동의 하에 개인정보를 제3자에게 제공하고 있으며, 아래와 같이 그 내용을 안내드립니다.
        </p>

        {/* 제1조 */}
        <Section title="제1조 (개인정보 제3자 제공에 대한 동의)">
          <p>회사는 서비스 제공 및 계약 이행, 결제 처리, 정산, 법령 준수 등의 목적으로 이용자의 개인정보를 필요한 범위 내에서 제3자에게 제공합니다. 이용자는 이에 대한 동의를 거부할 권리가 있으며, 동의 거부 시 일부 서비스 이용에 제한이 있을 수 있습니다.</p>
        </Section>

        {/* 제2조 */}
        <Section title="제2조 (개인정보를 제공받는 자, 제공 항목, 제공 목적 및 보유 기간)">
          <p className="font-bold text-gray-900 mt-2 mb-2">1. 프리랜서 회원에게 제공</p>
          <Table headers={['구분', '내용']} rows={[
            ['제공받는 자', '행사 매칭된 프리랜서 회원'],
            ['제공 항목', '고객 성명, 연락처, 행사 일시 및 장소, 행사 성격'],
            ['제공 목적', '행사 진행을 위한 사전 연락, 협의 및 준비'],
            ['보유 기간', '서비스 제공 완료 후 즉시 파기 (법령상 보존 필요 시 해당 기간)'],
          ]} />

          <p className="font-bold text-gray-900 mt-4 mb-2">2. 고객 회원에게 제공</p>
          <Table headers={['구분', '내용']} rows={[
            ['제공받는 자', '프리랜서 매칭 대상 고객 회원'],
            ['제공 항목', '프리랜서 성명, 연락처, 프로필 정보(경력, 포트폴리오 등)'],
            ['제공 목적', '프리랜서 검토 및 행사 전 커뮤니케이션'],
            ['보유 기간', '서비스 제공 완료 후 즉시 파기 (법령상 보존 필요 시 해당 기간)'],
          ]} />

          <p className="font-bold text-gray-900 mt-4 mb-2">3. 결제 대행사 등 금융기관</p>
          <Table headers={['구분', '내용']} rows={[
            ['제공받는 자', '결제대행사, PG사 등'],
            ['제공 항목', '이름, 결제 수단 정보, 연락처'],
            ['제공 목적', '서비스 요금 결제 및 결제 관련 문의 대응'],
            ['보유 기간', '전자상거래법, 전자금융거래법 등 관계 법령에 따른 기간'],
          ]} />

          <p className="font-bold text-gray-900 mt-4 mb-2">4. 세무·회계 처리 위탁업체</p>
          <Table headers={['구분', '내용']} rows={[
            ['제공받는 자', '정산 및 세금 처리 담당 전문가, 수탁자'],
            ['제공 항목', '성명, 연락처, 주민등록번호 또는 사업자등록번호, 계좌정보 등'],
            ['제공 목적', '프리랜서 정산 및 원천징수 세금 신고'],
            ['보유 기간', '소득세법, 부가가치세법 등 관련 세법에 따라 최대 5년'],
          ]} />

          <Notice text="주민등록번호 등 고유식별정보는 관련 법령에서 요구하거나 허용하는 경우에 한하여 필요한 최소 범위에서 처리되며, 해당 목적 달성 후 지체 없이 파기합니다." />
        </Section>

        {/* 제3조 */}
        <Section title="제3조 (동의 거부에 따른 불이익 안내)">
          <p>이용자는 개인정보의 제3자 제공에 대한 동의를 거부할 수 있습니다. 다만, 동의를 거부하실 경우 플랫폼 이용(매칭, 계약 체결, 결제, 정산 등) 중 필수 서비스의 이용이 제한될 수 있습니다.</p>
        </Section>

        {/* 제4조 */}
        <Section title="제4조 (제공 동의 철회 및 개인정보 파기)">
          <p>이용자는 언제든지 제3자 제공 동의를 철회할 수 있으며, 동의 철회 시 회사는 지체 없이 해당 제3자에게 파기를 요청하거나 자체 파기 절차를 진행합니다.</p>
          <Table headers={['파기 방법', '상세']} rows={[
            ['전자적 파일', '복구 불가능한 기술적 방법으로 삭제'],
            ['종이 문서', '분쇄 또는 소각 방식으로 파기'],
          ]} />
        </Section>

        {/* 제5조 */}
        <Section title="제5조 (기타 사항)">
          <Ol items={[
            '본 동의서는 서비스 이용 중 수시로 갱신될 수 있으며, 변경 시 회사는 개별 통지 또는 플랫폼 내 공지사항을 통해 안내합니다.',
            '이용자는 회원가입 또는 서비스 이용 시, 본 동의서의 내용을 충분히 숙지하고 전자적 방식(체크박스 선택 등)을 통해 명시적으로 동의하며, 회사는 해당 동의 내역을 시스템에 기록·보관합니다.',
          ]} />
        </Section>
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

function Table({ headers, rows }: { headers: string[]; rows: string[][] }) {
  return (
    <table className="w-full mt-2 border border-gray-200 text-[13px]" style={{ borderRadius: 8, overflow: 'hidden', borderCollapse: 'separate' }}>
      <thead>
        <tr className="bg-gray-50">
          {headers.map((h, i) => (
            <th key={i} className="text-left px-3 py-2 font-bold text-gray-700 border-b border-gray-200">{h}</th>
          ))}
        </tr>
      </thead>
      <tbody>
        {rows.map((row, i) => (
          <tr key={i} className="border-b border-gray-100 last:border-0">
            {row.map((cell, j) => (
              <td key={j} className={`px-3 py-2 ${j === 0 ? 'font-medium text-gray-900 w-[100px]' : 'text-gray-600'}`}>{cell}</td>
            ))}
          </tr>
        ))}
      </tbody>
    </table>
  );
}

function Notice({ text }: { text: string }) {
  return (
    <div className="mt-3 px-3 py-2.5 bg-gray-50 text-[12px] text-gray-500 leading-relaxed" style={{ borderRadius: 8 }}>
      {text}
    </div>
  );
}
