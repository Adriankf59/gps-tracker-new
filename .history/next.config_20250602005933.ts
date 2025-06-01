/** @type {import('next').NextConfig} */
const nextConfig = {
  reactStrictMode: true,
  transpilePackages: [
    'leaflet',
    'react-leaflet',
    'leaflet-draw',
    'react-leaflet-draw',
  ],

  // Tambahkan bagian ini:
  eslint: {
    ignoreDuringBuilds: true,
  },

  webpack: (config, { isServer }) => {
    // Only apply webpack config when not using Turbopack
    if (!process.env.__NEXT_EXPERIMENTAL_TURBOPACK) {
      // Fix for leaflet and related packages in Next.js
      config.resolve.alias = {
        ...config.resolve.alias,
        leaflet: 'leaflet/dist/leaflet.js',
      };

      // Add externals for server-side to avoid SSR issues
      if (isServer) {
        config.externals = [
          ...(config.externals || []),
          'leaflet',
          'leaflet-draw',
          'react-leaflet-draw',
        ];
      }

      // Fix for canvas and other browser-only dependencies
      config.externals = [...(config.externals || []), { canvas: 'canvas' }];

      // Ignore fs module in browser
      config.resolve.fallback = {
        ...config.resolve.fallback,
        fs: false,
        net: false,
        tls: false,
      };
    }

    return config;
  },
};

export default nextConfig;
