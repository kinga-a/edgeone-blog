/** @type {import('next').NextConfig} */
const nextConfig = {
  // EdgeOne Pages 框架预设：Next.js 需静态导出模式
  output: 'export',
  trailingSlash: true,
  images: {
    // 静态导出时需要禁用图片优化，图片由 EdgeOne CDN / Blob 提供
    unoptimized: true,
  },
  // 本地开发时（next dev），将 /api 代理到 edgeone pages dev 的本地代理端口。
  // 设置环境变量 DEV_API_URL=http://127.0.0.1:8787 后生效；生产环境（静态导出）忽略。
  async rewrites() {
    if (process.env.DEV_API_URL) {
      return [{ source: '/api/:path*', destination: `${process.env.DEV_API_URL}/api/:path*` }];
    }
    return [];
  },
};

export default nextConfig;
