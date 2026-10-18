import { describe, expect, it, vi } from 'vitest';
import { Prisma } from '@nora/database';
import { MasterProcurementDirectory } from './master-procurement-directory';
describe('public purchase FX reference', () => {
  it('reads only an approved active direct SELL quote valid and approved at the purchase instant', async () => {
    const findFirst = vi.fn().mockResolvedValue({
      rate: new Prisma.Decimal('123456.123456789'),
      observedAt: new Date('2026-10-17T00:00:00Z'),
    });
    const directory = new MasterProcurementDirectory({
      client: { masterDraftExchangeRate: { findFirst } },
    } as never);
    const at = new Date('2026-10-17T01:00:00Z');
    expect(await directory.purchaseRateToIrr('EUR', at)).toMatchObject({
      rateToIrr: '123456.12345679',
      source: 'SYSTEM_SELL',
    });
    expect(findFirst).toHaveBeenCalledWith(
      expect.objectContaining({
        where: expect.objectContaining({
          rateType: 'SELL',
          status: 'APPROVED',
          isActive: true,
          approvedAt: { lte: at },
          observedAt: { lte: at },
          validFrom: { lte: at },
          toCurrency: { code: 'IRR', isActive: true },
        }),
      }),
    );
  });
  it('falls back to REFERENCE, never BUY, and returns null for missing history', async () => {
    const findFirst = vi.fn().mockResolvedValue(null);
    const directory = new MasterProcurementDirectory({
      client: { masterDraftExchangeRate: { findFirst } },
    } as never);
    expect(await directory.purchaseRateToIrr('USD')).toBeNull();
    expect(findFirst.mock.calls.map(([arg]) => arg.where.rateType)).toEqual([
      'SELL',
      'REFERENCE',
    ]);
  });
});
