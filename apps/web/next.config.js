/** @type {import('next').NextConfig} */
function getApiBaseUrl() {
  const raw = process.env.NEXT_PUBLIC_API_URL?.replace(/\/+$/, '');
  return raw?.replace(/\/api\/v1$/, '').replace(/\/api$/, '');
}

function oauthCompatibilityRedirects(provider) {
  const callback = `/auth/${provider}/callback`;
  return [
    { source: `/${provider}`, destination: callback, permanent: false },
    { source: `/${provider}/callback`, destination: callback, permanent: false },
    { source: `/callback/${provider}`, destination: callback, permanent: false },
    { source: `/auth/callback/${provider}`, destination: callback, permanent: false },
    { source: `/oauth/callback/${provider}`, destination: callback, permanent: false },
    { source: `/oauth2/callback/${provider}`, destination: callback, permanent: false },
    { source: `/login/${provider}/callback`, destination: callback, permanent: false },
    { source: `/login/oauth/${provider}/callback`, destination: callback, permanent: false },
    { source: `/login/oauth2/code/${provider}`, destination: callback, permanent: false },
    { source: `/users/auth/${provider}/callback`, destination: callback, permanent: false },
    { source: `/api/auth/${provider}/callback`, destination: callback, permanent: false },
  ];
}

const nextConfig = {
  compress: true,
  poweredByHeader: false,
  reactStrictMode: false,
  transpilePackages: ['@prettyful/types'],
  images: {
    // unoptimized: true 제거 — WebP 변환·리사이징·지연로딩 활성화
    remotePatterns: [
      { protocol: 'https', hostname: '*.supabase.co', pathname: '/storage/v1/object/public/**' },
      { protocol: 'https', hostname: 'k.kakaocdn.net' },
      { protocol: 'https', hostname: 'lh3.googleusercontent.com' },
      { protocol: 'https', hostname: 'img.youtube.com' },
      { protocol: 'https', hostname: 'cdn.freetiful.co.kr' },
      { protocol: 'https', hostname: 'cdn.prettyful.co.kr' },
      { protocol: 'https', hostname: '*.public.blob.vercel-storage.com' },
      { protocol: 'https', hostname: 'phinf.pstatic.net' },
      { protocol: 'http', hostname: 'localhost' },
    ],
    formats: ['image/webp'],
    minimumCacheTTL: 2678400,
    deviceSizes: [375, 640, 750, 828, 1080, 1200],
    imageSizes: [32, 48, 64, 96, 128, 256],
  },
  experimental: {
    optimizePackageImports: ['lucide-react', 'framer-motion', 'date-fns'],
  },
  async headers() {
    if (process.env.NODE_ENV !== 'production') return [];
    return [
      {
        source: '/:path*.js',
        headers: [
          { key: 'Cache-Control', value: 'public, max-age=31536000, immutable' },
        ],
      },
      {
        source: '/:path*.css',
        headers: [
          { key: 'Cache-Control', value: 'public, max-age=31536000, immutable' },
        ],
      },
    ];
  },
  async redirects() {
    return [
      { source: '/login', destination: '/main', permanent: false },
      { source: '/signin', destination: '/main', permanent: false },
      { source: '/sign-in', destination: '/main', permanent: false },
      { source: '/signup', destination: '/main', permanent: false },
      { source: '/sign-up', destination: '/main', permanent: false },
      { source: '/auth/kakao', destination: '/auth/kakao/callback', permanent: false },
      { source: '/auth/kakao/mobile/callback', destination: '/auth/kakao/mobile', permanent: false },
      { source: '/kakao/mobile', destination: '/auth/kakao/mobile', permanent: false },
      { source: '/kakao/mobile/callback', destination: '/auth/kakao/mobile', permanent: false },
      { source: '/oauth/kakao', destination: '/auth/kakao/callback', permanent: false },
      { source: '/oauth/kakao/callback', destination: '/auth/kakao/callback', permanent: false },
      { source: '/auth/naver', destination: '/auth/naver/callback', permanent: false },
      { source: '/auth/naver/mobile/callback', destination: '/auth/naver/mobile', permanent: false },
      { source: '/naver/mobile', destination: '/auth/naver/mobile', permanent: false },
      { source: '/naver/mobile/callback', destination: '/auth/naver/mobile', permanent: false },
      { source: '/oauth/naver', destination: '/auth/naver/callback', permanent: false },
      { source: '/oauth/naver/callback', destination: '/auth/naver/callback', permanent: false },
      ...oauthCompatibilityRedirects('kakao'),
      ...oauthCompatibilityRedirects('naver'),
    ];
  },
  async rewrites() {
    const apiUrl = getApiBaseUrl();
    if (!apiUrl) return [];
    return [
      {
        source: '/api/v1/:path*',
        destination: `${apiUrl}/api/v1/:path*`,
      },
      // 업로드된 이미지(프로 프로필 사진, 채팅 이미지 등)는 Railway 에서 서빙됨
      {
        source: '/uploads/:path*',
        destination: `${apiUrl}/uploads/:path*`,
      },
    ];
  },
};

module.exports = nextConfig;
