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
    { label: '회사 소개', href: '#' },
    { label: '채용', href: '#' },
    { label: '블로그', href: '#' },
    { label: '기술 블로그', href: '#' },
  ],
  문의: [
    { label: '사업 제휴', href: '#' },
    { label: '광고 문의', href: '#' },
    { label: '전문가 입점 문의', href: '/pro-register' },
  ],
  '고객센터': [
    { label: '전화: 1599-0000 (평일 10-18시)', href: '#' },
    { label: '이메일: support@freetiful.kr', href: 'mailto:support@freetiful.kr' },
  ],
};

export default function Footer() {
  return (
    <footer className="bg-surface-100 border-t border-gray-200/60">
      {/* ─── Link Columns ──────────────────────────────────────── */}
      <div className="max-w-7xl mx-auto px-5 lg:px-8 pt-12 pb-10">
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

    </footer>
  );
}
