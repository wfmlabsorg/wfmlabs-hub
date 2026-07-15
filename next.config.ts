import { withPayload } from '@payloadcms/next/withPayload'
import type { NextConfig } from 'next'

const nextConfig: NextConfig = {
  // @xenova/transformers (Beacon query embedding, WFM-82) ships ONNX/WASM assets that must not be
  // bundled by Next — mark external so they load at runtime in the Node serverless function.
  serverExternalPackages: ['sharp', '@xenova/transformers'],
  // Debates retired 2026-06-23 (WFM-74) — old debate URLs redirect to the research surface.
  // Pricing removed 2026-07-15 (hub-032) — operating model being rethought; temporary (307)
  // redirect so inbound links don't 404 and the URL isn't permanently claimed.
  redirects: async () => [
    { source: '/debates', destination: '/research', permanent: true },
    { source: '/debates/:slug*', destination: '/research', permanent: true },
    { source: '/pricing', destination: '/', permanent: false },
  ],
  rewrites: async () => ({
    beforeFiles: [
      // Serve ROC OpenMCT at /roc (static HTML from public/roc/index.html)
      { source: '/roc', destination: '/roc/index.html' },
    ],
    afterFiles: [],
    fallback: [],
  }),
  images: {
    remotePatterns: [
      {
        protocol: 'https',
        hostname: '**.r2.cloudflarestorage.com',
      },
    ],
  },
  headers: async () => {
    const rocOrigin = process.env.ROC_ORIGIN || 'https://roc.cloud'
    return [
      // Cross-platform auth endpoints — CORS for ROC/OVIX
      {
        source: '/api/auth/verify',
        headers: [
          { key: 'Access-Control-Allow-Origin', value: rocOrigin },
          { key: 'Access-Control-Allow-Methods', value: 'POST, OPTIONS' },
          { key: 'Access-Control-Allow-Headers', value: 'Content-Type, Authorization, X-ROC-API-Key' },
        ],
      },
      {
        source: '/api/members/profile/:path*',
        headers: [
          { key: 'Access-Control-Allow-Origin', value: rocOrigin },
          { key: 'Access-Control-Allow-Methods', value: 'GET, OPTIONS' },
          { key: 'Access-Control-Allow-Headers', value: 'Content-Type, Authorization, X-API-Key' },
        ],
      },
      // ROC static files + globe — allow iframing from same origin
      {
        source: '/roc/:path*',
        headers: [
          { key: 'X-Frame-Options', value: 'SAMEORIGIN' },
          { key: 'Cache-Control', value: 'public, max-age=0, s-maxage=60, stale-while-revalidate=30' },
        ],
      },
      {
        source: '/globe-home.html',
        headers: [
          { key: 'X-Frame-Options', value: 'SAMEORIGIN' },
        ],
      },
      // Global security headers (excludes /roc/ and globe which have their own above)
      {
        source: '/((?!roc/|globe-).*)',
        headers: [
          { key: 'X-Frame-Options', value: 'DENY' },
          { key: 'X-Content-Type-Options', value: 'nosniff' },
          { key: 'Referrer-Policy', value: 'strict-origin-when-cross-origin' },
        ],
      },
    ]
  },
}

export default withPayload(nextConfig)
