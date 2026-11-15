import {
  salesContractFlights,
  type SalesReservationRequestV1,
} from '@nora/contracts';

/** Insurance covers both departure and return calendar days, in Tehran time. */
export function insuranceContractTrip(
  contract: { departureDate: Date; returnNotBefore?: Date | null },
  snapshot?: SalesReservationRequestV1,
) {
  const day = (value: string) =>
    new Intl.DateTimeFormat('en-CA', {
      timeZone: 'Asia/Tehran',
    }).format(new Date(value));
  const flights = salesContractFlights(
    snapshot?.serviceSelections ?? [],
    snapshot?.ticketSelections ?? [],
  );
  const outbound = flights
    .filter((f) => f.direction === 'OUTBOUND')
    .map((f) => day(f.departureAt))
    .sort();
  const returns = flights
    .filter((f) => f.direction === 'RETURN')
    .map((f) => day(f.arrivalAt))
    .sort();
  const departureDate =
    outbound[0] ?? contract.departureDate.toISOString().slice(0, 10);
  const stays = [
    snapshot?.hotelSelection,
    ...(snapshot?.hotelSelection?.additionalStays ?? []),
  ];
  const lastDay =
    returns.at(-1) ??
    [
      contract.returnNotBefore?.toISOString().slice(0, 10),
      ...stays.map((s) => s?.checkOutDate?.slice(0, 10)),
    ]
      .filter((d): d is string => Boolean(d))
      .sort()
      .at(-1) ??
    departureDate;
  return {
    departureDate,
    durationDays: Math.max(
      1,
      Math.round((Date.parse(lastDay) - Date.parse(departureDate)) / 86400000) +
        1,
    ),
  };
}
