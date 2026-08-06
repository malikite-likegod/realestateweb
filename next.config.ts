import type { NextConfig } from 'next'
import path from 'path'

// ── Security headers ────────────────────────────────────────────────────────
// Applied to every response. CSP is built to match the app's actual needs:
//   - Google Maps JS API via @vis.gl/react-google-maps (maps.googleapis.com, maps.gstatic.com)
//     Vector maps / AdvancedMarker (mapId-based rendering) load their rendering
//     libraries with new Function(), so script-src needs 'unsafe-eval' or the
//     map silently fails to paint (CSP EvalError, no console-visible crash in UI).
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
      // Scripts: self + Google Maps. 'unsafe-eval' is required by the Maps JS
      // vector renderer (AdvancedMarker/mapId) — without it the map canvas stays blank.
      "script-src 'self' 'unsafe-inline' 'unsafe-eval' https://maps.googleapis.com https://*.gstatic.com",
      // Styles: self + inline (Tailwind generates inline styles) + Maps' injected font stylesheet
      "style-src 'self' 'unsafe-inline' https://fonts.googleapis.com",
      // Images: self, data URIs (base64 thumbnails), blob (canvas), and https for MLS/listing images + map tiles
      "img-src 'self' data: blob: https:",
      // Fonts: self + Maps' info window / control fonts
      "font-src 'self' https://fonts.gstatic.com",
      // Fetch / XHR: self + Google Maps tile API. Vector map style/legend assets are
      // fetched from various *.gstatic.com subdomains (e.g. www.gstatic.com), not just maps.gstatic.com.
      // data: is required too — the vector map's label worker fetches inline data: image URIs.
      "connect-src 'self' data: https://maps.googleapis.com https://*.gstatic.com",
      // Google Maps tiles/vector rendering run in <canvas> / workers loaded via blob URLs
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
  serverExternalPackages: ['nodemailer', 'imapflow', 'twilio', 'ioredis'],
  webpack: (config, { isServer }) => {
    // Explicitly set @ alias so it resolves reliably on all deployment environments
    config.resolve.alias = {
      ...config.resolve.alias,
      '@': path.resolve(__dirname),
    }
    if (isServer) {
      const existing = Array.isArray(config.externals) ? config.externals : config.externals ? [config.externals] : []
      config.externals = [...existing, 'nodemailer', 'imapflow', 'twilio', 'ioredis', 'fs', 'fs/promises', 'path', 'crypto']
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
