/** @type {import('next').NextConfig} */
  const nextConfig = {
    // Only use static export in production builds
    ...(process.env.NODE_ENV === 'production' && { output: 'export' }),
    basePath: process.env.NODE_ENV === 'production' ? '/explore-instances-sales' : '',
    assetPrefix: process.env.NODE_ENV === 'production' ? '/explore-instances-sales' : '',
    images: {
      unoptimized: true,
    },
    trailingSlash: true,
    productionBrowserSourceMaps: false,
    webpack: (config) => {
      config.resolve.fallback = {
        ...(config.resolve.fallback || {}),
        fs: false,
        http: false,
        https: false,
        zlib: false,
        url: false,
      };
      return config;
    },
  }

  module.exports = nextConfig
    