/** Next minute boundary; callers schedule only after the previous pull completes. */
export function nextRadanSyncAt(now: Date): Date {
  if (!Number.isFinite(now.getTime()))
    throw new Error('Invalid synchronization time');
  return new Date((Math.floor(now.getTime() / 60000) + 1) * 60000);
}
