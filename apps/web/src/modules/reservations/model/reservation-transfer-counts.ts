import { readLegacyServiceParties } from '@nora/contracts';
import type { ReservationFormIntake } from './reservation-form';

/** Count only allocated non-infant passengers, bounded by the contract leg count. */
export function reservationTransferCounts(
  intake: ReservationFormIntake,
  passengers: readonly {
    age: string;
    hotelChildAgeBand?: string | undefined;
    outboundTransfer: boolean;
    returnTransfer: boolean;
  }[],
) {
  const services = intake.snapshot.serviceSelections;
  const parties = readLegacyServiceParties(services);
  const count = (direction: 'OUTBOUND' | 'RETURN') => {
    const transfers = services.filter(
      (service) =>
        service.kind === 'TRANSFER' &&
        (service.metadata?.direction === direction ||
          (!service.metadata?.direction &&
            (direction === 'OUTBOUND'
              ? /(?:^|[-_])(?:out|outbound)$/
              : /(?:^|[-_])(?:return|back|in)$/
            ).test(service.clientKey))),
    );
    if (!transfers.length) return 0;
    const declared = transfers
      .map((service) => service.metadata?.passengerCount)
      .filter(
        (value): value is number =>
          typeof value === 'number' &&
          Number.isSafeInteger(value) &&
          value >= 0,
      );
    if (passengers.length) {
      const selected = passengers.filter(
        (person) =>
          person.age !== 'INF' &&
          person.hotelChildAgeBand !== 'CHD_2_TO_6' &&
          (direction === 'OUTBOUND'
            ? person.outboundTransfer
            : person.returnTransfer),
      ).length;
      return declared.length
        ? Math.min(selected, Math.max(...declared))
        : selected;
    }
    const counts = transfers.map((service) => {
      const party = parties?.[service.clientKey];
      if (party) return party.adults + party.children;
      const value = service.metadata?.passengerCount;
      return typeof value === 'number' &&
        Number.isSafeInteger(value) &&
        value >= 0
        ? value
        : null;
    });
    return counts.some((value) => value === null)
      ? null
      : Math.max(...(counts as number[]));
  };
  return { outbound: count('OUTBOUND'), returning: count('RETURN') };
}
