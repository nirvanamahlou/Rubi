import { describe, expect, it } from 'vitest';
import { dateRange } from './procurement.validation';

describe('Procurement created-date filters', () => {
  it('uses an exclusive UTC upper bound so the entire final day is included', () => {
    expect(dateRange('2026-09-01', '2026-09-15')).toEqual({
      start: new Date('2026-09-01T00:00:00.000Z'),
      endExclusive: new Date('2026-09-16T00:00:00.000Z'),
    });
  });

  it('rejects impossible days and reversed ranges', () => {
    expect(() => dateRange('2026-02-30', '')).toThrow();
    expect(() => dateRange('2026-09-16', '2026-09-15')).toThrow();
  });
});
