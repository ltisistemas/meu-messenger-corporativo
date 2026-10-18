const rawApiUrl = process.env.NEXT_PUBLIC_API_URL || 'http://localhost:3001';
const backendOrigin = rawApiUrl.replace(/\/api\/?$/, '').replace(/\/+$/, '');

const nextConfig = {
  reactStrictMode: true,
  transpilePackages: [],
  async rewrites() {
    return [
      {
        source: '/api/:path*',
        destination: `${backendOrigin}/api/:path*`,
      },
    ];
  },
};

export default nextConfig;
