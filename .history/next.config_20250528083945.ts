/** @type {import('next').NextConfig} */
const nextConfig = {
  reactStrictMode: true,
  transpilePackages: ['leaflet'],
  experimental: {
    esmExternals: false,
  },
  webpack: (config, { buildId, dev, isServer, defaultLoaders, webpack }) => {
    // Fix for leaflet and related packages in Next.js
    config.resolve.alias = {
      ...config.resolve.alias,
      leaflet: 'leaflet/dist/leaflet.js',
    };
    
    // Add externals for server-side to avoid SSR issues
    if (isServer) {
      config.externals = [...config.externals, 'leaflet', 'leaflet-draw', 'react-leaflet-draw'];
    }
    
    // Handle CSS imports
    config.module.rules.push({
      test: /\.css$/,
      use: ['style-loader', 'css-loader'],
    });
    
    // Fix for canvas and other browser-only dependencies
    config.externals = [...(config.externals || []), { canvas: 'canvas' }];
    
    // Ignore fs module in browser
    config.resolve.fallback = {
      ...config.resolve.fallback,
      fs: false,
      net: false,
      tls: false,
    };
    
    return config;
  },
};

module.exports = nextConfig;