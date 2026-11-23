import {
  BadRequestException,
  ConflictException,
  NotFoundException,
} from '@nestjs/common';
import {
  contractFlightMetadata,
  type FloatingTourGroup,
  type SalesContractCreateRequest,
  type SalesPassengerInput,
  type SalesServiceInput,
} from '@nora/contracts';
import { Prisma } from '@nora/database';
import type { MasterDataService } from '../master-data/master-data.service';
import { floatingHotelKey } from '../package-pricing/floating-tour-import';
import type { FloatingTourPricingService } from '../package-pricing/floating-tour-pricing.service';
import { passengerAgeCategory } from '../sales/sales.domain';
import { stableFingerprint } from './site-commerce.policy';

type Product = Awaited<
  ReturnType<FloatingTourPricingService['websiteProduct']>
>;
type Stay = Product['dated'][number]['stays'][number];

export interface FloatingWebsiteBooking {
  publicationId: string;
  roomCode: string;
  expectedAmount: string;
  rooms: number[][];
  childrenWithoutBed: number[];
  customerId: string;
  buyerContact: NonNullable<SalesContractCreateRequest['buyerContact']>;
  passengers: Pick<
    SalesPassengerInput,
    'customerId' | 'displayNameSnapshot' | 'birthDate'
  >[];
}

const invalid = () =>
  new BadRequestException('درخواست قرارداد سایت معتبر نیست.');
const changed = () => new ConflictException('قیمت فروش معتبر نیست.');
const uuid = /^[0-9a-f]{8}(?:-[0-9a-f]{4}){3}-[0-9a-f]{12}$/i;
const groups: FloatingTourGroup[] = [
  'single',
  'double',
  'extra',
  'childBed',
  'childNoBed',
  'infant',
];
const Decimal = Prisma.Decimal.clone({ precision: 50 });

export function validateFloatingBooking(input: FloatingWebsiteBooking) {
  if (
    !input ||
    !uuid.test(input.publicationId) ||
    !/^[a-f0-9]{64}$/.test(input.roomCode) ||
    !/^[1-9][0-9]{0,17}$/.test(input.expectedAmount) ||
    !uuid.test(input.customerId) ||
    !input.buyerContact ||
    !(['name', 'phone', 'address', 'postalCode'] as const).every(
      (field) => typeof input.buyerContact[field] === 'string',
    ) ||
    (input.buyerContact.landline !== undefined &&
      typeof input.buyerContact.landline !== 'string') ||
    !Array.isArray(input.passengers) ||
    !input.passengers.length ||
    input.passengers.length > 30 ||
    !input.passengers.every(
      (p) =>
        p &&
        uuid.test(p.customerId) &&
        typeof p.displayNameSnapshot === 'string' &&
        /^\d{4}-\d{2}-\d{2}$/.test(p.birthDate) &&
        Number.isFinite(Date.parse(p.birthDate)),
    ) ||
    new Set(input.passengers.map((p) => p.customerId)).size !==
      input.passengers.length ||
    !Array.isArray(input.rooms) ||
    input.rooms.length > 20 ||
    !input.rooms.every(
      (room) => Array.isArray(room) && room.length > 0 && room.length <= 30,
    ) ||
    !Array.isArray(input.childrenWithoutBed) ||
    input.childrenWithoutBed.length > input.passengers.length
  )
    throw invalid();
  const indexes = input.rooms.flat();
  if (
    indexes.length !== input.passengers.length ||
    new Set(indexes).size !== indexes.length ||
    indexes.some(
      (i) => !Number.isSafeInteger(i) || i < 0 || i >= input.passengers.length,
    ) ||
    new Set(input.childrenWithoutBed).size !==
      input.childrenWithoutBed.length ||
    input.childrenWithoutBed.some((i) => !indexes.includes(i))
  )
    throw invalid();
}

