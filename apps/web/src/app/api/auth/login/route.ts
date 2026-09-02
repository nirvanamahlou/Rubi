import { NextResponse } from 'next/server';

import { getPublicApiBaseUrl } from '@/lib/environment';

export const dynamic = 'force-dynamic';

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
    for (const cookie of upstream.headers.getSetCookie())
      response.headers.append('set-cookie', cookie);
    return response;
  } catch {
    return NextResponse.json(
      { message: 'ارتباط با سرور ورود برقرار نشد.' },
      { status: 503 },
    );
  }
}
