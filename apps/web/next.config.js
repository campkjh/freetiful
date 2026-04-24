/** @type {import('next').NextConfig} */
function getApiBaseUrl() {
  const raw = process.env.NEXT_PUBLIC_API_URL?.replace(/\/+$/, '');
  return raw?.replace(/\/api\/v1$/, '').replace(/\/api$/, '');
}

const nextConfig = {
  compress: true,
  poweredByHeader: false,
  reactStrictMode: false,
  transpilePackages: ['@prettyful/types'],
  images: {
    domains: ['localhost', 'cdn.prettyful.co.kr', 'cdn.freetiful.co.kr', 'k.kakaocdn.net', 'lh3.googleusercontent.com', 'i.pravatar.cc', 'images.unsplash.com', 'picsum.photos', 'jnhwlzeyberhyv7s.public.blob.vercel-storage.com'],
    // Supabase Storage 공개 URL (프로젝트별 고유 서브도메인) 전부 허용
    remotePatterns: [
      { protocol: 'https', hostname: '*.supabase.co', pathname: '/storage/v1/object/public/**' },
    ],
    formats: ['image/avif', 'image/webp'],
    unoptimized: true,
    minimumCacheTTL: 2678400,
  },
  experimental: {
    optimizePackageImports: ['lucide-react'],
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
      { source: '/auth/kakao', destination: '/auth/kakao/callback', permanent: false },
      { source: '/oauth/kakao', destination: '/auth/kakao/callback', permanent: false },
      { source: '/oauth/kakao/callback', destination: '/auth/kakao/callback', permanent: false },
      { source: '/login/oauth2/code/kakao', destination: '/auth/kakao/callback', permanent: false },
      { source: '/auth/naver', destination: '/auth/naver/callback', permanent: false },
      { source: '/oauth/naver', destination: '/auth/naver/callback', permanent: false },
      { source: '/oauth/naver/callback', destination: '/auth/naver/callback', permanent: false },
      { source: '/login/oauth2/code/naver', destination: '/auth/naver/callback', permanent: false },
    ];
  },
  async rewrites() {
    const apiUrl = getApiBaseUrl();
    if (!apiUrl) return [];
    return [
      {
        source: '/api/:path*',
        destination: `${apiUrl}/api/:path*`,
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
