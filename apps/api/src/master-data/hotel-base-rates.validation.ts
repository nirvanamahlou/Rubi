import { BadRequestException } from '@nestjs/common';
import {
  MASTER_HOTEL_RATE_FACTOR_KEYS,
  type MasterHotelRateFactorsV1,
  type MasterHotelRatePeriodSaveV1,
} from '@nora/contracts';
import { Prisma } from '@nora/database';
import * as Joi from 'joi';

const uuid = Joi.string().guid({ version: ['uuidv4', 'uuidv5'] });
const decimal = Joi.string().pattern(/^(0|[1-9]\d{0,17})(\.\d{1,6})?$/);
const factorSchema = Joi.object(
  Object.fromEntries(
    MASTER_HOTEL_RATE_FACTOR_KEYS.map((key) => [key, decimal.required()]),
  ),
).required();

const schema = Joi.object({
  branchId: uuid.required(),
  cityId: uuid.required(),
  title: Joi.string().trim().min(3).max(200).required(),
  checkIn: Joi.string().pattern(/^\d{4}-\d{2}-\d{2}$/).required(),
  checkOut: Joi.string().pattern(/^\d{4}-\d{2}-\d{2}$/).required(),
  currencyCode: Joi.string().uppercase().pattern(/^[A-Z]{3}$/).required(),
  reason: Joi.string().trim().min(3).max(500).required(),
  expectedVersion: Joi.number().integer().min(1),
  rows: Joi.array()
    .min(1)
    .max(500)
    .items(
      Joi.object({
        id: Joi.string().optional(),
        hotelId: uuid.required(),
        hotelVersion: Joi.number().integer().min(1).required(),
        hotelName: Joi.string().allow('').required(),
        starRating: Joi.number().integer().min(1).max(5).allow(null).required(),
        included: Joi.boolean().required(),
        baseAmount: decimal.allow(null).required(),
        factors: factorSchema,
      }),
    )
    .required(),
});

export function hotelRateNights(checkIn: string, checkOut: string) {
  const start = Date.parse(`${checkIn}T00:00:00.000Z`);
  const end = Date.parse(`${checkOut}T00:00:00.000Z`);
  if (
    !Number.isFinite(start) ||
    !Number.isFinite(end) ||
    new Date(start).toISOString().slice(0, 10) !== checkIn ||
    new Date(end).toISOString().slice(0, 10) !== checkOut ||
    end <= start
  )
    throw new BadRequestException({ code: 'HOTEL_RATE_INVALID_PERIOD' });
  return (end - start) / 86_400_000;
}

function assertFactors(factors: MasterHotelRateFactorsV1) {
  for (const key of MASTER_HOTEL_RATE_FACTOR_KEYS) {
    const value = new Prisma.Decimal(factors[key]);
    if (value.lt(0) || value.gt(1000))
      throw new BadRequestException({ code: 'HOTEL_RATE_INVALID_FACTOR' });
  }
}

export function validateHotelRatePeriod(raw: unknown) {
  const result = schema.validate(raw, {
    abortEarly: false,
    allowUnknown: false,
    convert: false,
  });
  if (result.error)
    throw new BadRequestException({ code: 'HOTEL_RATE_VALIDATION_FAILED' });
  const input = result.value as MasterHotelRatePeriodSaveV1;
  const nights = hotelRateNights(input.checkIn, input.checkOut);
  const seen = new Set<string>();
  for (const row of input.rows) {
    if (seen.has(row.hotelId))
      throw new BadRequestException({ code: 'HOTEL_RATE_DUPLICATE_HOTEL' });
    seen.add(row.hotelId);
    assertFactors(row.factors);
    if (
      (row.included &&
        (!row.baseAmount || new Prisma.Decimal(row.baseAmount).lte(0))) ||
      (!row.included && row.baseAmount !== null)
    )
      throw new BadRequestException({ code: 'HOTEL_RATE_INVALID_AMOUNT' });
  }
  if (!input.rows.some((row) => row.included))
    throw new BadRequestException({ code: 'HOTEL_RATE_NO_INCLUDED_HOTEL' });
  return { input, nights };
}
