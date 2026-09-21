/** Elapsed-clock policy: only waiting for the customer pauses resolution. */
export function resolutionPausePatch(
  current: {
    pausedAt?: Date | null;
    pausedMinutes?: number;
    resolutionDueAt: Date;
  },
  target: string,
  now: Date,
) {
  if (target === 'WAITING_CUSTOMER')
    return current.pausedAt ? {} : { pausedAt: now };
  if (!current.pausedAt) return {};
  const elapsed = Math.max(0, now.getTime() - current.pausedAt.getTime());
  return {
    pausedAt: null,
    pausedMinutes: (current.pausedMinutes ?? 0) + Math.floor(elapsed / 60_000),
    resolutionDueAt: new Date(current.resolutionDueAt.getTime() + elapsed),
  };
}
