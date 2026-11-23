import { BadRequestException, NotFoundException } from '@nestjs/common';
import { Prisma } from '@nora/database';
import {
  floatingTourPeriodKey,
  type FloatingTourSaleSet,
  type FloatingTourPeriodChangeV1,
} from '@nora/contracts';
import * as Joi from 'joi';

const amount = Joi.string().pattern(/^\d{1,15}(?:\.\d{1,4})?$/);
const currency = Joi.string().valid('IRR', 'USD', 'EUR', 'TRY');
const money = Joi.object({
  amount: amount.required(),
  currency: currency.required(),
});
const schema = Joi.object({
  expectedVersion: Joi.number().integer().min(1).required(),
  periodKey: Joi.string().max(160).required(),
  action: Joi.string()
    .valid('STOP', 'RESUME', 'DELETE', 'ADJUST', 'EDIT')
    .required(),
  adjustment: Joi.object({
    mode: Joi.string().valid('PERCENT', 'FIXED').required(),
    direction: Joi.string().valid('INCREASE', 'DECREASE').required(),
    amount: amount.required(),
    currency: currency.when('mode', { is: 'FIXED', then: Joi.required() }),
  }).when('action', {
    is: 'ADJUST',
    then: Joi.required(),
    otherwise: Joi.forbidden(),
  }),
  rows: Joi.array()
    .min(1)
    .max(10000)
    .unique('index')
    .items(
      Joi.object({
        index: Joi.number().integer().min(0).required(),
        prices: Joi.object(
          Object.fromEntries(
            [
              'double',
              'single',
              'extra',
              'childBed',
              'childNoBed',
              'infant',
            ].map((key) => [
              key,
              Joi.array().max(4).unique('currency').items(money),
            ]),
          ),
        ).required(),
      }),
    )
    .when('action', {
      is: 'EDIT',
      then: Joi.required(),
      otherwise: Joi.forbidden(),
    }),
});

export function readFloatingPeriodChange(
  raw: unknown,
): FloatingTourPeriodChangeV1 {
  const result = schema.validate(raw, { convert: false, allowUnknown: false });
  if (result.error)
    throw new BadRequestException('تغییر بازه قیمت معتبر نیست.');
  return result.value;
}

/** Updates only the addressed period and never modifies the stored import snapshots. */
export function changeFloatingPeriod(
  current: FloatingTourSaleSet,
  command: FloatingTourPeriodChangeV1,
): FloatingTourSaleSet {
  const next = structuredClone(current);
  const monthly = command.periodKey.startsWith('monthly:');
  const rows = monthly ? next.monthly?.rows : next.dated;
  if (!rows) throw new NotFoundException('بازه قیمت پیدا نشد.');
  const matches = rows
    .map((row, index) => ({ row, index }))
    .filter(
      ({ row }) =>
        floatingTourPeriodKey(row, monthly ? next.monthly : null) ===
        command.periodKey,
    );
  if (!matches.length) throw new NotFoundException('بازه قیمت پیدا نشد.');
  const edits = new Map(command.rows?.map((edit) => [edit.index, edit.prices]));
  if (
    [...edits.keys()].some(
      (index) => !matches.some((match) => match.index === index),
    )
  )
    throw new BadRequestException('ردیف قیمت به این بازه تعلق ندارد.');
  for (const { row, index } of matches) {
    if (command.action === 'STOP' || command.action === 'RESUME')
      row.salesStopped = command.action === 'STOP';
    if (command.action === 'EDIT' && edits.has(index)) {
      const prices = edits.get(index)!;
      // Manual changes retain each group's existing currencies; no hidden FX conversion.
      for (const group of new Set([
        ...Object.keys(row.prices),
        ...Object.keys(prices),
      ])) {
        const key = group as keyof typeof prices;
        if (
          JSON.stringify(
            (row.prices[key] ?? []).map((m) => m.currency).sort(),
          ) !==
          JSON.stringify((prices[key] ?? []).map((m) => m.currency).sort())
        )
          throw new BadRequestException('ارزهای ردیف قیمت را تغییر ندهید.');
      }
      row.prices = structuredClone(prices);
    }
    if (command.action === 'ADJUST') {
      const adjustment = command.adjustment!;
      const value = new Prisma.Decimal(adjustment.amount);
      if (value.lte(0))
        throw new BadRequestException('مقدار تغییر قیمت باید مثبت باشد.');
      for (const prices of Object.values(row.prices))
        for (const price of prices ?? []) {
          if (
            adjustment.mode === 'FIXED' &&
            price.currency !== adjustment.currency
          )
            continue;
          const before = new Prisma.Decimal(price.amount);
          const difference =
            adjustment.mode === 'PERCENT' ? before.mul(value).div(100) : value;
          const after =
            adjustment.direction === 'INCREASE'
              ? before.add(difference)
              : before.sub(difference);
          if (after.lt(0) || after.gt('999999999999999'))
            throw new BadRequestException('قیمت جدید خارج از محدوده مجاز است.');
          price.amount = after.toFixed(4);
        }
    }
  }
  if (command.action === 'DELETE') {
    const kept = rows.filter(
      (row) =>
        floatingTourPeriodKey(row, monthly ? next.monthly : null) !==
        command.periodKey,
    );
    if (monthly)
      next.monthly = kept.length ? { ...next.monthly!, rows: kept } : null;
    else next.dated = kept;
  }
  return { ...next, version: current.version + 1 };
}
