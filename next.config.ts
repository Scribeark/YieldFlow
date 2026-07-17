import type { NextConfig } from "next";
import withPWAInit from "@ducanh2912/next-pwa";

const withPWA = withPWAInit({
  dest: "public",
  disable: process.env.NODE_ENV === "development",
  register: true,
  cacheOnFrontEndNav: false,
  reloadOnOnline: true,
  workboxOptions: {
    skipWaiting: true,
    clientsClaim: true,
    cleanupOutdatedCaches: true,
  },
  fallbacks: {
    document: "/offline",
  },
});

const nextConfig: NextConfig = {
  turbopack: {},
};

export default withPWA(nextConfig);
