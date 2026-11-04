import { NextResponse, type NextRequest } from 'next/server';

const ACCESS_COOKIE = 'nora_access';
const REFRESH_COOKIE = 'nora_refresh';

export function proxy(request: NextRequest) {
  if (
    ['GET', 'HEAD'].includes(request.method) &&
    /^\/d\/[A-Za-z0-9_-]{32}$/.test(request.nextUrl.pathname)
  )
    return NextResponse.next();
  if (request.nextUrl.pathname === '/human-resources') {
    const currentHr = request.nextUrl.clone();
    currentHr.pathname = '/hr';
    return NextResponse.redirect(currentHr);
  }
  if (request.nextUrl.pathname === '/api/hr-runtime')
    return NextResponse.next();
  const hasAccessCookie = Boolean(request.cookies.get(ACCESS_COOKIE)?.value);
  if (request.nextUrl.pathname === '/login') {
    // A stale access cookie must never prevent reauthentication.
    return NextResponse.next();
  }
  // Protected API handlers remain authoritative. A refresh cookie only allows
  // the browser shell to mount and recover its expired short-lived access token.
  const canRecover = Boolean(request.cookies.get(REFRESH_COOKIE)?.value);
  if (
    !hasAccessCookie &&
    (!canRecover || request.nextUrl.pathname.startsWith('/api/'))
  ) {
    if (request.nextUrl.pathname.startsWith('/api/assistant/'))
      return NextResponse.json(
        { error: { code: 'UNAUTHENTICATED' } },
        { status: 401, headers: { 'Cache-Control': 'private, no-store' } },
      );
    const login = new URL('/login', request.url);
    login.searchParams.set(
      'next',
      request.nextUrl.pathname + request.nextUrl.search,
    );
    return NextResponse.redirect(login);
  }
  return NextResponse.next();
}

export const config = {
  matcher: [
    '/((?!_next/static|_next/image|favicon.ico|brand/|images/dashboard-headers/).*)',
  ],
};
