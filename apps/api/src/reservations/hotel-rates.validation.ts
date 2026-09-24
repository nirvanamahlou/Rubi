import { BadRequestException } from '@nestjs/common';
import Joi from 'joi';
import { Prisma } from '@nora/database';

export const roomKinds = [
  'double',
  'single',
  'triple',
  'doubleChild',
  'doubleTwoChildren',
  'family',
] as const;
export type RoomKind = (typeof roomKinds)[number];

export interface HotelRoomRateInput {
  roomTypeId: string;
  factor: string;
  maxAdults: number;
  maxChildren: number;
}

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
    currency: 'EUR' | 'USD' | 'IRR';
    factors: Record<RoomKind, string>;
  }[];
}

export interface RatePackInput {
  branchId: string;
  checkIn: string;
  checkOut: string;
  currency: 'EUR' | 'USD' | 'IRR';
  method: 'CHECK_IN' | 'STAY';
  tourDepartureId?: string;
  cityId: string;
  expectedVersion?: number;
  rows: {
    hotelId: string;
    brokerId: string;
    base: string;
    currency: 'EUR' | 'USD' | 'IRR';
    factors: Partial<Record<RoomKind, string>>;
    roomRates: HotelRoomRateInput[];
  }[];
}

const money = Joi.string()
  .pattern(/^\d{1,12}(\.\d{1,2})?$/)
  .required();
const factor = Joi.string()
  .pattern(/^\d{1,3}(\.\d{1,3})?$/)
  .required();
const common = {
  branchId: Joi.string().uuid().required(),
  checkIn: Joi.string()
    .pattern(/^\d{4}-\d{2}-\d{2}$/)
    .required(),
  checkOut: Joi.string()
    .pattern(/^\d{4}-\d{2}-\d{2}$/)
    .required(),
  currency: Joi.string().valid('EUR', 'USD', 'IRR').required(),
  method: Joi.string().valid('CHECK_IN', 'STAY').required(),
};
const legacyFactors = Joi.object(
  Object.fromEntries(roomKinds.map((kind) => [kind, factor])),
);
const legacyRow = Joi.object({
  hotelId: Joi.string().uuid().required(),
  brokerId: Joi.string().uuid().required(),
  base: money,
  currency: Joi.string().valid('EUR', 'USD', 'IRR').optional(),
  factors: legacyFactors.required(),
});
const roomRate = Joi.object({
  roomTypeId: Joi.string().uuid().required(),
  factor,
  maxAdults: Joi.number().integer().min(1).max(20).required(),
  maxChildren: Joi.number().integer().min(0).max(20).required(),
}).unknown(false);
const packRow = Joi.object({
  hotelId: Joi.string().uuid().required(),
  brokerId: Joi.string().uuid().required(),
  base: money,
  currency: Joi.string().valid('EUR', 'USD', 'IRR').optional(),
  factors: Joi.object(
    Object.fromEntries(roomKinds.map((kind) => [kind, factor.optional()])),
  ).optional(),
  roomRates: Joi.array().items(roomRate).min(1).max(30).optional(),
})
  .or('factors', 'roomRates')
  .unknown(false);
const schema = Joi.object({
  ...common,
  rows: Joi.array().min(1).max(50).items(legacyRow).required(),
});
const packSchema = Joi.object({
  ...common,
  tourDepartureId: Joi.string().uuid().optional(),
  cityId: Joi.string().uuid().required(),
  expectedVersion: Joi.number().integer().positive().optional(),
  rows: Joi.array().min(1).max(50).items(packRow).required(),
});

function assertDates(input: { checkIn: string; checkOut: string }) {
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
}

function assertMoney(rows: readonly { base: string; currency: string }[]) {
  for (const row of rows)
    if (
      new Prisma.Decimal(row.base).lte(0) ||
      (row.currency === 'IRR' && !new Prisma.Decimal(row.base).isInteger())
    )
      throw new BadRequestException(
        'قیمت پایه باید مثبت و مبلغ ریالی عدد صحیح باشد.',
      );
}

export function validateRateBatch(raw: unknown): RateBatchInput {
  const { error, value } = schema.validate(raw, { convert: false });
  if (error)
    throw new BadRequestException(
      'هتل، کارگزار، تاریخ و نرخ تمام ردیف‌ها را کامل و معتبر وارد کنید.',
    );
  const parsed = value as RateBatchInput;
  const input = {
    ...parsed,
    rows: parsed.rows.map((row) => ({
      ...row,
      currency: row.currency ?? parsed.currency,
    })),
  };
  assertDates(input);
  const seen = new Set<string>();
  for (const row of input.rows) {
    const key = `${row.hotelId}:${row.brokerId}`;
    if (seen.has(key))
      throw new BadRequestException(
        'برای یک هتل و کارگزار در این ثبت فقط یک نرخ وارد کنید.',
      );
    seen.add(key);
  }
  assertMoney(input.rows);
  return input;
}

export function validateRatePack(raw: unknown): RatePackInput {
  const { error, value } = packSchema.validate(raw, { convert: false });
  if (error)
    throw new BadRequestException(
      'شهر، بازه، نوع اتاق، ضریب و ظرفیت نرخ‌های انتخاب‌شده را کامل و معتبر وارد کنید.',
    );
  const parsed = value as Omit<RatePackInput, 'rows'> & {
    rows: (Omit<
      RatePackInput['rows'][number],
      'currency' | 'factors' | 'roomRates'
    > & {
      currency?: 'EUR' | 'USD' | 'IRR';
      factors?: Partial<Record<RoomKind, string>>;
      roomRates?: HotelRoomRateInput[];
    })[];
  };
  const input: RatePackInput = {
    ...parsed,
    rows: parsed.rows.map((row) => ({
      ...row,
      currency: row.currency ?? parsed.currency,
      factors: row.factors ?? {},
      roomRates: row.roomRates ?? [],
    })),
  };
  assertDates(input);
  assertMoney(input.rows);
  if (new Set(input.rows.map((row) => row.hotelId)).size !== input.rows.length)
    throw new BadRequestException(
      'برای هر هتل در این بازه فقط یک نرخ وارد کنید.',
    );
  for (const row of input.rows) {
    const roomIds = row.roomRates.map((room) => room.roomTypeId);
    if (new Set(roomIds).size !== roomIds.length)
      throw new BadRequestException(
        'هر نوع اتاق برای یک هتل فقط یک‌بار قابل ثبت است.',
      );
    for (const room of row.roomRates)
      if (new Prisma.Decimal(room.factor).lte(0))
        throw new BadRequestException('ضریب نوع اتاق باید مثبت باشد.');
  }
  return input;
}

export function roomPrices(
  base: string,
  factors: Partial<Record<RoomKind, string>>,
  currency: string,
) {
  return Object.fromEntries(
    roomKinds.map((kind) => {
      const value = factors[kind];
      return [
        kind,
        value
          ? new Prisma.Decimal(base)
              .mul(value)
              .toFixed(currency === 'IRR' ? 0 : 2, Prisma.Decimal.ROUND_HALF_UP)
          : null,
      ];
    }),
  );
}
