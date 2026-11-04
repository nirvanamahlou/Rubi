import {
  reservationHotelStays,
  scopeReservationHotel,
  salesContractFlights,
  reservationFlightOutputKey,
  salesHotelRoomSummary,
  type SalesReservationRequestV1,
  type TravelWorkflowStateV1,
  type VoucherSettingsV1,
} from '@nora/contracts';
const signature = (v: unknown) => JSON.stringify(v);
/** Rebase changed canonical facts for current output only; never rewrite saved revisions. */
export function refreshWorkflowExecution(
  workflow: TravelWorkflowStateV1,
  before: SalesReservationRequestV1,
  current: SalesReservationRequestV1,
): TravelWorkflowStateV1 {
  before = workflow.outputSourceSnapshot ?? before;
  const oldHotel = before.hotelSelection,
    hotel = current.hotelSelection;
  const rooms = (v: typeof hotel) =>
    v?.rooms?.map(({ agreedPrice: _price, ...room }) => {
      void _price;
      return room;
    });
  const hotelChanged =
    signature([
      oldHotel?.hotelId,
      oldHotel?.checkInDate,
      oldHotel?.checkOutDate,
      oldHotel?.roomTypeId,
      oldHotel?.roomCount,
      oldHotel?.singleRoomCount,
      oldHotel?.doubleRoomCount,
      oldHotel?.extraBedCount,
      oldHotel?.cityId,
      oldHotel?.mealServiceId,
      rooms(oldHotel),
    ]) !==
    signature([
      hotel?.hotelId,
      hotel?.checkInDate,
      hotel?.checkOutDate,
      hotel?.roomTypeId,
      hotel?.roomCount,
      hotel?.singleRoomCount,
      hotel?.doubleRoomCount,
      hotel?.extraBedCount,
      hotel?.cityId,
      hotel?.mealServiceId,
      rooms(hotel),
    ]);
  const oldFlights = salesContractFlights(
    before.serviceSelections,
    before.ticketSelections ?? [],
  );
  const flights = salesContractFlights(
    current.serviceSelections,
    current.ticketSelections ?? [],
  );
  const changedDirections = (['OUTBOUND', 'RETURN'] as const).filter(
    (d) =>
      signature(
        oldFlights
          .filter((f) => f.direction === d)
          .map((f) => [
            f.serviceClientKey,
            f.offerId,
            f.originId,
            f.destinationId,
            f.departureAt,
            f.arrivalAt,
            f.carrierNameSnapshot,
            f.serviceNumberSnapshot,
            f.cabinClassCode,
          ]),
      ) !==
      signature(
        flights
          .filter((f) => f.direction === d)
          .map((f) => [
            f.serviceClientKey,
            f.offerId,
            f.originId,
            f.destinationId,
            f.departureAt,
            f.arrivalAt,
            f.carrierNameSnapshot,
            f.serviceNumberSnapshot,
            f.cabinClassCode,
          ]),
      ),
  );
  const currentAssignments = current.passengerAssignments ?? [],
    oldAssignments = before.passengerAssignments ?? [];
  const ageChanged = new Set(
    currentAssignments
      .filter((p) => {
        const old = oldAssignments.find((v) => v.customerId === p.customerId);
        return (
          !old ||
          old.ageCategory !== p.ageCategory ||
          old.childAgeBand !== p.childAgeBand
        );
      })
      .map((p) => p.customerId),
  );
  const update = (settings: VoucherSettingsV1 | null | undefined) => {
    if (!settings) return settings;
    const next: VoucherSettingsV1 = {
      ...settings,
      text: { ...settings.text },
      passengers: current.passengerIds.map(
        (id) =>
          settings.passengers.find((p) => p.id === id) ?? {
            id,
            selected: true,
            roomType: hotel?.rooms?.[0]?.roomTypeNameSnapshot ?? '',
            age: 'ADL',
          },
      ),
    };
    if (hotelChanged) {
      delete next.hotelRoomPrices;
      delete next.hotelTransferCounts;
      next.text.hotel = hotel?.hotelNameSnapshot ?? '';
      if (oldHotel?.mealServiceId !== hotel?.mealServiceId) next.text.meal = '';
      if (oldHotel?.cityId !== hotel?.cityId) next.text.city = '';
      if (oldHotel?.hotelId !== hotel?.hotelId) {
        next.text.stars = '';
        next.text.website = '';
      }
      next.text.checkIn = hotel?.checkInDate ?? '';
      next.text.checkOut = hotel?.checkOutDate ?? '';
      next.text.roomType =
        hotel?.rooms?.map((r) => r.roomTypeNameSnapshot).join(' / ') ?? '';
      next.rooms = (hotel?.rooms ?? []).map((r) => ({
        ordinal: r.ordinal,
        roomTypeNameSnapshot: r.roomTypeNameSnapshot,
        adults: r.adults,
        childAges: [...r.childAges],
      }));
      const summary = salesHotelRoomSummary(hotel?.rooms ?? []);
      next.numbers = {
        singleRooms: hotel?.rooms?.length
          ? summary.singleRoomCount
          : (hotel?.singleRoomCount ?? 0),
        doubleRooms: hotel?.rooms?.length
          ? summary.doubleRoomCount
          : (hotel?.doubleRoomCount ?? 0),
        extraBeds: hotel?.rooms?.length
          ? summary.extraBedCount
          : (hotel?.extraBedCount ?? 0),
        customRooms: Math.max(
          0,
          (hotel?.roomCount ?? 0) -
            summary.singleRoomCount -
            summary.doubleRoomCount,
        ),
      };
      next.flags = { ...next.flags, hotel: !!hotel };
      next.passengers = next.passengers.map((p) => {
        const room =
          next.rooms?.find((r) => r.ordinal === p.roomOrdinal) ??
          next.rooms?.[0];
        return {
          ...p,
          roomType: room?.roomTypeNameSnapshot ?? '',
          ...(room ? { roomOrdinal: room.ordinal } : {}),
        };
      });
    }
    for (const direction of changedDirections) {
      const f = flights.find((f) => f.direction === direction),
        prefix = direction === 'OUTBOUND' ? 'arrival' : 'departure';
      next.text[`${prefix}Airline`] = f?.carrierNameSnapshot ?? '';
      next.text[`${prefix}Flight`] = f?.serviceNumberSnapshot ?? '';
      const valid = f && Number.isFinite(Date.parse(f.departureAt));
      next.text[`${prefix}Date`] = valid
        ? new Intl.DateTimeFormat('en-CA', {
            timeZone: 'Asia/Tehran',
            year: 'numeric',
            month: '2-digit',
            day: '2-digit',
          }).format(new Date(f.departureAt))
        : '';
      next.text[`${prefix}Time`] = valid
        ? new Intl.DateTimeFormat('en-GB', {
            timeZone: 'Asia/Tehran',
            hour: '2-digit',
            minute: '2-digit',
            hourCycle: 'h23',
          }).format(new Date(f.departureAt))
        : '';
    }
    next.passengers = next.passengers.map((p) => {
      const row = currentAssignments.find((v) => v.customerId === p.id);
      if (!row || !ageChanged.has(p.id)) return p;
      return {
        ...p,
        age:
          row.ageCategory === 'CHD'
            ? 'CHD'
            : row.ageCategory === 'INF'
              ? 'INF'
              : 'ADL',
        hotelChildAgeBand:
          row.childAgeBand === 'AGE_2_6'
            ? 'CHD_2_TO_6'
            : row.childAgeBand === 'AGE_6_12'
              ? 'CHD_6_TO_12'
              : '',
      };
    });
    const topology = (snapshot: SalesReservationRequestV1) =>
      snapshot.serviceSelections.map((s) => [
        s.clientKey,
        s.kind,
        s.metadata?.direction,
      ]);
    next.passengers = next.passengers.map((p) => {
      const now = currentAssignments.find((v) => v.customerId === p.id),
        old = oldAssignments.find((v) => v.customerId === p.id);
      if (
        !now ||
        (signature(now.serviceClientKeys) ===
          signature(old?.serviceClientKeys) &&
          signature(topology(before)) === signature(topology(current)))
      )
        return p;
      const allocated = current.serviceSelections.filter((s) =>
        now.serviceClientKeys.includes(s.clientKey),
      );
      const direction = (s: (typeof allocated)[number]) =>
        s.metadata?.direction ??
        flights.find((f) => f.serviceClientKey === s.clientKey)?.direction ??
        (/(?:^|[-_])(?:out|outbound)$/.test(s.clientKey)
          ? 'OUTBOUND'
          : /(?:^|[-_])(?:return|back|in)$/.test(s.clientKey)
            ? 'RETURN'
            : undefined);
      const has = (kind: string, leg: string) =>
        allocated.some((s) => s.kind === kind && direction(s) === leg);
      return {
        ...p,
        services: {
          outboundFlight: has('FLIGHT', 'OUTBOUND'),
          returnFlight: has('FLIGHT', 'RETURN'),
          outboundTransfer: has('TRANSFER', 'OUTBOUND'),
          returnTransfer: has('TRANSFER', 'RETURN'),
          hotel:
            !!hotel && now.serviceClientKeys.includes(hotel.serviceClientKey),
        },
      };
    });
    return next;
  };
  const hotelSupplierForms: NonNullable<
    TravelWorkflowStateV1['hotelSupplierForms']
  > = {};
  if (workflow.hotelSupplierForms) {
    const priorKeys = reservationHotelStays(before).map((stay) => stay.key);
    for (const stay of reservationHotelStays(current)) {
      const entry = workflow.hotelSupplierForms[stay.key];
      if (!entry || !priorKeys.includes(stay.key)) continue;
      const child = {
        ...workflow,
        outputSourceSnapshot: scopeReservationHotel(before, stay.key),
      };
      delete child.hotelSupplierForms;
      delete child.supplierFormSettings;
      delete child.sentSupplierFormSettings;
      delete child.voucherSettings;
      if (entry.settings) child.supplierFormSettings = entry.settings;
      if (entry.sentSettings)
        child.sentSupplierFormSettings = entry.sentSettings;
      const updated = refreshWorkflowExecution(
        child,
        scopeReservationHotel(before, stay.key),
        scopeReservationHotel(current, stay.key),
      );
      hotelSupplierForms[stay.key] = {
        ...entry,
        ...(updated.supplierFormSettings
          ? { settings: updated.supplierFormSettings }
          : {}),
        ...(updated.sentSupplierFormSettings
          ? { sentSettings: updated.sentSupplierFormSettings }
          : {}),
      };
    }
  }
  return {
    ...workflow,
    ...(workflow.hotelSupplierForms ? { hotelSupplierForms } : {}),
    outputSourceSnapshot: structuredClone(current),
    ...Object.fromEntries(
      (
        [
          'supplierFormSettings',
          'sentSupplierFormSettings',
          'voucherSettings',
        ] as const
      )
        .filter((k) => workflow[k] !== undefined)
        .map((k) => [k, update(workflow[k])]),
    ),
    ageOverrides: Object.fromEntries(
      Object.entries(workflow.ageOverrides).filter(
        ([id]) => !ageChanged.has(id) && current.passengerIds.includes(id),
      ),
    ),
    ticketFlightNumbers: Object.fromEntries(
      Object.entries(workflow.ticketFlightNumbers ?? {}).filter(
        ([key]) =>
          !oldFlights.some(
            (f) =>
              changedDirections.includes(f.direction) &&
              reservationFlightOutputKey(f.serviceClientKey, f.offerId) === key,
          ),
      ),
    ),
  };
}
