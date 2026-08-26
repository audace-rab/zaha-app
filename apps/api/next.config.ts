import type { NextConfig } from "next";

const nextConfig: NextConfig = {
  transpilePackages: ['@zaha/shared'],
  experimental: {
    serverActions: {
      bodySizeLimit: '10mb',
    },
  },
};

export default nextConfig;
