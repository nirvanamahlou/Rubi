import { BadRequestException, ConflictException } from '@nestjs/common';
import {
  matchingPublishedRooms,
  packageRoomIdentity,
  publishedSaleTotals,
  ticketCalendarDate,
  type PackagePublishedSaleV1,
  type SalesContractCreateRequest,
  type SalesHotelStayInput,
  type SalesPassengerInput,
  type SalesServiceInput,
} from '@nora/contracts';
import { passengerAgeCategory } from '../sales/sales.domain';

type Money = { currencyCode: string; amount: string };
type Traveler = Pick<
  SalesPassengerInput,
  'customerId' | 'displayNameSnapshot' | 'birthDate'
>;

export interface DatedTourBooking {
  publicationId: string;
  customerId: string;
  buyerContact: NonNullable<SalesContractCreateRequest['buyerContact']>;
  passengers: Traveler[];
  rooms: {
    publicationId: string;
    roomCode: string;
    passengerIndexes: number[];
  }[];
  expectedTotals: Money[];
}

type Leg = {
  id: string;
  originId: string;
  destinationId: string;
  departureAt: string;
  arrivalAt: string;
  carrierName: string;
  serviceNumber: string;
  cabinClassCode: string;
  remainingCapacity: number;
  supplyType?: string | null;
};

export interface DatedTour {
  id: string;
  version: number;
  outbound: Leg;
  returning?: Leg | null;
  package: {
    destinationId: string;
    transferOutbound?: boolean;
    transferReturn?: boolean;
    cityTour?: boolean;
    tourGuide?: boolean;
    visa?: boolean;
    insuranceId?: string | null;
  };
}

const invalid = () =>
  new BadRequestException('درخواست قرارداد سایت معتبر نیست.');
const changed = () =>
  new ConflictException(
    'اطلاعات تغییر کرده است. صفحه را دوباره بارگذاری کنید.',
  );
const uuid = (id: unknown) =>
  typeof id === 'string' &&
  /^[0-9a-f]{8}(?:-[0-9a-f]{4}){3}-[0-9a-f]{12}$/i.test(id);

export function validateDatedTourBooking(input: DatedTourBooking) {
  if (
    !input ||
    !uuid(input.publicationId) ||
    !uuid(input.customerId) ||
    !input.buyerContact ||
    !(['name', 'phone', 'address', 'postalCode'] as const).every(
      (key) =>
        typeof input.buyerContact[key] === 'string' &&
        input.buyerContact[key].length <= 500,
    ) ||
    (input.buyerContact.landline !== undefined &&
      (typeof input.buyerContact.landline !== 'string' ||
        input.buyerContact.landline.length > 30)) ||
    !Array.isArray(input.passengers) ||
    !input.passengers.length ||
    input.passengers.length > 30 ||
    input.passengers.some(
      (person) =>
        !person ||
        !uuid(person.customerId) ||
        typeof person.displayNameSnapshot !== 'string' ||
        !person.displayNameSnapshot.trim() ||
        person.displayNameSnapshot.length > 200 ||
        typeof person.birthDate !== 'string' ||
        !/^\d{4}-\d{2}-\d{2}$/.test(person.birthDate) ||
        !Number.isFinite(Date.parse(person.birthDate)) ||
        new Date(person.birthDate).toISOString().slice(0, 10) !==
          person.birthDate,
    ) ||
    new Set(input.passengers.map((person) => person.customerId)).size !==
      input.passengers.length ||
    !Array.isArray(input.rooms) ||
    !input.rooms.length ||
    input.rooms.length > 20 ||
    input.rooms.some(
      (room) =>
        !room ||
        !uuid(room.publicationId) ||
        !packageRoomIdentity(room.roomCode) ||
        !Array.isArray(room.passengerIndexes) ||
        !room.passengerIndexes.length ||
        room.passengerIndexes.length > input.passengers.length,
    ) ||
    !Array.isArray(input.expectedTotals) ||
    !input.expectedTotals.length ||
    input.expectedTotals.length > 12 ||
    input.expectedTotals.some(
      (total) =>
        !total ||
        typeof total.currencyCode !== 'string' ||
        !/^[A-Z]{3}$/.test(total.currencyCode) ||
        typeof total.amount !== 'string' ||
        !/^\d{1,18}(?:\.\d{1,4})?$/.test(total.amount),
    )
  )
    throw invalid();

  const indexes = input.rooms.flatMap((room) => room.passengerIndexes);
  if (
    indexes.length !== input.passengers.length ||
    new Set(indexes).size !== indexes.length ||
    indexes.some(
      (index) =>
        !Number.isSafeInteger(index) ||
        index < 0 ||
        index >= input.passengers.length,
    ) ||
    new Set(input.expectedTotals.map((total) => total.currencyCode)).size !==
      input.expectedTotals.length
  )
    throw invalid();
}

