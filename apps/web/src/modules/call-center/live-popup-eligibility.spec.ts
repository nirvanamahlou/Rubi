import { expect, it } from 'vitest';
import { livePopupEligible } from './live-popup-eligibility';
const since = '2026-11-01T10:00:00Z';
it.each([
  ['RINGING', '2026-11-01T09:00:00Z', false],
  ['ANSWERED', '2026-11-01T09:00:00Z', false],
  ['ENDED', '2026-11-01T10:00:01Z', false],
  ['RINGING', '2026-11-01T10:00:01Z', true],
  ['ANSWERED', '2026-11-01T10:00:01Z', true],
  ['RINGING', undefined, false],
])('live-only eligibility %s %s', (state, offeredAt, expected) =>
  expect(
    livePopupEligible(
      {
        state,
        synthetic: false,
        technical: { ...(offeredAt ? { offeredAt } : {}) },
      },
      since,
    ),
  ).toBe(expected),
);
it('never automatically shows synthetic events', () =>
  expect(
    livePopupEligible(
      {
        state: 'RINGING',
        synthetic: true,
        technical: { offeredAt: '2026-11-01T10:00:01Z' },
      },
      since,
    ),
  ).toBe(false));
