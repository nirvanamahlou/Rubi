import type { NextConfig } from 'next';

const allowedDevOrigins = (process.env.NORA_ALLOWED_DEV_ORIGINS ?? '')
  .split(',')
  .map((origin) => origin.trim())
  .filter(Boolean);

const nextConfig: NextConfig = {
  distDir: process.env.NORA_CALL_CENTER_NEXT_DIST_DIR ?? '.next',
  ...(allowedDevOrigins.length > 0 ? { allowedDevOrigins } : {}),
  reactStrictMode: true,
  poweredByHeader: false,
  images: {
    // Dashboard header artwork is decorative. Allow the intentionally lighter
    // rendition used by the active page without loosening image optimization.
    qualities: [45, 75],
  },
  outputFileTracingIncludes: {
    '/reservations/requests/*/pdf': [
      './src/modules/reservations/components/reservation-form-sheet.module.css',
      './public/brand/*.png',
    ],
    '/reservations/requests/*/tickets/pdf': ['./public/brand/*.png'],
  },
  async headers() {
    return [
      {
        source: '/:path*',
        headers: [
          { key: 'X-Content-Type-Options', value: 'nosniff' },
          { key: 'X-Frame-Options', value: 'DENY' },
          { key: 'Referrer-Policy', value: 'no-referrer' },
          {
            key: 'Permissions-Policy',
            value: 'camera=(), microphone=(), geolocation=(), payment=()',
          },
          { key: 'Cross-Origin-Opener-Policy', value: 'same-origin' },
          {
            key: 'Content-Security-Policy',
            value:
              "object-src 'none'; base-uri 'self'; frame-ancestors 'none'; form-action 'self'",
          },
        ],
      },
      {
        source: '/d/:token',
        headers: [
          {
            key: 'Content-Security-Policy',
            // Keep configuration standalone: next start does not resolve TS module imports.
            // The public-document regression checks this against the route's shared policy.
            value:
              "default-src 'none'; style-src 'unsafe-inline'; img-src data:; font-src data:; base-uri 'none'; form-action 'none'; frame-ancestors 'none'; sandbox allow-popups",
          },
        ],
      },
      {
        source: '/procurement-optimized.html',
        headers: [
          { key: 'X-Frame-Options', value: 'SAMEORIGIN' },
          {
            key: 'Content-Security-Policy',
            value:
              "object-src 'none'; base-uri 'self'; frame-ancestors 'self'; form-action 'self'",
          },
        ],
      },
      {
        source: '/package-generator/:path*',
        headers: [
          { key: 'X-Frame-Options', value: 'SAMEORIGIN' },
          {
            key: 'Content-Security-Policy',
            value:
              "object-src 'none'; base-uri 'self'; frame-ancestors 'self'; form-action 'self'",
          },
        ],
      },
    ];
  },
};

export default nextConfig;
