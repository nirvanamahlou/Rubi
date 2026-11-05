import { BadRequestException } from '@nestjs/common';
import {
  moneyUnits,
  moneyDecimal,
  type SalesReservationRequestV1,
  type ReservationServicePurchaseInputV1,
} from '@nora/contracts';
export function floatingPassengerPurchaseGroups(
  snapshot: SalesReservationRequestV1,
  rows: NonNullable<ReservationServicePurchaseInputV1['totalPassengerPrices']>,
) {
  const assigned = snapshot.passengerAssignments?.length
    ? snapshot.passengerAssignments
    : snapshot.passengerIds.map((customerId) => ({
        customerId,
        displayNameSnapshot: customerId,
      }));
  if (
    !Array.isArray(rows) ||
    !rows.length ||
    rows.length > 500 ||
    rows.length !== assigned.length ||
    new Set(rows.map((r) => r?.customerId)).size !== rows.length
  )
    throw new BadRequestException(
      'قیمت خرید همه مسافران را بدون تکرار وارد کنید.',
    );
  const groups = new Map<
    string,
    {
      currencyCode: string;
      amount: string;
      passengerPrices: {
        customerId: string;
        passengerName: string;
        unitAmount: string;
        totalAmount: string;
      }[];
    }
  >();
  try {
    for (const row of rows) {
      const passenger = assigned.find((p) => p.customerId === row.customerId);
      if (
        !passenger ||
        Object.keys(row).some(
          (k) =>
            ![
              'customerId',
              'rialAmount',
              'foreignAmount',
              'currencyCode',
            ].includes(k),
        )
      )
        throw new Error();
      if (row.currencyCode === 'IRR') throw new Error();
      for (const [code, value] of [
        ['IRR', row.rialAmount],
        [row.currencyCode, row.foreignAmount],
      ] as const) {
        const units = moneyUnits(value);
        if (units < 0n || (units > 0n && (!code || !/^[A-Z]{3}$/.test(code))))
          throw new Error();
        if (!units) continue;
        const group = groups.get(code!) ?? {
          currencyCode: code!,
          amount: '0',
          passengerPrices: [],
        };
        group.amount = moneyDecimal(moneyUnits(group.amount) + units);
        moneyUnits(group.amount);
        group.passengerPrices.push({
          customerId: row.customerId,
          passengerName: passenger.displayNameSnapshot || row.customerId,
          unitAmount: moneyDecimal(units),
          totalAmount: moneyDecimal(units),
        });
        groups.set(code!, group);
      }
    }
    if (!groups.size) throw new Error();
  } catch {
    throw new BadRequestException('مسافر، ارز یا مبلغ خرید معتبر نیست.');
  }
  return [...groups.values()];
}
