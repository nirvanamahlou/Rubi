import { describe, expect, it } from 'vitest';

import { HealthService } from '../src/health/health.service';

describe('HealthService', () => {
  it('returns the shared API health contract', () => {
    const service = new HealthService();
    expect(service.getHealth(new Date('2026-08-19T00:00:00.000Z'))).toEqual({
      service: 'api',
      status: 'ok',
      timestamp: '2026-08-19T00:00:00.000Z',
    });
  });
});
