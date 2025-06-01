import type { NextConfig } from "next";

/** @type {import('next').NextConfig} */
const nextConfig: NextConfig = {
  reactStrictMode: true,
  transpilePackages: [
    "leaflet",
    "react-leaflet",
    "leaflet-draw",
    "react-leaflet-draw",
  ],

  eslint: {
    ignoreDuringBuilds: true,
  },

  webpack: (
    config: any,
    { isServer }: { isServer: boolean }
  ): any => {
    // Only apply webpack tweaks when not using Turbopack
    if (!process.env.__NEXT_EXPERIMENTAL_TURBOPACK) {
      // Pastikan resolve dan externals terdefinisi
      config.resolve = config.resolve || {};
      config.resolve.alias = {
        ...(config.resolve.alias || {}),
        leaflet: "leaflet/dist/leaflet.js",
      };

      // Tambahkan externals saat server‐side (untuk menghindari masalah SSR)
      if (isServer) {
        config.externals = [
          ...(Array.isArray(config.externals) ? config.externals : []),
          "leaflet",
          "leaflet-draw",
          "react-leaflet-draw",
        ];
      }

      // Fix untuk dependensi browser‐only (seperti canvas)
      config.externals = [
        ...(Array.isArray(config.externals) ? config.externals : []),
        { canvas: "canvas" },
      ];

      // Abaikan module fs, net, tls di sisi browser
      config.resolve.fallback = {
        ...(config.resolve.fallback || {}),
        fs: false,
        net: false,
        tls: false,
      };
    }

    return config;
  },
};

export default nextConfig;
