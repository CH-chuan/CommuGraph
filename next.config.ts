import type { NextConfig } from "next";

const nextConfig: NextConfig = {
  // Enable server actions with larger body size for file uploads
  experimental: {
    serverActions: {
      bodySizeLimit: '10mb',
    },
  },
};

export default nextConfig;
