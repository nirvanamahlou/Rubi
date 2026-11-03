import { describe, expect, it, vi } from 'vitest';
import { TourPublicService } from './tour-public.service';
const actor = {
  userId: 'user',
  sessionId: 'session',
  branchIds: ['branch'],
  permissions: ['ticket_catalog.tours.manage'],
} as const;
function fixture(status = 'ACTIVE', version = 0) {
  const tx = {
    tourDeparture: {
      findFirst: vi
        .fn()
        .mockResolvedValue({ id: 'period', status, lifecycleVersion: version }),
      updateMany: vi.fn().mockResolvedValue({ count: 1 }),
    },
    tourDepartureLifecycleRevision: { create: vi.fn() },
  };
  const client = {
    tourDeparture: tx.tourDeparture,
    $transaction: vi.fn(async (run: (tx: unknown) => unknown) => run(tx)),
  };
  const service = new TourPublicService({ client } as never, {} as never);
  return { tx, service };
}
describe('audited tour period lifecycle', () => {
  it('scopes writes, compares versions and appends audit without changing travel facts', async () => {
    const { tx, service } = fixture();
    await service.setDepartureStatus(
      'period',
      { status: 'PAUSED', expectedVersion: 0 },
      actor as never,
      'branch',
    );
    expect(tx.tourDeparture.findFirst).toHaveBeenCalledWith({
      where: { id: 'period', branchId: 'branch' },
    });
    expect(tx.tourDeparture.updateMany).toHaveBeenCalledWith({
      where: {
        id: 'period',
        branchId: 'branch',
        lifecycleVersion: 0,
        status: { not: 'DELETED' },
      },
      data: { status: 'PAUSED', lifecycleVersion: { increment: 1 } },
    });
    expect(tx.tourDepartureLifecycleRevision.create).toHaveBeenCalledWith({
      data: {
        departureId: 'period',
        version: 1,
        status: 'PAUSED',
        actorUserId: 'user',
      },
    });
  });
  it('permits resume and logical deletion, but never undeletes or accepts stale revisions', async () => {
    for (const status of ['ACTIVE', 'DELETED'])
      await expect(
        fixture('PAUSED', 2).service.setDepartureStatus(
          'period',
          { status, expectedVersion: 2 },
          actor as never,
          'branch',
        ),
      ).resolves.toBeDefined();
    for (const [state, version] of [
      ['DELETED', 0],
      ['ACTIVE', 2],
    ] as const) {
      const { service, tx } = fixture(state, version);
      await expect(
        service.setDepartureStatus(
          'period',
          { status: 'ACTIVE', expectedVersion: 0 },
          actor as never,
          'branch',
        ),
      ).rejects.toThrow();
      expect(tx.tourDeparture.updateMany).not.toHaveBeenCalled();
    }
  });
  it('rejects missing authority, branch mismatch and malformed command fields', async () => {
    const { service, tx } = fixture();
    for (const a of [
      { ...actor, permissions: [] },
      { ...actor, branchIds: [] },
    ])
      await expect(
        service.setDepartureStatus(
          'period',
          { status: 'DELETED', expectedVersion: 0 },
          a as never,
          'branch',
        ),
      ).rejects.toThrow();
    await expect(
      service.setDepartureStatus(
        'period',
        { status: 'PAUSED', expectedVersion: 0, unexpected: true },
        actor as never,
        'branch',
      ),
    ).rejects.toThrow();
    expect(tx.tourDeparture.updateMany).not.toHaveBeenCalled();
  });
  it('rejects concurrent changes and does not append a false audit', async () => {
    const { service, tx } = fixture();
    tx.tourDeparture.updateMany.mockResolvedValue({ count: 0 });
    await expect(
      service.setDepartureStatus(
        'period',
        { status: 'PAUSED', expectedVersion: 0 },
        actor as never,
        'branch',
      ),
    ).rejects.toThrow();
    expect(tx.tourDepartureLifecycleRevision.create).not.toHaveBeenCalled();
  });
});

it.each(['PAUSED', 'DELETED'])(
  'rejects new Sales selection for %s periods',
  async (status) => {
    const { service } = fixture(status);
    await expect(
      service.assertSalesSelection(
        {
          services: [
            {
              kind: 'FLIGHT',
              metadata: {
                tourDepartureId: '00000000-0000-4000-8000-000000000042',
              },
            },
          ],
        } as never,
        'branch',
      ),
    ).rejects.toThrow('این بازه برای فروش فعال نیست.');
  },
);
