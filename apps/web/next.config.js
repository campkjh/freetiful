/** @type {import('next').NextConfig} */
const nextConfig = {
  compress: true,
  poweredByHeader: false,
  reactStrictMode: false,
  transpilePackages: ['@prettyful/types'],
  images: {
    domains: ['localhost', 'cdn.prettyful.co.kr', 'cdn.freetiful.co.kr', 'k.kakaocdn.net', 'lh3.googleusercontent.com', 'i.pravatar.cc', 'images.unsplash.com', 'picsum.photos', 'jnhwlzeyberhyv7s.public.blob.vercel-storage.com'],
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
  async rewrites() {
    const apiUrl = process.env.NEXT_PUBLIC_API_URL;
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
