import {
  reservationHotelStays,
  reservationHotelTransferKeys,
  readLegacyServiceParties,
  moneyDecimal,
  moneyUnits,
  type SalesContractDetail,
  type SalesContractProfitV1,
  type ReservationIntakeV1,
} from '@nora/contracts';

type TicketCost = {
  id: string;
  offerId: string;
  currencyCode: string;
  adultUnitCost: string;
  childUnitCost: string;
  unitCost: string | null;
  supplyType?: string | null | undefined;
  poolCost?: { seatCount: number; totalCost: string };
  seatCount?: number | null;
  invoiceAmount?: string | null;
};
export function contractProfit(
  contract: SalesContractDetail,
  intake: ReservationIntakeV1 | null,
  ticketCosts: readonly TicketCost[],
  companyOfferIds: readonly string[] = [],
): SalesContractProfitV1 {
  const costs: SalesContractProfitV1['costs'][number][] = [];
  const covered = new Set<string>();
  const services = [
    ...contract.servicesDetail.filter(
      (s) => s.metadata?.insuranceAgeSurcharge !== true,
    ),
  ];
  if (
    intake?.servicePurchases?.some((purchase) => purchase.roomPrices?.length)
  ) {
    for (const stay of reservationHotelStays(
      intake.purchaseSnapshot ?? intake.snapshot,
    )) {
      if (!services.some((service) => service.clientKey === stay.key))
        services.push({
          clientKey: stay.key,
          kind: 'HOTEL',
          titleSnapshot: stay.hotel.hotelNameSnapshot,
        } as (typeof services)[number]);
      for (const key of reservationHotelTransferKeys(
        intake.purchaseSnapshot ?? intake.snapshot,
        stay.key,
      ))
        if (!services.some((service) => service.clientKey === key))
          services.push({
            clientKey: key,
            kind: 'TRANSFER',
            titleSnapshot: 'Transfer · ' + stay.hotel.hotelNameSnapshot,
          } as (typeof services)[number]);
    }
  }
  const title = (key: string) =>
    services.find((s) => s.clientKey === key)?.titleSnapshot ||
    (
      {
        FLIGHT: 'بلیط',
        HOTEL: 'هتل',
        TRANSFER: 'ترانسفر',
        INSURANCE: 'بیمه',
        VISA: 'ویزا',
      } as Record<string, string>
    )[services.find((s) => s.clientKey === key)?.kind ?? ''] ||
    'خدمت';
  const validKeys = new Set(services.map((s) => s.clientKey));
  const companyKeys = new Set(
    contract.ticketSelections
      .filter(
        (selection) =>
          companyOfferIds.includes(selection.offerId) ||
          ticketCosts.some(
            (cost) =>
              cost.offerId === selection.offerId &&
              cost.supplyType === 'COMPANY',
          ),
      )
      .map((selection) => selection.serviceClientKey),
  );
  for (const purchase of intake?.servicePurchases ?? []) {
    const keys = purchase.coveredServiceClientKeys?.length
      ? [...purchase.coveredServiceClientKeys]
      : [purchase.serviceClientKey];
    if (
      keys.some(
        (key) =>
          !validKeys.has(key) || covered.has(key) || companyKeys.has(key),
      )
    )
      continue;
    keys.forEach((key) => covered.add(key));
    costs.push({
      serviceClientKeys: keys,
      serviceTitles: keys.map(title),
      source: 'RESERVATIONS',
      referenceId: purchase.id,
      amount: purchase.amount,
      currencyCode: purchase.currencyCode,
    });
  }
  // Old hotel revisions are a fallback only; a current service purchase is never added twice.
  const hotel = contract.hotelSelection;
  if (
    hotel &&
    !covered.has(hotel.serviceClientKey) &&
    intake?.hotelPurchases?.length
  ) {
    for (const cost of intake.hotelPurchases)
      costs.push({
        serviceClientKeys: [hotel.serviceClientKey],
        serviceTitles: [title(hotel.serviceClientKey)],
        source: 'RESERVATIONS',
        referenceId: cost.id,
        amount: cost.amount,
        currencyCode: cost.currencyCode,
      });
    covered.add(hotel.serviceClientKey);
  }
  const legacyParties = readLegacyServiceParties(contract.servicesDetail);
  const flightCoverage = new Map<string, boolean>();
  for (const selection of contract.ticketSelections) {
    if (covered.has(selection.serviceClientKey)) continue;
    const cost = ticketCosts.find((row) => row.offerId === selection.offerId);
    if (!cost) {
      flightCoverage.set(selection.serviceClientKey, false);
      continue;
    }
    const assigned = contract.passengersDetail.filter((p) =>
      p.serviceClientKeys.includes(selection.serviceClientKey),
    );
    const legacyParty = legacyParties?.[selection.serviceClientKey];
    if (!assigned.length && !legacyParty) continue;
    const soldSeats = legacyParty
      ? legacyParty.adults + legacyParty.children
      : assigned.filter((p) => p.ageCategory !== 'INF').length;
    const purchasedSeats = cost.poolCost?.seatCount ?? cost.seatCount;
    const invoice = cost.poolCost?.totalCost ?? cost.invoiceAmount;
    const proportional =
      purchasedSeats && invoice
        ? (moneyUnits(invoice) * BigInt(soldSeats) +
            BigInt(purchasedSeats) / 2n) /
          BigInt(purchasedSeats)
        : null;
    const amount =
      proportional ??
      (legacyParty
        ? BigInt(legacyParty.adults) *
            moneyUnits(cost.unitCost ?? cost.adultUnitCost) +
          BigInt(legacyParty.children) *
            moneyUnits(cost.unitCost ?? cost.childUnitCost)
        : assigned.reduce(
            (sum, p) =>
              sum +
              (p.ageCategory === 'INF'
                ? 0n
                : moneyUnits(
                    cost.unitCost ??
                      (p.ageCategory === 'CHD'
                        ? cost.childUnitCost
                        : cost.adultUnitCost),
                  )),
            0n,
          ));
    costs.push({
      serviceClientKeys: [selection.serviceClientKey],
      serviceTitles: [title(selection.serviceClientKey)],
      source: 'FINANCE_TICKET',
      referenceId: cost.id,
      amount: moneyDecimal(amount),
      currencyCode: cost.currencyCode,
    });
    if (!flightCoverage.has(selection.serviceClientKey))
      flightCoverage.set(selection.serviceClientKey, true);
  }
  for (const [key, complete] of flightCoverage) if (complete) covered.add(key);
  const missingServiceKeys = services
    .filter((s) => !covered.has(s.clientKey))
    .map((s) => s.clientKey);
  const sums = new Map<string, { sales: bigint; purchase: bigint }>();
  const row = (code: string) => {
    if (!sums.has(code)) sums.set(code, { sales: 0n, purchase: 0n });
    return sums.get(code)!;
  };
  for (const p of contract.priceComponents)
    row(p.currencyCode).sales +=
      moneyUnits(p.amount) * (p.type === 'DISCOUNT' ? -1n : 1n);
  for (const cost of costs)
    row(cost.currencyCode).purchase += moneyUnits(cost.amount);
  return {
    version: 1,
    complete: !missingServiceKeys.length,
    missingServiceKeys,
    missingServiceTitles: missingServiceKeys.map(title),
    costs,
    totals: [...sums].map(([currencyCode, value]) => ({
      currencyCode,
      salesAmount: moneyDecimal(value.sales),
      purchaseAmount: moneyDecimal(value.purchase),
      profitAmount: missingServiceKeys.length
        ? null
        : moneyDecimal(value.sales - value.purchase),
    })),
  };
}
