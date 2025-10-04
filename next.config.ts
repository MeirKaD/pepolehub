import type { NextConfig } from "next";

const nextConfig: NextConfig = {
  transpilePackages: ['three'],
  images: {
    remotePatterns: [
      {
        protocol: 'https',
        hostname: 'idsai.net.technion.ac.il',
      },
    ],
  },
};

export default nextConfig;
