import type {
  ReservationIntakeV1,
  SalesServiceInput,
  TicketPurchaseInboxItemV1,
} from '@nora/contracts';

export const purchaseCategories = [
  ['ALL', 'همه خدمات'],
  ['HOTEL', 'خرید هتل'],
  ['FLIGHT', 'خرید پرواز'],
  ['TRANSFER', 'خرید ترانسفر'],
  ['INSURANCE', 'خرید بیمه'],
] as const;
export type PurchaseCategory = (typeof purchaseCategories)[number][0];
export function purchaseCategory(value: string | null): PurchaseCategory {
  return purchaseCategories.some(([key]) => key === value)
    ? (value as PurchaseCategory)
    : 'ALL';
}
export function contractPurchaseServices(
  request: ReservationIntakeV1,
): SalesServiceInput[] {
  const services = request.snapshot.serviceSelections.filter((s) =>
    purchaseCategories.some(([key]) => key === s.kind),
  );
  const hotel = request.snapshot.hotelSelection;
  if (hotel && !services.some((s) => s.clientKey === hotel.serviceClientKey))
    services.push({
      clientKey: hotel.serviceClientKey,
      kind: 'HOTEL',
      titleSnapshot: hotel.hotelNameSnapshot,
    });
  for (const ticket of request.snapshot.ticketSelections ?? [])
    if (
      !request.snapshot.serviceSelections.some(
        (s) => s.clientKey === ticket.serviceClientKey,
      )
    )
      services.push({
        clientKey: ticket.serviceClientKey,
        kind: 'FLIGHT',
        referenceId: ticket.offerId,
        titleSnapshot: `${ticket.carrierNameSnapshot} ${ticket.serviceNumberSnapshot}`,
      });
  for (const offerId of request.snapshot.serviceSelections.some((service) =>
    ['FLIGHT', 'TRAIN', 'BUS'].includes(service.kind),
  )
    ? []
    : request.snapshot.selectedTicketOfferIds)
    if (
      !services.some(
        (s) =>
          s.kind === 'FLIGHT' &&
          (s.referenceId === offerId ||
            request.snapshot.ticketSelections?.some(
              (t) =>
                t.serviceClientKey === s.clientKey && t.offerId === offerId,
            )),
      )
    )
      services.push({
        clientKey: offerId,
        kind: 'FLIGHT',
        referenceId: offerId,
        titleSnapshot: 'پرواز قرارداد',
      });
  return services;
}
export function servicePurchase(request: ReservationIntakeV1, key: string) {
  return [...(request.servicePurchases ?? [])]
    .sort((a, b) => b.version - a.version)
    .find((p) =>
      (p.coveredServiceClientKeys?.length
        ? p.coveredServiceClientKeys
        : [p.serviceClientKey]
      ).includes(key),
    );
}
export function flightOfferId(
  request: ReservationIntakeV1,
  service: SalesServiceInput,
) {
  return (
    request.snapshot.ticketSelections?.find(
      (t) => t.serviceClientKey === service.clientKey,
    )?.offerId ??
    service.referenceId ??
    undefined
  );
}
export function flightPurchase(
  request: ReservationIntakeV1,
  service: SalesServiceInput,
  items: readonly TicketPurchaseInboxItemV1[],
) {
  const offer = flightOfferId(request, service);
  return offer
    ? items.find(
        (i) =>
          i.request.branchId === request.branchId &&
          i.request.status !== 'CANCELLED' &&
          (i.request.offerId === offer ||
            i.request.catalogProductReference === offer),
      )
    : undefined;
}
export function purchaseHubHref(request: {
  id: string;
  contractNumber: string;
}) {
  return `/ticket-purchases?${new URLSearchParams({ reservationId: request.id, contractNumber: request.contractNumber })}`;
}

export const purchaseDateFields = [
  ['ENTRY', 'تاریخ ورود به خرید و تأمین'],
  ['DEPARTURE', 'تاریخ حرکت پرواز'],
  ['CHECK_IN', 'تاریخ ورود به هتل'],
  ['PURCHASE', 'تاریخ ثبت خرید'],
] as const;
export interface PurchaseFilters {
  status: 'ALL' | 'REGISTERED' | 'UNREGISTERED';
  dateBy: (typeof purchaseDateFields)[number][0];
  from: string;
  to: string;
  direction: 'ASC' | 'DESC';
}
export function purchaseFilters(
  query: { get: (key: string) => string | null } | null,
): PurchaseFilters {
  const status = query?.get('status');
  const dateBy = query?.get('dateBy');
  return {
    status:
      status === 'REGISTERED' || status === 'UNREGISTERED' ? status : 'ALL',
    dateBy: purchaseDateFields.some(([key]) => key === dateBy)
      ? (dateBy as PurchaseFilters['dateBy'])
      : 'ENTRY',
    from: query?.get('from') ?? '',
    to: query?.get('to') ?? '',
    direction: query?.get('direction') === 'ASC' ? 'ASC' : 'DESC',
  };
}
export function writePurchaseFilters(
  query: URLSearchParams,
  value: PurchaseFilters,
) {
  for (const [key, field] of Object.entries(value))
    if (field) query.set(key, field);
    else query.delete(key);
}
export function ticketPurchaseDate(
  item: TicketPurchaseInboxItemV1,
  dateBy: PurchaseFilters['dateBy'],
) {
  return dateBy === 'ENTRY'
    ? item.request.createdAt
    : dateBy === 'DEPARTURE'
      ? item.request.serviceDate
      : dateBy === 'PURCHASE'
        ? (item.cost?.createdAt ?? null)
        : null;
}
export function filterTicketPurchases(
  items: readonly TicketPurchaseInboxItemV1[],
  value: PurchaseFilters,
) {
  const date = (i: TicketPurchaseInboxItemV1) =>
    ticketPurchaseDate(i, value.dateBy);
  return items
    .filter(
      (i) =>
        (value.status === 'ALL' ||
          (i.cost ? 'REGISTERED' : 'UNREGISTERED') === value.status) &&
        (!value.from || (!!date(i) && date(i)!.slice(0, 10) >= value.from)) &&
        (!value.to || (!!date(i) && date(i)!.slice(0, 10) <= value.to)),
    )
    .sort((a, b) => {
      const x = date(a),
        y = date(b);
      return x && y
        ? (value.direction === 'ASC'
            ? x.localeCompare(y)
            : y.localeCompare(x)) || a.request.id.localeCompare(b.request.id)
        : x
          ? -1
          : y
            ? 1
            : a.request.id.localeCompare(b.request.id);
    });
}
