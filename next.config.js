/** @type {import('next').NextConfig} */
const nextConfig = {
  // 静态资源缓存配置
  async headers() {
    return [
      {
        // 优化后的图片 - 长期缓存（1年）
        source: '/images/optimized/:path*',
        headers: [
          {
            key: 'Cache-Control',
            value: 'public, max-age=31536000, immutable',
          },
        ],
      },
      {
        // 图片映射 JSON - 中等缓存（1天）
        source: '/images/optimized/image-mapping.json',
        headers: [
          {
            key: 'Cache-Control',
            value: 'public, max-age=86400, stale-while-revalidate=604800',
          },
        ],
      },
    ];
  },
}

module.exports = nextConfig

