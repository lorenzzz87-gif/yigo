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
        {
          source: '/suvoo/:path((?!.*\\..+$).*)',
          destination: '/suvoo/index.html',
        },
      ],
    }
  },
};

export default nextConfig;
