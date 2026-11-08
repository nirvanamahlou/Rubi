import { describe, it, expect } from 'vitest';
import { nextRadanSyncAt } from './hr-radan-sync-schedule';
describe('one-minute attendance synchronization', () => {
  it.each([
    ['2026-11-01T05:29:59Z', '2026-11-01T05:30:00Z'],
    ['2026-11-01T05:30:00Z', '2026-11-01T05:31:00Z'],
    ['2026-11-01T23:59:59Z', '2026-11-02T00:00:00Z'],
  ])('selects the next strict-future minute after %s', (now, expected) =>
    expect(nextRadanSyncAt(new Date(now)).toISOString()).toBe(
      new Date(expected).toISOString(),
    ),
  );
  it('rejects an invalid clock', () =>
    expect(() => nextRadanSyncAt(new Date('invalid'))).toThrow());
});
