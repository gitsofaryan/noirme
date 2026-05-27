import type { NextConfig } from "next";
import withPWAInit from "@ducanh2912/next-pwa";

const withPWA = withPWAInit({
  dest: "public",
  disable: process.env.NODE_ENV === "development",
  register: true,
});

const nextConfig: NextConfig = {
  webpack: (config, { isServer }) => {
    if (isServer) {
      // Don't bundle 'ws' — keep it as a native Node.js require
      // This fixes the "Server is not a constructor" webpack bundling error
      config.externals = [
        ...(Array.isArray(config.externals) ? config.externals : []),
        "ws",
      ];
    }
    return config;
  },
};

export default withPWA(nextConfig);
