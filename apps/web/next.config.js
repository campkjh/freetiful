/** @type {import('next').NextConfig} */
const nextConfig = {
  transpilePackages: ['@prettyful/types'],
  images: {
    domains: ['localhost', 'cdn.prettyful.co.kr', 'cdn.freetiful.co.kr', 'k.kakaocdn.net', 'lh3.googleusercontent.com', 'i.pravatar.cc', 'images.unsplash.com', 'picsum.photos'],
    formats: ['image/webp'],
  },
  async rewrites() {
    const apiUrl = process.env.NEXT_PUBLIC_API_URL;
    if (!apiUrl) return [];
    return [
      {
        source: '/api/:path*',
        destination: `${apiUrl}/api/:path*`,
      },
    ];
  },
};

module.exports = nextConfig;
