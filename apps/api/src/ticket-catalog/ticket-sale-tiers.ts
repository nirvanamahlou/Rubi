import { BadRequestException } from '@nestjs/common';
import { Prisma } from '@nora/database';
import type { TicketSalePriceTierV1 } from '@nora/contracts';

/** A tier schedule is an immutable, gap-free partition of the offer capacity. */
export function validatePriceTiers(
  tiers: readonly TicketSalePriceTierV1[] | undefined,
  firstAmount: string,
  capacity: number,
): void {
  if (!tiers) return;
  if (
    !tiers.length ||
    tiers.length > 40 ||
    tiers.some(
      (tier) =>
        !Number.isSafeInteger(tier.seatCount) ||
        tier.seatCount < 1 ||
        !new Prisma.Decimal(tier.amount).isFinite() ||
        new Prisma.Decimal(tier.amount).lte(0),
    ) ||
    tiers.reduce((total, tier) => total + tier.seatCount, 0) !== capacity ||
    !new Prisma.Decimal(tiers[0]!.amount).eq(firstAmount)
  )
    throw new BadRequestException(
      'پله‌های قیمت باید مثبت باشند، پشت سر هم تمام ظرفیت را پوشش دهند و قیمت پله اول با قیمت پایه برابر باشد.',
    );
}

export function priceTierCreate(
  tiers: readonly TicketSalePriceTierV1[],
  currencyCode: string,
) {
  return tiers.map((tier, index) => ({
    tierIndex: index + 1,
    seatCount: tier.seatCount,
    amount: new Prisma.Decimal(tier.amount),
    currencyCode,
  }));
}
