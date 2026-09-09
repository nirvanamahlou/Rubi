import { afterEach, describe, expect, it, vi } from 'vitest';

import { getHealthEndpoint, getPublicApiBaseUrl } from './environment';

const originalValue = process.env.NEXT_PUBLIC_API_BASE_URL;

afterEach(() => {
  vi.unstubAllGlobals();
  if (originalValue === undefined) {
    delete process.env.NEXT_PUBLIC_API_BASE_URL;
  } else {
    process.env.NEXT_PUBLIC_API_BASE_URL = originalValue;
  }
});

describe('web environment', () => {
  it('normalizes a configured API base URL', () => {
    process.env.NEXT_PUBLIC_API_BASE_URL = 'https://api.rubi.test/api/v1/';
    expect(getPublicApiBaseUrl()).toBe('https://api.rubi.test/api/v1');
    expect(getHealthEndpoint()).toBe('https://api.rubi.test/api/v1/health');
  });

  it('does not hardcode an API address when configuration is missing', () => {
    delete process.env.NEXT_PUBLIC_API_BASE_URL;
    expect(getPublicApiBaseUrl()).toBeNull();
    expect(getHealthEndpoint()).toBeNull();
  });

  it('discovers the local API when a localhost build has no injected address', () => {
    delete process.env.NEXT_PUBLIC_API_BASE_URL;
    vi.stubGlobal('window', {
      location: {
        hostname: 'localhost',
        origin: 'http://localhost:3100',
      },
    });

    expect(getPublicApiBaseUrl()).toBe('http://localhost:4000/api/v1');
    expect(getHealthEndpoint()).toBe('http://localhost:4000/api/v1/health');
  });
});
