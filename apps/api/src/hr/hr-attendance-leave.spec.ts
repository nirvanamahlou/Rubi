import { expect, it } from 'vitest';
import { approvedLeaveCoverage } from './hr-attendance-leave';
import { localClockToUtc } from './hr.validation';
const at = (time: string) => localClockToUtc('2026-11-03', time);
it('credits only approved intervals outside worked time, without counting overlaps twice', () => {
  const result = approvedLeaveCoverage(
    [
      { kind: 'ورود', at: at('10:15') },
      { kind: 'خروج', at: at('16:00') },
    ],
    at('09:15'),
    at('17:00'),
    [
      [at('09:15').getTime(), at('10:30').getTime()],
      [at('09:30').getTime(), at('10:15').getTime()],
      [at('16:00').getTime(), at('17:00').getTime()],
    ],
  );
  expect(result).toMatchObject({
    creditMinutes: 120,
    lateCredit: 60,
    earlyCredit: 60,
    fullDay: false,
  });
});
it('recognizes full-day leave even without a clocking', () => {
  expect(
    approvedLeaveCoverage([], at('09:15'), at('17:00'), [
      [at('00:00').getTime(), at('23:59').getTime()],
    ]),
  ).toMatchObject({ fullDay: true, creditMinutes: 465 });
});
