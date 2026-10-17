import { describe, expect, it, vi } from 'vitest';
import { Prisma } from '@nora/database';
import { PurchaseFxService } from './purchase-fx.service';
const input = {
  reservationPurchaseId: 'purchase',
  branchId: 'branch',
  actorUserId: 'actor',
  currencyCode: 'EUR',
  amount: '915',
  baselineAt: new Date('2026-10-17T00:00:00Z'),
};
function fixture() {
  const directory = {
    purchaseRateToIrr: vi
      .fn()
      .mockResolvedValue({ rateToIrr: '300000', source: 'SYSTEM_SELL' }),
  };
  const tx = {
    $queryRaw: vi.fn().mockResolvedValue([{ locked: 1 }]),
    financePurchaseFxSnapshot: {
      findFirst: vi.fn().mockResolvedValue(null),
      create: vi.fn(async ({ data }) => data),
    },
  };
  return {
    directory,
    tx,
    service: new PurchaseFxService({} as never, directory as never),
  };
}
describe('immutable purchase-day FX capture', () => {
  it('captures approved system rates atomically with the owning purchase and freezes the original value', async () => {
    const { service, tx, directory } = fixture();
    const result = await service.capture(tx as never, input);
    expect(result).toMatchObject({
      rateToIrr: '300000',
      source: 'SYSTEM_SELL',
      baselineAt: input.baselineAt,
      foreignAmount: '915',
    });
    expect(directory.purchaseRateToIrr).toHaveBeenCalledWith(
      'EUR',
      input.baselineAt,
    );
    tx.financePurchaseFxSnapshot.findFirst.mockResolvedValue({
      ...result,
      rateToIrr: new Prisma.Decimal('300000'),
    });
    directory.purchaseRateToIrr.mockResolvedValue({
      rateToIrr: '400000',
      source: 'SYSTEM_SELL',
    });
    expect(
      (await service.capture(tx as never, input))?.rateToIrr.toString(),
    ).toBe('300000');
    expect(tx.financePurchaseFxSnapshot.create).toHaveBeenCalledTimes(1);
  });
  it('permits a manual purchase-day rate, but rejects replacing a frozen rate', async () => {
    const { service, tx } = fixture();
    const result = await service.capture(tx as never, {
      ...input,
      rateToIrr: '350000',
    });
    expect(result?.source).toBe('MANUAL');
    tx.financePurchaseFxSnapshot.findFirst.mockResolvedValue({
      ...result,
      rateToIrr: new Prisma.Decimal('350000'),
    });
    await expect(
      service.capture(tx as never, { ...input, rateToIrr: '360000' }),
    ).rejects.toThrow('ثابت');
  });
  it.each(['0', '-1', 'NaN', '1e3', '1.123456789'])(
    'rejects invalid manual rate %s',
    async (rateToIrr) => {
      const { service, tx } = fixture();
      await expect(
        service.capture(tx as never, { ...input, rateToIrr }),
      ).rejects.toThrow();
      expect(tx.financePurchaseFxSnapshot.create).not.toHaveBeenCalled();
    },
  );
  it('keeps missing system quotes unknown and does not invent a baseline or touch IRR purchases', async () => {
    const { service, tx, directory } = fixture();
    directory.purchaseRateToIrr.mockResolvedValue(null);
    expect(await service.capture(tx as never, input)).toBeNull();
    expect(
      await service.capture(tx as never, { ...input, currencyCode: 'IRR' }),
    ).toBeNull();
    expect(tx.financePurchaseFxSnapshot.create).not.toHaveBeenCalled();
  });
});
