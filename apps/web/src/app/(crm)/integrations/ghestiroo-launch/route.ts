import { randomBytes } from 'node:crypto';

export const runtime = 'nodejs';

/** A scoped navigation document supplies its own form policy; the CRM stays self-only. */
export async function POST(request: Request) {
  const origin = request.headers.get('origin');
  const host = request.headers.get('host') ?? new URL(request.url).host;
  let validOrigin = false;
  try {
    const parsed = new URL(origin ?? '');
    validOrigin =
      parsed.host === host &&
      parsed.origin === origin &&
      (parsed.protocol === 'https:' ||
        (process.env.NODE_ENV !== 'production' && parsed.protocol === 'http:'));
  } catch {
    /* Missing and opaque origins fail closed. */
  }
  // no-referrer can make native form POST origins null. Fetch metadata still
  // distinguishes same-origin navigation from a foreign site's form.
  const sameOriginNavigation =
    (origin === 'null' || origin === null) &&
    request.headers.get('sec-fetch-site') === 'same-origin' &&
    request.headers.get('sec-fetch-mode') === 'navigate' &&
    request.headers.get('sec-fetch-dest') === 'document';
  if (!validOrigin && !sameOriginNavigation)
    return new Response('Forbidden', { status: 403 });
  if (
    !request.headers
      .get('content-type')
      ?.startsWith('application/x-www-form-urlencoded')
  )
    return new Response('Unsupported media type', { status: 415 });
  const reader = request.body?.getReader();
  if (!reader) return new Response('Invalid request', { status: 400 });
  const chunks: Uint8Array[] = [];
  let bytes = 0;
  try {
    while (true) {
      const { done, value } = await reader.read();
      if (done) break;
      bytes += value.length;
      if (bytes > 2048) {
        await reader.cancel();
        return new Response('Too large', { status: 413 });
      }
      chunks.push(value);
    }
  } finally {
    reader.releaseLock();
  }
  try {
    const data = new URLSearchParams(Buffer.concat(chunks).toString());
    const action = new URL(data.get('action') ?? '');
    const token = data.get('token') ?? '';
    const local =
      process.env.NODE_ENV !== 'production' &&
      ['localhost', '127.0.0.1'].includes(action.hostname);
    if (
      !/^[A-Za-z0-9_-]{64}$/.test(token) ||
      action.username ||
      action.password ||
      action.search ||
      action.hash ||
      action.pathname !== '/admin/nora-sso' ||
      (!local &&
        (action.protocol !== 'https:' ||
          (action.port && action.port !== '443'))) ||
      (local && action.protocol !== 'http:')
    )
      throw Error();
    const escape = (value: string) =>
      value
        .replaceAll('&', '&amp;')
        .replaceAll('"', '&quot;')
        .replaceAll('<', '&lt;')
        .replaceAll('>', '&gt;');
    const nonce = randomBytes(18).toString('base64');
    const html = `<!doctype html><html lang="fa" dir="rtl"><meta charset="utf-8"><title>ورود امن به قسطی‌رو</title><body><p>در حال انتقال به پنل قسطی‌رو…</p><form id="launch" method="post" action="${escape(action.href)}"><input type="hidden" name="token" value="${token}"><button type="submit">ادامه ورود به قسطی‌رو</button></form><script nonce="${nonce}">document.getElementById('launch').submit()</script></body></html>`;
    return new Response(html, {
      headers: {
        'Content-Type': 'text/html; charset=utf-8',
        'Cache-Control': 'private, no-store',
        'Referrer-Policy': 'origin',
        'Content-Security-Policy': `default-src 'none'; base-uri 'none'; frame-ancestors 'none'; form-action ${action.origin}; script-src 'nonce-${nonce}'`,
      },
    });
  } catch {
    return new Response('Invalid request', { status: 400 });
  }
}
