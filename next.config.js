/** @type {import('next').NextConfig} */
  const nextConfig = {
    output: 'export',
    basePath: process.env.NODE_ENV === 'production' ? '/explore-instances-sales' : '',
    assetPrefix: process.env.NODE_ENV === 'production' ? '/explore-instances-sales' : '',
    reactStrictMode: false,
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
    