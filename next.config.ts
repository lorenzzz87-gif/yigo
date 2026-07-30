import type { NextConfig } from "next";

const nextConfig: NextConfig = {
  async rewrites() {
    return {
      afterFiles: [
        {
          source: '/pocketmoda',
          destination: '/pocketmoda/index.html',
        },
        {
          source: '/pocketmoda/:path((?!.*\\..+$).*)',
          destination: '/pocketmoda/index.html',
        },
        // SUVOO 进销存 · 面单核对（静态应用，位于 public/suvoo）
        {
          source: '/suvoo',
          destination: '/suvoo/index.html',
        },
        // SUVOO ERP · 扫码出库工具（独立静态应用）
        {
          source: '/suvoo/erp',
          destination: '/suvoo/erp/index.html',
        },
        {
          source: '/suvoo/:path((?!.*\\..+$).*)',
          destination: '/suvoo/index.html',
        },
        // SUVOO-出库管理系统：跑在 Cloudflare Worker 上（D1 + R2），这里只做反向代理。
        // 前缀在转发时被吃掉，Worker 收到的是 /api/... 和 /assets/...
        {
          source: '/suvoodeliverynote',
          destination: 'https://chuku.ydanstudio.workers.dev/',
        },
        {
          source: '/suvoodeliverynote/:path*',
          destination: 'https://chuku.ydanstudio.workers.dev/:path*',
        },
      ],
    }
  },
};

export default nextConfig;
