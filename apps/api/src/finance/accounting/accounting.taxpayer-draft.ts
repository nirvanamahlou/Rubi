import { taxpayerPages, type TaxpayerDraftKind } from '@nora/contracts';
import * as v from './accounting.validation';

export const taxpayerDraftRoutes = {
  settings: 'taxpayer-system/settings',
  cancellations: 'taxpayer-system/cancellation-invoice',
  schedules: 'taxpayer-system/operations/batch-schedules',
} as const;
export function draftKind(value: string): TaxpayerDraftKind {
  if (!Object.hasOwn(taxpayerDraftRoutes, value))
    v.invalid('نوع پیش‌نویس معتبر نیست.');
  return value as TaxpayerDraftKind;
}
/** Source field whitelist; secrets never reach persistence, receipts or logs. */
export function taxpayerDraftValues(
  kind: TaxpayerDraftKind,
  input: unknown,
  allowSecrets = false,
) {
  const raw = v.object(input);
  const page = taxpayerPages.find(
    (p) => p.route === taxpayerDraftRoutes[kind],
  )!;
  if (
    Object.keys(raw).some(
      (key) => !page.fields.some((field) => field.id === key),
    )
  )
    v.invalid('فیلد ناشناخته مودیان مجاز نیست.');
  const values: Record<string, string | boolean> = {};
  for (const field of page.fields) {
    const value = raw[field.id];
    if (field.sensitive && allowSecrets) continue;
    if (
      kind === 'schedules' &&
      [
        'lkpActionType_ComboBox_Input',
        'lkpTaxPayerBillType_ComboBox_Input',
        'lkpTaxPayerBillPattern_ComboBox_Input',
      ].includes(field.id) &&
      (!raw.lkpOperatins_ComboBox_Input ||
        raw.lkpOperatins_ComboBox_Input === 'جمع آوری داده')
    ) {
      if (value !== undefined && value !== '')
        v.invalid('فیلتر صورتحساب برای جمع‌آوری داده غیرفعال است.');
      continue;
    }
    if (field.sensitive || field.readOnly || field.disabled) {
      if (value !== undefined && value !== '' && value !== false)
        v.invalid('ورودی محرمانه یا محاسبه‌شده در پیش‌نویس عمومی مجاز نیست.');
      continue;
    }
    if (field.when && raw[field.when.field] !== field.when.value) {
      if (value !== undefined && value !== '' && value !== false)
        v.invalid('فیلد غیرفعال نباید مقدار داشته باشد.');
      continue;
    }
    if (field.type === 'checkbox') {
      if (value !== undefined && typeof value !== 'boolean')
        v.invalid('مقدار گزینه معتبر نیست.');
      values[field.id] = value === true;
    } else if (field.type === 'date')
      values[field.id] = v.date(value, !field.required) ?? '';
    else {
      const text = v.text(value, 160, field.required);
      if (field.options && text && !field.options.includes(text))
        v.invalid('گزینه انتخاب‌شده معتبر نیست.');
      if (
        field.type === 'time' &&
        text &&
        !/^([01]\d|2[0-3]):[0-5]\d$/.test(text)
      )
        v.invalid('زمان اجرا معتبر نیست.');
      values[field.id] = text;
    }
  }
  if (kind === 'schedules') {
    const interval = values.txtOperationExecutionInterval;
    if (
      interval &&
      (typeof interval !== 'string' || !/^[1-9]\d{0,3}$/.test(interval))
    )
      v.invalid('فاصله اجرا باید تعداد روز مثبت باشد.');
  }
  if (
    kind === 'cancellations' &&
    String(values.dpCancellationDate_MaskedTextBox) <
      String(values.dpReferenceDate_MaskedTextBox)
  )
    v.invalid('تاریخ ابطال نمی‌تواند قبل از تاریخ مرجع باشد.');
  if (kind === 'settings' && values.txtIndirectServiceAddress) {
    try {
      const address = new URL(String(values.txtIndirectServiceAddress));
      if (
        address.protocol !== 'https:' ||
        address.username ||
        address.password ||
        address.hash ||
        address.search
      )
        v.invalid('نشانی سرویس باید HTTPS و فاقد اطلاعات ورود باشد.');
    } catch {
      v.invalid('نشانی سرویس باید HTTPS و فاقد اطلاعات ورود باشد.');
    }
  }
  return values;
}
