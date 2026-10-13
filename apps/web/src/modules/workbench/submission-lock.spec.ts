import { describe, expect, it, vi } from 'vitest';

import { createSubmissionLock } from './submission-lock';

describe('createSubmissionLock', () => {
  it('rejects a concurrent submission and unlocks after completion', async () => {
    let release!: () => void;
    const firstAction = vi.fn(
      () => new Promise<void>((resolve) => (release = resolve)),
    );
    const secondAction = vi.fn();
    const lock = createSubmissionLock();

    const first = lock.run(firstAction);
    const second = lock.run(secondAction);

    expect(lock.locked).toBe(true);
    await expect(second).resolves.toBe(false);
    expect(secondAction).not.toHaveBeenCalled();

    release();
    await expect(first).resolves.toBe(true);
    expect(lock.locked).toBe(false);
    await expect(lock.run(secondAction)).resolves.toBe(true);
    expect(secondAction).toHaveBeenCalledOnce();
  });

  it('unlocks after a failed submission', async () => {
    const lock = createSubmissionLock();

    await expect(
      lock.run(() => Promise.reject(new Error('failed'))),
    ).rejects.toThrow('failed');
    expect(lock.locked).toBe(false);
  });
});
