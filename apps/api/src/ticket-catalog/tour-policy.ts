import { BadRequestException } from '@nestjs/common';
import * as Joi from 'joi';
import type { TourDepartureInputV1, TourPackageInputV1 } from '@rubi/contracts';

const id = Joi.string().guid();
const date = Joi.string().pattern(/^\d{4}-\d{2}-\d{2}$/);
const packageSchema = Joi.object({
  name: Joi.string().trim().min(2).max(160).required(),
  originId: id.required(),
  destinationId: id.invalid(Joi.ref('originId')).required(),
  hotelIds: Joi.array().items(id).unique().max(30).required(),
  insuranceId: id,
  transferOutbound: Joi.boolean().required(),
  transferReturn: Joi.boolean().required(),
  visa: Joi.boolean().required(),
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
  if (result.error)
    throw new BadRequestException('نام، مسیر و خدمات تور را بررسی کنید.');
  return result.value as TourPackageInputV1;
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
