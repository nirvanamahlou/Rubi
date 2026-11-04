import type {
  SalesReservationRequestV1,
  SalesPassengerAgeCategory,
} from '../sales';
import { readLegacyServiceParties } from '../sales/legacy-service-parties';

/** Purchase ordinals are not customer identities and must never enter passenger FKs. */
export function legacyPurchaseGuests(
  snapshot: SalesReservationRequestV1,
  serviceKey: string,
) {
  if (snapshot.passengerIds.length || snapshot.passengerAssignments?.length)
    return [];
  const party = readLegacyServiceParties(snapshot.serviceSelections)?.[
    serviceKey
  ];
  if (!party) return [];
  const ages: SalesPassengerAgeCategory[] = [
    ...Array<SalesPassengerAgeCategory>(party.adults).fill('ADT'),
    ...Array<SalesPassengerAgeCategory>(party.children).fill('CHD'),
    ...Array<SalesPassengerAgeCategory>(party.infants).fill('INF'),
  ];
  return ages.map((ageCategory, guestIndex) => ({ guestIndex, ageCategory }));
}
