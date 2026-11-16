/** Validate browser Origin against server configuration, never forwarded headers. */
export function reservationMailOrigin(request: Request): string | null {
  const configured = process.env.RESERVATION_MAIL_WEB_ORIGIN?.trim();
  let expected = new URL(request.url).origin;
  if (configured) {
    try {
      const url = new URL(configured);
      if (
        url.origin !== configured ||
        url.username ||
        url.password ||
        (url.protocol !== 'https:' &&
          !(
            url.protocol === 'http:' &&
            ['localhost', '127.0.0.1', '[::1]'].includes(url.hostname)
          ))
      )
        return null;
      expected = url.origin;
    } catch {
      return null;
    }
  }
  const origin = request.headers.get('origin');
  if (configured || origin === expected)
    return origin === expected ? expected : null;
  try {
    const browserOrigin = new URL(origin ?? '');
    const requestUrl = new URL(request.url);
    // Preserve the upstream same-host TLS proxy fallback when no explicit origin is set.
    return browserOrigin.origin === origin &&
      requestUrl.protocol === 'http:' &&
      browserOrigin.protocol === 'https:' &&
      browserOrigin.host === (request.headers.get('host') ?? requestUrl.host)
      ? browserOrigin.origin
      : null;
  } catch {
    return null;
  }
}
