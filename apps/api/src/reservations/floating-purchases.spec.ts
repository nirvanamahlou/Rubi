import { describe, it, expect, vi } from 'vitest';
import { ForbiddenException } from '@nestjs/common';
import { ReservationServicePurchaseService } from './reservation-service-purchase.service';
import { FloatingPurchasesController } from './floating-purchases.controller';
import { FLOATING_PURCHASE_OWN, FLOATING_PURCHASE_ALL } from '@nora/contracts';
const id = '11111111-1111-4111-8111-111111111111';
const input = {
  version: 1 as const,
  expectedVersion: 0,
  serviceClientKey: 'hotel',
  supplierOrganizationId: id,
  amount: '100',
  currencyCode: 'IRR',
};
const actor = {
  userId: 'seller',
  branchIds: ['branch'],
  permissions: [FLOATING_PURCHASE_OWN],
} as never;
function harness(owner = 'seller', floating = true) {
  const create = vi.fn().mockResolvedValue({
    id: 'cost',
    version: 1,
    amount: { toString: () => '100' },
  });
  const update = vi.fn().mockResolvedValue({ count: 1 });
  const snapshot = {
    serviceSelections: [
      { kind: 'HOTEL', clientKey: 'hotel', titleSnapshot: 'Hotel' },
      ...(floating
        ? [
            {
              kind: 'FLIGHT',
              clientKey: 'flight',
              titleSnapshot: 'Flight',
              metadata: { contractFlightVersion: 1 },
            },
          ]
        : []),
    ],
    hotelSelection: { serviceClientKey: 'hotel' },
    passengerIds: [],
  };
  const row = {
    id,
    contractId: 'contract',
    branchId: 'branch',
    salesOwnerUserId: owner,
    snapshot,
  };
  const db = {
    client: {
      reservationIntake: { findUnique: vi.fn().mockResolvedValue(row) },
      reservationServicePurchase: {
        findUnique: vi.fn().mockResolvedValue(null),
      },
      $transaction: vi.fn(async (fn: (tx: unknown) => unknown) =>
        fn({
          $queryRaw: vi.fn(),
          reservationIntake: { updateMany: update },
          reservationServicePurchase: { create },
          auditEvent: { create: vi.fn() },
        }),
      ),
    },
  };
  const directory = {
    brokerReference: vi
      .fn()
      .mockResolvedValue({ id, name: 'Synthetic broker' }),
    currencyReference: vi.fn().mockResolvedValue({ code: 'IRR' }),
  };
  return {
    db,
    create,
    update,
    directory,
    service: new ReservationServicePurchaseService(
      db as never,
      directory as never,
    ),
  };
}
describe('own floating cost commands', () => {
  it('records the aggregate hotel cost using only the new own permission and rechecks owner in CAS', async () => {
    const h = harness();
    await h.service.record(id, input, actor, 'synthetic', true);
    expect(h.create).toHaveBeenCalledWith(
      expect.objectContaining({
        data: expect.objectContaining({
          serviceKind: 'HOTEL',
          amount: '100',
          actorUserId: 'seller',
        }),
      }),
    );
    expect(h.update.mock.calls[0]?.[0].where.salesOwnerUserId).toBe('seller');
  });
  it.each(['other', null])(
    'rejects another or unknown owner before references or financial writes: %s',
    async (owner) => {
      const h = harness(owner as never);
      await expect(
        h.service.record(id, input, actor, 'k', true),
      ).rejects.toBeInstanceOf(ForbiddenException);
      expect(h.db.client.$transaction).not.toHaveBeenCalled();
      expect(h.directory.brokerReference).not.toHaveBeenCalled();
    },
  );
  it('keeps ordinary contracts and general endpoints unavailable to the new scope', async () => {
    const h = harness('seller', false);
    await expect(
      h.service.record(id, input, actor, 'k', true),
    ).rejects.toBeInstanceOf(ForbiddenException);
    await expect(
      h.service.record(id, input, actor, 'k'),
    ).rejects.toBeInstanceOf(ForbiddenException);
  });
  it('does not let read-all management access write purchases', async () => {
    const h = harness();
    await expect(
      h.service.record(
        id,
        input,
        { ...(actor as object), permissions: [FLOATING_PURCHASE_ALL] } as never,
        'k',
        true,
      ),
    ).rejects.toBeInstanceOf(ForbiddenException);
    expect(h.db.client.reservationIntake.findUnique).not.toHaveBeenCalled();
  });
  it('does not let floating users purchase transfers or forge a hotel classification', async () => {
    const h = harness();
    await expect(
      h.service.record(
        id,
        { ...input, serviceClientKey: 'missing' },
        actor,
        'k',
        true,
      ),
    ).rejects.toThrow();
  });
});
describe('floating read controller', () => {
  it('applies own scope before query pagination; managers have all only inside their branches', async () => {
    const inbox = vi.fn().mockResolvedValue({ data: [], meta: {} });
    const controller = new FloatingPurchasesController(
      { purchaseInbox: inbox } as never,
      {} as never,
      {} as never,
    );
    await controller.list({ actor } as never, { kind: 'HOTEL', page: '2' });
    expect(inbox).toHaveBeenLastCalledWith(
      ['branch'],
      { kind: 'HOTEL', page: '2' },
      undefined,
      { ownerUserId: 'seller' },
    );
    await controller.list(
      {
        actor: { ...(actor as object), permissions: [FLOATING_PURCHASE_ALL] },
      } as never,
      { kind: 'FLIGHT' },
    );
    expect(inbox).toHaveBeenLastCalledWith(
      ['branch'],
      { kind: 'FLIGHT' },
      undefined,
      {},
    );
  });
  it('rejects unauthenticated feature access and unrelated service queries', async () => {
    const inbox = vi.fn();
    const controller = new FloatingPurchasesController(
      { purchaseInbox: inbox } as never,
      {} as never,
      {} as never,
    );
    await expect(
      controller.list({ actor: { permissions: [] } } as never, {
        kind: 'HOTEL',
      }),
    ).rejects.toThrow();
    await expect(
      controller.list({ actor } as never, { kind: 'TRANSFER' }),
    ).rejects.toThrow();
    expect(inbox).not.toHaveBeenCalled();
  });
});

