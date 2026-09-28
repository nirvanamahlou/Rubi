import { describe, it, expect, vi } from 'vitest';
import { Prisma } from '@nora/database';
import type { AuthenticatedActor, TicketOfferV1 } from '@nora/contracts';
import type { DatabaseService } from '../database/database.service';
import {
  applySaleCommissions,
  commissionAmount,
  saveTicketSaleCommission,
} from './ticket-sale-commissions';
const offerId = '10000000-0000-4000-8000-000000000001',
  returnId = '10000000-0000-4000-8000-000000000002',
  targetId = '10000000-0000-4000-8000-000000000003';
const actor = {
  userId: 'actor',
  branchIds: ['branch'],
  permissions: ['ticket_catalog.manage'],
} as AuthenticatedActor;
const input = {
  offerId,
  salePriceTargetId: targetId,
  percent: '4',
  expectedRevision: 0,
  expectedBaseRevision: 2,
};
function setup() {
  const rows = [
    {
      id: offerId,
      branchId: 'branch',
      standaloneSalePrices: [
        { revision: 2, amount: new Prisma.Decimal('100'), currencyCode: 'IRR' },
      ],
      outboundRoundTripSalePrices: [
        {
          returnOfferId: returnId,
          revision: 3,
          amount: new Prisma.Decimal('250'),
          currencyCode: 'IRR',
        },
      ],
      saleCommissions: [],
    },
    {
      id: returnId,
      branchId: 'branch',
      standaloneSalePrices: [],
      outboundRoundTripSalePrices: [],
      saleCommissions: [],
    },
  ];
  const tx = {
    $queryRaw: vi.fn().mockResolvedValue([]),
    ticketPublishedOffer: {
      findFirst: vi.fn().mockResolvedValue({ id: offerId, branchId: 'branch' }),
      findMany: vi
        .fn()
        .mockImplementation(({ select }) =>
          Promise.resolve(select ? rows.map((r) => ({ id: r.id })) : rows),
        ),
    },
    ticketSalePriceTarget: {
      findFirst: vi.fn().mockResolvedValue({ id: targetId }),
    },
    ticketSaleCommissionRevision: {
      findUnique: vi.fn().mockResolvedValue(null),
      count: vi.fn().mockResolvedValue(2),
      create: vi.fn().mockResolvedValue({}),
    },
  };
  const transaction = vi.fn((operation) => operation(tx));
  return {
    tx,
    rows,
    transaction,
    db: { client: { $transaction: transaction } } as unknown as DatabaseService,
  };
}
describe('commission persistence', () => {
  it('copies only priced one-way and pair rows in one serializable transaction', async () => {
    const { db, tx, transaction } = setup();
    expect(
      await saveTicketSaleCommission(
        db,
        { ...input, copyToAll: true },
        actor,
        'copy-key',
      ),
    ).toEqual({ data: { count: 2, revision: 1 } });
    expect(transaction).toHaveBeenCalledTimes(1);
    expect(transaction).toHaveBeenCalledWith(expect.any(Function), {
      isolationLevel: 'Serializable',
      timeout: 30000,
    });
    expect(tx.ticketSaleCommissionRevision.create).toHaveBeenCalledTimes(2);
    expect(
      tx.ticketSaleCommissionRevision.create.mock.calls[1]?.[0].data,
    ).toMatchObject({
      offerId,
      returnOfferId: returnId,
      salePriceTargetId: targetId,
      percent: new Prisma.Decimal(4),
    });
  });
  it('updates one row when copy is omitted', async () => {
    const { db, tx } = setup();
    expect(
      await saveTicketSaleCommission(db, input, actor, 'save-key'),
    ).toEqual({ data: { count: 1, revision: 1 } });
    expect(tx.ticketSaleCommissionRevision.create).toHaveBeenCalledTimes(1);
  });
  it('rejects stale base and commission versions before any write', async () => {
    for (const patch of [
      { expectedBaseRevision: 1 },
      { expectedRevision: 1 },
    ]) {
      const { db, tx } = setup();
      await expect(
        saveTicketSaleCommission(
          db,
          { ...input, ...patch, copyToAll: true },
          actor,
          'stale',
        ),
      ).rejects.toThrow('تغییر کرده');
      expect(tx.ticketSaleCommissionRevision.create).not.toHaveBeenCalled();
    }
  });
  it('requires manage permission, a valid percentage and a target from the same branch', async () => {
    const { db, tx, transaction } = setup();
    await expect(
      saveTicketSaleCommission(db, input, { ...actor, permissions: [] }, 'bad'),
    ).rejects.toThrow('مجوز');
    await expect(
      saveTicketSaleCommission(
        db,
        { ...input, percent: '100.1' },
        actor,
        'bad',
      ),
    ).rejects.toThrow('درصد');
    expect(transaction).not.toHaveBeenCalled();
    tx.ticketSalePriceTarget.findFirst.mockResolvedValue(null);
    await expect(
      saveTicketSaleCommission(db, input, actor, 'bad'),
    ).rejects.toThrow('شعبه');
    expect(tx.ticketSaleCommissionRevision.create).not.toHaveBeenCalled();
  });
  it('rejects unauthorized offers and offers without a base price', async () => {
    const { db, tx, rows } = setup();
    tx.ticketPublishedOffer.findFirst.mockResolvedValue(null);
    await expect(
      saveTicketSaleCommission(db, input, actor, 'bad'),
    ).rejects.toThrow('شعبه');
    tx.ticketPublishedOffer.findFirst.mockResolvedValue({
      id: offerId,
      branchId: 'branch',
    });
    rows[0]!.standaloneSalePrices = [];
    await expect(
      saveTicketSaleCommission(db, input, actor, 'bad'),
    ).rejects.toThrow('قیمت پایه');
    expect(tx.ticketSaleCommissionRevision.create).not.toHaveBeenCalled();
  });
  it('replays the same command and rejects changed payloads', async () => {
    const { db, tx } = setup();
    let saved: Record<string, unknown> | undefined;
    tx.ticketSaleCommissionRevision.create.mockImplementation(({ data }) => {
      saved = data;
      return Promise.resolve({});
    });
    await saveTicketSaleCommission(db, input, actor, 'same');
    tx.ticketSaleCommissionRevision.findUnique.mockImplementation(() =>
      Promise.resolve(saved),
    );
    tx.ticketSaleCommissionRevision.count.mockResolvedValue(1);
    expect(await saveTicketSaleCommission(db, input, actor, 'same')).toEqual({
      data: { count: 1, revision: 1 },
    });
    expect(tx.ticketSaleCommissionRevision.create).toHaveBeenCalledTimes(1);
    await expect(
      saveTicketSaleCommission(db, { ...input, percent: '3' }, actor, 'same'),
    ).rejects.toThrow('اطلاعات متفاوت');
  });
});
describe('sale commission projection', () => {
  it('uses exact Decimal arithmetic with half-up rounding', () => {
    expect(commissionAmount('250000000', '3')).toBe('242500000');
    expect(commissionAmount('9999999999999999.9999', '0.0001')).toBe(
      '9999989999999999.9999',
    );
    expect(commissionAmount('0.0001', '50')).toBe('0.0001');
  });
  it('recalculates from current base, preserves the pair base and picks latest percentages', () => {
    const offer = {
      id: offerId,
      standaloneSalePrice: { amount: '100', currencyCode: 'IRR', revision: 2 },
      roundTripSalePrices: [
        {
          returnOfferId: returnId,
          amount: '250',
          currencyCode: 'IRR',
          revision: 3,
        },
      ],
    } as unknown as TicketOfferV1;
    const view = applySaleCommissions(offer, [
      {
        returnOfferId: null,
        salePriceTargetId: null,
        revision: 1,
        percent: new Prisma.Decimal(3),
      },
      {
        returnOfferId: null,
        salePriceTargetId: null,
        revision: 2,
        percent: new Prisma.Decimal(4),
      },
      {
        returnOfferId: returnId,
        salePriceTargetId: null,
        revision: 1,
        percent: new Prisma.Decimal(4),
      },
    ]);
    expect(view.baseStandaloneSalePrice?.amount).toBe('100');
    expect(view.standaloneSalePrice?.amount).toBe('96');
    expect(view.roundTripSalePrices?.[0]).toMatchObject({
      baseAmount: '250',
      amount: '240',
    });
    expect(
      applySaleCommissions(
        {
          ...offer,
          standaloneSalePrice: {
            amount: '200',
            currencyCode: 'IRR',
            revision: 3,
          },
        },
        [
          {
            returnOfferId: null,
            salePriceTargetId: null,
            revision: 2,
            percent: new Prisma.Decimal(4),
          },
        ],
      ).standaloneSalePrice?.amount,
    ).toBe('192');
  });
  it('preserves legacy absolute targeted prices until an explicit percentage is stored', () => {
    const target = {
      id: targetId,
      branchId: 'branch',
      name: 'Partner',
      code: 'PARTNER',
      version: 1,
      isActive: true,
    };
    const offer = {
      id: offerId,
      standaloneSalePrice: { amount: '100', currencyCode: 'IRR', revision: 2 },
      targetedStandaloneSalePrices: [
        {
          amount: '88',
          currencyCode: 'IRR',
          revision: 1,
          salePriceTarget: target,
        },
      ],
    } as unknown as TicketOfferV1;
    expect(
      applySaleCommissions(offer, []).targetedStandaloneSalePrices?.[0]?.amount,
    ).toBe('88');
    expect(
      applySaleCommissions(offer, [
        {
          returnOfferId: null,
          salePriceTargetId: targetId,
          revision: 1,
          percent: new Prisma.Decimal(4),
          target,
        },
      ]).targetedStandaloneSalePrices?.[0]?.amount,
    ).toBe('96');
  });
});
