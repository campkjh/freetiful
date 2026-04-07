/** @type {import('next').NextConfig} */
const nextConfig = {
  transpilePackages: ['@prettyful/types'],
  images: {
    domains: ['localhost', 'cdn.prettyful.co.kr', 'k.kakaocdn.net', 'lh3.googleusercontent.com'],
    formats: ['image/webp'],
  },
  async rewrites() {
    return [
      {
        source: '/api/:path*',
        destination: `${process.env.NEXT_PUBLIC_API_URL}/api/:path*`,
      },
    ];
  },
};

module.exports = nextConfig;