export async function floatingWebsiteRooms(
  product: Product,
  rates: Record<string, string>,
  references: Pick<MasterDataService, 'detail'>,
) {
  const hotels = new Map<string, ReturnType<MasterDataService['detail']>>();
  const rooms = new Map<string, ReturnType<MasterDataService['detail']>>();
  const reference = (kind: 'hotels' | 'room-types', id: string) => {
    const cache = kind === 'hotels' ? hotels : rooms;
    if (!cache.has(id)) cache.set(id, references.detail(kind, id));
    return cache.get(id)!;
  };
  const resolve = async (stay: Stay, checkIn: string) => {
    const { data: hotel } = await reference('hotels', stay.hotelId);
    if (
      hotel.status !== 'active' ||
      hotel.attributes.cityId !== stay.cityId ||
      hotel.attributes.isSaleableReference === false
    )
      throw new NotFoundException();
    const linked = String(hotel.attributes.roomTypeIds ?? '')
      .split(',')
      .filter(Boolean);
    const matched = (
      await Promise.all(linked.map((id) => reference('room-types', id)))
    )
      .map(({ data }) => data)
      .filter(
        (room) =>
          room.status === 'active' &&
          [room.name, room.code, room.attributes.englishName].some(
            (name) =>
              typeof name === 'string' &&
              floatingHotelKey(name) === floatingHotelKey(stay.room),
          ),
      );
    if (matched.length !== 1) throw new NotFoundException();
    const checkOut = new Date(Date.parse(checkIn) + 86400000 * stay.nights)
      .toISOString()
      .slice(0, 10);
    return {
      ...stay,
      hotelName: hotel.name,
      roomTypeId: matched[0]!.id,
      roomTypeName: matched[0]!.name,
      checkIn,
      checkOut,
    };
  };
  const choices = [];
  for (const row of product.dated) {
    const schedule = row.flightSchedule;
    if (
      !schedule ||
      !row.startsOn ||
      !row.endsOn ||
      Date.parse(schedule.outbound.departureAt) <= Date.now() ||
      schedule.outbound.originAirport.countryId !==
        schedule.inbound.destinationAirport.countryId ||
      schedule.outbound.destinationAirport.countryId !==
        schedule.inbound.originAirport.countryId
    )
      continue;
    try {
      let checkIn = row.startsOn;
      const stays = [];
      for (const stay of row.stays) {
        const resolved = await resolve(stay, checkIn);
        stays.push(resolved);
        checkIn = resolved.checkOut;
      }
      const first = stays[0];
      if (!first || checkIn !== row.endsOn) continue;
      const ratesIrr: Partial<Record<FloatingTourGroup, string>> = {};
      for (const group of groups) {
        const parts = row.prices[group];
        if (!parts?.length || parts.some((part) => !rates[part.currency]))
          continue;
        ratesIrr[group] = parts
          .reduce(
            (total, part) =>
              total.plus(new Decimal(part.amount).times(rates[part.currency]!)),
            new Decimal(0),
          )
          .toFixed(0, Prisma.Decimal.ROUND_HALF_UP);
      }
      if (!(Number(ratesIrr.single) > 0 || Number(ratesIrr.double) > 0))
        continue;
      choices.push({
        roomCode: stableFingerprint({
          stays,
          schedule,
          ratesIrr,
          definition: product.package.version,
        }),
        hotelId: first.hotelId,
        hotelName: first.hotelName,
        roomTypeName: first.roomTypeName,
        checkIn: row.startsOn,
        checkOut: row.endsOn,
        stays,
        ratesIrr,
        flightSchedule: schedule,
      });
    } catch (error) {
      if (!(error instanceof NotFoundException)) throw error;
    }
  }
  return choices;
}

