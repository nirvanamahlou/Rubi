/** Synthetic, network-isolated UI. This is not a Tasks or IAM service. */
export function workbenchDemoEnabled(value: string | undefined): boolean {
  return value === '1';
}

export const workbenchDemoHeaders = {
  'Content-Type': 'text/html; charset=utf-8',
  'Cache-Control': 'private, no-store, max-age=0',
  'X-Content-Type-Options': 'nosniff',
  'Referrer-Policy': 'no-referrer',
  'X-Robots-Tag': 'noindex, nofollow, noarchive',
  'Permissions-Policy': 'camera=(), microphone=(), geolocation=()',
  // Inline scripts/styles retain reference fidelity. The opaque-origin sandbox
  // cannot access the app's cookies/storage; connect/form policies forbid writes.
  'Content-Security-Policy': [
    "default-src 'none'",
    "script-src 'unsafe-inline'",
    "style-src 'unsafe-inline'",
    'img-src data: blob:',
    "connect-src 'none'",
    "form-action 'none'",
    "base-uri 'none'",
    "frame-ancestors 'self'",
    'sandbox allow-scripts allow-forms allow-downloads',
  ].join('; '),
} as const;

export function workbenchDemoResponse(html: string): Response {
  return new Response(html, { status: 200, headers: workbenchDemoHeaders });
}
