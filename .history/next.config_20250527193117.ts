/** @type {import('next').NextConfig} */
const nextConfig = {
  reactStrictMode: true,
  transpilePackages: ['leaflet'],
  webpack: (config, { buildId, dev, isServer, defaultLoaders, webpack }) => {
    // Fix for leaflet in Next.js
    config.resolve.alias = {
      ...config.resolve.alias,
      leaflet: 'leaflet/dist/leaflet.js',
    };
    
    // Handle CSS imports
    config.module.rules.push({
      test: /\.css$/,
      use: ['style-loader', 'css-loader'],
    });
    
    return config;
  },
};

module.exports = nextConfig;