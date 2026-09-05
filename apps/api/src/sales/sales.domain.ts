import { createHash } from 'node:crypto';

import type {
  SalesBalance,
  SalesContractCreateRequest,
  SalesPassengerAgeCategory,
  SalesPaymentInput,
  SalesPaymentStatus,
  SalesPriceComponentInput,
} from '@rubi/contracts';

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
    values.reduce((sum, value) => sum + decimalUnits(value), 0n),
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

export function passengerAgeCategory(
  birthDate: string,
  departureDate: string,
): SalesPassengerAgeCategory {
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
  return age < 2 ? 'INF' : age < 12 ? 'CHD' : 'ADT';
}

export function validateSalesContract(input: SalesContractCreateRequest): void {
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
  if (
    !input.services.length ||
    !input.passengers.length ||
    !input.priceComponents.length
  )
    throw new SalesDomainError(
      'SALES_CONTRACT_INCOMPLETE',
      'خدمت، مسافر و جزء قیمت الزامی است.',
    );
  const serviceKeys = new Set(input.services.map(({ clientKey }) => clientKey));
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
  for (const passenger of input.passengers) {
    if (
      !UUID.test(passenger.customerId) ||
      !passenger.displayNameSnapshot.trim()
    )
      throw new SalesDomainError(
        'SALES_PASSENGER_INVALID',
        'مشخصات مسافر کامل نیست.',
      );
    passengerAgeCategory(passenger.birthDate, input.departureDate);
    if (
      !passenger.serviceClientKeys.length ||
      passenger.serviceClientKeys.some((key) => !serviceKeys.has(key))
    )
      throw new SalesDomainError(
        'SALES_PASSENGER_SERVICE_INVALID',
        'تخصیص خدمت به مسافر معتبر نیست.',
      );
  }
  const tickets = input.ticketSelections ?? [];
  for (const ticket of tickets) {
    if (!serviceKeys.has(ticket.serviceClientKey))
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
  if (
    input.services.some(({ kind }) => kind === 'FLIGHT') &&
    (!outbound || (input.tripType === 'ROUND_TRIP' && !inbound))
  )
    throw new SalesDomainError(
      'RETURN_TICKET_INVALID',
      'هر دو بلیت رفت و برگشت الزامی است.',
    );
  if (
    outbound &&
    inbound &&
    (inbound.originId !== input.destinationId ||
      inbound.destinationId !== input.originId ||
      Date.parse(inbound.departureAt) <
        Math.max(
          Date.parse(outbound.arrivalAt),
          Date.parse(input.returnNotBefore ?? input.departureDate),
        ))
  )
    throw new SalesDomainError(
      'RETURN_TICKET_INVALID',
      'مسیر یا زمان بلیت برگشت با قرارداد سازگار نیست.',
    );
  if (input.hotelSelection) {
    const hotel = input.hotelSelection;
    if (
      !serviceKeys.has(hotel.serviceClientKey) ||
      hotel.cityId !== input.destinationId
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
  }
  for (const price of input.priceComponents) {
    currency(price.currencyCode);
    if (decimalUnits(price.amount) <= 0n)
      throw new SalesDomainError(
        'SALES_MONEY_INVALID',
        'مبلغ جزء قیمت باید مثبت باشد.',
      );
  }
  for (const payment of input.payments ?? []) validateSalesPayment(payment);
}

export function validateSalesPayment(payment: SalesPaymentInput): void {
  if (!payment || typeof payment.dueAt !== 'string')
    throw new SalesDomainError(
      'SALES_PAYMENT_INVALID',
      'ساختار پرداخت معتبر نیست.',
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
