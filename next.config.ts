import type { NextConfig } from "next";

const nextConfig: NextConfig = {
  // output: 'export',  // Disabled - we need SSR for dynamic routes
  images: {
    unoptimized: true,
  },
  // For production deployment, we'll need different configuration
  // based on the deployment target (Amplify, Vercel, App Runner, etc.)
};

export default nextConfig;