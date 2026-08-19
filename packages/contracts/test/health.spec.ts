import { describe, expect, it } from 'vitest';

import { createHealthData } from '../src';

describe('health contract', () => {
  it('creates a stable UTC health payload', () => {
    expect(
      createHealthData('api', new Date('2026-08-19T00:00:00.000Z')),
    ).toEqual({
      service: 'api',
      status: 'ok',
      timestamp: '2026-08-19T00:00:00.000Z',
    });
  });
});
