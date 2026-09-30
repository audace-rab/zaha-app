import type { NextConfig } from "next";

const nextConfig: NextConfig = {
  transpilePackages: ['@zaha/shared'],
  turbopack: {
    root: __dirname,
  },
};

export default nextConfig;
