import Link from 'next/link';

const FOOTER_LINKS = {
  서비스: [
    { label: '공지사항', href: '/my/announcements' },
    { label: '자주 묻는 질문', href: '/my/faq' },
    { label: '고객센터', href: '/my/support' },
    { label: '이용약관', href: '/terms/service' },
    { label: '개인정보 처리방침', href: '/terms/privacy' },
  ],
  회사: [
    { label: '회사 소개', href: '/biz' },
    { label: '채용', href: '/careers' },
  ],
  문의: [
    { label: '사업 제휴', href: '/biz' },
    { label: '전문가 입점 문의', href: '/pro-register' },
  ],
  '고객센터': [
    { label: '전화: 02-765-8882', href: 'tel:02-765-8882' },
    { label: '이메일: freetiful2025@gmail.com', href: 'mailto:freetiful2025@gmail.com' },
  ],
};

export default function Footer() {
  return (
    <footer className="bg-surface-100 border-t border-gray-200/60">
      {/* ─── Logo ──────────────────────────────────────── */}
      <div className="max-w-7xl mx-auto px-5 lg:px-8 pt-10 pb-4">
        <img src="/images/logo-prettyful.svg" alt="Freetiful" className="h-6 opacity-20 grayscale" />
      </div>

      {/* ─── Link Columns ──────────────────────────────────────── */}
      <div className="max-w-7xl mx-auto px-5 lg:px-8 pb-6">
        <div className="grid grid-cols-2 gap-8 lg:grid-cols-4 lg:gap-12">
          {Object.entries(FOOTER_LINKS).map(([title, links]) => (
            <div key={title}>
              <h4 className="text-[14px] font-bold text-gray-900 mb-4">{title}</h4>
              <ul className="space-y-2.5">
                {links.map((link) => (
                  <li key={link.label}>
                    <Link
                      href={link.href}
                      className="text-[13px] text-gray-500 hover:text-gray-900 transition-colors"
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
      <div className="border-t border-gray-200/60">
        <div className="max-w-7xl mx-auto px-5 lg:px-8 py-6">
          <p className="text-[11px] text-gray-400 leading-[1.8]">
            프리티풀은 통신판매중개자로서 통신판매의 당사자가 아니며 개별 판매자가 제공하는 서비스에 대한 이행, 계약사항 등과 관련한 의무와 책임은 거래 당사자에게 있습니다.
          </p>
          <div className="mt-3 space-y-1 text-[11px] text-gray-400 leading-relaxed">
            <p>프리티풀 ㅣ 서울 강남구 논현대로10길 30, 505-제이20호</p>
            <p>E freetiful2025@naver.com</p>
            <p>사업자등록번호 313-40-01352</p>
            <p>통신판매업 제2026-서울강남-02439호</p>
          </div>
          <p className="mt-4 text-[10px] text-gray-300">Copyright&copy; Freetiful. All right reserved.</p>
        </div>
      </div>
    </footer>
  );
}
