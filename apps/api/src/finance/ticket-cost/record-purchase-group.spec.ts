import { describe, it, expect, vi } from 'vitest';
import { Prisma } from '@nora/database';
import type { AuthenticatedActor } from '@nora/contracts';
import { FinanceTicketCostService } from './finance-ticket-cost.service';
import { purchaseFlightGroup } from './ticket-purchase-group';
const id = (n: number) =>
  '00000000-0000-4000-8000-' + String(n).padStart(12, '0');
const actor = {
  userId: id(9),
  branchIds: [id(8)],
  permissions: ['procurement.quote.manage'],
} as unknown as AuthenticatedActor;
const command = {
  version: 1 as const,
  operationId: id(99),
  members: [
    { requestId: id(1), expectedCostVersion: 0 },
    { requestId: id(2), expectedCostVersion: 0 },
  ],
  seatCount: 3,
  totalCost: '100',
  currencyCode: 'USD',
};
type CostRow = {
  id: string;
  requestId: string;
  branchId: string;
  version: number;
  reason: string;
  invoiceAmount: Prisma.Decimal;
  unitCost: Prisma.Decimal;
  createdAt: Date;
  payments: { id: string }[];
};
function fixture() {
  const rows: CostRow[] = [];
  const requests = [1, 2, 3].map((n) => ({
    id: id(n),
    branchId: id(8),
    offerId: id(n + 10),
    offerVersion: 1,
    seatCount: n === 1 ? 2 : 1,
    supplierDisplaySnapshot: 'AIRLINE',
    requestVersion: 1,
  }));
  const inventory = requests.map((r, i) => ({
    id: r.offerId,
    branchId: r.branchId,
    supplyType: 'COMPANY',
    departureAt: new Date(
      '2026-10-' + String(5 + i * 7).padStart(2, '0') + 'T10:00:00Z',
    ),
    arrivalAt: new Date(
      '2026-10-' + String(5 + i * 7).padStart(2, '0') + 'T12:00:00Z',
    ),
    carrierName: 'AIRLINE',
    serviceNumber: '9740',
    originId: id(50),
    destinationId: id(51),
    originAirportId: null,
    destinationAirportId: null,
    cabinClassCode: 'ECONOMY',
    totalCapacity: r.seatCount,
    allocatedCapacity: 0,
  }));
  const cost = {
    findMany: vi.fn(
      async ({ where }: { where?: { reason?: { startsWith: string } } }) =>
        rows
          .filter(
            (r) =>
              !where?.reason || r.reason.startsWith(where.reason.startsWith),
          )
          .sort((a, b) => a.requestId.localeCompare(b.requestId))
          .map((r) => ({ ...r, _count: { payments: r.payments.length } })),
    ),
    findFirst: vi.fn(
      async ({
        where,
      }: {
        where: { requestId: string; reason?: { startsWith: string } };
      }) =>
        rows
          .filter(
            (r) =>
              r.requestId === where.requestId &&
              (!where.reason || r.reason.startsWith(where.reason.startsWith)),
          )
          .sort((a, b) => b.version - a.version)[0] ?? null,
    ),
    create: vi.fn(
      async ({ data }: { data: Omit<CostRow, 'payments' | 'createdAt'> }) => {
        const row = { ...data, createdAt: new Date(), payments: [] };
        rows.push(row);
        return row;
      },
    ),
  };
  const tx = { $queryRaw: vi.fn(), financeTicketPurchaseCostRevision: cost };
  const database = {
    client: {
      ...tx,
      $transaction: async (fn: (value: typeof tx) => Promise<unknown>) => {
        const saved = [...rows];
        try {
          return await fn(tx);
        } catch (e) {
          rows.splice(0, rows.length, ...saved);
          throw e;
        }
      },
    },
  };
  const procurement = {
    forFinance: vi.fn(async (requestId: string, branches: string[]) => {
      const r = requests.find((r) => r.id === requestId);
      if (!r || !branches.includes(r.branchId)) throw Error('branch denied');
      return { ...r };
    }),
  };
  const tickets = {
    purchaseCapacityInventory: vi.fn(async () => inventory),
    documentSupply: vi.fn(async () => 'COMPANY'),
  };
  const fx = { capture: vi.fn(async () => null) };
  const service = new FinanceTicketCostService(
    database as never,
    procurement as never,
    undefined,
    tickets as never,
    fx as never,
  );
  return { rows, requests, inventory, cost, procurement, tickets, fx, service };
}
describe('recurring company purchase groups', () => {
  it('apportions one exact invoice atomically, preserves the pooled denominator and replays after closure', async () => {
    const f = fixture();
    await f.service.recordGroupCost(command, actor);
    expect(f.rows.map((r) => r.invoiceAmount.toString())).toEqual([
      '66.6667',
      '33.3333',
    ]);
    expect(f.rows.every((r) => r.unitCost.equals('33.3333'))).toBe(true);
    expect(
      f.rows
        .reduce((s, r) => s.add(r.invoiceAmount), new Prisma.Decimal(0))
        .toString(),
    ).toBe('100');
    f.procurement.forFinance.mockRejectedValue(Error('closed after payment'));
    await expect(
      f.service.recordGroupCost(command, actor),
    ).resolves.toMatchObject({ seatCount: 3, totalCost: '100' });
    expect(f.rows).toHaveLength(2);
    await expect(
      f.service.recordGroupCost({ ...command, totalCost: '101' }, actor),
    ).rejects.toThrow('operation changed');
  });
  it.each([
    'serviceNumber',
    'originId',
    'destinationId',
    'cabinClassCode',
    'carrierName',
    'supplyType',
    'weekday',
    'supplier',
    'branch',
  ])('never pools a different %s', async (field) => {
    const f = fixture();
    if (field === 'weekday')
      f.inventory[1]!.departureAt = new Date('2026-10-13T10:00:00Z');
    else if (field === 'supplier')
      f.requests[1]!.supplierDisplaySnapshot = 'OTHER SUPPLIER';
    else if (field === 'branch') f.requests[1]!.branchId = id(70);
    else
      (f.inventory[1] as unknown as Record<string, unknown>)[field] =
        'DIFFERENT';
    await expect(f.service.recordGroupCost(command, actor)).rejects.toThrow();
    expect(f.rows).toHaveLength(0);
  });
  it('requires quote permission, unique members and the exact full seat count', async () => {
    const f = fixture();
    for (const input of [
      { ...command, seatCount: 2 },
      { ...command, members: [command.members[0]!, command.members[0]!] },
    ])
      await expect(f.service.recordGroupCost(input, actor)).rejects.toThrow();
    await expect(
      f.service.recordGroupCost(command, {
        ...actor,
        permissions: ['finance.payment.create'],
      }),
    ).rejects.toThrow();
    expect(f.rows).toHaveLength(0);
  });
  it('rolls back every cost and FX snapshot if any member fails', async () => {
    const f = fixture();
    f.fx.capture.mockRejectedValueOnce(Error('FX failure'));
    await expect(f.service.recordGroupCost(command, actor)).rejects.toThrow(
      'FX failure',
    );
    expect(f.rows).toHaveLength(0);
  });
  it('locks paid members and rejects stale group edits without creating partial costs', async () => {
    const f = fixture();
    await f.service.recordGroupCost(command, actor);
    const next = {
      ...command,
      operationId: id(100),
      members: command.members.map((m) => ({ ...m, expectedCostVersion: 1 })),
    };
    f.rows[1]!.payments = [{ id: id(55) }];
    await expect(f.service.recordGroupCost(next, actor)).rejects.toThrow(
      'payment has started',
    );
    expect(f.rows).toHaveLength(2);
    f.rows[1]!.payments = [];
    await expect(
      f.service.recordGroupCost({ ...next, members: command.members }, actor),
    ).rejects.toThrow('changed');
    await expect(
      f.service.recordCost(
        id(1),
        {
          version: 1,
          operationId: id(101),
          expectedCostVersion: 1,
          seatCount: 2,
          totalCost: '100',
          currencyCode: 'USD',
        },
        actor,
      ),
    ).rejects.toThrow('complete original');
  });
  it('retains the full original pool when correcting costs', async () => {
    const f = fixture();
    const first = {
      ...command,
      members: [
        ...command.members,
        { requestId: id(3), expectedCostVersion: 0 },
      ],
      seatCount: 4,
    };
    await f.service.recordGroupCost(first, actor);
    await expect(
      f.service.recordGroupCost(
        {
          ...command,
          operationId: id(102),
          members: command.members.map((m) => ({
            ...m,
            expectedCostVersion: 1,
          })),
        },
        actor,
      ),
    ).rejects.toThrow('complete original');
    expect(f.rows).toHaveLength(3);
  });
  it('uses Tehran weekday across a UTC midnight boundary', () => {
    const f = fixture(),
      r = f.requests[0]!,
      o = f.inventory[0]!;
    expect(
      purchaseFlightGroup(r, {
        ...o,
        departureAt: new Date('2026-10-04T22:00:00Z'),
      })?.weekday,
    ).toBe(1);
    expect(purchaseFlightGroup(r, o)?.key).toBe(
      purchaseFlightGroup(r, {
        ...o,
        departureAt: new Date('2026-10-12T14:00:00Z'),
      })?.key,
    );
  });
  it('projects the immutable pool denominator and does not expose pooled totals to own-only readers', async () => {
    const f = fixture();
    await f.service.recordGroupCost(command, actor);
    const requests = f.requests
      .slice(0, 2)
      .map((r) => ({ ...r, status: 'PENDING', title: 'Synthetic' }));
    Object.assign(f.procurement, {
      listTicketPurchaseInbox: async () => requests,
    });
    const result = await f.service.purchaseInbox(actor);
    expect(result.data[0]!.cost?.purchaseGroup).toMatchObject({
      seatCount: 3,
      totalCost: '100',
    });
    const own = await f.service.purchaseInbox({
      ...actor,
      permissions: ['procurement.read.own'],
    });
    expect(own.data.every((r) => !r.cost?.purchaseGroup)).toBe(true);
  });
});
