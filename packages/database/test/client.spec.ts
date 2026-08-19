import { describe, expect, it } from 'vitest';

import { createDatabaseClient } from '../src';

describe('database client factory', () => {
  it('fails fast when DATABASE_URL is missing', () => {
    expect(() => createDatabaseClient('')).toThrow('DATABASE_URL is required');
  });
});