export function floatingNativeDraft(
  input: FloatingWebsiteBooking,
  definition: Product['package'],
  choices: Awaited<ReturnType<typeof floatingWebsiteRooms>>,
): SalesContractCreateRequest {
  const choice = choices.find((row) => row.roomCode === input.roomCode);
  if (!choice) throw changed();
  const { flightSchedule, checkIn, checkOut } = choice;
  const first = choice.stays[0]!;
  const { originId } = definition;
  const destinationId = first.cityId;
  const legs = [
    ['OUTBOUND', flightSchedule.outbound],
    ['RETURN', flightSchedule.inbound],
  ] as const;
  const services: SalesServiceInput[] = legs.map(([side, leg]) => {
    return {
      clientKey: side === 'OUTBOUND' ? 'flight-outbound' : 'flight-return',
      kind: 'FLIGHT',
      titleSnapshot: leg.carrierName + ' ' + leg.serviceNumber,
      status: 'NEEDS_RESERVATION_CONFIRMATION',
      metadata: contractFlightMetadata({
        ...leg,
        version: 1,
        direction: side,
        originId: side === 'OUTBOUND' ? originId : destinationId,
        destinationId: side === 'OUTBOUND' ? destinationId : originId,
        carrierNameSnapshot: leg.carrierName,
        serviceNumberSnapshot: leg.serviceNumber,
      }),
    };
  });
  services.push({
    clientKey: 'hotel',
    kind: 'HOTEL',
    referenceId: first.hotelId,
    titleSnapshot: first.hotelName,
    status: 'NEEDS_RESERVATION_CONFIRMATION',
    metadata: { purchaseSupplyType: 'FLOATING', hotelMealPlan: first.service },
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
      titleSnapshot: 'بیمه سفر',
      referenceId: definition.insuranceId,
    });
  if (
    input.passengers.some(
      (p) =>
        p.birthDate > checkIn ||
        new Date(p.birthDate).toISOString().slice(0, 10) !== p.birthDate,
    )
  )
    throw invalid();
  const ages = input.passengers.map((p) =>
    passengerAgeCategory(p.birthDate, checkIn),
  );
  const withoutBed = new Set(input.childrenWithoutBed);
  if ([...withoutBed].some((index) => ages[index] !== 'CHD')) throw invalid();
  let total = new Decimal(0);
  const passengers: SalesPassengerInput[] = [];
  const groupsByRoom = input.rooms.map((indexes, index) => {
    const adults = indexes.filter((i) => ages[i] === 'ADT').length;
    if (adults < 1 || adults > 3) throw invalid();
    let adult = 0;
    for (const i of indexes) {
      const age = ages[i]!;
      const group =
        age === 'INF'
          ? 'infant'
          : age === 'CHD'
            ? withoutBed.has(i)
              ? 'childNoBed'
              : 'childBed'
            : adults === 1
              ? 'single'
              : ++adult > 2
                ? 'extra'
                : 'double';
      const amount = choice.ratesIrr[group];
      if (amount === undefined) throw changed();
      total = total.plus(amount);
      const person = input.passengers[i]!;
      passengers[i] = {
        customerId: person.customerId,
        displayNameSnapshot: person.displayNameSnapshot,
        birthDate: person.birthDate,
        ageCategory: age,
        accommodationKind:
          age === 'ADT'
            ? adults === 1
              ? 'SINGLE'
              : 'DBL'
            : age === 'INF'
              ? 'INFANT'
              : withoutBed.has(i)
                ? 'CHILD_WITHOUT_BED'
                : 'CHILD_WITH_BED',
        serviceClientKeys: services.map((service) => service.clientKey),
        agreedPrices: [{ currencyCode: 'IRR', amount }],
      };
    }
    const childAges = indexes
      .filter((i) => ages[i] !== 'ADT')
      .map((i) => {
        const born = input.passengers[i]!.birthDate;
        if (born > checkIn) throw invalid();
        return (
          Number(checkIn.slice(0, 4)) -
          Number(born.slice(0, 4)) -
          Number(checkIn.slice(5) < born.slice(5))
        );
      });
    return { ordinal: index + 1, adults, childAges };
  });
  if (!total.eq(input.expectedAmount)) throw changed();
  const stayInput = (stay: typeof first) => ({
    hotelId: stay.hotelId,
    hotelNameSnapshot: stay.hotelName,
    cityId: stay.cityId,
    checkInDate: stay.checkIn,
    checkOutDate: stay.checkOut,
    rooms: groupsByRoom.map((room) => ({
      ...room,
      roomTypeId: stay.roomTypeId,
      roomTypeNameSnapshot: stay.roomTypeName,
    })),
  });
  return {
    customerId: input.customerId,
    buyerContact: input.buyerContact,
    tripType: 'ROUND_TRIP',
    originId,
    destinationId,
    departureDate: checkIn,
    returnNotBefore: checkOut,
    services,
    passengers,
    hotelSelection: {
      ...stayInput(first),
      serviceClientKey: 'hotel',
      additionalStays: choice.stays.slice(1).map(stayInput),
      roomCount: groupsByRoom.length,
      roomTypeId: first.roomTypeId,
      singleRoomCount: groupsByRoom.filter((room) => room.adults === 1).length,
      doubleRoomCount: groupsByRoom.filter((room) => room.adults >= 2).length,
      extraBedCount: groupsByRoom.filter((room) => room.adults === 3).length,
      occupancy: passengers.length,
      inventoryStatus: 'NEEDS_RESERVATION_CONFIRMATION',
    },
    priceComponents: [
      {
        type: 'BASE',
        title: 'قیمت فروش ERP',
        currencyCode: 'IRR',
        amount: total.toFixed(0),
      },
    ],
  };
}

export const floatingBookingIdentity = (input: FloatingWebsiteBooking) =>
  stableFingerprint({
    publicationId: input.publicationId,
    roomCode: input.roomCode,
    expectedAmount: input.expectedAmount,
    rooms: input.rooms,
    childrenWithoutBed: input.childrenWithoutBed,
    buyerContact: input.buyerContact,
    birthDates: input.passengers.map((p) => p.birthDate),
  });
