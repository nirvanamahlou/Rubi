import { afterEach, describe, expect, it, vi } from 'vitest';
import { getPublicApiBaseUrl } from './environment';

afterEach(() => {
  vi.unstubAllEnvs();
  vi.unstubAllGlobals();
});
describe('local API cookie hostname alignment', () => {
  it.each([
    [
      'localhost',
      'http://127.0.0.1:4190/api/v1',
      'http://localhost:4190/api/v1',
    ],
    [
      '127.0.0.1',
      'http://localhost:4190/api/v1/',
      'http://127.0.0.1:4190/api/v1',
    ],
    [
      'localhost',
      'https://api.example.test/api/v1',
      'https://api.example.test/api/v1',
    ],
    [
      'crm.example.test',
      'http://localhost:4190/api/v1',
      'http://localhost:4190/api/v1',
    ],
    ['localhost', '/api/v1', '/api/v1'],
  ])('keeps %s compatible with %s', (hostname, configured, expected) => {
    vi.stubGlobal('window', { location: { hostname } });
    vi.stubEnv('NEXT_PUBLIC_API_BASE_URL', configured);
    expect(getPublicApiBaseUrl()).toBe(expected);
  });
});
