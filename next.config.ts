import type { NextConfig } from "next";

const nextConfig: NextConfig = {
  images: {
    remotePatterns: [
      // Supabase Storage
      { protocol: "https", hostname: "*.supabase.co" },
      { protocol: "https", hostname: "*.supabase.in" },
      // Firebase Storage
      { protocol: "https", hostname: "firebasestorage.googleapis.com" },
    ],
  },
  turbopack: {
    root: typeof process !== 'undefined' ? process.cwd() : undefined,
  },
};

export default nextConfig;
