import { legacyRowPriceTotals } from '@nora/contracts';
import {
  salesBookedAgeCategory,
  salesHotelGuestAges,
  type SalesPassengerInput,
} from '@nora/contracts';
import { readLegacyServiceParties } from '@nora/contracts';
import { enforceSalesHotelCapacity } from '@nora/contracts';
import { validatePassengerHotelStays } from '@nora/contracts';
import {
  readPassengerTotalPrices,
  validatePassengerTotalPricing,
} from '@nora/contracts';
import { readAgencyCommission } from '@nora/contracts';
import {
  flightRoomTotals,
  readPassengerFlightPrices,
  readPassengerHotelPrices,
  insuranceExtraRials,
} from '@nora/contracts';
import {
  validatePassengerFlightPrices,
  readPassengerDeductions,
  passengerNetPrices,
} from '@nora/contracts';
import {
  moneyUnits,
  validSalesHotelRooms,
  validateInsuranceExtras,
} from '@nora/contracts';
import {
  SALES_CHEQUE_FEE,
  salesChequeComponents,
  validateSalesChequePayments,
} from '@nora/contracts';
import { createHash } from 'node:crypto';
import { salesAccommodationValid, salesContractFlights } from '@nora/contracts';
import {
  servicePriceComponents,
  validatePassengerPackagePrices,
} from '@nora/contracts';

import type {
  SalesHotelRoomV1,
  SalesBalance,
  SalesContractCreateRequest,
  SalesPassengerAgeCategory,
  SalesPaymentInput,
  SalesPaymentStatus,
  SalesPriceComponentInput,
} from '@nora/contracts';

export class SalesDomainError extends Error {
  constructor(
    readonly code: string,
    message: string,
  ) {
    super(message);
  }
}

