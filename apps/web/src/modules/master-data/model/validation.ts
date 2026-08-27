import { z } from 'zod';

import { getMasterDataDefinition, type MasterDataResourceKey } from './catalog';

const draftValuesSchema = z.record(
  z.string(),
  z.string().trim().max(200, 'حداکثر طول مجاز ۲۰۰ نویسه است.'),
);
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

  if (resource === 'countries' && values.iso2Code) {
    values.iso2Code = values.iso2Code.toUpperCase();
    if (!/^[A-Z]{2}$/.test(values.iso2Code))
      errors.iso2Code = 'کد ISO-2 باید دو حرف بزرگ باشد.';
  }

  if (resource === 'regions' && values.type) {
    if (!['PROVINCE', 'STATE', 'REGION', 'TERRITORY'].includes(values.type))
      errors.type = 'نوع استان/ناحیه معتبر نیست.';
  }

  if (resource === 'airports') {
    for (const [field, pattern, message] of [
      ['iataCode', /^[A-Z]{3}$/, 'کد IATA باید سه حرف بزرگ باشد.'],
      ['icaoCode', /^[A-Z]{4}$/, 'کد ICAO باید چهار حرف بزرگ باشد.'],
    ] as const) {
      if (!values[field]) continue;
      values[field] = values[field].toUpperCase();
      if (!pattern.test(values[field])) errors[field] = message;
    }
    if (values.ianaTimezone) {
      try {
        new Intl.DateTimeFormat('en-US', {
          timeZone: values.ianaTimezone,
        }).format();
      } catch {
        errors.ianaTimezone = 'Timezone باید شناسه معتبر IANA باشد.';
      }
    }
    for (const [field, minimum, maximum] of [
      ['latitude', -90, 90],
      ['longitude', -180, 180],
    ] as const) {
      if (!values[field]) continue;
      const coordinate = Number(values[field]);
      if (
        !Number.isFinite(coordinate) ||
        coordinate < minimum ||
        coordinate > maximum
      )
        errors[field] = 'مختصات خارج از بازه مجاز است.';
    }
  }

  if (
    resource === 'terminals' &&
    values.terminalType &&
    !['DOMESTIC', 'INTERNATIONAL', 'VIP'].includes(values.terminalType)
  )
    errors.terminalType = 'نوع ترمینال معتبر نیست.';

  if (resource === 'hotels' && values.starRating) {
    const rating = Number(values.starRating);
    if (!Number.isInteger(rating) || rating < 1 || rating > 5) {
      errors.starRating = 'درجه هتل باید عدد صحیح بین ۱ تا ۵ باشد.';
    }
  }

  return { success: Object.keys(errors).length === 0, values, errors };
}
