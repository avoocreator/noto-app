import type { NextConfig } from "next";

// Noto v2 — 100% client-side (data di IndexedDB + Supabase langsung dari
// browser/HP). Static export → bisa di-host gratis (Vercel/Netlify/Cloudflare
// Pages) dan dibungkus Capacitor menjadi APK Android dengan widget asli.
const nextConfig: NextConfig = {
  output: "export",
  images: { unoptimized: true },
  typescript: {
    ignoreBuildErrors: true,
  },
  reactStrictMode: false,
};

export default nextConfig;
