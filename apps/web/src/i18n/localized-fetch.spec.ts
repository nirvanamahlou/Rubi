import { afterEach, describe, expect, it, vi } from 'vitest';
import { localizedFetch } from './localized-fetch';

afterEach(() => vi.unstubAllGlobals());
describe('language-aware application requests', () => {
  it('passes language without changing the payload, credentials or concurrency headers', async () => {
    vi.stubGlobal('document', { cookie: 'nora-display-language=en' });
    const fetch = vi.fn().mockResolvedValue(new Response('{}'));
    vi.stubGlobal('fetch', fetch);
    const body = JSON.stringify({ status: 'ACTIVE', value: 'یادداشت شخصی' });
    await localizedFetch('/api/records', {
      method: 'PATCH',
      body,
      credentials: 'include',
      headers: { 'If-Match': '7' },
    });
    const [, options] = fetch.mock.calls[0]!;
    expect(new Headers(options.headers).get('Accept-Language')).toBe('en');
    expect(new Headers(options.headers).get('If-Match')).toBe('7');
    expect(options.body).toBe(body);
    expect(options.credentials).toBe('include');
  });
  it('preserves an explicitly supplied locale', async () => {
    const fetch = vi.fn().mockResolvedValue(new Response('{}'));
    vi.stubGlobal('fetch', fetch);
    await localizedFetch('/api/records', {
      headers: { 'Accept-Language': 'fa' },
    });
    expect(
      new Headers(fetch.mock.calls[0]![1].headers).get('Accept-Language'),
    ).toBe('fa');
  });
});
