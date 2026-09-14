import { describe, expect, it } from 'vitest';
import { resolutionPausePatch } from './customer-affairs-sla';
describe('Resolution clock pause', () => {
  const due = new Date('2026-09-13T12:00:00Z');
  const start = new Date('2026-09-12T12:00:00Z');
  it('pauses customer wait, not an internal unit delay', () => {
    expect(
      resolutionPausePatch({ resolutionDueAt: due }, 'WAITING_CUSTOMER', start),
    ).toEqual({ pausedAt: start });
    expect(
      resolutionPausePatch({ resolutionDueAt: due }, 'WAITING_EXTERNAL', start),
    ).toEqual({});
  });
  it('does not restart an existing pause', () => {
    expect(
      resolutionPausePatch(
        { resolutionDueAt: due, pausedAt: start },
        'WAITING_CUSTOMER',
        new Date(),
      ),
    ).toEqual({});
  });
  it('extends resolution once, without altering the first response clock', () => {
    const result = resolutionPausePatch(
      { resolutionDueAt: due, pausedAt: start, pausedMinutes: 5 },
      'IN_PROGRESS',
      new Date('2026-09-12T13:30:00Z'),
    );
    expect(result).toEqual({
      pausedAt: null,
      pausedMinutes: 95,
      resolutionDueAt: new Date('2026-09-13T13:30:00Z'),
    });
    expect(
      resolutionPausePatch(
        result as {
          pausedAt: null;
          pausedMinutes: number;
          resolutionDueAt: Date;
        },
        'IN_PROGRESS',
        new Date(),
      ),
    ).toEqual({});
  });
});
