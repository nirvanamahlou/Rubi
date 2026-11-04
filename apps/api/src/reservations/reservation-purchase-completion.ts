import {
  reservationHotelStays,
  reservationHotelTransferLegKeys,
  type ReservationIntakeV1,
  type TravelWorkflowStateV1,
} from '@nora/contracts';

/** Persisted registration, independent of supplier forms or full service coverage. */
export function reservationPurchaseRegistered(
  request: Pick<ReservationIntakeV1, 'hotelPurchases' | 'servicePurchases'> & {
    workflow?: unknown;
  },
) {
  const state = request.workflow as TravelWorkflowStateV1 | null | undefined;
  return (
    state?.supplierStatus !== 'CANCELLED' &&
    Boolean(request.hotelPurchases?.length || request.servicePurchases?.length)
  );
}

/** Registration coverage only; no financial amounts, approval or payment inference. */
export function reservationPurchasesComplete(
  request: ReservationIntakeV1 & { workflow?: unknown },
) {
  const snapshot = request.purchaseSnapshot ?? request.snapshot;
  const state = request.workflow as TravelWorkflowStateV1 | null | undefined;
  if (state?.supplierStatus === 'CANCELLED') return false;
  const required = new Set<string>();
  const stays = reservationHotelStays(snapshot);
  const hasTransfer = snapshot.serviceSelections.some(
    (s) => s.kind === 'TRANSFER',
  );
  for (const stay of stays) {
    required.add(stay.key);
    const settings =
      state?.hotelSupplierForms?.[stay.key]?.settings ??
      (stay.ordinal === 1 ? state?.supplierFormSettings : undefined);
    const counts = settings?.hotelTransferCounts;
    if (hasTransfer || (counts?.outbound ?? 0) + (counts?.returning ?? 0) > 0)
      for (const key of reservationHotelTransferLegKeys(snapshot, stay.key))
        required.add(key);
  }
  const services = [...snapshot.serviceSelections];
  for (const ticket of snapshot.ticketSelections ?? []) {
    if (
      !services.some((service) => service.clientKey === ticket.serviceClientKey)
    ) {
      const service = request.snapshot.serviceSelections.find(
        (item) => item.clientKey === ticket.serviceClientKey,
      );
      if (!service) return false;
      services.push(service);
    }
  }
  for (const offerId of snapshot.selectedTicketOfferIds ?? []) {
    if (
      !services.some(
        (service) =>
          service.kind === 'FLIGHT' && service.referenceId === offerId,
      )
    ) {
      const service = request.snapshot.serviceSelections.find(
        (item) => item.kind === 'FLIGHT' && item.referenceId === offerId,
      );
      if (!service) return false;
      services.push(service);
    }
  }
  for (const service of services) {
    if (
      service.kind === 'HOTEL' ||
      service.kind === 'INSURANCE' ||
      (service.kind === 'TRANSFER' && !stays.length)
    )
      required.add(service.clientKey);
    if (service.kind === 'FLIGHT') {
      const supply =
        request.snapshot.serviceSelections.find(
          (item) => item.clientKey === service.clientKey,
        )?.metadata?.purchaseSupplyType ?? service.metadata?.purchaseSupplyType;
      if (
        service.metadata?.contractFlightVersion === 1 ||
        supply === 'FLOATING'
      )
        required.add(service.clientKey);
      else if (supply !== 'COMPANY' && supply !== 'API') return false;
    }
  }
  const covered = new Set(
    (request.servicePurchases ?? []).flatMap((p) => [
      p.serviceClientKey,
      ...(p.coveredServiceClientKeys ?? []),
    ]),
  );
  // Historical single-hotel records cannot cover later hotel stays.
  const hotelKeys = [...required].filter(
    (key) =>
      stays.some((stay) => stay.key === key) ||
      services.some(
        (service) => service.kind === 'HOTEL' && service.clientKey === key,
      ),
  );
  if (hotelKeys.length === 1 && request.hotelPurchases?.length)
    covered.add(hotelKeys[0]!);
  return required.size > 0 && [...required].every((key) => covered.has(key));
}
