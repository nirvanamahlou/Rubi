import { ConflictException } from '@nestjs/common';
import { Prisma } from '@nora/database';
export type AgeCounts = { adults: number; children: number; infants: number };
export function ageFareFields(fare: {
  childAmount?: { toString(): string } | null;
  infantAmount?: { toString(): string } | null;
}) {
  return {
    ...(fare.childAmount != null
      ? { childAmount: fare.childAmount.toString() }
      : {}),
    ...(fare.infantAmount != null
      ? { infantAmount: fare.infantAmount.toString() }
      : {}),
  };
}
export function ageCounts(categories: readonly string[]): AgeCounts {
  return {
    adults: categories.filter((x) => x === 'ADT').length,
    children: categories.filter((x) => x === 'CHD').length,
    infants: categories.filter((x) => x === 'INF').length,
  };
}
export function ageFareTotal(
  fare: {
    amount: string;
    childAmount?: string | null | undefined;
    infantAmount?: string | null | undefined;
    tiers?: readonly { seatCount: number; amount: string }[] | undefined;
  },
  counts: AgeCounts,
  consumed: number,
) {
  if (
    !Object.values(counts).every((n) => Number.isSafeInteger(n) && n >= 0) ||
    counts.adults + counts.children < 1
  )
    throw new ConflictException('ترکیب مسافران معتبر نیست.');
  const seats = counts.adults + counts.children;
  const charged =
    counts.adults + (fare.childAmount == null ? counts.children : 0);
  let covered = 0,
    cursor = 0,
    total = new Prisma.Decimal(0);
  if (fare.tiers?.length) {
    for (const tier of fare.tiers) {
      const n = Math.max(
        0,
        Math.min(consumed + charged, cursor + tier.seatCount) -
          Math.max(consumed, cursor),
      );
      total = total.add(new Prisma.Decimal(tier.amount).mul(n));
      covered += n;
      cursor += tier.seatCount;
    }
    if (covered !== charged || consumed + seats > cursor)
      throw new ConflictException('ظرفیت نرخ پلکانی کافی نیست.');
  } else total = new Prisma.Decimal(fare.amount).mul(charged);
  if (fare.childAmount != null)
    total = total.add(
      new Prisma.Decimal(fare.childAmount).mul(counts.children),
    );
  if (fare.infantAmount != null)
    total = total.add(
      new Prisma.Decimal(fare.infantAmount).mul(counts.infants),
    );
  return total;
}
