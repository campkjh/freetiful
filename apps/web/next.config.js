/** @type {import('next').NextConfig} */
const nextConfig = {
  transpilePackages: ['@prettyful/types'],
  images: {
    domains: ['localhost', 'cdn.prettyful.co.kr', 'cdn.freetiful.co.kr', 'k.kakaocdn.net', 'lh3.googleusercontent.com', 'i.pravatar.cc', 'images.unsplash.com', 'picsum.photos'],
    formats: ['image/avif', 'image/webp'],
    unoptimized: true,
  },
  async rewrites() {
    const apiUrl = process.env.NEXT_PUBLIC_API_URL;
    if (!apiUrl) return [];
    return [
      {
        source: '/api/:path*',
        destination: `${apiUrl}/api/:path*`,
      },
      {
        // 파트너 신청 시 업로드된 이미지(/uploads/*.webp 등)를 Railway API 서버에서 가져오기
        source: '/uploads/:path*',
        destination: `${apiUrl}/uploads/:path*`,
      },
    ];
  },
};

module.exports = nextConfig;
