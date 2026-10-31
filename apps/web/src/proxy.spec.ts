import { NextRequest } from 'next/server';
import { describe, expect, it } from 'vitest';
import { config, proxy } from './proxy';
describe('Reauthentication and local build verification', () => {
  it.each([
    '/sales/contracts/new',
    '/reservations?section=hotel',
    '/ticket-purchases',
  ])('lets the shell recover an expired access cookie on %s', (route) => {
    const response = proxy(
      new NextRequest(`http://localhost:3116${route}`, {
        headers: { cookie: 'nora_refresh=opaque-refresh-cookie' },
      }),
    );
    expect(response.headers.get('location')).toBeNull();
    expect(response.headers.get('x-middleware-next')).toBe('1');
  });
  it('does not treat a refresh cookie as API authentication', () => {
    const response = proxy(
      new NextRequest('http://localhost:3116/api/assistant/executive', {
        headers: { cookie: 'nora_refresh=opaque-refresh-cookie' },
      }),
    );
    expect(response.status).toBe(401);
  });
  it('returns uncached JSON401 for assistant fetches instead of HTML login redirects', async () => {
    for (const path of [
      '/api/assistant/executive',
      '/api/assistant/actions/daily-summary',
      '/api/assistant/actions/sales-analysis',
      '/api/assistant/actions/receivables-follow-up',
    ]) {
      const response = proxy(new NextRequest(`http://localhost:3000${path}`));
      expect(response.status).toBe(401);
      expect(response.headers.get('location')).toBeNull();
      expect(response.headers.get('cache-control')).toBe('private, no-store');
      expect(await response.json()).toEqual({
        error: { code: 'UNAUTHENTICATED' },
      });
      const stale = proxy(
        new NextRequest(`http://localhost:3000${path}`, {
          headers: { cookie: 'nora_access=stale' },
        }),
      );
      expect(stale.headers.get('x-middleware-next')).toBe('1');
    }
    expect(
      proxy(new NextRequest('http://localhost:3000/assistant')).headers.get(
        'location',
      ),
    ).toContain('/login');
  });
  it('keeps decorative dashboard header artwork publicly reachable', () => {
    expect(config.matcher[0]).toContain('images/dashboard-headers/');
  });
  it('redirects the legacy route before mounting a second authenticated shell', () => {
    const request = new NextRequest(
      'http://localhost:3100/human-resources?section=employees&employee=employee-1',
    );
    const response = proxy(request);
    expect(response.status).toBe(307);
    expect(response.headers.get('location')).toBe(
      'http://localhost:3100/hr?section=employees&employee=employee-1',
    );
    expect(
      proxy(new NextRequest(response.headers.get('location')!)).headers.get(
        'location',
      ),
    ).toContain('/login');
  });
  it('allows login even when an invalid or expired access cookie is present', () => {
    const response = proxy(
      new NextRequest('http://localhost:3100/login?next=%2Fhr', {
        headers: { cookie: 'nora_access=stale' },
      }),
    );
    expect(response.headers.get('location')).toBeNull();
  });
  it('retains the HR section when redirecting unauthenticated users', () => {
    const response = proxy(
      new NextRequest('http://localhost:3100/hr?section=employees'),
    );
    const location = new URL(response.headers.get('location')!);
    expect(location.searchParams.get('next')).toBe('/hr?section=employees');
  });
  it('exposes only non-sensitive build metadata without requiring a session', () => {
    expect(
      proxy(
        new NextRequest('http://localhost:3100/api/hr-runtime'),
      ).headers.get('location'),
    ).toBeNull();
    expect(
      proxy(new NextRequest('http://localhost:3100/hr')).headers.get(
        'location',
      ),
    ).toContain('/login');
  });
});
