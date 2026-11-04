import { moneyDecimal, moneyUnits } from '@nora/contracts';
import type { TicketPurchaseInboxItemV1 } from '@nora/contracts';
export const purchaseStages = {
  UNPRICED: 'در انتظار قیمت خرید',
  READY_FOR_PAYMENT: 'ارسال‌شده به مالی',
  PAYING: 'در حال پرداخت',
  PAID: 'تسویه‌شده',
};
export function purchaseSummary(items: readonly TicketPurchaseInboxItemV1[]) {
  const sums = new Map<
    string,
    { invoice: bigint; paid: bigint; remaining: bigint }
  >();
  const units = (s: string) => {
    const [w, f = ''] = s.split('.');
    return BigInt(w!) * 10000n + BigInt(f.padEnd(4, '0'));
  };
  const format = (v: bigint) => {
    const d = (v % 10000n).toString().padStart(4, '0').replace(/0+$/, '');
    return (v / 10000n).toString() + (d ? '.' + d : '');
  };
  for (const item of items)
    if (item.cost) {
      const c = item.cost;
      const total = sums.get(c.currencyCode) ?? {
        invoice: 0n,
        paid: 0n,
        remaining: 0n,
      };
      total.invoice += units(c.invoiceAmount);
      total.paid += units(c.paidAmount);
      total.remaining += units(c.remainingAmount);
      sums.set(c.currencyCode, total);
    }
  return {
    unpriced: items.filter((i) => i.stage === 'UNPRICED').length,
    pending: items.filter((i) =>
      ['READY_FOR_PAYMENT', 'PAYING'].includes(i.stage),
    ).length,
    paid: items.filter((i) => i.stage === 'PAID').length,
    totals: [...sums].map(([currencyCode, t]) => ({
      currencyCode,
      invoice: format(t.invoice),
      paid: format(t.paid),
      remaining: format(t.remaining),
    })),
  };
}

export type TicketPurchaseRow = TicketPurchaseInboxItemV1 & {
  members: readonly TicketPurchaseInboxItemV1[];
  dates: string[];
  capacityCosts: NonNullable<TicketPurchaseInboxItemV1['capacityCost']>[];
};
export const purchaseWeekdays = [
  'یکشنبه',
  'دوشنبه',
  'سه‌شنبه',
  'چهارشنبه',
  'پنجشنبه',
  'جمعه',
  'شنبه',
];
/** Each dated offer owns its request, cost and payment evidence. */
export function separateTicketPurchases(
  matching: readonly TicketPurchaseInboxItemV1[],
): TicketPurchaseRow[] {
  return matching.map((row) => ({
    ...row,
    members: [row],
    dates: [row.flightGroup?.departureDate ?? row.request.serviceDate].filter(
      (date): date is string => !!date,
    ),
    capacityCosts: row.capacityCost ? [row.capacityCost] : [],
  }));
}

/** Previously persisted shared invoices must retain their original edit scope. */
export function ticketPurchaseEditRow(
  all: readonly TicketPurchaseInboxItemV1[],
  row: TicketPurchaseInboxItemV1,
): TicketPurchaseRow {
  return row.cost?.purchaseGroup
    ? groupTicketPurchases(all, [row])[0]!
    : separateTicketPurchases([row])[0]!;
}

export function canEditTicketPurchase(
  row: TicketPurchaseRow,
  canPrice: boolean,
) {
  return (
    canPrice &&
    row.members.every(
      (member) =>
        member.request.status === 'PENDING' && !member.cost?.paymentCount,
    )
  );
}

export function groupTicketPurchases(
  all: readonly TicketPurchaseInboxItemV1[],
  matching = all,
): TicketPurchaseRow[] {
  const groups = new Map<string, TicketPurchaseInboxItemV1[]>();
  for (const row of matching) {
    const pool = row.cost?.purchaseGroup;
    const key = pool ? 'saved:' + pool.id : 'single:' + row.request.id;
    if (pool) {
      if (!groups.has(key))
        groups.set(
          key,
          all.filter((m) => m.cost?.purchaseGroup?.id === pool.id),
        );
    } else {
      const rows = groups.get(key) ?? [];
      rows.push(row);
      groups.set(key, rows);
    }
  }
  return [...groups.values()].map((members) => {
    const first = members[0]!;
    const sum = (field: 'invoiceAmount' | 'paidAmount' | 'remainingAmount') =>
      moneyDecimal(
        members.reduce((v, m) => v + moneyUnits(m.cost?.[field] ?? '0'), 0n),
      );
    const seats = members.reduce(
      (v, m) => v + (m.cost?.seatCount ?? m.request.seatCount ?? 0),
      0,
    );
    const priced = members.every((m) => !!m.cost);
    const cost = priced
      ? {
          ...first.cost!,
          invoiceAmount: sum('invoiceAmount'),
          paidAmount: sum('paidAmount'),
          remainingAmount: sum('remainingAmount'),
          seatCount: seats,
          paymentCount: members.reduce(
            (v, m) => v + (m.cost?.paymentCount ?? 0),
            0,
          ),
          unitCost: seats
            ? moneyDecimal(
                (moneyUnits(sum('invoiceAmount')) + BigInt(seats) / 2n) /
                  BigInt(seats),
              )
            : null,
        }
      : null;
    const losses = new Map<
      string,
      NonNullable<TicketPurchaseInboxItemV1['capacityCost']>
    >();
    for (const m of members)
      if (m.capacityCost) {
        const c = m.capacityCost,
          key = c.status + ':' + c.currencyCode,
          old = losses.get(key);
        losses.set(
          key,
          old
            ? {
                ...c,
                amount: moneyDecimal(
                  moneyUnits(old.amount) + moneyUnits(c.amount),
                ),
                purchasedSeats: old.purchasedSeats + c.purchasedSeats,
                allocatedSeats: old.allocatedSeats + c.allocatedSeats,
                unsoldSeats: old.unsoldSeats + c.unsoldSeats,
              }
            : c,
        );
      }
    return {
      ...first,
      members,
      dates: members
        .map((m) => m.flightGroup?.departureDate ?? m.request.serviceDate)
        .filter((d): d is string => !!d)
        .sort(),
      capacityCosts: [...losses.values()],
      request: { ...first.request, seatCount: seats },
      cost,
      stage: members.every((m) => m.stage === 'PAID')
        ? 'PAID'
        : members.some((m) => m.stage === 'UNPRICED')
          ? 'UNPRICED'
          : members.some((m) => m.stage === 'PAYING')
            ? 'PAYING'
            : 'READY_FOR_PAYMENT',
    };
  });
}
