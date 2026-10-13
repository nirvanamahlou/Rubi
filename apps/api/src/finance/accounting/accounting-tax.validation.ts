import { accountingTaxForms, type AccountingTaxValues } from '@nora/contracts';
import { DecimalValue } from '../finance.money';
import * as v from './accounting.validation';

export function taxForm(kind: string) {
  const form = accountingTaxForms.find((item) => item.key === kind);
  if (!form?.writable)
    v.rule('ذخیره این بخش به تکمیل قرارداد اختصاصی مالیاتی وابسته است.');
  return form;
}

/** The API owns computed values and rejects fields absent from the observed form. */
export function taxValues(kind: string, input: unknown): AccountingTaxValues {
  const form = taxForm(kind);
  const raw = v.object(input);
  const allowed = new Set(form.fields.map((field) => field.key));
  if (Object.keys(raw).some((key) => !allowed.has(key)))
    v.invalid('فیلد ناشناخته مالیاتی مجاز نیست.');
  const result: AccountingTaxValues = {};
  for (const field of form.fields) {
    if (field.readOnly) continue;
    const value =
      raw[field.key] ?? field.initial ?? (field.kind === 'check' ? false : '');
    if (
      field.dependsOn &&
      (raw[field.dependsOn] ?? false) !== field.dependsValue
    ) {
      if (value !== '' && value !== false)
        v.invalid('زیرگزینه غیرفعال نباید مقدار داشته باشد.');
      result[field.key] = field.kind === 'check' ? false : '';
      continue;
    }
    if (field.kind === 'check') {
      if (typeof value !== 'boolean') v.invalid('مقدار گزینه باید منطقی باشد.');
      result[field.key] = value;
    } else if (field.kind === 'decimal') {
      result[field.key] = v.decimalAtScale(value, 8);
    } else if (field.kind === 'date') {
      result[field.key] = v.date(value, !field.required) ?? '';
    } else if (field.kind === 'lookup') {
      result[field.key] = v.uuid(value, !field.required) ?? '';
    } else {
      const text = v.text(
        value,
        field.key === 'numNumber' ? 40 : 160,
        field.required,
      );
      if (field.options && text && !field.options.includes(text))
        v.invalid('گزینه انتخاب‌شده معتبر نیست.');
      result[field.key] = text;
    }
  }
  if (kind === 'thresholds') {
    const rate = DecimalValue.parse(
      result.decSmallDealsMergeRate_input as string,
    );
    if (rate.compare(DecimalValue.parse('100')) > 0)
      v.invalid('درصد نمی‌تواند بیشتر از صد باشد.');
    result.decSmallDealsMergeAmount_input = DecimalValue.parse(
      result.decSmallDealsQuorum_input as string,
    )
      .multiply(rate)
      .multiply(DecimalValue.parse('0.01'))
      .toString();
  }
  if (kind === 'periods') {
    if (
      String(result.dpkEndDate_MaskedTextBox) <
      String(result.dpkStartDate_MaskedTextBox)
    )
      v.invalid('تاریخ پایان نباید قبل از تاریخ شروع باشد.');
    if (
      result.lkpGatheringType_ComboBox_Input === 'تجمیعی' &&
      !result.sltMergePattern_Input
    )
      v.invalid('روش تجمیع اطلاعات را انتخاب کنید.');
  }
  return result;
}