it('forbids actual transfer purchases and cross-branch rows in the floating sales entry', async () => {
  const h = harness();
  const row = await h.db.client.reservationIntake.findUnique();
  row.snapshot.serviceSelections.push({
    kind: 'TRANSFER',
    clientKey: 'transfer',
    titleSnapshot: 'Transfer',
  });
  await expect(
    h.service.record(
      id,
      { ...input, serviceClientKey: 'transfer' },
      actor,
      'k',
      true,
    ),
  ).rejects.toBeInstanceOf(ForbiddenException);
  await expect(
    h.service.record(
      id,
      input,
      { ...(actor as object), branchIds: ['other'] } as never,
      'k',
      true,
    ),
  ).rejects.toThrow();
  expect(h.create).not.toHaveBeenCalled();
});

it('uses server-derived floating status for reference options and rejects ordinary context', async () => {
  const context = vi
    .fn()
    .mockResolvedValue({
      salesOwnerUserId: 'seller',
      floatingContract: true,
      snapshot: { serviceSelections: [] },
    });
  const choices = vi.fn().mockResolvedValue({ data: [], meta: { total: 0 } });
  const controller = new FloatingPurchasesController(
    { purchaseContext: context } as never,
    {} as never,
    { hotelRateChoices: choices } as never,
  );
  await controller.options(id, { actor } as never, 'HOTEL', 'brokers', '', '1');
  expect(choices).toHaveBeenCalledWith('brokers', '', 1);
  context.mockResolvedValue({
    salesOwnerUserId: 'seller',
    floatingContract: false,
    snapshot: {
      serviceSelections: [
        { kind: 'FLIGHT', metadata: { purchaseSupplyType: 'FLOATING' } },
      ],
    },
  });
  await expect(
    controller.options(id, { actor } as never, 'HOTEL', 'brokers', '', '1'),
  ).rejects.toBeInstanceOf(ForbiddenException);
  expect(choices).toHaveBeenCalledTimes(1);
});
