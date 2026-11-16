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
  return request.headers.get('origin') === expected ? expected : null;
}
