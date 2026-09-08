import { NextRequest } from 'next/server';
import { describe, expect, it } from 'vitest';
import { proxy } from './proxy';
describe('Reauthentication and local build verification', () => {
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
        headers: { cookie: 'rubi_access=stale' },
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
