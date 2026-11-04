import {
  salesContractFlights,
  type AuthenticatedActor,
  type SalesReservationRequestV1,
} from '@nora/contracts';
import { NotFoundException } from '@nestjs/common';
import type { CustomerService } from '../customers/customer.service';

/** Called only after workflow.detail has checked the request branch. */
export async function reservationOutputPassengers(
  snapshot: SalesReservationRequestV1,
  customers: CustomerService,
  actor: AuthenticatedActor,
) {
  const outbound = salesContractFlights(
    snapshot.serviceSelections,
    snapshot.ticketSelections ?? [],
  )
    .filter((flight) => flight.direction === 'OUTBOUND')
    .sort((a, b) => a.departureAt.localeCompare(b.departureAt))[0];
  const arrivalAt = outbound?.arrivalAt || outbound?.departureAt;
  const travelDate =
    snapshot.hotelSelection?.checkInDate?.slice(0, 10) ||
    (arrivalAt && Number.isFinite(Date.parse(arrivalAt))
      ? new Intl.DateTimeFormat('en-CA', {
          timeZone: 'Asia/Tehran',
          year: 'numeric',
          month: '2-digit',
          day: '2-digit',
        }).format(new Date(arrivalAt))
      : undefined);
  const result: Awaited<
    ReturnType<CustomerService['reservationOutputIdentity']>
  >[] = [];
  const ids = [...new Set(snapshot.passengerIds)];
  for (let i = 0; i < ids.length; i += 3) {
    const batch = await Promise.all(
      ids.slice(i, i + 3).map(async (id) => {
        try {
          return await customers.reservationOutputIdentity(
            id,
            travelDate,
            actor,
          );
        } catch (error) {
          if (error instanceof NotFoundException) return null;
          throw error;
        }
      }),
    );
    result.push(
      ...batch.filter((row): row is NonNullable<typeof row> => row !== null),
    );
  }
  return result;
}
