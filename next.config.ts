import type { NextConfig } from 'next'

const nextConfig: NextConfig = {
  // nodemailer uses Node.js built-ins (stream, fs, crypto) — exclude from webpack bundling.
  // Listed in both serverExternalPackages (for server components/routes) and webpack externals
  // (for instrumentation.ts which has its own bundle context).
  serverExternalPackages: ['nodemailer'],
  webpack: (config, { isServer }) => {
    if (isServer) {
      const existing = Array.isArray(config.externals) ? config.externals : config.externals ? [config.externals] : []
      config.externals = [...existing, 'nodemailer']
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
    serverActions: { allowedOrigins: ['localhost:3000'] },
  },
}

export default nextConfig
