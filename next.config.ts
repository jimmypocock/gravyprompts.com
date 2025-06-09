import type { NextConfig } from "next";

const nextConfig: NextConfig = {
  // Commented out for local development with dynamic routes
  // output: 'export',
  images: {
    unoptimized: true,
  },
};

export default nextConfig;