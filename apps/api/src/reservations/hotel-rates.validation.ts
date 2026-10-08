import { BadRequestException } from '@nestjs/common';
import Joi from 'joi';
import { Prisma } from '@nora/database';
import {
  calculateManualHotelPrices,
  type HotelOccupancyRateV1,
} from '@nora/contracts';

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
  occupancyRates?: HotelOccupancyRateV1[];
  roomTypeId: string;
  factor: string;
  maxAdults: number;
  maxChildren: number;
  maxChildren2To6: number;
  maxChildren6To12: number;
  maxInfants: number;
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
  occupancyRates: Joi.array()
    .min(1)
    .max(2000)
    .items(
      Joi.object({
        saleAmount: money.optional(),
        manualPricing: Joi.object({
          baseAmount: money,
          coefficient: factor,
          adjustment: Joi.object({
            kind: Joi.string().valid('AMOUNT', 'PERCENT', 'SET').required(),
            value: Joi.string()
              .pattern(/^-?\d{1,12}(\.\d{1,2})?$/)
              .required(),
          })
            .unknown(false)
            .required(),
        })
          .unknown(false)
          .optional(),
        adults: Joi.number().integer().min(1).max(20).required(),
        childAges: Joi.array()
          .max(10)
          .items(
            Joi.object({
              min: Joi.number().min(0).max(17.99).required(),
              maxExclusive: Joi.number()
                .greater(Joi.ref('min'))
                .max(18)
                .required(),
            }).unknown(false),
          )
          .required(),
        startsOn: Joi.string()
          .pattern(/^\d{4}-\d{2}-\d{2}$/)
          .required(),
        endsOnExclusive: Joi.string()
          .pattern(/^\d{4}-\d{2}-\d{2}$/)
          .required(),
        amount: Joi.string()
          .pattern(/^\d{1,12}(\.\d{1,12})?$/)
          .required(),
        currencyCode: Joi.string()
          .valid('EUR', 'USD', 'IRR', 'TRY', 'AED', 'GBP')
          .required(),
        composition: Joi.string().max(300).required(),
        board: Joi.string().allow('').max(100).required(),
      }).unknown(false),
    )
    .optional(),
  roomTypeId: Joi.string().uuid().required(),
  factor,
  maxAdults: Joi.number().integer().min(1).max(20).required(),
  maxChildren: Joi.number().integer().min(0).max(20).optional(),
  maxChildren2To6: Joi.number().integer().min(0).max(20).optional(),
  maxChildren6To12: Joi.number().integer().min(0).max(20).optional(),
  maxInfants: Joi.number().integer().min(0).max(20).optional(),
})
  .or('maxChildren', 'maxChildren2To6', 'maxChildren6To12', 'maxInfants')
  .unknown(false);
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
      roomRates: (row.roomRates ?? []).map((room) => {
        // A legacy payload only has the aggregate child capacity. Preserve it
        // safely as the younger band until the rate is edited with age bands.
        const maxChildren2To6 = room.maxChildren2To6 ?? room.maxChildren ?? 0;
        const maxChildren6To12 = room.maxChildren6To12 ?? 0;
        return {
          ...room,
          maxChildren: maxChildren2To6 + maxChildren6To12,
          maxChildren2To6,
          maxChildren6To12,
          maxInfants: room.maxInfants ?? 0,
        };
      }),
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
    const manualCoefficients = new Map<string, string>();
    if (new Set(roomIds).size !== roomIds.length)
      throw new BadRequestException(
        'هر نوع اتاق برای یک هتل فقط یک‌بار قابل ثبت است.',
      );
    for (const room of row.roomRates) {
      const tariffs = room.occupancyRates ?? [];
      let manualBase: string | undefined;
      const shape = (rate: HotelOccupancyRateV1) =>
        JSON.stringify([
          rate.adults,
          rate.childAges
            .map((a) => [a.min, a.maxExclusive])
            .sort((a, b) => a[0]! - b[0]! || a[1]! - b[1]!),
          rate.board,
        ]);
      tariffs.forEach((rate, index) => {
        if (
          tariffs
            .slice(0, index)
            .some(
              (previous) =>
                shape(previous) === shape(rate) &&
                previous.startsOn < rate.endsOnExclusive &&
                rate.startsOn < previous.endsOnExclusive &&
                (!new Prisma.Decimal(previous.amount).equals(rate.amount) ||
                  !new Prisma.Decimal(
                    previous.saleAmount ?? previous.amount,
                  ).equals(rate.saleAmount ?? rate.amount)),
            )
        )
          throw new BadRequestException(
            `نرخ‌های هم‌پوشان و متفاوت برای ترکیب ${rate.composition} وجود دارد؛ تاریخ یا قیمت را اصلاح کنید.`,
          );
      });
      if (room.occupancyRates && input.tourDepartureId)
        throw new BadRequestException(
          'نرخ ترکیبی فعلاً فقط برای بسته مستقل هتل است، نه قیمت‌گذاری تور.',
        );
      if (new Set(room.occupancyRates?.map((rate) => rate.board)).size > 1)
        throw new BadRequestException(
          'برای هر نوع اتاق یک بورد مشخص انتخاب کنید.',
        );
      for (const tariff of room.occupancyRates ?? []) {
        if (tariff.manualPricing) {
          const composition = JSON.stringify([
            tariff.adults,
            tariff.childAges
              .map((a) => [a.min, a.maxExclusive])
              .sort((a, b) => a[0]! - b[0]! || a[1]! - b[1]!),
          ]);
          const previousCoefficient = manualCoefficients.get(composition);
          if (
            (manualBase !== undefined &&
              !new Prisma.Decimal(manualBase).equals(
                tariff.manualPricing.baseAmount,
              )) ||
            (previousCoefficient !== undefined &&
              !new Prisma.Decimal(previousCoefficient).equals(
                tariff.manualPricing.coefficient,
              ))
          ) {
            throw new BadRequestException(
              'قیمت پایهٔ هر اتاق و ضریب هر ترکیب باید در جدول هتل یکسان باشد.',
            );
          }
          manualBase = tariff.manualPricing.baseAmount;
          manualCoefficients.set(composition, tariff.manualPricing.coefficient);
          const expected = calculateManualHotelPrices(
            tariff.manualPricing.baseAmount,
            tariff.manualPricing.coefficient,
            tariff.currencyCode,
            tariff.manualPricing.adjustment,
          );
          if (
            !expected ||
            !tariff.saleAmount ||
            !new Prisma.Decimal(expected.purchase).equals(tariff.amount) ||
            !new Prisma.Decimal(expected.sale).equals(tariff.saleAmount) ||
            tariff.childAges.some(
              (age) =>
                age.maxExclusive > 15 ||
                !Number.isInteger(age.min) ||
                !Number.isInteger(age.maxExclusive),
            ) ||
            tariff.startsOn !== input.checkIn ||
            tariff.endsOnExclusive !== input.checkOut
          )
            throw new BadRequestException(
              'قیمت خرید و فروش با قیمت پایه و ضریب ترکیب هماهنگ نیست.',
            );
        } else if (tariff.saleAmount !== undefined) {
          throw new BadRequestException(
            'قیمت فروش مستقل باید همراه ضریب و قیمت پایه ثبت شود.',
          );
        }
        assertDates({
          checkIn: tariff.startsOn,
          checkOut: tariff.endsOnExclusive,
        });
        if (
          new Prisma.Decimal(tariff.amount).lt(0) ||
          (tariff.currencyCode === 'IRR' &&
            !new Prisma.Decimal(tariff.amount).isInteger())
        )
          throw new BadRequestException('نرخ ترکیب اتاق نامعتبر است.');
        if (
          tariff.startsOn < input.checkIn ||
          tariff.endsOnExclusive > input.checkOut ||
          tariff.currencyCode !== row.currency
        )
          throw new BadRequestException(
            'تاریخ و ارز نرخ ترکیب باید داخل بستهٔ انتخاب‌شده باشد.',
          );
      }
      if (new Prisma.Decimal(room.factor).lte(0))
        throw new BadRequestException('ضریب نوع اتاق باید مثبت باشد.');
    }
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
