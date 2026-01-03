import type { NextConfig } from "next";

const nextConfig: NextConfig = {
  output: 'export',
  basePath: '/convert-raptor-v0.69-to-v1.0',
  assetPrefix: '/convert-raptor-v0.69-to-v1.0',
  images: {
    unoptimized: true,
  },
};

export default nextConfig;
