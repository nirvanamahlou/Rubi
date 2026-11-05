import { describe, expect, it } from 'vitest';
import { createNotificationFeedGuard } from './notification-feed-guard';

describe('acknowledgement and polling order', () => {
  it('does not let an old unread response restore the counter after read-all finishes', async () => {
    const guard = createNotificationFeedGuard();
    let resolve!: (items: string[]) => void;
    const response = new Promise<string[]>((done) => {
      resolve = done;
    });
    let unread: string[] = ['old-notice'];
    const token = guard.beginRead()!;
    const poll = response.then((items) => {
      if (guard.canApply(token)) unread = items;
    });
    const settle = guard.beginWrite();
    unread = [];
    settle();
    resolve(['old-notice']);
    await poll;
    expect(unread).toEqual([]);
    const fresh = guard.beginRead()!;
    expect(guard.canApply(fresh)).toBe(true);
    if (guard.canApply(fresh)) unread = ['genuinely-new-notice'];
    expect(unread).toEqual(['genuinely-new-notice']);
  });
  it('does not poll partially acknowledged batches or accept out-of-order reads', () => {
    const guard = createNotificationFeedGuard();
    const first = guard.beginRead()!;
    const second = guard.beginRead()!;
    expect(guard.canApply(first)).toBe(false);
    expect(guard.canApply(second)).toBe(true);
    const settleA = guard.beginWrite();
    const settleB = guard.beginWrite();
    settleA();
    settleA();
    expect(guard.beginRead()).toBeNull();
    expect(guard.canApply(second)).toBe(false);
    settleB();
    expect(guard.canApply(guard.beginRead()!)).toBe(true);
  });
});
