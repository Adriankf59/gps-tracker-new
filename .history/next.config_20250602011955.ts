// next.config.ts
import type { NextConfig } from "next";
import type { Configuration as WebpackConfiguration } from "webpack";

const nextConfig: NextConfig = {
  reactStrictMode: true,
  transpilePackages: [
    "leaflet",
    "react-leaflet",
    "leaflet-draw",
    "react-leaflet-draw",
  ],
  webpack: (config: WebpackConfiguration, { isServer }) => {
    // Hanya jalankan jika tidak menggunakan Turbopack
    if (!process.env.__NEXT_EXPERIMENTAL_TURBOPACK) {
      // Alias 'leaflet$' (dengan $) agar hanya 'import "leaflet"' yang dialihkan,
      // sementara 'import "leaflet/dist/leaflet.css"' tetap mencari berkas aslinya.
      config.resolve = config.resolve || {};
      config.resolve.alias = {
        ...(config.resolve.alias || {}),
        // '$' artinya hanya modul "leaflet" (tanpa sub‐path) yang di‐alias ke JS-nya langsung
        "leaflet$": "leaflet/dist/leaflet.js",
      };

      // Jika server‐side, abaikan paket leaflet dan leaflet-draw
      if (isServer) {
        config.externals = [
          ...(config.externals || []),
          "leaflet",
          "leaflet-draw",
          "react-leaflet-draw",
        ];
      }

      // Agar modul Node semacam fs, net, tls tidak di‐bundle
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
