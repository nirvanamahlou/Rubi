import { expect, it, vi } from 'vitest';
import {
  holdClock,
  holdSecondsRemaining,
  readHoldPages,
  type CapacityHoldRow,
} from './capacity-hold-roster';
const now = '2030-01-01T00:00:00Z';
const row: CapacityHoldRow = {
  id: 'synthetic-hold',
  quantity: 2,
  siteCode: 'nss',
  externalId: 'SYNTHETIC-ORDER-1',
  expiresAt: '2030-01-01T00:10:00Z',
  paymentPendingAt: null,
  createdAt: now,
  remainingSeconds: 600,
};
it('uses the authoritative deadline and elapsed duration despite a badly skewed browser date', () => {
  vi.spyOn(Date, 'now').mockReturnValue(Date.parse('2099-01-01'));
  expect(holdSecondsRemaining(row, now, 0)).toBe(600);
  expect(holdSecondsRemaining(row, now, 599001)).toBe(1);
  expect(holdSecondsRemaining(row, now, 600000)).toBe(0);
  expect(holdSecondsRemaining(row, now, 700000)).toBe(0);
  expect(holdClock(61)).toBe('۱:۰۱');
  vi.restoreAllMocks();
});
it('does not announce release of a pending bank payment after the nominal expiry', () => {
  expect(
    holdSecondsRemaining({ ...row, paymentPendingAt: now }, now, 700000),
  ).toBeNull();
  expect(holdSecondsRemaining(row, 'invalid', 0)).toBeNull();
});
it('reads requested pages with opaque cursors and deduplicates rows, retaining the first server anchor', async () => {
  const load = vi
    .fn()
    .mockResolvedValueOnce({
      data: [row],
      serverNow: now,
      hasMore: true,
      nextCursor: 'next',
    })
    .mockResolvedValueOnce({
      data: [row, { ...row, id: 'other', externalId: 'OTHER' }],
      serverNow: now,
      hasMore: false,
      nextCursor: null,
    });
  const signal = new AbortController().signal;
  const result = await readHoldPages(load, 'offer', 2, signal);
  expect(load.mock.calls).toEqual([
    ['offer', undefined, signal],
    ['offer', 'next', signal],
  ]);
  expect(result.data.map((x) => x.id)).toEqual(['synthetic-hold', 'other']);
  expect(result.hasMore).toBe(false);
});
it('rejects invalid server time, inventory quantities and inconsistent pagination rather than showing an empty success', async () => {
  for (const response of [
    { data: [row], serverNow: 'bad', hasMore: false, nextCursor: null },
    {
      data: [{ ...row, quantity: 0 }],
      serverNow: now,
      hasMore: false,
      nextCursor: null,
    },
    { data: [row], serverNow: now, hasMore: true, nextCursor: null },
  ])
    await expect(
      readHoldPages(
        vi.fn().mockResolvedValue(response),
        'offer',
        1,
        new AbortController().signal,
      ),
    ).rejects.toThrow();
});
it('stops cyclic pagination instead of silently dropping or infinitely reloading holds', async () => {
  const load = vi.fn().mockResolvedValue({
    data: [row],
    serverNow: now,
    hasMore: true,
    nextCursor: 'same',
  });
  await expect(
    readHoldPages(load, 'offer', 3, new AbortController().signal),
  ).rejects.toThrow();
  expect(load).toHaveBeenCalledTimes(2);
});
