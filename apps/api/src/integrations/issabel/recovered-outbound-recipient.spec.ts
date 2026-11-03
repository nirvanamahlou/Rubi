import { describe, expect, it, vi } from 'vitest';
import type { TelephonyEventV1 } from '@nora/contracts';
import { recoveredOutboundAccounts } from './recovered-outbound-recipient';

const event = {
  direction: 'OUT',
  kind: 'ANSWERED',
  connectionId: 'pbx',
  extension: '101',
  occurredAt: '2026-10-01T00:00:00.000Z',
} as TelephonyEventV1;
function setup(
  mapping: unknown = { userId: 'staff', teamId: null },
  current = ['staff'],
  eligible = true,
) {
  const findFirst = vi.fn().mockResolvedValue(mapping);
  const directory = {
    answeredAccounts: vi.fn().mockResolvedValue(current),
    eligibleMapping: vi.fn().mockResolvedValue(eligible),
  };
  return {
    findFirst,
    directory,
    run: (e = event) =>
      recoveredOutboundAccounts(
        e,
        'branch',
        { integrationTelephonyMapping: { findFirst } } as never,
        directory as never,
      ),
  };
}
describe('recovered outbound identity', () => {
  it('requires an unchanged pre-call mapping and current HR agreement', async () => {
    const s = setup();
    expect(await s.run()).toEqual(['staff']);
    expect(s.findFirst).toHaveBeenCalledWith({
      where: {
        connectionId: 'pbx',
        extension: '101',
        active: true,
        version: { gt: 0 },
        updatedAt: { lte: new Date(event.occurredAt) },
      },
    });
    expect(s.directory.eligibleMapping).toHaveBeenCalledWith(
      'branch',
      'staff',
      null,
      expect.anything(),
    );
  });
  it('denies absent/newer mapping, ambiguous/changed HR identity and ineligible accounts', async () => {
    expect(await setup(null).run()).toEqual([]);
    expect(await setup(undefined, []).run()).toEqual([]);
    expect(await setup(undefined, ['staff', 'other']).run()).toEqual([]);
    expect(await setup(undefined, ['other']).run()).toEqual([]);
    expect(await setup(undefined, ['staff'], false).run()).toEqual([]);
  });
  it('never infers an incoming recipient or a successful unanswered call', async () => {
    for (const e of [
      { ...event, direction: 'IN' as const },
      { ...event, kind: 'RINGING' as const },
      { ...event, extension: null },
    ]) {
      const s = setup();
      expect(await s.run(e)).toEqual([]);
      expect(s.findFirst).not.toHaveBeenCalled();
    }
  });
});
