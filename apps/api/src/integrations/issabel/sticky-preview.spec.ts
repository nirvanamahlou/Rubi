import { ForbiddenException } from '@nestjs/common';
import { afterEach, describe, expect, it, vi } from 'vitest';
import { StickyPreviewBudget } from './sticky-preview';
import type { StickyDecision } from './sticky-sales';

const prefer: StickyDecision = {
  kind: 'PREFER',
  extension: '110',
  ringSeconds: 10,
  fallbackQueue: '1002',
};
afterEach(() => vi.useRealTimers());
describe('bounded internal routing preview', () => {
  it('preserves 10-second decision and sanitizes dependency errors', async () => {
    const budget = new StickyPreviewBudget();
    expect(await budget.run('1002', async () => prefer)).toEqual(prefer);
    expect(
      await budget.run('1002', async () => {
        throw Error('private credentials');
      }),
    ).toEqual({
      kind: 'FALLBACK',
      queue: '1002',
      reason: 'LOOKUP_UNAVAILABLE',
    });
    await expect(
      budget.run('1002', async () => {
        throw new ForbiddenException();
      }),
    ).rejects.toBeInstanceOf(ForbiddenException);
  });
  it('expires at 1 second, aborts follow-up work and never returns a late preference', async () => {
    vi.useFakeTimers();
    const budget = new StickyPreviewBudget();
    let settle!: (d: StickyDecision) => void;
    let signal!: AbortSignal;
    const result = budget.run('1002', (s) => {
      signal = s;
      return new Promise((resolve) => {
        settle = resolve;
      });
    });
    await vi.advanceTimersByTimeAsync(1000);
    expect(await result).toMatchObject({ reason: 'LOOKUP_TIMEOUT' });
    expect(signal.aborted).toBe(true);
    settle(prefer);
    await Promise.resolve();
    expect(await result).toMatchObject({ kind: 'FALLBACK' });
  });
  it('bounds unresolved work even after caller timeout', async () => {
    vi.useFakeTimers();
    const budget = new StickyPreviewBudget();
    const calls = Array.from({ length: 8 }, () =>
      budget.run('1002', () => new Promise(() => {})),
    );
    await vi.advanceTimersByTimeAsync(1000);
    await Promise.all(calls);
    expect(await budget.run('1002', async () => prefer)).toMatchObject({
      reason: 'LOOKUP_BUSY',
    });
  });
});
