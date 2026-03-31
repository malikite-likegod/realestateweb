import type { NextConfig } from 'next'
import path from 'path'

// ── Security headers ────────────────────────────────────────────────────────
// Applied to every response. CSP is built to match the app's actual needs:
//   - Google Maps JS API (maps.googleapis.com, maps.gstatic.com)
//   - Uploaded images served from /uploads (same origin)
//   - Inline styles used by Tailwind and third-party components
// HSTS is set for production; browsers will enforce HTTPS for 2 years.
const securityHeaders = [
  // Prevent MIME-type sniffing
  { key: 'X-Content-Type-Options', value: 'nosniff' },
  // Deny framing from any origin (clickjacking)
  { key: 'X-Frame-Options', value: 'SAMEORIGIN' },
  // Limit referrer info sent to external sites
  { key: 'Referrer-Policy', value: 'strict-origin-when-cross-origin' },
  // Disable unused browser features
  { key: 'Permissions-Policy', value: 'camera=(), microphone=(), geolocation=(self)' },
  // HTTPS enforcement (2 years, include subdomains)
  { key: 'Strict-Transport-Security', value: 'max-age=63072000; includeSubDomains; preload' },
  {
    key: 'Content-Security-Policy',
    value: [
      // Only load resources from self by default
      "default-src 'self'",
      // Scripts: self + Google Maps (loaded by @googlemaps/js-api-loader)
      "script-src 'self' 'unsafe-inline' https://maps.googleapis.com",
      // Styles: self + inline (Tailwind generates inline styles)
      "style-src 'self' 'unsafe-inline'",
      // Images: self, data URIs (base64 thumbnails), blob (canvas), and https for MLS/listing images
      "img-src 'self' data: blob: https:",
      // Fonts: self only (no external font CDN)
      "font-src 'self'",
      // Fetch / XHR: self + Google Maps tile API
      "connect-src 'self' https://maps.googleapis.com https://maps.gstatic.com",
      // Google Maps tiles rendered in <canvas> / workers
      "worker-src blob:",
      "child-src blob:",
      // Map tile images from Google
      "frame-src 'none'",
    ].join('; '),
  },
]

const nextConfig: NextConfig = {
  output: 'standalone',
  // nodemailer and Node.js built-ins used in server-only modules — exclude from webpack bundling.
  // Listed in both serverExternalPackages (for server components/routes) and webpack externals
  // (for instrumentation.ts which has its own bundle context).
  serverExternalPackages: ['nodemailer', 'imapflow', 'twilio'],
  webpack: (config, { isServer }) => {
    // Explicitly set @ alias so it resolves reliably on all deployment environments
    config.resolve.alias = {
      ...config.resolve.alias,
      '@': path.resolve(__dirname),
    }
    if (isServer) {
      const existing = Array.isArray(config.externals) ? config.externals : config.externals ? [config.externals] : []
      config.externals = [...existing, 'nodemailer', 'imapflow', 'twilio', 'fs', 'fs/promises', 'path', 'crypto']
    }
    return config
  },
  images: {
    remotePatterns: [
      { protocol: 'https', hostname: '**.unsplash.com' },
      { protocol: 'https', hostname: '**.cloudinary.com' },
      { protocol: 'https', hostname: '**.idx.broker' },
      { protocol: 'https', hostname: 'images.treb.com' },
      { protocol: 'https', hostname: '**.ampre.ca' },
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
  async headers() {
    return [{ source: '/(.*)', headers: securityHeaders }]
  },
}

export default nextConfig
