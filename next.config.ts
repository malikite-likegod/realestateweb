import type { NextConfig } from 'next'
import path from 'path'

const nextConfig: NextConfig = {
  // nodemailer and Node.js built-ins used in server-only modules — exclude from webpack bundling.
  // Listed in both serverExternalPackages (for server components/routes) and webpack externals
  // (for instrumentation.ts which has its own bundle context).
  serverExternalPackages: ['nodemailer'],
  webpack: (config, { isServer }) => {
    // Explicitly set @ alias so it resolves reliably on all deployment environments
    config.resolve.alias = {
      ...config.resolve.alias,
      '@': path.resolve(__dirname),
    }
    if (isServer) {
      const existing = Array.isArray(config.externals) ? config.externals : config.externals ? [config.externals] : []
      config.externals = [...existing, 'nodemailer', 'fs', 'fs/promises', 'path', 'crypto']
    }
    return config
  },
  images: {
    remotePatterns: [
      { protocol: 'https', hostname: '**.unsplash.com' },
      { protocol: 'https', hostname: '**.cloudinary.com' },
      { protocol: 'https', hostname: '**.idx.broker' },
      { protocol: 'https', hostname: 'images.treb.com' },
    ],
  },
  experimental: {
    serverActions: {
      allowedOrigins: [
        'localhost:3000',
        'michaeltaylorrealty.com',
        'www.michaeltaylorrealty.com',
      ],
    },
  },
}

export default nextConfig
