import type {
  MasterCurrencyRateQuoteRequest,
  MasterDataRecord,
  MasterDataStatus,
} from '@rubi/contracts';

import { getMasterDataDefinition } from './catalog';
import { validateMasterDataDraft } from './validation';

export function currencyFormValues(
  record?: MasterDataRecord,
): Record<string, string> {
  return Object.fromEntries(
    getMasterDataDefinition('currencies').fields.map(({ key }) => [
      key,
      key === 'code'
        ? (record?.code ?? '')
        : key === 'name'
          ? (record?.name ?? '')
          : String(
              record?.attributes[key] ?? (key === 'decimalDigits' ? '2' : ''),
            ),
    ]),
  );
}

export function validateCurrencyForm(input: Record<string, string>) {
  const allowed = new Set(
    getMasterDataDefinition('currencies').fields.map(({ key }) => key),
  );
  const result = validateMasterDataDraft(
    'currencies',
    Object.fromEntries(
      Object.entries(input).filter(([key]) => allowed.has(key)),
    ),
  );
  for (const key of ['name', 'englishName'])
    if ((result.values[key]?.length ?? 0) > 160)
      result.errors[key] = 'حداکثر ۱۶۰ نویسه مجاز است.';
  if ((result.values.symbol?.length ?? 0) > 16)
    result.errors.symbol = 'نماد حداکثر ۱۶ نویسه است.';
  if (
    !/^\d$/.test(result.values.decimalDigits ?? '') ||
    Number(result.values.decimalDigits) > 6
  )
    result.errors.decimalDigits =
      'تعداد اعشار باید عدد صحیح بین صفر تا شش باشد.';
  result.success = Object.keys(result.errors).length === 0;
  return result;
}

export function validateCurrencyQuote(
  fromCurrencyCode: string,
  values: Record<string, string>,
) {
  const errors: Record<string, string> = {};
  const toCurrencyCode = (values.toCurrencyCode ?? '').trim().toUpperCase();
  if (!/^[A-Z]{3}$/.test(toCurrencyCode) || toCurrencyCode === fromCurrencyCode)
    errors.toCurrencyCode = 'ارز مقابل را متفاوت از این ارز انتخاب کنید.';
  const buyRate = values.buyRate?.trim();
  const sellRate = values.sellRate?.trim();
  if (!buyRate && !sellRate)
    errors.buyRate = 'حداقل نرخ خرید یا فروش را وارد کنید.';
  for (const [key, value] of [
    ['buyRate', buyRate],
    ['sellRate', sellRate],
  ] as const)
    if (
      value &&
      (!/^\d{1,14}(\.\d{1,10})?$/.test(value) || !/[1-9]/.test(value))
    )
      errors[key] = 'نرخ مثبت با حداکثر ۱۴ رقم صحیح و ۱۰ رقم اعشار وارد کنید.';
  const source = values.source?.trim() ?? '';
  if (!source || source.length > 160)
    errors.source = 'منبع نرخ الزامی و حداکثر ۱۶۰ نویسه است.';
  const dates: Record<string, string> = {};
  for (const key of ['observedAt', 'validFrom', 'validTo']) {
    const value = values[key];
    if (!value) {
      if (key === 'observedAt') errors[key] = 'تاریخ و ساعت الزامی است.';
      continue;
    }
    const date = new Date(value);
    if (Number.isNaN(date.getTime())) errors[key] = 'تاریخ و ساعت معتبر نیست.';
    else dates[key] = date.toISOString();
  }
  if (
    dates.validTo &&
    dates.validTo <= (dates.validFrom ?? dates.observedAt ?? '')
  )
    errors.validTo = 'پایان اعتبار باید پس از شروع اعتبار باشد.';
  const correctionReason = values.correctionReason?.trim();
  if (correctionReason && correctionReason.length > 500)
    errors.correctionReason = 'حداکثر ۵۰۰ نویسه مجاز است.';
  const input: MasterCurrencyRateQuoteRequest = {
    fromCurrencyCode,
    toCurrencyCode,
    source,
    observedAt: dates.observedAt ?? '',
    ...(buyRate ? { buyRate } : {}),
    ...(sellRate ? { sellRate } : {}),
    ...(dates.validFrom ? { validFrom: dates.validFrom } : {}),
    ...(dates.validTo ? { validTo: dates.validTo } : {}),
    ...(correctionReason ? { correctionReason } : {}),
  };
  return { success: !Object.keys(errors).length, errors, input };
}

interface CurrencyPersistence {
  create(
    resource: 'currencies',
    body: { values: Record<string, string> },
  ): Promise<{ data: MasterDataRecord }>;
  update(
    resource: 'currencies',
    id: string,
    body: { values: Record<string, string>; version: number },
  ): Promise<{ data: MasterDataRecord }>;
  setStatus(
    resource: 'currencies',
    id: string,
    status: MasterDataStatus,
    version: number,
  ): Promise<{ data: MasterDataRecord }>;
}

// Publish a successful first step before attempting status so a retry never creates a duplicate currency.
export async function persistCurrencyForm(
  api: CurrencyPersistence,
  input: {
    record?: MasterDataRecord;
    values: Record<string, string>;
    status: MasterDataStatus;
    onSaved: (record: MasterDataRecord) => void;
  },
) {
  let response = input.record
    ? await api.update('currencies', input.record.id, {
        values: input.values,
        version: input.record.version,
      })
    : await api.create('currencies', { values: input.values });
  input.onSaved(response.data);
  if (response.data.status !== input.status) {
    try {
      response = await api.setStatus(
        'currencies',
        response.data.id,
        input.status,
        response.data.version,
      );
      input.onSaved(response.data);
    } catch (error) {
      throw new Error(
        `مشخصات ارز ذخیره شد، اما وضعیت تغییر نکرد: ${error instanceof Error ? error.message : 'عملیات ناموفق بود.'}`,
      );
    }
  }
  return response.data;
}
