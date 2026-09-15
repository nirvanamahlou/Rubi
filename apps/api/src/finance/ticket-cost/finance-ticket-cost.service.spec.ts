import { BadRequestException, ForbiddenException } from '@nestjs/common';
import { Prisma } from '@nora/database';
import type { AuthenticatedActor } from '@nora/contracts';
import { describe, expect, it, vi } from 'vitest';
import type { DatabaseService } from '../../database/database.service';
import type { ProcurementPublicService } from '../../procurement/procurement-public.service';
import { FinanceTicketCostService } from './finance-ticket-cost.service';

const actor = {
  userId: 'finance-user',
  branchIds: ['branch-a'],
  permissions: ['finance.payment.create'],
} as unknown as AuthenticatedActor;

describe('FinanceTicketCostService', () => {
  it('releases only paid, offer-linked costs; never a catalog estimate', async () => {
    const findMany = vi.fn().mockResolvedValue([
      {
        id: 'paid-cost',
        requestId: 'request-1',
        branchId: 'branch-a',
        offerId: 'offer-1',
        offerVersion: 1,
        adultUnitCost: new Prisma.Decimal('150'),
        childUnitCost: new Prisma.Decimal('90'),
        invoiceAmount: new Prisma.Decimal('3000'),
        currencyCode: 'EUR',
        payments: [
          { status: 'PAID', transferAt: new Date('2026-09-15T10:00:00.000Z') },
        ],
      },
      {
        id: 'unpaid-cost',
        requestId: 'request-2',
        branchId: 'branch-a',
        offerId: 'offer-2',
        offerVersion: 1,
        adultUnitCost: new Prisma.Decimal('200'),
        childUnitCost: new Prisma.Decimal('100'),
        invoiceAmount: new Prisma.Decimal('4000'),
        currencyCode: 'EUR',
        payments: [],
      },
      {
        id: 'legacy-cost',
        requestId: 'request-3',
        branchId: 'branch-a',
        offerId: null,
        offerVersion: null,
        adultUnitCost: new Prisma.Decimal('100'),
        childUnitCost: new Prisma.Decimal('50'),
        invoiceAmount: new Prisma.Decimal('2000'),
        currencyCode: 'EUR',
        payments: [{ status: 'PAID', transferAt: new Date() }],
      },
    ]);
    const database = {
      client: { financeTicketPurchaseCostRevision: { findMany } },
    } as unknown as DatabaseService;
    const service = new FinanceTicketCostService(
      database,
      {} as ProcurementPublicService,
    );
    const costs = await service.paidCostsForOffers(
      ['offer-1', 'offer-2'],
      'branch-a',
    );
    expect(costs).toMatchObject([
      { offerId: 'offer-1', adultUnitCost: '150', currencyCode: 'EUR' },
    ]);
    expect(findMany).toHaveBeenCalledWith(
      expect.objectContaining({
        where: {
          offerId: { in: ['offer-1', 'offer-2'] },
          branchId: 'branch-a',
        },
      }),
    );
  });

  it('rejects missing Finance permission before reading a request', async () => {
    const procurement = { forFinance: vi.fn() };
    const service = new FinanceTicketCostService(
      {} as DatabaseService,
      procurement as unknown as ProcurementPublicService,
    );
    await expect(
      service.recordCost(
        'request-1',
        {
          version: 1,
          adultUnitCost: '150',
          childUnitCost: '90',
          invoiceAmount: '3000',
          currencyCode: 'EUR',
          reason: 'test',
        },
        { ...actor, permissions: [] } as never,
      ),
    ).rejects.toBeInstanceOf(ForbiddenException);
    expect(procurement.forFinance).not.toHaveBeenCalled();
  });

  it('rejects fractional precision beyond currency scale and zero rates', async () => {
    const procurement = {
      forFinance: vi.fn().mockResolvedValue({
        id: 'request-1',
        branchId: 'branch-a',
        offerId: 'offer-1',
        offerVersion: 1,
      }),
    };
    const service = new FinanceTicketCostService(
      {} as DatabaseService,
      procurement as unknown as ProcurementPublicService,
    );
    await expect(
      service.recordCost(
        'request-1',
        {
          version: 1,
          adultUnitCost: '1.12345',
          childUnitCost: '0',
          invoiceAmount: '3000',
          currencyCode: 'EUR',
          reason: 'test',
        },
        actor,
      ),
    ).rejects.toBeInstanceOf(BadRequestException);
    await expect(
      service.recordCost(
        'request-1',
        {
          version: 1,
          adultUnitCost: '0',
          childUnitCost: '0',
          invoiceAmount: '3000',
          currencyCode: 'EUR',
          reason: 'test',
        },
        actor,
      ),
    ).rejects.toBeInstanceOf(BadRequestException);
  });
});
