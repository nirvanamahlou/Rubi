import { describe, it, expect } from 'vitest';
import { nextRadanSyncAt } from './hr-radan-sync-schedule';
describe('Tehran attendance synchronization slots', () => {
  it.each([
    ['2026-11-01T05:29:59Z', '2026-11-01T05:30:00Z'],
    ['2026-11-01T05:30:00Z', '2026-11-01T05:45:00Z'],
    ['2026-11-01T05:45:01Z', '2026-11-01T06:00:00Z'],
    ['2026-11-01T06:15:00Z', '2026-11-01T06:30:00Z'],
    ['2026-11-01T06:30:00Z', '2026-11-01T07:30:00Z'],
    ['2026-11-01T13:29:59Z', '2026-11-01T13:30:00Z'],
    ['2026-11-01T13:30:00Z', '2026-11-01T13:45:00Z'],
    ['2026-11-01T14:00:00Z', '2026-11-01T14:15:00Z'],
    ['2026-11-01T14:15:00Z', '2026-11-01T14:30:00Z'],
    ['2026-11-01T14:30:00Z', '2026-11-01T15:30:00Z'],
    ['2026-11-01T20:29:59Z', '2026-11-01T20:30:00Z'],
  ])('schedules the next strict-future slot after %s', (now, expected) =>
    expect(nextRadanSyncAt(new Date(now)).toISOString()).toBe(
      new Date(expected).toISOString(),
    ),
  );
  it('rejects an invalid clock', () =>
    expect(() => nextRadanSyncAt(new Date('invalid'))).toThrow());
});
