import { describe, expect, it, vi } from 'vitest';
import { buildAssistantBalances } from './sales-assistant-balances';
import { SalesAssistantController } from './sales-assistant.controller';
import type { DatabaseService } from '../database/database.service';
import type { AuthenticatedRequest } from '../iam/iam.types';
const now = new Date('2026-10-12T08:00:00Z');
const fact = {
  id: 'aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaaa',
  contractNumber: 'SYNTHETIC-1',
  updatedAt: now,
  priceComponents: [
    {
      type: 'BASE' as const,
      title: 'Synthetic',
      amount: '100.0001',
      currencyCode: 'USD',
    },
    {
      type: 'DISCOUNT' as const,
      title: 'Synthetic discount',
      amount: '10',
      currencyCode: 'USD',
    },
    {
      type: 'BASE' as const,
      title: 'Synthetic',
      amount: '9007199254740993.0001',
      currencyCode: 'IRR',
    },
  ],
  payments: [
    { amount: '20', currencyCode: 'USD', status: 'FINANCE_CONFIRMED' as const },
    {
      amount: '5',
      currencyCode: 'USD',
      status: 'PENDING_FINANCE_CONFIRMATION' as const,
    },
    { amount: '7', currencyCode: 'USD', status: 'FINANCE_REJECTED' as const },
  ],
};
describe('Assistant operational balances', () => {
  it('preserves exact decimals, discounts and distinct currencies; pending/rejected receipts never reduce outstanding', () => {
    const report = buildAssistantBalances([fact], now);
    expect(report.totals).toEqual([
      {
        currencyCode: 'IRR',
        amount: '9007199254740993.0001',
        confirmedPaid: '0',
        pendingFinance: '0',
        outstanding: '9007199254740993.0001',
      },
      {
        currencyCode: 'USD',
        amount: '90.0001',
        confirmedPaid: '20',
        pendingFinance: '5',
        outstanding: '70.0001',
      },
    ]);
    expect(report.coverage.refundsIncluded).toBe(false);
    expect(report.unavailable).toContain(
      'ACCOUNTING_RECEIVABLES_SOURCE_PENDING',
    );
    expect(JSON.stringify(report)).not.toContain('Synthetic discount');
  });
  it('bounds the visible list without truncating totals and preserves empty and overpayment meaning', () => {
    const rows = Array.from({ length: 31 }, (_, index) => ({
      ...fact,
      id: String(index),
    }));
    const report = buildAssistantBalances(rows, now);
    expect(report.items).toHaveLength(30);
    expect(report.coverage.itemsTruncated).toBe(true);
    expect(
      report.totals.find((row) => row.currencyCode === 'USD')?.amount,
    ).toBe('2790.0031');
    expect(buildAssistantBalances([], now)).toMatchObject({
      contractCount: 0,
      totals: [],
      items: [],
      sourceUpdatedAt: null,
    });
    const overpaid = buildAssistantBalances(
      [
        {
          ...fact,
          priceComponents: fact.priceComponents.slice(0, 2),
          payments: [
            { amount: '100', currencyCode: 'USD', status: 'FINANCE_CONFIRMED' },
          ],
        },
      ],
      now,
    );
    expect(overpaid.items).toEqual([]);
    expect(overpaid.totals[0]?.outstanding).toBe('-9.9999');
  });
  it('denies financial reads and input scope before DB, excludes cancelled/unconfirmed, and rejects source cap', async () => {
    const findMany = vi.fn().mockResolvedValue([]);
    const controller = new SalesAssistantController({
      client: { salesContract: { findMany } },
    } as unknown as DatabaseService);
    const request = {
      actor: { permissions: ['sales.contracts.read.all'] },
    } as unknown as AuthenticatedRequest;
    await expect(controller.balances(request, {})).rejects.toThrow(
      'SALES_BALANCE_READ_REQUIRED',
    );
    request.actor.permissions.push('sales.payments.read');
    await expect(
      controller.balances(request, { branchId: 'foreign' }),
    ).rejects.toThrow('ASSISTANT_FIXED_SCOPE');
    expect(findMany).not.toHaveBeenCalled();
    await controller.balances(request, {});
    expect(findMany.mock.calls[0]?.[0]).toMatchObject({
      take: 5001,
      where: {
        confirmedAt: { not: null },
        status: {
          in: ['CONFIRMED', 'SENT_TO_RESERVATIONS', 'IN_PROGRESS', 'COMPLETED'],
        },
      },
    });
    expect(JSON.stringify(findMany.mock.calls[0]?.[0])).not.toMatch(
      /customerName|bankId|description|buyerContact/,
    );
    findMany.mockResolvedValue(Array(5001).fill(fact));
    await expect(controller.balances(request, {})).rejects.toThrow(
      'SALES_SOURCE_CAP_EXCEEDED',
    );
  });
});
