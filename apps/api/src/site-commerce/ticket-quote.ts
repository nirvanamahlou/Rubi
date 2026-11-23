import {
  ageFareTotal,
  ageFareBreakdown,
  type AgeCounts,
} from '../ticket-catalog/ticket-age-fares';
import { ConflictException } from '@nestjs/common';
import { Prisma } from '@nora/database';
import {
  eligibleTicketReturn,
  type TicketOfferV1,
  type TicketStandaloneSalePriceV1,
} from '@nora/contracts';

import { assertWebsiteBookable } from './price-only-policy';

export type WebsiteFlightQuote = {
  amount: string;
  currencyCode: string;
  pricingBreakdown?: ReturnType<typeof ageFareBreakdown> & {
    version: 1;
    coverage: 'one_way' | 'round_trip';
    currencyCode: string;
  };
};

export function websiteFareTotal(
  fare: TicketStandaloneSalePriceV1,
  seats: number,
  consumed: number,
) {
  if (
    !Number.isSafeInteger(seats) ||
    seats < 1 ||
    !Number.isSafeInteger(consumed) ||
    consumed < 0
  )
    throw new ConflictException('تعداد صندلی معتبر نیست.');
  if (!fare.tiers?.length) return new Prisma.Decimal(fare.amount).mul(seats);
  let cursor = 0,
    covered = 0;
  let total = new Prisma.Decimal(0);
  for (const tier of fare.tiers) {
    const count = Math.max(
      0,
      Math.min(consumed + seats, cursor + tier.seatCount) -
        Math.max(consumed, cursor),
    );
    total = total.add(new Prisma.Decimal(tier.amount).mul(count));
    covered += count;
    cursor += tier.seatCount;
  }
  if (covered !== seats)
    throw new ConflictException('ظرفیت نرخ پلکانی کافی نیست.');
  return total;
}

export function websiteFlightQuotes(
  outbound: TicketOfferV1,
  returning: TicketOfferV1 | undefined,
  seats: number,
  counts?: AgeCounts,
  includeBreakdown = false,
): WebsiteFlightQuote[] {
  for (const offer of [outbound, ...(returning ? [returning] : [])])
    assertWebsiteBookable('ticket', offer.supplyType);
  const totalFor = (fare: TicketStandaloneSalePriceV1, consumed: number) =>
    counts
      ? ageFareTotal(fare, counts, consumed)
      : websiteFareTotal(fare, seats, consumed);
  const details = (
    fare: TicketStandaloneSalePriceV1,
    consumed: number,
    coverage: 'one_way' | 'round_trip',
  ) =>
    includeBreakdown && counts
      ? {
          pricingBreakdown: {
            version: 1 as const,
            coverage,
            currencyCode: fare.currencyCode,
            ...ageFareBreakdown(fare, counts, consumed),
          },
        }
      : {};
  if (counts && counts.adults + counts.children !== seats)
    throw new ConflictException('ترکیب مسافران معتبر نیست.');
  const offers = [outbound, ...(returning ? [returning] : [])];
  if (offers.some((o) => o.remainingCapacity < seats))
    throw new ConflictException('ظرفیت بلیت کافی نیست.');
  if (returning && !eligibleTicketReturn(outbound, returning))
    throw new ConflictException('پرواز برگشت با رفت مطابقت ندارد.');
  const pair =
    returning &&
    outbound.roundTripSalePrices?.find((p) => p.returnOfferId === returning.id);
  if (pair) {
    const consumed = Math.max(
      ...offers.map(
        (o) => (o.allocatedCapacity ?? 0) + (o.reservedCapacity ?? 0),
      ),
    );
    const total = totalFor(pair, consumed);
    const first = total.div(2).toDecimalPlaces(2, Prisma.Decimal.ROUND_DOWN);
    return [
      {
        amount: first.toFixed(2),
        currencyCode: pair.currencyCode,
        ...details(pair, consumed, 'round_trip'),
      },
      { amount: total.sub(first).toFixed(2), currencyCode: pair.currencyCode },
    ];
  }
  return offers.map((offer) => {
    if (!offer.standaloneSalePrice)
      throw new ConflictException('قیمت فروش بلیت منتشر نشده است.');
    return {
      amount: totalFor(
        offer.standaloneSalePrice,
        (offer.allocatedCapacity ?? 0) + (offer.reservedCapacity ?? 0),
      ).toFixed(2),
      currencyCode: offer.standaloneSalePrice.currencyCode,
      ...details(
        offer.standaloneSalePrice,
        (offer.allocatedCapacity ?? 0) + (offer.reservedCapacity ?? 0),
        'one_way',
      ),
    };
  });
}
