import {
  BadRequestException,
  UnprocessableEntityException,
} from '@nestjs/common';
import { DecimalValue } from '../finance.money';
import type { AccountingAttributes, AccountingLineV1 } from '@nora/contracts';

export function invalid(message: string): never {
  throw new BadRequestException({ code: 'ACCOUNTING_INPUT_INVALID', message });
}
export function rule(message: string): never {
  throw new UnprocessableEntityException({
    code: 'ACCOUNTING_RULE_FAILED',
    message,
  });
}
export function object(value: unknown): Record<string, unknown> {
  if (!value || typeof value !== 'object' || Array.isArray(value))
    invalid('اطلاعات فرم معتبر نیست.');
  return value as Record<string, unknown>;
}
export function text(value: unknown, max = 160, required = false): string {
  if (value === null || value === undefined) value = '';
  if (
    typeof value !== 'string' ||
    value.length > max ||
    (required && value.trim().length < 1)
  )
    invalid('متن فیلد معتبر نیست.');
  return value.trim();
}
export function uuid(value: unknown, optional = false): string | null {
  if (optional && (value === '' || value === null || value === undefined))
    return null;
  if (
    typeof value !== 'string' ||
    !/^[0-9a-f]{8}-[0-9a-f]{4}-[1-5][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i.test(
      value,
    )
  )
    invalid('شناسه انتخاب معتبر نیست.');
  return value;
}
export function date(value: unknown, optional = false): string | null {
  if (optional && !value) return null;
  if (
    typeof value !== 'string' ||
    !/^\d{4}-\d{2}-\d{2}$/.test(value) ||
    !Number.isFinite(Date.parse(value)) ||
    new Date(value).toISOString().slice(0, 10) !== value
  )
    invalid('تاریخ معتبر انتخاب کنید.');
  return value;
}
export function decimal(value: unknown, optional = false): string | null {
  if (optional && (value === '' || value === null || value === undefined))
    return null;
  if (typeof value === 'string') {
    let normalized = value
      .replace(/[۰-۹]/g, (d) => String('۰۱۲۳۴۵۶۷۸۹'.indexOf(d)))
      .replace(/[٠-٩]/g, (d) => String('٠١٢٣٤٥٦٧٨٩'.indexOf(d)))
      .replace(/٫/g, '.')
      .replace(/٬/g, ',')
      .trim();
    if (normalized.includes(',')) {
      if (!/^\d{1,3}(,\d{3})+(\.\d{1,18})?$/.test(normalized))
        invalid('جداکننده‌های مبلغ معتبر نیست.');
      normalized = normalized.replaceAll(',', '');
    }
    value = normalized.replace(/^0+(?=\d)/, '');
  }
  if (
    typeof value !== 'string' ||
    !/^(0|[1-9]\d{0,19})(\.\d{1,18})?$/.test(value)
  )
    invalid('مبلغ یا نرخ باید عدد مثبت با حداکثر ۱۸ رقم اعشار باشد.');
  return DecimalValue.parse(value).toString();
}
export function attributes(value: unknown): AccountingAttributes {
  const input = value === undefined ? {} : object(value);
  if (JSON.stringify(input).length > 16000 || Object.keys(input).length > 50)
    invalid('اطلاعات تکمیلی بیش از حد مجاز است.');
  for (const [key, v] of Object.entries(input)) {
    if (
      key.length > 80 ||
      (!['string', 'boolean'].includes(typeof v) &&
        !(
          Array.isArray(v) &&
          v.length <= 100 &&
          v.every((x) => typeof x === 'string' && x.length <= 200)
        ))
    )
      invalid('اطلاعات تکمیلی معتبر نیست.');
  }
  return input as AccountingAttributes;
}
export function lines(value: unknown): AccountingLineV1[] {
  if (!Array.isArray(value) || value.length > 500)
    invalid('حداکثر ۵۰۰ ردیف مجاز است.');
  return value.map((raw) => {
    const v = object(raw);
    const currency = text(v.currency, 3) || null;
    if (currency && !/^[A-Z]{3}$/.test(currency)) invalid('کد ارز معتبر نیست.');
    return {
      accountId: uuid(v.accountId, true),
      detail4Id: uuid(v.detail4Id, true),
      detail5Id: uuid(v.detail5Id, true),
      detail6Id: uuid(v.detail6Id, true),
      description: text(v.description, 2000),
      debit: decimal(v.debit === '' ? '0' : (v.debit ?? '0'))!,
      credit: decimal(v.credit === '' ? '0' : (v.credit ?? '0'))!,
      fxSnapshotId: uuid(v.fxSnapshotId, true),
      currency,
      foreignAmount: decimal(v.foreignAmount, true),
      rate: decimal(v.rate, true),
      attributes: attributes(v.attributes),
    };
  });
}
export function totals(
  rows: readonly Pick<AccountingLineV1, 'debit' | 'credit'>[],
) {
  let debit = DecimalValue.zero(),
    credit = DecimalValue.zero();
  for (const row of rows) {
    debit = debit.add(DecimalValue.parse(row.debit));
    credit = credit.add(DecimalValue.parse(row.credit));
  }
  return {
    debit: debit.toString(),
    credit: credit.toString(),
    balanced: debit.compare(credit) === 0 && !debit.isZero,
  };
}
