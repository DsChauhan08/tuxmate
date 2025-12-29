import type { NextConfig } from "next";

const nextConfig: NextConfig = {
  // Use 'export' for static hosting (CF Pages), 'standalone' for Docker/self-hosting
  output: process.env.STATIC_EXPORT === 'true' ? 'export' : 'standalone',
  images: {
    unoptimized: true,
  },
};

export default nextConfig;
