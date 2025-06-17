import type { NextConfig } from "next";

const nextConfig: NextConfig = {
  output: "standalone", // Required for AWS Amplify
  images: {
    unoptimized: true,
  },
  // AWS Amplify configuration
  experimental: {
    // Ensure server components work properly
    serverActions: {
      bodySizeLimit: "2mb",
    },
  },
  // Environment variables that should be available at build time
  env: {
    NEXT_PUBLIC_APP_URL:
      process.env.NEXT_PUBLIC_APP_URL || "https://gravyprompts.com",
  },
};

export default nextConfig;
