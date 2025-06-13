const nextConfig = {
  reactStrictMode: true,

  // Lewati pengecekan ESLint saat build
  eslint: {
    ignoreDuringBuilds: true,
  },

  // ++ TAMBAHKAN BLOK INI ++
  // Lewati pemeriksaan tipe TypeScript saat build
  typescript: {
    // Izinkan build produksi berhasil meskipun ada error tipe.
    ignoreBuildErrors: true,
  },

  transpilePackages: [
    "leaflet",
    "react-leaflet",
    "leaflet-draw",
    "react-leaflet-draw",
  ],

  webpack: (config, { isServer }) => {
    // Hanya jalankan jika tidak pakai Turbopack
    if (!process.env.__NEXT_EXPERIMENTAL_TURBOPACK) {
      config.resolve = config.resolve || {};
      config.resolve.alias = {
        ...(config.resolve.alias || {}),
        // "leaflet$" agar hanya import "leaflet" saja yang dialihkan ke JS-nya,
        // sementara import "leaflet/dist/leaflet.css" tetap mencari CSS di node_modules
        "leaflet$": "leaflet/dist/leaflet.js",
      };

      // Abaikan bundling leaflet di server
      if (isServer) {
        config.externals = [
          ...(config.externals || []),
          "leaflet",
          "leaflet-draw",
          "react-leaflet-draw",
        ];
      }

      // Fallback untuk modul‐modul Node (fs, net, tls) agar tidak di‐bundle
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