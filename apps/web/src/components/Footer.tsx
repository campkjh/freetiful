import Link from 'next/link';

const FOOTER_LINKS = {
  서비스: [
    { label: '공지사항', href: '/my/announcements' },
    { label: '자주 묻는 질문', href: '/my/faq' },
    { label: '고객센터', href: '/my/support' },
    { label: '이용약관', href: '/terms/service' },
    { label: '개인정보 처리방침', href: '/terms/privacy' },
    { label: '환불 규정', href: '/terms/refund' },
  ],
  회사: [
    { label: '회사 소개', href: '/biz' },
    { label: '채용', href: '/careers' },
  ],
  문의: [
    { label: '사업 제휴', href: '/biz' },
    { label: '사회자 입점 문의', href: '/pro-register' },
  ],
  '고객센터': [
    { label: '전화: 02-765-8882', href: 'tel:02-765-8882' },
    { label: '이메일: freetiful2025@gmail.com', href: 'mailto:freetiful2025@gmail.com' },
  ],
};

/**
 * 회사 정보 푸터.
 * 모바일(260926 사장 "푸터 텍스트 계층 웨딩숲 계층으로, 끝부분 그라데이션으로 풀어서 고급스럽게"):
 *  · 글자 = 웨딩숲 계층 — 묶음 제목 15 굵게 #333D4B · 링크 15 #6B7684 · 사업자 정보 13 #8B95A1(줄 1.7) · 저작권 12 #B0B8C1
 *  · 바탕 = 윗선 없이 흰색 → 연회색으로 스며들고, 끝은 다시 흰색으로 풀린다(아래 탭바가 흰 바탕 위에 자연스럽게 얹히게).
 *    마지막 줄이 탭바에 가려 잘리지 않게 탭바 높이만큼 아래 여백.
 * PC 는 예전 모양 그대로(lg:).
 */
export default function Footer() {
  return (
    <footer className="bg-[linear-gradient(180deg,#FFFFFF_0px,#F4F6F8_72px,#F4F6F8_calc(100%_-_190px),#FFFFFF_100%)] pb-[calc(104px+env(safe-area-inset-bottom,0px))] lg:border-t lg:border-gray-200/60 lg:bg-surface-100 lg:bg-none lg:pb-0">
      {/* ─── Logo ──────────────────────────────────────── */}
      <div className="max-w-7xl mx-auto px-5 pb-5 pt-14 lg:px-8 lg:pb-4 lg:pt-10">
        <img src="/images/logo-prettyful.svg" alt="Freetiful" className="h-6 opacity-20 grayscale" />
      </div>

      {/* ─── Link Columns ──────────────────────────────────────── */}
      <div className="max-w-7xl mx-auto px-5 pb-7 lg:px-8 lg:pb-6">
        <div className="grid grid-cols-2 gap-x-6 gap-y-9 lg:grid-cols-4 lg:gap-12">
          {Object.entries(FOOTER_LINKS).map(([title, links]) => (
            <div key={title} className="min-w-0">
              <h4 className="mb-3.5 text-[15px] font-bold tracking-[-0.2px] text-[#333D4B] lg:mb-4 lg:text-[14px] lg:text-gray-900">{title}</h4>
              <ul className="space-y-3 lg:space-y-2.5">
                {links.map((link) => (
                  <li key={link.label}>
                    <Link
                      href={link.href}
                      className="break-all text-[15px] leading-[1.5] tracking-[-0.2px] text-[#6B7684] transition-colors hover:text-gray-900 lg:text-[13px] lg:text-gray-500"
                    >
                      {link.label}
                    </Link>
                  </li>
                ))}
              </ul>
            </div>
          ))}
        </div>
      </div>

      {/* ─── 사업자 정보 ──────────────────────────────────────── */}
      {/* 모바일은 가는 선 대신 옅은 가로 그라데이션 선(가운데만 살짝) */}
      <div className="lg:border-t lg:border-gray-200/60">
        <div aria-hidden className="mx-5 h-px bg-[linear-gradient(90deg,rgba(229,232,235,0)_0%,#E5E8EB_18%,#E5E8EB_82%,rgba(229,232,235,0)_100%)] lg:hidden" />
        <div className="max-w-7xl mx-auto px-5 pb-2 pt-6 lg:px-8 lg:py-6">
          <p className="text-[13px] leading-[1.7] tracking-[-0.2px] text-[#8B95A1] lg:text-[11px] lg:leading-[1.8] lg:text-gray-400">
            프리티풀은 통신판매중개자로서 통신판매의 당사자가 아니며 개별 판매자가 제공하는 서비스에 대한 이행, 계약사항 등과 관련한 의무와 책임은 거래 당사자에게 있습니다.
          </p>
          <div className="mt-3.5 space-y-1 text-[13px] leading-[1.7] tracking-[-0.2px] text-[#8B95A1] lg:mt-3 lg:text-[11px] lg:leading-relaxed lg:text-gray-400">
            <p>주식회사커넥트풀 ㅣ 대표자명 서나웅 ㅣ 서울시 중구 퇴계로36길 2, 충무로관 본관 130호</p>
            <p>E freetiful2025@gmail.com</p>
            <p>사업자등록번호 391-86-03659</p>
            <p>통신판매업신고번호 2026-서울중구-699호</p>
          </div>
          <p className="mt-5 text-[12px] tracking-[-0.1px] text-[#B0B8C1] lg:mt-4 lg:text-[10px] lg:text-gray-300">Copyright&copy; Freetiful. All right reserved.</p>
        </div>
      </div>
    </footer>
  );
}
