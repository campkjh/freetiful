'use client';

import { useRouter } from 'next/navigation';
import { ChevronLeft } from 'lucide-react';

export default function MetaAdsDataPage() {
  const router = useRouter();

  return (
    <div className="bg-white min-h-screen" style={{ letterSpacing: '-0.02em' }}>
      <div className="sticky top-0 z-10 bg-white border-b border-gray-100">
        <div className="flex items-center h-[52px] px-4">
          <button onClick={() => router.back()} className="p-1 -ml-1 active:scale-90 transition-transform">
            <ChevronLeft size={24} className="text-gray-900" />
          </button>
          <h1 className="text-[18px] font-bold text-gray-900 ml-1">META 광고 데이터 처리 약관</h1>
        </div>
      </div>

      <div className="px-4 py-6">
        <p className="text-[12px] text-gray-400 mb-6">마지막 업데이트 2026년 03월 22일</p>

        <div className="text-[13px] text-gray-600 leading-relaxed mb-6">
          <p>프리티풀(이하 &quot;회사&quot;)은 META Platforms, Inc.(이하 &quot;META&quot;)가 운영하는 Facebook, Instagram 등의 플랫폼을 통한 광고 운영 과정에서 이용자의 데이터를 처리하고 있으며, 본 약관은 그 기준과 절차를 안내합니다.</p>
        </div>

        {/* 제1조 */}
        <Section
          title="제1조. 목적"
          subtitle="Article 1. Purpose"
        >
          <p>본 약관은 회사가 META 플랫폼(Facebook, Instagram 등)을 활용한 광고 운영을 위하여 이용자의 데이터를 수집·이용·제공하는 기준과 절차를 정함을 목적으로 합니다.</p>
        </Section>

        {/* 제2조 */}
        <Section
          title="제2조. 수집 항목"
          subtitle="Article 2. Data Collected"
        >
          <p className="mb-2">회사는 META Pixel 및 META SDK를 통하여 다음과 같은 데이터를 자동으로 수집할 수 있습니다.</p>
          <table className="w-full mt-3 border border-gray-200 text-[13px]" style={{ borderRadius: 8, overflow: 'hidden' }}>
            <thead>
              <tr className="bg-gray-50">
                <th className="text-left px-3 py-2 font-bold text-gray-700 border-b border-gray-200 w-[140px]">수집 항목</th>
                <th className="text-left px-3 py-2 font-bold text-gray-700 border-b border-gray-200">상세 내용</th>
                <th className="text-left px-3 py-2 font-bold text-gray-700 border-b border-gray-200 w-[110px]">이용 목적</th>
              </tr>
            </thead>
            <tbody>
              {[
                ['페이지 방문 데이터', '방문한 페이지 URL, 방문 시간, 체류 시간', '광고 성과 분석'],
                ['이벤트 데이터', '버튼 클릭, 장바구니 추가, 검색어 등 행동 데이터', '맞춤형 광고 제공'],
                ['전환 데이터', '회원가입, 예약 완료, 결제 완료 등 전환 이벤트', '전환 추적 및 최적화'],
                ['기기 정보', '브라우저 유형, OS, 화면 해상도, 언어 설정', '광고 노출 최적화'],
                ['IP 주소', '접속 IP 주소 (지역 기반 분석용)', '지역 타겟팅'],
                ['쿠키 식별자', 'META Pixel이 설정한 쿠키 ID (_fbp, _fbc)', '리타겟팅 광고'],
              ].map(([item, detail, purpose], i) => (
                <tr key={i} className="border-b border-gray-100 last:border-0">
                  <td className="px-3 py-2 text-gray-900 font-medium">{item}</td>
                  <td className="px-3 py-2 text-gray-600">{detail}</td>
                  <td className="px-3 py-2 text-gray-600">{purpose}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </Section>

        {/* 제3조 */}
        <Section
          title="제3조. 이용 목적"
          subtitle="Article 3. Purpose of Use"
        >
          <Ol items={[
            '맞춤형 광고 제공: 이용자의 관심사와 행동 패턴을 기반으로 Facebook, Instagram에서 관련성 높은 광고를 노출합니다.',
            '리타겟팅(Retargeting): 회사의 서비스를 방문하였으나 전환(예약, 결제 등)을 완료하지 않은 이용자에게 재방문을 유도하는 광고를 제공합니다.',
            '전환 추적(Conversion Tracking): 광고 클릭 후 실제 서비스 이용(회원가입, 예약, 결제)으로 이어지는 전환율을 측정하여 광고 효율을 분석합니다.',
            '유사 타겟(Lookalike Audience) 생성: 기존 이용자와 유사한 특성을 가진 잠재 고객군을 META 플랫폼에서 생성하여 신규 이용자 확보를 위한 광고에 활용합니다.',
            '광고 성과 분석: 광고 캠페인의 도달, 노출, 클릭, 전환 등 성과 데이터를 분석하여 마케팅 전략을 개선합니다.',
          ]} />
        </Section>

        {/* 제4조 */}
        <Section
          title="제4조. 제3자 제공"
          subtitle="Article 4. Provision to Third Parties"
        >
          <Ol items={[
            '회사는 광고 운영 및 성과 측정을 위하여 META Platforms, Inc.에 전환 데이터를 전송합니다.',
            '제공받는 자: META Platforms, Inc. (미국 소재)',
            '제공 항목: 전환 이벤트 데이터(회원가입, 예약, 결제 등), 이벤트 파라미터(금액, 상품 카테고리 등), 쿠키 식별자(_fbp, _fbc), 해시 처리된 이메일/전화번호(커스텀 오디언스 활용 시)',
            '제공 목적: 맞춤형 광고 제공, 광고 전환 추적, 유사 타겟 생성, 광고 최적화',
            '데이터 전송 시 개인을 직접 식별할 수 있는 정보는 해시(SHA-256) 처리하여 전송하며, META의 데이터 처리 약관(Data Processing Terms)에 따라 처리됩니다.',
          ]} />
        </Section>

        {/* 제5조 */}
        <Section
          title="제5조. 보유기간"
          subtitle="Article 5. Retention Period"
        >
          <Ol items={[
            'META Pixel 및 SDK를 통해 수집된 데이터는 META의 정책에 따라 최대 180일간 보유됩니다.',
            '180일 경과 후 해당 데이터는 비식별화(익명화) 처리되어 통계 목적으로만 활용됩니다.',
            '커스텀 오디언스에 활용된 해시 데이터는 해당 오디언스가 삭제되거나 갱신되지 않으면 META 정책에 따라 자동 삭제됩니다.',
            '회사 서버에 별도 저장되는 광고 성과 데이터(집계·통계 데이터)는 광고 캠페인 종료 후 1년간 보관한 뒤 파기합니다.',
          ]} />
        </Section>

        {/* 제6조 */}
        <Section
          title="제6조. 이용자의 권리"
          subtitle="Article 6. User Rights"
        >
          <Ol items={[
            'META 맞춤형 광고 차단: 이용자는 META 플랫폼의 광고 설정(Facebook > 설정 > 광고 > 광고 설정)에서 맞춤형 광고를 차단할 수 있습니다.',
            'META 외부 활동 관리: Facebook의 &quot;내 Facebook 정보&quot; > &quot;Facebook 외부 활동&quot;에서 회사가 전송한 데이터를 확인하고 삭제할 수 있습니다.',
            '회사에 데이터 삭제 요청: 이용자는 회사 고객센터(이메일: Jaicylab0110@gmail.com)에 META 광고 관련 데이터의 삭제를 요청할 수 있으며, 회사는 요청일로부터 10영업일 이내에 처리합니다.',
            '쿠키 차단: 이용자는 웹 브라우저 설정에서 쿠키를 차단하거나 삭제하여 META Pixel의 데이터 수집을 제한할 수 있습니다.',
            '앱 추적 거부: iOS(14.5 이상) 이용자는 앱 추적 투명성(ATT) 설정에서 추적을 거부할 수 있으며, Android 이용자는 광고 ID 설정에서 맞춤형 광고를 비활성화할 수 있습니다.',
          ]} />
        </Section>

        {/* 제7조 */}
        <Section
          title="제7조. 쿠키 및 추적 기술"
          subtitle="Article 7. Cookies and Tracking Technologies"
        >
          <div className="space-y-3 mt-1">
            <div>
              <p className="font-bold text-gray-900 text-[13px] mb-1">7-1. META Pixel</p>
              <p>META Pixel은 회사 웹사이트에 설치되는 JavaScript 코드로, 이용자의 웹사이트 방문 및 행동 데이터를 META 서버로 전송합니다. 이를 통해 광고 전환 추적, 리타겟팅 광고 제공, 광고 성과 분석이 가능합니다.</p>
            </div>
            <div>
              <p className="font-bold text-gray-900 text-[13px] mb-1">7-2. Conversions API (CAPI)</p>
              <p>Conversions API는 회사 서버에서 META 서버로 직접 전환 데이터를 전송하는 서버 간(Server-to-Server) 연동 방식입니다. 브라우저 쿠키 차단 환경에서도 안정적인 전환 추적이 가능하며, META Pixel과 병행하여 데이터 정확도를 높입니다.</p>
            </div>
            <div>
              <p className="font-bold text-gray-900 text-[13px] mb-1">7-3. 쿠키 종류</p>
              <table className="w-full mt-2 border border-gray-200 text-[13px]" style={{ borderRadius: 8, overflow: 'hidden' }}>
                <thead>
                  <tr className="bg-gray-50">
                    <th className="text-left px-3 py-2 font-bold text-gray-700 border-b border-gray-200 w-[100px]">쿠키명</th>
                    <th className="text-left px-3 py-2 font-bold text-gray-700 border-b border-gray-200">설명</th>
                    <th className="text-left px-3 py-2 font-bold text-gray-700 border-b border-gray-200 w-[80px]">유효기간</th>
                  </tr>
                </thead>
                <tbody>
                  {[
                    ['_fbp', 'META Pixel이 설정하는 자사 쿠키로, 웹사이트 방문자를 식별합니다.', '90일'],
                    ['_fbc', '광고 클릭 후 웹사이트 방문 시 설정되는 쿠키로, 클릭 ID를 저장합니다.', '90일'],
                  ].map(([name, desc, period], i) => (
                    <tr key={i} className="border-b border-gray-100 last:border-0">
                      <td className="px-3 py-2 text-gray-900 font-medium">{name}</td>
                      <td className="px-3 py-2 text-gray-600">{desc}</td>
                      <td className="px-3 py-2 text-gray-600">{period}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
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
