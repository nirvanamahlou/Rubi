import { z } from 'zod';

import { getMasterDataDefinition, type MasterDataResourceKey } from './catalog';

const draftValuesSchema = z.record(
  z.string(),
  z.string().trim().max(200, 'حداکثر طول مجاز ۲۰۰ نویسه است.'),
);
const canonicalCodePattern = /^[A-Z0-9][A-Z0-9_-]{1,31}$/;
const currencyCodePattern = /^[A-Z]{3}$/;

export interface MasterDataValidationResult {
  success: boolean;
  values: Record<string, string>;
  errors: Record<string, string>;
}

export function validateMasterDataDraft(
  resource: MasterDataResourceKey,
  input: unknown,
): MasterDataValidationResult {
  const parsed = draftValuesSchema.safeParse(input);
  if (!parsed.success) {
    return {
      success: false,
      values: {},
      errors: {
        form: parsed.error.issues[0]?.message ?? 'مقادیر فرم معتبر نیستند.',
      },
    };
  }

  const definition = getMasterDataDefinition(resource);
  const values = Object.fromEntries(
    Object.entries(parsed.data).map(([key, value]) => [key, value.trim()]),
  );
  const errors: Record<string, string> = {};

  for (const field of definition.fields) {
    if (field.required && !values[field.key]) {
      errors[field.key] = `${field.label} الزامی است.`;
    }
  }

  if (values.code && !canonicalCodePattern.test(values.code)) {
    errors.code = 'کد باید انگلیسی، بزرگ و بدون فاصله باشد.';
  }

  for (const key of ['fromCurrencyCode', 'toCurrencyCode']) {
    if (values[key] && !currencyCodePattern.test(values[key])) {
      errors[key] = 'کد ارز باید سه حرف بزرگ ISO-4217 باشد.';
    }
  }

  if (
    resource === 'exchange-rates' &&
    values.fromCurrencyCode &&
    values.fromCurrencyCode === values.toCurrencyCode
  ) {
    errors.toCurrencyCode = 'ارز مبدأ و مقصد باید متفاوت باشند.';
  }

  if (resource === 'exchange-rates' && values.rate) {
    const rate = Number(values.rate);
    if (!Number.isFinite(rate) || rate <= 0) {
      errors.rate = 'نرخ باید عدد Decimal مثبت باشد.';
    }
  }

  if (resource === 'hotels' && values.starRating) {
    const rating = Number(values.starRating);
    if (!Number.isInteger(rating) || rating < 1 || rating > 5) {
      errors.starRating = 'درجه هتل باید عدد صحیح بین ۱ تا ۵ باشد.';
    }
  }

  return { success: Object.keys(errors).length === 0, values, errors };
}
