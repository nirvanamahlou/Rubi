import { NextResponse, type NextRequest } from 'next/server';

const ACCESS_COOKIE = 'rubi_access';

export function proxy(request: NextRequest) {
  if (request.nextUrl.pathname === '/api/auth/login')
    return NextResponse.next();
  const hasAccessCookie = Boolean(request.cookies.get(ACCESS_COOKIE)?.value);
  if (request.nextUrl.pathname === '/login') {
    return hasAccessCookie
      ? NextResponse.redirect(new URL('/dashboard', request.url))
      : NextResponse.next();
  }
  if (!hasAccessCookie) {
    const login = new URL('/login', request.url);
    login.searchParams.set('next', request.nextUrl.pathname);
    return NextResponse.redirect(login);
  }
  return NextResponse.next();
}

export const config = {
  matcher: ['/((?!_next/static|_next/image|favicon.ico|brand/).*)'],
};
