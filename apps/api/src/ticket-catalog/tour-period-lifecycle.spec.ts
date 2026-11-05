import { describe, expect, it, vi } from 'vitest';
import { TourPublicService } from './tour-public.service';
const actor = {
  userId: 'user',
  sessionId: 'session',
  branchIds: ['branch'],
  permissions: ['ticket_catalog.tours.manage'],
} as const;
function fixture(status = 'ACTIVE', version = 1) {
  const tx = {
    tourDeparture: {
      findMany: vi.fn().mockResolvedValue([]),
      findFirst: vi
        .fn()
        .mockResolvedValue({
          id: 'period',
          isActive: status === 'ACTIVE',
          isDeleted: status === 'DELETED',
          salesVersion: version,
        }),
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
      { isActive: false, expectedVersion: 1 },
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
        salesVersion: 1,
        isDeleted: false,
      },
      data: { isActive: false, salesVersion: { increment: 1 } },
    });
    expect(tx.tourDepartureLifecycleRevision.create).toHaveBeenCalledWith({
      data: {
        departureId: 'period',
        version: 2,
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
          {
            isActive: status === 'ACTIVE',
            ...(status === 'DELETED' ? { isDeleted: true } : {}),
            expectedVersion: 2,
          },
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
          { isActive: true, expectedVersion: 1 },
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
          { isActive: false, isDeleted: true, expectedVersion: 1 },
          a as never,
          'branch',
        ),
      ).rejects.toThrow();
    await expect(
      service.setDepartureStatus(
        'period',
        { isActive: false, expectedVersion: 1, unexpected: true },
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
        { isActive: false, expectedVersion: 1 },
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
    ).rejects.toThrow('فروش این نوبت متوقف شده است.');
  },
);

it('keeps Sales choices active-only even for managers and authorizes explicit management reads', async () => {
  const { service, tx } = fixture();
  await service.departures(actor as never);
  expect(tx.tourDeparture.findMany.mock.lastCall?.[0].where.isActive).toBe(
    true,
  );
  await service.departures(actor as never, true);
  expect(tx.tourDeparture.findMany.mock.lastCall?.[0].where).toMatchObject({
    isDeleted: false,
  });
  expect(
    tx.tourDeparture.findMany.mock.lastCall?.[0].where.isActive,
  ).toBeUndefined();
  await service.pricingDepartures(['branch']);
  expect(tx.tourDeparture.findMany.mock.lastCall?.[0].where.isActive).toBe(
    true,
  );
  await expect(
    service.departures(
      { ...actor, permissions: ['ticket_catalog.read'] } as never,
      true,
    ),
  ).rejects.toThrow();
});
