/** @type {import('next').NextConfig} */
const nextConfig = {
  // Exclude native modules from webpack bundling (handled by Node.js at runtime)
  webpack: (config, { isServer }) => {
    if (isServer) {
      config.externals.push('better-sqlite3');
    }
    return config;
  },
};

export default nextConfig;
