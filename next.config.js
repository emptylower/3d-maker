// Validate required environment variables at build/start time.
require('./scripts/validateEnv').validateRequiredEnv();

/** @type {import('next').NextConfig} */
const nextConfig = {
  reactStrictMode: true,
  experimental: {
    typedRoutes: true,
  },
};

module.exports = nextConfig;
