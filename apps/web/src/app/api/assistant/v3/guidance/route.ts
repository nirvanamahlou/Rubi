import { canViewRoute } from '@nora/contracts';
import { pilotGuideResponse } from '@/modules/assistant/guide-pilot';

const response = (status: number, data: unknown) =>
  Response.json(data, {
    status,
    headers: { 'Cache-Control': 'private, no-store' },
  });

export async function POST(request: Request) {
  if (request.headers.get('origin') !== new URL(request.url).origin)
    return response(403, { status: 'forbidden' });
  const cookie = request.headers
    .get('cookie')
    ?.split(';')
    .map((x) => x.trim())
    .find((x) => /^nora_access=[A-Za-z0-9_.%~-]{1,8192}$/.test(x));
  if (!cookie) return response(401, { status: 'unauthenticated' });
  const reader = request.body?.getReader();
  if (!reader) return response(400, { status: 'invalid' });
  try {
    const decoder = new TextDecoder('utf-8', { fatal: true });
    let size = 0;
    let raw = '';
    for (;;) {
      const { value, done } = await reader.read();
      if (done) break;
      size += value.byteLength;
      if (size > 4096) {
        await reader.cancel();
        return response(413, { status: 'invalid' });
      }
      raw += decoder.decode(value, { stream: true });
    }
    const input = JSON.parse(raw + decoder.decode());
    if (
      input?.version !== 3 ||
      typeof input.question !== 'string' ||
      !input.question.trim() ||
      input.question.length > 500 ||
      typeof input.panel !== 'string' ||
      input.panel.length > 160 ||
      (input.previous !== undefined &&
        (typeof input.previous !== 'string' || input.previous.length > 100))
    )
      return response(400, { status: 'invalid' });
    const base = process.env.ERP_AUTH_API_BASE_URL;
    if (!base) return response(503, { status: 'unavailable' });
    const access = await fetch(base.replace(/\/$/, '') + '/iam/auth/access', {
      headers: { cookie },
      redirect: 'error',
      cache: 'no-store',
      signal: AbortSignal.any([request.signal, AbortSignal.timeout(4000)]),
    }).catch(() => null);
    if (!access?.ok)
      return response(
        access && [401, 403].includes(access.status) ? access.status : 503,
        { status: 'unavailable' },
      );
    const actor = await access.json();
    if (
      !Array.isArray(actor.permissions) ||
      !actor.permissions.every((p: unknown) => typeof p === 'string')
    )
      return response(503, { status: 'unavailable' });
    return response(
      200,
      pilotGuideResponse(
        input.question,
        input.panel,
        input.previous,
        (href, permission) =>
          canViewRoute(actor.permissions, href) &&
          (!permission || actor.permissions.includes(permission)),
      ),
    );
  } catch {
    return response(400, { status: 'invalid' });
  } finally {
    reader.releaseLock();
  }
}
