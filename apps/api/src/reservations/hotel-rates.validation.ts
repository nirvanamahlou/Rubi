import { BadRequestException } from '@nestjs/common';
import Joi from 'joi';
import { Prisma } from '@rubi/database';

export const roomKinds = [
  'double',
  'single',
  'triple',
  'doubleChild',
  'doubleTwoChildren',
  'family',
] as const;
export type RoomKind = (typeof roomKinds)[number];
export interface RateBatchInput {
  branchId: string;
  checkIn: string;
  checkOut: string;
  currency: 'EUR' | 'USD' | 'IRR';
  method: 'CHECK_IN' | 'STAY';
  rows: {
    hotelId: string;
    brokerId: string;
    base: string;
    factors: Record<RoomKind, string>;
  }[];
}
const money = Joi.string()
  .pattern(/^\d{1,12}(\.\d{1,2})?$/)
  .required();
const factor = Joi.string()
  .pattern(/^\d{1,3}(\.\d{1,3})?$/)
  .required();
const schema = Joi.object({
  branchId: Joi.string().uuid().required(),
  checkIn: Joi.string()
    .pattern(/^\d{4}-\d{2}-\d{2}$/)
    .required(),
  checkOut: Joi.string()
    .pattern(/^\d{4}-\d{2}-\d{2}$/)
    .required(),
  currency: Joi.string().valid('EUR', 'USD', 'IRR').required(),
  method: Joi.string().valid('CHECK_IN', 'STAY').required(),
  rows: Joi.array()
    .min(1)
    .max(50)
    .items(
      Joi.object({
        hotelId: Joi.string().uuid().required(),
        brokerId: Joi.string().uuid().required(),
        base: money,
        factors: Joi.object(
          Object.fromEntries(roomKinds.map((k) => [k, factor])),
        ).required(),
      }),
    )
    .required(),
});
export function validateRateBatch(raw: unknown): RateBatchInput {
  const { error, value } = schema.validate(raw, { convert: false });
  if (error)
    throw new BadRequestException(
      'هتل، کارگزار، تاریخ و نرخ تمام ردیف‌ها را کامل و معتبر وارد کنید.',
    );
  const input = value as RateBatchInput;
  for (const date of [input.checkIn, input.checkOut]) {
    const stamp = new Date(date);
    if (
      !Number.isFinite(stamp.getTime()) ||
      stamp.toISOString().slice(0, 10) !== date
    )
      throw new BadRequestException('تاریخ نامعتبر است.');
  }
  if (input.checkOut <= input.checkIn)
    throw new BadRequestException('خروج باید بعد از ورود باشد.');
  const seen = new Set<string>();
  for (const row of input.rows) {
    const key = row.hotelId + ':' + row.brokerId;
    if (seen.has(key))
      throw new BadRequestException(
        'برای یک هتل و کارگزار در این ثبت فقط یک نرخ وارد کنید.',
      );
    seen.add(key);
    if (
      new Prisma.Decimal(row.base).lte(0) ||
      (input.currency === 'IRR' && !new Prisma.Decimal(row.base).isInteger())
    )
      throw new BadRequestException(
        'قیمت پایه باید مثبت و مبلغ ریالی عدد صحیح باشد.',
      );
  }
  return input;
}
export function roomPrices(
  base: string,
  factors: Record<RoomKind, string>,
  currency: string,
) {
  return Object.fromEntries(
    roomKinds.map((k) => [
      k,
      new Prisma.Decimal(base)
        .mul(factors[k])
        .toFixed(currency === 'IRR' ? 0 : 2, Prisma.Decimal.ROUND_HALF_UP),
    ]),
  );
}
