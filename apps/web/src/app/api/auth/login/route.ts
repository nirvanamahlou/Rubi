import { NextResponse } from 'next/server';

import { getPublicApiBaseUrl } from '@/lib/environment';

export const dynamic = 'force-dynamic';

function cookieValue(headers: Headers, name: string): string | null {
  const getSetCookie = (
    headers as Headers & { getSetCookie?: () => string[] }
  ).getSetCookie;
  const rawCookies =
    typeof getSetCookie === 'function'
      ? getSetCookie.call(headers)
      : (headers.get('set-cookie') ?? '').split(
          /,(?=\s*rubi_(?:access|refresh)=)/,
        );
  const prefix = `${name}=`;
  const cookie = rawCookies.find((value) => value.trim().startsWith(prefix));
  return cookie?.trim().slice(prefix.length).split(';', 1)[0] ?? null;
}

export async function POST(request: Request) {
  const api = getPublicApiBaseUrl();
  if (!api)
    return NextResponse.json(
      { message: 'آدرس API تنظیم نشده است.' },
      { status: 503 },
    );
  try {
    const upstream = await fetch(`${api}/iam/auth/login`, {
      method: 'POST',
      cache: 'no-store',
      headers: { 'content-type': 'application/json' },
      body: await request.text(),
    });
    const response = new NextResponse(await upstream.text(), {
      status: upstream.status,
      headers: {
        'cache-control': 'private, no-store',
        'content-type':
          upstream.headers.get('content-type') ?? 'application/json',
      },
    });
    if (upstream.ok) {
      const access = cookieValue(upstream.headers, 'rubi_access');
      const refresh = cookieValue(upstream.headers, 'rubi_refresh');
      if (!access || !refresh)
        return NextResponse.json(
          { message: 'نشست ورود از سرور دریافت نشد.' },
          { status: 502 },
        );
      const cookieOptions = {
        httpOnly: true,
        sameSite: 'lax' as const,
        secure: process.env.NODE_ENV === 'production',
        path: '/',
      };
      response.cookies.set('rubi_access', access, {
        ...cookieOptions,
        maxAge: 15 * 60,
      });
      response.cookies.set('rubi_refresh', refresh, {
        ...cookieOptions,
        maxAge: 14 * 24 * 60 * 60,
      });
    }
    return response;
  } catch {
    return NextResponse.json(
      { message: 'ارتباط با سرور ورود برقرار نشد.' },
      { status: 503 },
    );
  }
}
