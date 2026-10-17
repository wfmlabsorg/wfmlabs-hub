import { withPayload } from '@payloadcms/next/withPayload'
import type { NextConfig } from 'next'

const nextConfig: NextConfig = {
  // @xenova/transformers (Beacon query embedding, WFM-82) ships ONNX/WASM assets that must not be
  // bundled by Next — mark external so they load at runtime in the Node serverless function.
  serverExternalPackages: ['sharp', '@xenova/transformers'],
  // Debates retired 2026-06-23 (WFM-74) — old debate URLs redirect to the research surface.
  // Pricing removed 2026-07-15 (hub-032) — operating model being rethought; temporary (307)
  // redirect so inbound links don't 404 and the URL isn't permanently claimed.
  // ROC / OpenMCT globe hibernated 2026-09-05 (hub-052) — temporary (307) redirect home,
  // same pattern as /pricing. The static app stays in public/roc/ for an easy restore:
  // re-add the `/roc → /roc/index.html` rewrite and the SAMEORIGIN headers below.
  redirects: async () => [
    { source: '/debates', destination: '/research', permanent: true },
    { source: '/debates/:slug*', destination: '/research', permanent: true },
    { source: '/pricing', destination: '/', permanent: false },
    { source: '/roc', destination: '/', permanent: false },
    { source: '/roc/index.html', destination: '/', permanent: false },
    { source: '/roc/dashboards/:path*', destination: '/', permanent: false },
    { source: '/roc/admin/:path*', destination: '/', permanent: false },
    { source: '/globe-home.html', destination: '/', permanent: false },
    // NOT redirected: /roc/globe/* — the travelrisk airport globe lives there and
    // that surface is untouched by hub-052.
  ],
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
      // travelrisk airport globe — still served from /roc/globe/, still iframe-able same-origin
      {
        source: '/roc/globe/:path*',
        headers: [
          { key: 'X-Frame-Options', value: 'SAMEORIGIN' },
          { key: 'Cache-Control', value: 'public, max-age=0, s-maxage=60, stale-while-revalidate=30' },
        ],
      },
      // Global security headers (excludes /roc/globe/ above). The OpenMCT app and
      // /globe-home.html used to be excluded too; both redirect home while hibernated (hub-052).
      {
        source: '/((?!roc/globe/).*)',
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
