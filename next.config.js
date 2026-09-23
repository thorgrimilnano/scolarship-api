/** @type {import('next').NextConfig} */
const nextConfig = {
  // better-sqlite3 ships a native binary; keep it external to the server
  // bundle so Next.js doesn't try to webpack it.
  experimental: {
    serverComponentsExternalPackages: ['better-sqlite3'],
  },
};

module.exports = nextConfig;