export function datedTourDraft(
  input: DatedTourBooking,
  tour: DatedTour,
  catalog: readonly PackagePublishedSaleV1[],
  now = Date.now(),
): SalesContractCreateRequest {
  const firstDay = ticketCalendarDate(tour.outbound.departureAt);
  const returnDay = tour.returning
    ? ticketCalendarDate(tour.returning.departureAt)
    : null;
  const legs = [
    ['OUTBOUND', tour.outbound],
    ['RETURN', tour.returning],
  ] as const;
  if (!firstDay || (tour.returning && !returnDay)) throw changed();

  const categories = input.passengers.map((person) => {
    if (person.birthDate > firstDay) throw invalid();
    return passengerAgeCategory(person.birthDate, firstDay);
  });
  const seats = categories.filter((category) => category !== 'INF').length;
  if (
    legs.some(
      ([, leg]) =>
        leg &&
        (!(Date.parse(leg.departureAt) > now) ||
          !(leg.remainingCapacity >= seats) ||
          leg.supplyType === 'FLOATING'),
    )
  )
    throw changed();

  const prices = input.rooms.map((room) => {
    const price = catalog.find(
      (item) =>
        item.publicationId === room.publicationId &&
        item.roomCode === room.roomCode,
    );
    if (!price) throw changed();
    return price;
  });
  const totals = publishedSaleTotals(prices);
  let expected: Money[];
  try {
    expected = publishedSaleTotals([{ prices: input.expectedTotals }]);
  } catch {
    throw invalid();
  }
  if (
    JSON.stringify(totals) !== JSON.stringify(expected) ||
    totals.every((price) => Number(price.amount) === 0)
  )
    throw changed();

  const itinerary = (price: PackagePublishedSaleV1) =>
    price.stays ?? [
      {
        hotelId: price.hotelId,
        hotelName: price.hotelName,
        cityId: tour.package.destinationId,
        checkIn: price.checkIn,
        checkOut: price.checkOut,
        roomTypeName: price.roomTypeName,
        roomCode: price.roomCode,
      },
    ];
  const routes = prices.map(itinerary);
  const shape = (route: ReturnType<typeof itinerary>) =>
    JSON.stringify(
      route.map((stay) => [
        stay.hotelId,
        stay.cityId,
        stay.checkIn,
        stay.checkOut,
      ]),
    );
  const first = routes[0]!;
  if (!first.length || routes.some((route) => shape(route) !== shape(first)))
    throw changed();

  const stays = first.map((stay, index): SalesHotelStayInput => ({
    hotelId: stay.hotelId,
    hotelNameSnapshot: stay.hotelName,
    cityId: stay.cityId,
    checkInDate: stay.checkIn,
    checkOutDate: stay.checkOut,
    rooms: input.rooms.map((room, ordinal) => {
      const selected = routes[ordinal]![index]!;
      const identity = packageRoomIdentity(selected.roomCode);
      if (!identity) throw changed();
      const ages = room.passengerIndexes.map((i) => {
        const dob = input.passengers[i]!.birthDate;
        return (
          Number(stay.checkIn.slice(0, 4)) -
          Number(dob.slice(0, 4)) -
          Number(stay.checkIn.slice(5) < dob.slice(5))
        );
      });
      const childAges = ages.filter((age) => age < 12);
      const adults = ages.length - childAges.length;
      const price = { ...prices[ordinal]!, ...selected };
      if (
        !matchingPublishedRooms([price], {
          ...selected,
          roomTypeId: identity.roomTypeId,
          adults,
          childAges,
        }).length
      )
        throw changed();
      return {
        ordinal: ordinal + 1,
        roomTypeId: identity.roomTypeId,
        roomTypeNameSnapshot: selected.roomTypeName,
        adults,
        childAges,
      };
    }),
  }));

  const services: SalesServiceInput[] = [];
  const ticketSelections: NonNullable<
    SalesContractCreateRequest['ticketSelections']
  >[number][] = [];
  for (const [direction, leg] of legs) {
    if (!leg) continue;
    const serviceClientKey =
      direction === 'OUTBOUND' ? 'flight-outbound' : 'flight-return';
    services.push({
      clientKey: serviceClientKey,
      kind: 'FLIGHT',
      referenceId: leg.id,
      titleSnapshot: `${leg.carrierName} ${leg.serviceNumber}`,
      metadata:
        direction === 'OUTBOUND'
          ? {
              direction,
              tourDepartureId: tour.id,
              tourDepartureVersion: tour.version,
              packagePublishedSale: JSON.stringify({
                tourDepartureId: tour.id,
                items: prices.map(({ publicationId, roomCode }) => ({
                  publicationId,
                  roomCode,
                })),
                prices: totals,
              }),
            }
          : { direction },
    });
    ticketSelections.push({
      serviceClientKey,
      direction,
      offerId: leg.id,
      originId: leg.originId,
      destinationId: leg.destinationId,
      departureAt: leg.departureAt,
      arrivalAt: leg.arrivalAt,
      carrierNameSnapshot: leg.carrierName,
      serviceNumberSnapshot: leg.serviceNumber,
      cabinClassCode: leg.cabinClassCode,
    });
  }
  const base = stays[0]!;
  const definition = tour.package;
  services.push({
    clientKey: 'hotel',
    kind: 'HOTEL',
    referenceId: base.hotelId,
    titleSnapshot: base.hotelNameSnapshot,
  });
  if (definition.transferOutbound)
    services.push({
      clientKey: 'transfer-outbound',
      kind: 'TRANSFER',
      titleSnapshot: 'ترانسفر رفت',
      metadata: { direction: 'OUTBOUND' },
    });
  if (definition.transferReturn)
    services.push({
      clientKey: 'transfer-return',
      kind: 'TRANSFER',
      titleSnapshot: 'ترانسفر برگشت',
      metadata: { direction: 'RETURN' },
    });
  if (definition.visa)
    services.push({ clientKey: 'visa', kind: 'VISA', titleSnapshot: 'ویزا' });
  if (definition.cityTour)
    services.push({
      clientKey: 'city-tour',
      kind: 'OTHER',
      titleSnapshot: 'گشت شهری',
      metadata: { additionalServiceRole: 'CITY_TOUR' },
    });
  if (definition.tourGuide)
    services.push({
      clientKey: 'tour-guide',
      kind: 'OTHER',
      titleSnapshot: 'راهنمای تور',
      metadata: { additionalServiceRole: 'TOUR_GUIDE' },
    });
  if (definition.insuranceId)
    services.push({
      clientKey: 'insurance',
      kind: 'INSURANCE',
      referenceId: definition.insuranceId,
      titleSnapshot: 'بیمه سفر',
    });

  return {
    customerId: input.customerId,
    buyerContact: {
      name: input.buyerContact.name,
      phone: input.buyerContact.phone,
      address: input.buyerContact.address,
      postalCode: input.buyerContact.postalCode,
      ...(input.buyerContact.landline
        ? { landline: input.buyerContact.landline }
        : {}),
    },
    tripType: tour.returning ? 'ROUND_TRIP' : 'ONE_WAY',
    originId: tour.outbound.originId,
    destinationId: tour.outbound.destinationId,
    departureDate: firstDay,
    returnNotBefore: returnDay,
    services,
    ticketSelections,
    hotelSelection: {
      ...base,
      serviceClientKey: 'hotel',
      additionalStays: stays.slice(1),
      roomCount: input.rooms.length,
      roomTypeId: base.rooms![0]!.roomTypeId,
      occupancy: input.passengers.length,
      inventoryStatus: 'NEEDS_RESERVATION_CONFIRMATION',
    },
    passengers: input.passengers.map(
      ({ customerId, displayNameSnapshot, birthDate }, index) => ({
        customerId,
        displayNameSnapshot,
        birthDate,
        ageCategory: categories[index]!,
        accommodationKind:
          categories[index] === 'INF'
            ? 'INFANT'
            : categories[index] === 'CHD'
              ? 'CHILD_WITH_BED'
              : 'DBL',
        serviceClientKeys: services.map((service) => service.clientKey),
      }),
    ),
    priceComponents: totals.map((total) => ({
      ...total,
      type: 'BASE',
      title: 'قیمت فروش ERP',
    })),
  };
}
