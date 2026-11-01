import { localClockParts } from './hr.validation';

/** Wall-clock slots in Tehran: every full hour, plus quarter-hours during 09 and 17. */
export function nextRadanSyncAt(now: Date): Date {
  if (!Number.isFinite(now.getTime()))
    throw new Error('Invalid synchronization time');
  const minute = Math.floor(now.getTime() / 60000);
  for (let step = 1; step <= 60; step++) {
    const candidate = new Date((minute + step) * 60000);
    const [hour, minutes] = localClockParts(candidate)
      .time.split(':')
      .map(Number);
    if (minutes === 0 || ((hour === 9 || hour === 17) && minutes! % 15 === 0))
      return candidate;
  }
  throw new Error('Synchronization slot unavailable');
}