const DECIMAL = /^\d{1,18}(?:\.\d{1,4})?$/;
const UUID =
  /^[0-9a-f]{8}-[0-9a-f]{4}-[1-8][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i;

function stable(value: unknown): unknown {
  if (Array.isArray(value)) return value.map(stable);
  if (value && typeof value === 'object')
    return Object.fromEntries(
      Object.entries(value)
        .sort(([left], [right]) => left.localeCompare(right))
        .map(([key, item]) => [key, stable(item)]),
    );
  return value;
}

export function salesFingerprint(value: unknown): string {
  return createHash('sha256')
    .update(JSON.stringify(stable(value)))
    .digest('hex');
}

function decimalUnits(value: string): bigint {
  if (typeof value !== 'string' || !DECIMAL.test(value))
    throw new SalesDomainError(
      'SALES_MONEY_INVALID',
      'مبلغ Decimal معتبر نیست.',
    );
  const [whole, fraction = ''] = value.split('.');
  return BigInt(`${whole}${fraction.padEnd(4, '0')}`);
}

function unitsDecimal(value: bigint): string {
  const sign = value < 0n ? '-' : '';
  const absolute = value < 0n ? -value : value;
  const whole = absolute / 10_000n;
  const fraction = (absolute % 10_000n)
    .toString()
    .padStart(4, '0')
    .replace(/0+$/, '');
  return `${sign}${whole}${fraction ? `.${fraction}` : ''}`;
}

export function sumSalesDecimals(values: readonly string[]): string {
  return unitsDecimal(
    values.reduce(
      (sum, value) =>
        sum +
        (value.startsWith('-')
          ? -decimalUnits(value.slice(1))
          : decimalUnits(value)),
      0n,
    ),
  );
}

function currency(value: string): string {
  if (typeof value !== 'string')
    throw new SalesDomainError(
      'SALES_CURRENCY_INVALID',
      'کد ارز باید ISO سه‌حرفی باشد.',
    );
  const normalized = value.trim().toUpperCase();
  if (!/^[A-Z]{3}$/.test(normalized))
    throw new SalesDomainError(
      'SALES_CURRENCY_INVALID',
      'کد ارز باید ISO سه‌حرفی باشد.',
    );
  return normalized;
}

function validDate(value: string, label: string): number {
  const timestamp = Date.parse(value);
  if (Number.isNaN(timestamp))
    throw new SalesDomainError('SALES_DATE_INVALID', `${label} معتبر نیست.`);
  return timestamp;
}

export function passengerAgeYears(
  birthDate: string,
  departureDate: string,
): number {
  const birth = new Date(`${birthDate.slice(0, 10)}T00:00:00.000Z`);
  const departure = new Date(`${departureDate.slice(0, 10)}T00:00:00.000Z`);
  if (birth > departure || Number.isNaN(birth.getTime()))
    throw new SalesDomainError(
      'SALES_PASSENGER_BIRTH_DATE_INVALID',
      'تاریخ تولد مسافر معتبر نیست.',
    );
  let age = departure.getUTCFullYear() - birth.getUTCFullYear();
  const beforeBirthday =
    departure.getUTCMonth() < birth.getUTCMonth() ||
    (departure.getUTCMonth() === birth.getUTCMonth() &&
      departure.getUTCDate() < birth.getUTCDate());
  if (beforeBirthday) age -= 1;
  return age;
}

export function passengerAgeCategory(
  birthDate: string,
  departureDate: string,
): SalesPassengerAgeCategory {
  const age = passengerAgeYears(birthDate, departureDate);
  return age < 2 ? 'INF' : age < 12 ? 'CHD' : 'ADT';
}

export function contractPassengerAgeCategory(
  passenger: Pick<SalesPassengerInput, 'birthDate' | 'ageCategory'>,
  travelDate: string,
): SalesPassengerAgeCategory {
  const category = salesBookedAgeCategory(passenger, travelDate);
  if (!category)
    throw new SalesDomainError(
      'SALES_PASSENGER_BIRTH_DATE_INVALID',
      'تاریخ تولد مسافر معتبر نیست.',
    );
  return category;
}

export function validateSalesContract(
  input: SalesContractCreateRequest,
  requireChequeTerms = false,
  categories: Readonly<Record<string, 'ADT' | 'CHD' | 'INF'>> = {},
): void {
  if (
    !input ||
    !['ONE_WAY', 'ROUND_TRIP'].includes(input.tripType) ||
    !Array.isArray(input.services as unknown) ||
    !Array.isArray(input.passengers as unknown) ||
    !Array.isArray(input.priceComponents as unknown)
  )
    throw new SalesDomainError(
      'SALES_CONTRACT_INVALID',
      'ساختار قرارداد معتبر نیست.',
    );
  try {
    validateInsuranceExtras(input);
  } catch (error) {
    throw new SalesDomainError(
      'SALES_INSURANCE_EXTRA_INVALID',
      error instanceof Error ? error.message : 'هزینه بیمه معتبر نیست',
    );
  }
  for (const [label, value] of [
    ['مشتری', input.customerId],
    ['مبدأ', input.originId],
    ['مقصد', input.destinationId],
  ] as const)
    if (!UUID.test(value))
      throw new SalesDomainError(
        'SALES_REFERENCE_INVALID',
        `شناسه ${label} معتبر نیست.`,
      );
  if (input.buyerContact != null) {
    const buyer = input.buyerContact;
    if (
      typeof buyer !== 'object' ||
      !['name', 'phone', 'address', 'postalCode'].every(
        (key) => typeof buyer[key as keyof typeof buyer] === 'string',
      ) ||
      !buyer.name.trim() ||
      buyer.name.length > 200 ||
      (buyer.phone.trim() !== '' &&
        !/^\+?[0-9]{10,15}$/.test(buyer.phone.trim())) ||
      buyer.address.length > 1000 ||
      (buyer.postalCode.trim() !== '' &&
        !/^[0-9]{10}$/.test(buyer.postalCode.trim())) ||
      (buyer.landline !== undefined &&
        (typeof buyer.landline !== 'string' ||
          (buyer.landline.trim() !== '' &&
            !/^\+?[0-9]+$/.test(buyer.landline.trim())))) ||
      (input.payerCustomerId && input.payerCustomerId !== input.customerId)
    )
      throw new SalesDomainError(
        'SALES_CONTRACT_INVALID',
        'مشخصات مشتری طرف حساب را کامل و معتبر وارد کنید.',
      );
  }
  if (input.originId === input.destinationId)
    throw new SalesDomainError(
      'SALES_ROUTE_INVALID',
      'مبدأ و مقصد نمی‌توانند یکسان باشند.',
    );
  const departure = validDate(input.departureDate, 'تاریخ رفت');
  if (input.tripType === 'ROUND_TRIP' && !input.returnNotBefore)
    throw new SalesDomainError(
      'RETURN_TICKET_INVALID',
      'برای سفر رفت‌وبرگشت تاریخ بازگشت لازم است.',
    );
  if (
    input.returnNotBefore &&
    validDate(input.returnNotBefore, 'تاریخ بازگشت') < departure
  )
    throw new SalesDomainError(
      'RETURN_TICKET_INVALID',
      'تاریخ بازگشت نباید قبل از رفت باشد.',
    );
  let legacyParties: ReturnType<typeof readLegacyServiceParties>;
  try {
    legacyParties = readLegacyServiceParties(input.services);
    if (legacyParties && input.passengers.length)
      throw Error('Invalid legacy service counts');
  } catch {
    throw new SalesDomainError(
      'SALES_CONTRACT_INVALID',
      'ساختار قرارداد قدیمی معتبر نیست.',
    );
  }
  const legacyContract = input.services.some(
    (s) => s.metadata?.legacyContractV1 === true,
  );
  if (
    legacyContract &&
    (input.services.length !== 1 ||
      input.services[0]?.kind !== 'OTHER' ||
      input.services[0]?.clientKey !== 'legacy-contract' ||
      input.passengers.length ||
      input.ticketSelections?.length ||
      input.hotelSelection)
  )
    throw new SalesDomainError(
      'SALES_CONTRACT_INVALID',
      'ساختار قرارداد قدیمی معتبر نیست.',
    );
  if (
    !input.services.length ||
    (!legacyContract && !legacyParties && !input.passengers.length) ||
    (!input.priceComponents.length &&
      !input.services.every(
        (service) =>
          service.kind === 'TRANSFER' &&
          service.metadata?.includedWithoutCharge === true,
      ))
  )
    throw new SalesDomainError(
      'SALES_CONTRACT_INCOMPLETE',
      'خدمت، مسافر و جزء قیمت الزامی است.',
    );
  const serviceKeys = new Set(input.services.map(({ clientKey }) => clientKey));
  if (
    input.services.some((item) => item.kind === 'FLIGHT') &&
    input.services.some((item) => item.kind === 'BUS' || item.kind === 'TRAIN')
  )
    throw new SalesDomainError(
      'SALES_SERVICE_INVALID',
      'پرواز با قطار یا اتوبوس هم‌زمان قابل انتخاب نیست.',
    );
  if (serviceKeys.size !== input.services.length)
    throw new SalesDomainError(
      'SALES_SERVICE_DUPLICATE',
      'کلید خدمت باید یکتا باشد.',
    );
  if (
    input.services.some(
      (service) => !service.clientKey?.trim() || !service.titleSnapshot?.trim(),
    )
  )
    throw new SalesDomainError(
      'SALES_SERVICE_INVALID',
      'مشخصات خدمت کامل نیست.',
    );
  if (
    new Set(input.passengers.map((passenger) => passenger.customerId)).size !==
    input.passengers.length
  )
    throw new SalesDomainError(
      'SALES_PASSENGER_DUPLICATE',
      'یک مسافر نمی‌تواند دوبار به قرارداد اضافه شود.',
    );
  try {
    readAgencyCommission(input.services);
  } catch {
    throw new SalesDomainError(
      'SALES_AGENCY_COMMISSION_INVALID',
      'کمیسیون آژانس معتبر نیست.',
    );
  }
  try {
    const totalPrices = readPassengerTotalPrices(
      input.services,
      input.passengers,
    );
    const deductions = readPassengerDeductions(
      input.services,
      input.passengers,
    );
    if (
      Object.keys(deductions).length &&
      !readPassengerTotalPrices(input.services, input.passengers) &&
      !input.services.some(
        (s) => s.metadata?.automaticFlightRoomTotalV1 === true,
      )
    )
      throw Error('تخفیف و کمیسیون مسافران معتبر نیست.');
    validatePassengerTotalPricing(input.services, input.passengers);
    if (!totalPrices) {
      readPassengerHotelPrices(input.services, input.passengers);
      validatePassengerFlightPrices(
        input.services,
        input.passengers,
        input.priceComponents,
      );
    }
  } catch (error) {
    throw new SalesDomainError(
      'SALES_FLIGHT_PASSENGER_PRICE_INVALID',
      error instanceof Error ? error.message : 'قیمت پرواز مسافران معتبر نیست.',
    );
  }
  if (
    !readPassengerTotalPrices(input.services, input.passengers) &&
    input.services.some((s) => s.metadata?.automaticFlightRoomTotalV1 === true)
  ) {
    try {
      if (
        input.services.some((s) => s.kind === 'FLIGHT') &&
        !readPassengerFlightPrices(input.services)
      )
        throw Error('قیمت پرواز هر مسافر را وارد کنید.');
      const hotelPrices = readPassengerHotelPrices(
        input.services,
        input.passengers,
      );
      if (
        !hotelPrices &&
        input.hotelSelection?.rooms?.some((r) => !r.agreedPrice)
      )
        throw Error('قیمت هر اتاق را وارد کنید.');
      const extra = input.services
        .filter((s) => s.metadata?.insuranceAgeSurcharge === true)
        .map((s) => ({
          amount: insuranceExtraRials(String(s.metadata!.extraToman)),
          currencyCode: 'IRR',
        }));
      const deductions = readPassengerDeductions(
        input.services,
        input.passengers,
      );
      const flightPrices = readPassengerFlightPrices(input.services);
      const netPrices = passengerNetPrices(
        Object.fromEntries(
          input.passengers.map((p) => [
            p.customerId,
            [
              ...(flightPrices?.[p.customerId] ?? []),
              ...(hotelPrices?.[p.customerId] ?? []),
            ],
          ]),
        ),
        deductions,
      );
      const expected = flightRoomTotals(
        {
          ...netPrices,
          insuranceExtras: extra,
        },
        hotelPrices ? [] : (input.hotelSelection?.rooms ?? []),
      );
      const actual = new Map<string, bigint>();
      for (const p of input.priceComponents.filter(
        (p) => p.title !== SALES_CHEQUE_FEE,
      ))
        actual.set(
          p.currencyCode,
          (actual.get(p.currencyCode) ?? 0n) +
            moneyUnits(p.amount) * (p.type === 'DISCOUNT' ? -1n : 1n),
        );
      for (const [code, value] of actual) if (value === 0n) actual.delete(code);
      const wanted = expected.filter((p) => moneyUnits(p.amount) > 0n);
      if (
        actual.size !== wanted.length ||
        wanted.some((p) => actual.get(p.currencyCode) !== moneyUnits(p.amount))
      )
        throw Error(
          'مبلغ کل قرارداد باید برابر جمع قیمت پروازها و اتاق‌ها باشد.',
        );
    } catch (error) {
      throw new SalesDomainError(
        'SALES_COMPONENT_TOTAL_INVALID',
        error instanceof Error ? error.message : 'مبلغ قرارداد معتبر نیست.',
      );
    }
  }
  for (const passenger of input.passengers) {
    if (
      !UUID.test(passenger.customerId) ||
      !passenger.displayNameSnapshot.trim()
    )
      throw new SalesDomainError(
        'SALES_PASSENGER_INVALID',
        'مشخصات مسافر کامل نیست.',
      );
    const age =
      categories[passenger.customerId] ??
      contractPassengerAgeCategory(passenger, input.departureDate);
    if (
      passenger.childAgeBand != null &&
      (age !== 'CHD' ||
        !['AGE_2_6', 'AGE_6_12'].includes(passenger.childAgeBand))
    )
      throw new SalesDomainError(
        'SALES_CHILD_AGE_BAND_INVALID',
        'رده سنی کودک معتبر نیست.',
      );
    if (
      passenger.accommodationKind !== undefined &&
      (!salesAccommodationValid(passenger.accommodationKind, age) ||
        !input.services.some(
          (s) =>
            s.kind === 'HOTEL' &&
            passenger.serviceClientKeys.includes(s.clientKey),
        ))
    )
      throw new SalesDomainError(
        'SALES_ACCOMMODATION_INVALID',
        'نوع اقامت باید با سن مسافر و تخصیص هتل مطابقت داشته باشد.',
      );
    if (
      !passenger.serviceClientKeys.length ||
      passenger.serviceClientKeys.some((key) => !serviceKeys.has(key))
    )
      throw new SalesDomainError(
        'SALES_PASSENGER_SERVICE_INVALID',
        'تخصیص خدمت به مسافر معتبر نیست.',
      );
  }
  let tickets: ReturnType<typeof salesContractFlights>;
  try {
    tickets = salesContractFlights(
      input.services,
      input.ticketSelections ?? [],
    );
  } catch (error) {
    throw new SalesDomainError(
      'TICKET_NOT_AVAILABLE',
      error instanceof Error ? error.message : 'اطلاعات بلیت شناور معتبر نیست.',
    );
  }
  for (const ticket of tickets) {
    const legacyFlight = legacyParties?.[ticket.serviceClientKey];
    if (legacyFlight && legacyFlight.adults + legacyFlight.children < 1)
      throw new SalesDomainError(
        'TICKET_NOT_AVAILABLE',
        'ساختار قرارداد قدیمی معتبر نیست.',
      );
    const service = input.services.find(
      (item) => item.clientKey === ticket.serviceClientKey,
    );
    if (
      !service ||
      service.kind !== 'FLIGHT' ||
      (service.metadata?.direction &&
        service.metadata.direction !== ticket.direction) ||
      !['OUTBOUND', 'RETURN'].includes(ticket.direction)
    )
      throw new SalesDomainError(
        'TICKET_NOT_AVAILABLE',
        'خدمت بلیت انتخاب‌شده معتبر نیست.',
      );
    const departAt = validDate(ticket.departureAt, 'زمان حرکت بلیت');
    const arriveAt = validDate(ticket.arrivalAt, 'زمان رسیدن بلیت');
    if (arriveAt <= departAt)
      throw new SalesDomainError(
        'TICKET_NOT_AVAILABLE',
        'زمان رسیدن باید پس از حرکت باشد.',
      );
    if (ticket.quotedPrice) {
      currency(ticket.quotedPrice.currencyCode);
      decimalUnits(ticket.quotedPrice.amount);
    }
  }
  const outbound = tickets.find(({ direction }) => direction === 'OUTBOUND');
  const inbound = tickets.find(({ direction }) => direction === 'RETURN');
  if (
    input.tripType === 'ROUND_TRIP' &&
    outbound?.source === 'CATALOG' &&
    inbound?.source === 'CONTRACT_ONLY'
  )
    throw new SalesDomainError(
      'TICKET_NOT_AVAILABLE',
      'برای بلیت رفت از سهمیه شرکت، بلیت برگشت نیز باید از سهمیه شرکت انتخاب شود.',
    );

  if (
    tickets.length > 2 ||
    new Set(tickets.map(({ direction }) => direction)).size !==
      tickets.length ||
    (input.tripType === 'ONE_WAY' && inbound) ||
    (outbound &&
      (outbound.originId !== input.originId ||
        outbound.destinationId !== input.destinationId))
  )
    throw new SalesDomainError(
      'RETURN_TICKET_INVALID',
      'تعداد یا مسیر بلیت‌ها با قرارداد سازگار نیست.',
    );
  for (const service of input.services) {
    if (
      service.kind === 'VISA' &&
      service.metadata?.applicantAdults !== undefined
    ) {
      const c = {
        adults: Number(service.metadata.applicantAdults),
        children: Number(service.metadata.applicantChildren),
      };
      const selected = input.passengers.filter((p) =>
        p.serviceClientKeys.includes(service.clientKey),
      );
      const cats = selected.map(
        (p) =>
          categories[p.customerId] ??
          contractPassengerAgeCategory(p, input.departureDate),
      );
      const ageText = service.metadata.applicantChildAges;
      const ages =
        typeof ageText === 'string'
          ? ageText
            ? ageText.split(',').map(Number)
            : []
          : null;
      const actualAges = salesHotelGuestAges(
        selected.filter(
          (p) => contractPassengerAgeCategory(p, input.departureDate) === 'CHD',
        ),
        input.departureDate,
        ages ?? [],
      )?.sort((a, b) => a - b);
      if (
        !c ||
        !Number.isInteger(c.adults) ||
        !Number.isInteger(c.children) ||
        c.adults < 0 ||
        c.children < 0 ||
        c.adults + c.children < 1 ||
        (legacyParties
          ? legacyParties[service.clientKey]!.adults !== c.adults ||
            legacyParties[service.clientKey]!.children !== c.children
          : selected.length !== c.adults + c.children ||
            cats.filter((x) => x === 'ADT').length !== c.adults ||
            cats.filter((x) => x === 'CHD').length !== c.children) ||
        !Array.isArray(ages) ||
        ages.length !== c.children ||
        (!legacyParties &&
          (!actualAges ||
            actualAges.length !== ages.length ||
            actualAges.some(
              (a, i) => a !== [...ages].sort((a, b) => a - b)[i],
            ))) ||
        ages.some(
          (a) => !Number.isInteger(a) || Number(a) < 2 || Number(a) >= 12,
        )
      )
        throw new SalesDomainError(
          'SALES_SERVICE_INVALID',
          'افراد متقاضی ویزا با تعداد درخواست‌شده هماهنگ نیستند.',
        );
    }
    if (
      service.kind === 'TRANSFER' &&
      service.metadata?.passengerCount !== undefined
    ) {
      const count = service.metadata.passengerCount;
      const legacyTransfer = legacyParties?.[service.clientKey];
      const max = legacyTransfer
        ? legacyTransfer.adults + legacyTransfer.children
        : input.passengers.filter(
            (p) =>
              (categories[p.customerId] ??
                contractPassengerAgeCategory(p, input.departureDate)) !== 'INF',
          ).length;
      if (
        typeof count !== 'number' ||
        !Number.isInteger(count) ||
        count < 0 ||
        count > max
      )
        throw new SalesDomainError(
          'SALES_SERVICE_INVALID',
          'تعداد مسافران ترانسفر معتبر نیست.',
        );
    }
    const direction = service.metadata?.direction;
    if (
      direction &&
      input.services.filter(
        (item) =>
          item.kind === service.kind && item.metadata?.direction === direction,
      ).length > 1
    )
      throw new SalesDomainError(
        'SALES_SERVICE_DUPLICATE',
        'خدمت هر جهت فقط یک بار قابل انتخاب است.',
      );
    if (
      (service.kind === 'FLIGHT' || service.kind === 'TRANSFER') &&
      direction !== undefined &&
      (!['OUTBOUND', 'RETURN'].includes(String(direction)) ||
        (direction === 'RETURN' && input.tripType !== 'ROUND_TRIP'))
    )
      throw new SalesDomainError(
        'SALES_SERVICE_INVALID',
        'جهت خدمت با قرارداد سازگار نیست.',
      );
    if (service.kind === 'FLIGHT') {
      const required = direction
        ? [direction]
        : input.tripType === 'ROUND_TRIP'
          ? ['OUTBOUND', 'RETURN']
          : ['OUTBOUND'];
      if (
        required.some(
          (expected) =>
            !tickets.some(
              (ticket) =>
                ticket.direction === expected &&
                ticket.serviceClientKey === service.clientKey,
            ),
        )
      )
        throw new SalesDomainError(
          'RETURN_TICKET_INVALID',
          'بلیت جهت انتخاب‌شده الزامی است.',
        );
    }
  }
  if (
    inbound &&
    (inbound.originId !== input.destinationId ||
      inbound.destinationId !== input.originId ||
      Date.parse(inbound.departureAt) <
        Math.max(
          outbound ? Date.parse(outbound.arrivalAt) : departure,
          Date.parse(input.returnNotBefore ?? input.departureDate),
        ))
  )
    throw new SalesDomainError(
      'RETURN_TICKET_INVALID',
      'مسیر یا زمان بلیت برگشت با قرارداد سازگار نیست.',
    );
  try {
    validatePassengerHotelStays(input);
  } catch (reason) {
    throw new SalesDomainError(
      'SALES_HOTEL_INVALID',
      reason instanceof Error ? reason.message : 'Invalid passenger stays',
    );
  }
  if (input.hotelSelection) {
    const hotel = input.hotelSelection;
    if (hotel.rooms !== undefined) {
      if (!validSalesHotelRooms(hotel.rooms, hotel.roomCount))
        throw new SalesDomainError(
          'SALES_HOTEL_INVALID',
          'ترکیب اتاق‌ها معتبر نیست.',
        );
      if (hotel.rooms.some((r) => r.agreedPrice)) {
        if (hotel.rooms.some((r) => !r.agreedPrice))
          throw new SalesDomainError(
            'SALES_HOTEL_INVALID',
            'مبلغ توافق‌شدهٔ همهٔ اتاق‌ها را وارد کنید.',
          );
        const totals = new Map<string, bigint>();
        for (const r of hotel.rooms) {
          const p = r.agreedPrice!;
          totals.set(
            p.currencyCode,
            (totals.get(p.currencyCode) ?? 0n) + moneyUnits(p.amount),
          );
        }
        for (const [code, total] of totals) {
          const contract = input.priceComponents
            .filter((p) => p.currencyCode === code)
            .reduce(
              (n, p) =>
                n + (p.type === 'DISCOUNT' ? -1n : 1n) * moneyUnits(p.amount),
              0n,
            );
          if (total > contract)
            throw new SalesDomainError(
              'SALES_HOTEL_INVALID',
              'جمع مبالغ اتاق‌ها نباید از مبلغ کل قرارداد در همان ارز بیشتر باشد.',
            );
        }
      }
      const guests = input.passengers.filter((p) =>
        p.serviceClientKeys.includes(hotel.serviceClientKey),
      );
      const expected = hotel.rooms
        .flatMap((r) => [...Array(r.adults).fill(15), ...r.childAges])
        .sort((a, b) => a - b);
      const actual = salesHotelGuestAges(
        guests,
        hotel.checkInDate,
        expected,
      )?.sort((a, b) => a - b);
      if (
        hotel.roomTypeId !== hotel.rooms[0]?.roomTypeId ||
        (enforceSalesHotelCapacity() &&
          !legacyParties &&
          (!actual ||
            expected.length !== actual.length ||
            expected.some((a, i) => a !== actual[i])))
      )
        throw new SalesDomainError(
          'SALES_HOTEL_INVALID',
          'ترکیب و سن مهمانان با اتاق‌های انتخاب‌شده یکسان نیست.',
        );
    }
    if (
      !serviceKeys.has(hotel.serviceClientKey) ||
      (!hotel.additionalStays?.length && hotel.cityId !== input.destinationId)
    )
      throw new SalesDomainError(
        'SALES_HOTEL_INVALID',
        'هتل باید برای شهر مقصد و خدمت انتخاب‌شده باشد.',
      );
    if (
      validDate(hotel.checkOutDate, 'خروج هتل') <=
      validDate(hotel.checkInDate, 'ورود هتل')
    )
      throw new SalesDomainError(
        'SALES_HOTEL_INVALID',
        'خروج هتل باید پس از ورود باشد.',
      );
    if (hotel.roomCount < 1 || hotel.occupancy < 1)
      throw new SalesDomainError(
        'SALES_HOTEL_INVALID',
        'تعداد اتاق و ظرفیت باید مثبت باشد.',
      );
    const singleRooms = hotel.singleRoomCount ?? 0;
    const doubleRooms = hotel.doubleRoomCount ?? hotel.roomCount;
    const extraBeds = hotel.extraBedCount ?? 0;
    if (
      ![singleRooms, doubleRooms, extraBeds].every(
        (value) => Number.isInteger(value) && value >= 0,
      ) ||
      singleRooms + doubleRooms > hotel.roomCount
    )
      throw new SalesDomainError(
        'SALES_HOTEL_INVALID',
        'ترکیب اتاق یک‌تخته، دوتخته و تخت اضافه معتبر نیست.',
      );
    const legacyHotel = legacyParties?.[hotel.serviceClientKey];
    const hotelGuestCount = legacyHotel
      ? legacyHotel.adults + legacyHotel.children + legacyHotel.infants
      : input.passengers.filter((passenger) =>
          passenger.serviceClientKeys.includes(hotel.serviceClientKey),
        ).length;
    if (legacyHotel && hotel.rooms) {
      const adults = hotel.rooms.reduce((n, r) => n + r.adults, 0);
      const ages = hotel.rooms.flatMap((r) => r.childAges);
      if (
        adults !== legacyHotel.adults ||
        ages.filter((a) => a >= 2).length !== legacyHotel.children ||
        ages.filter((a) => a < 2).length !== legacyHotel.infants
      )
        throw new SalesDomainError(
          'SALES_HOTEL_INVALID',
          'ساختار قرارداد قدیمی معتبر نیست.',
        );
    }
    if (hotelGuestCount < 1 || hotel.occupancy !== hotelGuestCount)
      throw new SalesDomainError(
        'SALES_HOTEL_INVALID',
        'تعداد اعضای انتخاب‌شده برای اقامت باید با تعداد مسافران هتل برابر باشد.',
      );
    if (hotel.additionalStays !== undefined) {
      if (
        !Array.isArray(hotel.additionalStays) ||
        hotel.additionalStays.length > 49 ||
        (hotel.additionalStays.length > 0 &&
          (!UUID.test(hotel.hotelId) || !UUID.test(hotel.cityId)))
      )
        throw new SalesDomainError(
          'SALES_HOTEL_INVALID',
          'Invalid hotel itinerary',
        );
      const ids = new Set([hotel.hotelId]);
      let previousOut = validDate(hotel.checkOutDate, 'Hotel check-out');
      for (const stay of hotel.additionalStays) {
        if (
          stay &&
          stay.rooms !== undefined &&
          (!Array.isArray(stay.rooms) ||
            !validSalesHotelRooms(stay.rooms, stay.rooms.length) ||
            stay.rooms.reduce(
              (n: number, room: SalesHotelRoomV1) =>
                n + room.adults + room.childAges.length,
              0,
            ) > hotel.occupancy ||
            stay.rooms.some((room: SalesHotelRoomV1) =>
              Object.keys(room).some(
                (key) =>
                  ![
                    'ordinal',
                    'roomTypeId',
                    'roomTypeNameSnapshot',
                    'adults',
                    'childAges',
                    'roomCategory',
                  ].includes(key),
              ),
            ))
        )
          throw new SalesDomainError(
            'SALES_HOTEL_INVALID',
            'ترکیب اتاق‌ها معتبر نیست.',
          );
        if (
          !stay ||
          !UUID.test(stay.hotelId) ||
          !UUID.test(stay.cityId) ||
          ids.has(stay.hotelId) ||
          typeof stay.hotelNameSnapshot !== 'string' ||
          !stay.hotelNameSnapshot.trim() ||
          stay.hotelNameSnapshot.length > 240
        )
          throw new SalesDomainError(
            'SALES_HOTEL_INVALID',
            'Invalid hotel itinerary',
          );
        const start = validDate(stay.checkInDate, 'Hotel check-in');
        const end = validDate(stay.checkOutDate, 'Hotel check-out');
        if (end <= start || start < previousOut)
          throw new SalesDomainError(
            'SALES_HOTEL_INVALID',
            'Hotel itinerary dates overlap or are reversed',
          );
        previousOut = end;
        ids.add(stay.hotelId);
      }
    }
  }
  try {
    validateSalesChequePayments(
      input.priceComponents,
      input.payments ?? [],
      input.paymentTerms,
    );
    if (
      requireChequeTerms &&
      input.payments?.some((p) => p.method === 'CHECK') &&
      !input.paymentTerms
    )
      throw new Error('برای پرداخت چکی، نوع فروش چکی را انتخاب کنید.');
    const legacyTotals = legacyRowPriceTotals(input.services);
    if (legacyTotals) {
      const signature = (
        rows: readonly {
          currencyCode: string;
          amount: string;
          type?: string;
        }[],
      ) => {
        const sums = new Map<string, bigint>();
        for (const p of rows)
          sums.set(
            p.currencyCode,
            (sums.get(p.currencyCode) ?? 0n) +
              (p.type === 'DISCOUNT' ? -1n : 1n) * moneyUnits(p.amount),
          );
        return JSON.stringify(
          [...sums]
            .filter(([, n]) => n !== 0n)
            .sort(([a], [b]) => a.localeCompare(b))
            .map(([c, n]) => [c, n.toString()]),
        );
      };
      if (
        input.passengers.length ||
        !input.services.every(
          (s) => s.metadata?.contractPackagePricingVersion === 1,
        ) ||
        signature(
          salesChequeComponents(
            legacyTotals.map((p) => ({
              ...p,
              type: 'BASE' as const,
              title: 'جمع قیمت کل مسافران',
            })),
            input.paymentTerms,
          ),
        ) !== signature(input.priceComponents)
      )
        throw Error('مجموع قیمت نفرات با مبلغ کل قرارداد مطابقت ندارد.');
    }
    const derived = servicePriceComponents(
      input.services,
      input.hotelSelection,
    );
    validatePassengerPackagePrices(
      input.passengers,
      input.paymentTerms
        ? input.priceComponents.filter((p) => p.title !== SALES_CHEQUE_FEE)
        : input.priceComponents,
      input.services.some(
        (s) => s.metadata?.passengerPackagePricingVersion === 1,
      ),
    );
    if (
      derived &&
      salesFingerprint(
        salesChequeComponents(derived, input.paymentTerms)
          .map(salesFingerprint)
          .sort(),
      ) !== salesFingerprint(input.priceComponents.map(salesFingerprint).sort())
    )
      throw new Error(
        'مجموع قیمت‌ها با قیمت روز و مبلغ توافقی خدمات مطابقت ندارد.',
      );
  } catch (error) {
    throw new SalesDomainError(
      'SALES_MONEY_INVALID',
      error instanceof Error ? error.message : 'قیمت خدمات معتبر نیست.',
    );
  }
  for (const price of input.priceComponents) {
    currency(price.currencyCode);
    if (decimalUnits(price.amount) <= 0n)
      throw new SalesDomainError(
        'SALES_MONEY_INVALID',
        'مبلغ جزء قیمت باید مثبت باشد.',
      );
  }
  if (!input.priceComponents.length && input.payments?.length)
    throw new SalesDomainError(
      'SALES_PAYMENT_INVALID',
      'خدمات بدون هزینه نباید برنامه پرداخت داشته باشند.',
    );
  for (const payment of input.payments ?? []) validateSalesPayment(payment);
}

export function validateSalesPayment(payment: SalesPaymentInput): void {
  if (
    payment?.destinationAccountId != null &&
    (typeof payment.destinationAccountId !== 'string' ||
      !/^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i.test(
        payment.destinationAccountId,
      ))
  )
    throw new SalesDomainError(
      'SALES_PAYMENT_ACCOUNT_INVALID',
      'حساب مقصد پرداخت معتبر نیست.',
    );
  if (!payment || typeof payment.dueAt !== 'string')
    throw new SalesDomainError(
      'SALES_PAYMENT_INVALID',
      'ساختار پرداخت معتبر نیست.',
    );
  if (
    payment.paymentReference != null &&
    (typeof payment.paymentReference !== 'string' ||
      payment.paymentReference.length > 160 ||
      [...payment.paymentReference].some(
        (character) =>
          character.charCodeAt(0) < 32 || character.charCodeAt(0) === 127,
      ))
  )
    throw new SalesDomainError(
      'SALES_PAYMENT_REFERENCE_INVALID',
      'شماره پیگیری باید متن معتبر و حداکثر ۱۶۰ نویسه باشد.',
    );
  currency(payment.currencyCode);
  if (decimalUnits(payment.amount) <= 0n)
    throw new SalesDomainError(
      'SALES_MONEY_INVALID',
      'مبلغ پرداخت باید مثبت باشد.',
    );
  validDate(payment.dueAt, 'سررسید پرداخت');
  if (payment.method === 'CHECK' && !payment.check)
    throw new SalesDomainError(
      'SALES_CHECK_INVALID',
      'اطلاعات امن چک الزامی است.',
    );
  if (payment.method !== 'CHECK' && payment.check)
    throw new SalesDomainError(
      'SALES_CHECK_INVALID',
      'اطلاعات چک فقط برای روش چک مجاز است.',
    );
}

export function calculateSalesBalances(
  components: readonly SalesPriceComponentInput[],
  payments: readonly {
    amount: string;
    currencyCode: string;
    status: SalesPaymentStatus;
  }[],
): SalesBalance[] {
  const totals = new Map<
    string,
    { total: bigint; confirmed: bigint; pending: bigint }
  >();
  const bucket = (code: string) => {
    const normalized = currency(code);
    const current = totals.get(normalized) ?? {
      total: 0n,
      confirmed: 0n,
      pending: 0n,
    };
    totals.set(normalized, current);
    return current;
  };
  for (const item of components) {
    const target = bucket(item.currencyCode);
    const amount = decimalUnits(item.amount);
    target.total += item.type === 'DISCOUNT' ? -amount : amount;
  }
  for (const payment of payments) {
    const target = bucket(payment.currencyCode);
    const amount = decimalUnits(payment.amount);
    if (payment.status === 'FINANCE_CONFIRMED') target.confirmed += amount;
    else if (payment.status === 'PENDING_FINANCE_CONFIRMATION')
      target.pending += amount;
  }
  return [...totals.entries()].map(([currencyCode, value]) => ({
    amount: unitsDecimal(value.total),
    currencyCode,
    confirmedPaid: unitsDecimal(value.confirmed),
    pendingFinance: unitsDecimal(value.pending),
    outstanding: unitsDecimal(value.total - value.confirmed),
  }));
}
