import { BadRequestException } from '@nestjs/common';
import * as Joi from 'joi';
import type { TourDepartureInputV1, TourPackageInputV1 } from '@rubi/contracts';

const id = Joi.string().guid();
const date = Joi.string().pattern(/^\d{4}-\d{2}-\d{2}$/);
const copy = (max = 5000) => Joi.string().trim().max(max);
const money = Joi.object({
  amount: Joi.string()
    .pattern(/^(0|[1-9]\d{0,14})(\.\d{1,4})?$/)
    .required(),
  currency: Joi.string()
    .valid(
      'IRT',
      'IRR',
      'USD',
      'EUR',
      'TRY',
      'RUB',
      'GEL',
      'GBP',
      'AED',
      'CNY',
      'JPY',
      'CAD',
      'AUD',
      'AZN',
      'AMD',
      'KZT',
      'SAR',
      'QAR',
      'KWD',
      'OMR',
      'CHF',
    )
    .required(),
});
const detailsSchema = Joi.object({
  version: Joi.number().valid(1).required(),
  summary: copy(500),
  description: copy(),
  requiredDocuments: copy(),
  services: copy(),
  installmentTerms: copy(),
  refundRules: copy(),
  originAirportCode: Joi.string().pattern(/^[A-Z]{3}$/),
  durationDays: Joi.number().integer().min(1).max(366),
  rating: Joi.number().min(0).max(5),
  transport: Joi.string().valid('FLIGHT', 'TRAIN'),
  ticketIncluded: Joi.boolean(),
  airlineName: copy(160),
  basePrice: money,
  flightPrice: money,
  imageDocumentId: id,
  itinerary: Joi.array()
    .max(100)
    .items(
      Joi.object({
        kind: Joi.string().valid(
          'START',
          'TRANSPORT',
          'TRANSIT',
          'STAY',
          'EVENT',
          'END',
        ),
        title: copy(160),
        location: copy(160),
        stayDays: Joi.number().integer().min(0).max(366),
        startTime: Joi.string().pattern(/^([01]\d|2[0-3]):[0-5]\d$/),
        durationMinutes: Joi.number().integer().min(0).max(527040),
        transport: copy(100),
        cabinClass: copy(100),
        baggageKg: Joi.number().min(0).max(1000),
        description: copy(2000),
      }),
    ),
});
const packageSchema = Joi.object({
  name: Joi.string().trim().min(2).max(160).required(),
  originId: id.required(),
  destinationId: id.invalid(Joi.ref('originId')).required(),
  hotelIds: Joi.array().items(id).unique().max(30).required(),
  insuranceId: id,
  transferOutbound: Joi.boolean().required(),
  transferReturn: Joi.boolean().required(),
  visa: Joi.boolean().required(),
  details: detailsSchema,
});
const departureSchema = Joi.object({
  packageId: id.required(),
  packageVersion: Joi.number().integer().min(1).required(),
  startsOn: date.required(),
  endsOn: date.required(),
  outboundOfferId: id.required(),
  returnOfferId: id.invalid(Joi.ref('outboundOfferId')),
});

export function validateTourPackage(input: unknown): TourPackageInputV1 {
  const result = packageSchema.validate(input, { convert: false });
  if (result.error) {
    const path = result.error.details[0]?.path ?? [];
    const labels: Record<string, string> = {
      basePrice: 'قیمت پایه و ارز پکیج',
      flightPrice: 'هزینه جداگانه پرواز و ارز',
      itinerary: 'برنامه سفر (ساعت HH:mm و مدت مثبت)',
      originAirportCode: 'کد سه‌حرفی فرودگاه مبدأ',
      durationDays: 'مدت سفر (۱ تا ۳۶۶ روز)',
      rating: 'امتیاز تور (۰ تا ۵)',
      imageDocumentId: 'تصویر تور',
    };
    const label =
      path[0] === 'details'
        ? (labels[String(path[1])] ?? 'مشخصات تکمیلی تور')
        : 'نام، مسیر و خدمات تور';
    throw new BadRequestException(`${label} را بررسی کنید.`);
  }
  const value = structuredClone(result.value) as TourPackageInputV1;
  for (const key of ['basePrice', 'flightPrice'] as const) {
    const price = value.details?.[key];
    if (price?.currency !== 'IRT') continue;
    // Toman is an input/display unit, never a second ledger currency.
    const [whole, fraction = ''] = price.amount.split('.');
    const scaled = BigInt(whole! + fraction.padEnd(4, '0')) * 10n;
    const integer = (scaled / 10000n).toString();
    if (integer.length > 15)
      throw new BadRequestException('مبلغ ریالی بیش از سقف مجاز است.');
    const decimal = (scaled % 10000n)
      .toString()
      .padStart(4, '0')
      .replace(/0+$/, '');
    price.amount = integer + (decimal ? `.${decimal}` : '');
    price.currency = 'IRR';
  }
  return value;
}

export function validateTourDeparture(
  input: unknown,
  now = new Date(),
): TourDepartureInputV1 {
  const result = departureSchema.validate(input, { convert: false });
  if (result.error)
    throw new BadRequestException('تاریخ و بلیت نوبت تور را کامل کنید.');
  const value = result.value as TourDepartureInputV1;
  for (const raw of [value.startsOn, value.endsOn]) {
    const parsed = new Date(`${raw}T00:00:00.000Z`);
    if (
      !Number.isFinite(parsed.getTime()) ||
      parsed.toISOString().slice(0, 10) !== raw
    )
      throw new BadRequestException('تاریخ برگزاری معتبر نیست.');
  }
  if (
    value.endsOn < value.startsOn ||
    value.startsOn <
      new Intl.DateTimeFormat('en-CA', {
        timeZone: 'Asia/Tehran',
        year: 'numeric',
        month: '2-digit',
        day: '2-digit',
      }).format(now)
  )
    throw new BadRequestException(
      'بازه برگزاری باید در آینده و پایان آن پس از شروع باشد.',
    );
  return value;
}
