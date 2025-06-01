import type { NextConfig } from "next";
import type { Configuration as WebpackConfiguration } from "webpack";

const nextConfig: NextConfig = {
  reactStrictMode: true,

  // Lewati pengecekan ESLint/TSLint saat build
  eslint: {
    ignoreDuringBuilds: true,
  },

  transpilePackages: [
    "leaflet",
    "react-leaflet",
    "leaflet-draw",
    "react-leaflet-draw",
  ],

  webpack: (config: WebpackConfiguration, { isServer }) => {
    // Hanya jalankan jika tidak menggunakan Turbopack
    if (!process.env.__NEXT_EXPERIMENTAL_TURBOPACK) {
      config.resolve = config.resolve || {};
      config.resolve.alias = {
        ...(config.resolve.alias || {}),
        // Alias "leaflet$" agar import "leaflet" menunjuk ke dist JS-nya,
        // tetapi "leaflet/dist/leaflet.css" tetap mencari berkas CSS di node_modules.
        "leaflet$": "leaflet/dist/leaflet.js",
      };

      // Agar Next.js tidak mencoba mem‐bundle leaflet di server
      if (isServer) {
        config.externals = [
          ...(config.externals || []),
          "leaflet",
          "leaflet-draw",
          "react-leaflet-draw",
        ];
      }

      // Fallback untuk modul Node yang hanya di‐browser
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
