import {
  readLegacyServiceParties,
  reservationHotelTransferKeys,
  type SalesReservationRequestV1,
} from '@nora/contracts';

/** Initial purchase quantities only; stored purchases and subsequent edits remain authoritative. */
export function contractHotelTransferCounts(
  snapshot: SalesReservationRequestV1,
  stayKey: string,
) {
  const keys = new Set(reservationHotelTransferKeys(snapshot, stayKey));
  const parties = readLegacyServiceParties(snapshot.serviceSelections);
  const members = new Set(snapshot.passengerIds);
  const counts = { outbound: 0, returning: 0 };
  for (const direction of ['outbound', 'returning'] as const) {
    const services = snapshot.serviceSelections.filter((service) => {
      if (service.kind !== 'TRANSFER' || !keys.has(service.clientKey))
        return false;
      const returning =
        service.metadata?.direction === 'RETURN' ||
        (!service.metadata?.direction &&
          /(?:^|[-_])(?:return|back|in)$/.test(service.clientKey));
      return returning === (direction === 'returning');
    });
    if (parties || !snapshot.passengerAssignments?.length) {
      counts[direction] = Math.max(
        0,
        ...services.map((service) => {
          const party = parties?.[service.clientKey];
          if (party) return party.adults + party.children;
          const count = service.metadata?.passengerCount;
          return typeof count === 'number' &&
            Number.isSafeInteger(count) &&
            count >= 0
            ? count
            : 0;
        }),
      );
    } else {
      const serviceKeys = new Set(services.map((service) => service.clientKey));
      counts[direction] = new Set(
        snapshot.passengerAssignments
          .filter(
            (passenger) =>
              members.has(passenger.customerId) &&
              passenger.ageCategory !== 'INF' &&
              passenger.serviceClientKeys.some((key) => serviceKeys.has(key)),
          )
          .map((passenger) => passenger.customerId),
      ).size;
    }
  }
  return counts;
}
