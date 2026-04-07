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
    { label: '이메일: support@prettyful.kr', href: 'mailto:support@prettyful.kr' },
  ],
};

const LEGAL_LINKS = [
  { label: '서비스 이용약관', href: '/terms/service' },
  { label: '개인정보 처리방침', href: '/terms/privacy', bold: true },
  { label: '위치기반서비스 이용약관', href: '#' },
];

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

      {/* ─── Company Info ──────────────────────────────────────── */}
      <div className="border-t border-gray-200/60">
        <div className="max-w-7xl mx-auto px-5 lg:px-8 py-8">
          <p className="text-[14px] font-bold text-gray-900 mb-3">(주)프리티풀</p>
          <div className="space-y-1 text-[12px] text-gray-400 leading-relaxed">
            <p>사업자 등록번호 : 000-00-00000 | 대표 : 홍길동</p>
            <p>통신판매업 신고번호 : 2024-서울강남-00000</p>
            <p>06236 서울특별시 강남구 테헤란로 142, 4층</p>
          </div>

          {/* Legal links */}
          <div className="flex flex-wrap gap-x-4 gap-y-1.5 mt-6">
            {LEGAL_LINKS.map((link) => (
              <Link
                key={link.label}
                href={link.href}
                className={`text-[11px] transition-colors ${
                  link.bold
                    ? 'font-bold text-gray-700 hover:text-gray-900'
                    : 'text-gray-400 hover:text-gray-600'
                }`}
              >
                {link.label}
              </Link>
            ))}
          </div>

          {/* Social + Copyright */}
          <div className="flex items-center justify-between mt-8">
            <div className="flex items-center gap-3">
              {(['blog', 'instagram', 'youtube'] as const).map((s) => (
                <a
                  key={s}
                  href="#"
                  className="w-8 h-8 rounded-full bg-gray-200/80 flex items-center justify-center text-gray-500 hover:bg-gray-300/80 hover:text-gray-700 transition-colors"
                  aria-label={s}
                >
                  <SocialIcon type={s} />
                </a>
              ))}
            </div>
            <p className="text-[11px] text-gray-400">&copy; {new Date().getFullYear()} Prettyful. All rights reserved.</p>
          </div>
        </div>
      </div>
    </footer>
  );
}

function SocialIcon({ type }: { type: 'blog' | 'instagram' | 'youtube' }) {
  switch (type) {
    case 'blog':
      return <span className="text-[11px] font-black">N</span>;
    case 'instagram':
      return (
        <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
          <rect x="2" y="2" width="20" height="20" rx="5" />
          <circle cx="12" cy="12" r="5" />
          <circle cx="17.5" cy="6.5" r="1.5" fill="currentColor" stroke="none" />
        </svg>
      );
    case 'youtube':
      return (
        <svg width="14" height="14" viewBox="0 0 24 24" fill="currentColor">
          <path d="M23.5 6.2a3 3 0 0 0-2.1-2.1C19.5 3.5 12 3.5 12 3.5s-7.5 0-9.4.6A3 3 0 0 0 .5 6.2 31.5 31.5 0 0 0 0 12a31.5 31.5 0 0 0 .5 5.8 3 3 0 0 0 2.1 2.1c1.9.6 9.4.6 9.4.6s7.5 0 9.4-.6a3 3 0 0 0 2.1-2.1c.3-1.9.5-3.8.5-5.8s-.2-3.9-.5-5.8ZM9.5 15.5V8.5l6.3 3.5-6.3 3.5Z" />
        </svg>
      );
  }
}
