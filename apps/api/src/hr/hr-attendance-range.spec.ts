import { afterEach, expect, it, vi } from 'vitest';
import { attendanceFrom } from './hr-attendance-range';
afterEach(() => vi.unstubAllEnvs());
it('clamps dates to the configured ingestion start without widening a later window', () => {
  vi.stubEnv('HR_RADAN_FROM_DATE', '2026-10-29');
  expect(attendanceFrom('2026-10-04')).toBe('2026-10-29');
  expect(attendanceFrom('2026-11-01')).toBe('2026-11-01');
});
