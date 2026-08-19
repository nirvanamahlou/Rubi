import { afterEach, describe, expect, it } from 'vitest';

import { getPublicApiBaseUrl } from './environment';

const originalValue = process.env.NEXT_PUBLIC_API_BASE_URL;

afterEach(() => {
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
  });
});
