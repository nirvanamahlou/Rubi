import { expect, it } from 'vitest';
import { leaveDescription } from './leave-description';
const leave = {
  from: '2026-11-17',
  to: '2026-11-17',
  mode: 'روزانه' as const,
  reason: 'Reason',
};
it('replaces generated legacy Gregorian dates with Persian dates and removes the duplicate HR summary', () => {
  const description = `Body\n\nمرخصی روزانه\nاز 2026-11-17 تا 2026-11-17\nدلیل: Reason`;
  expect(leaveDescription(description, leave)).not.toContain('2026-11-17');
  expect(leaveDescription(description, leave)).toContain('۱۴۰۵');
  expect(leaveDescription(description, leave, false)).toBe('Body');
  expect(leaveDescription('User text')).toBe('User text');
});
