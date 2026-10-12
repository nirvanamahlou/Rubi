import {
  accountingTaxForms,
  type AccountingTaxForm,
  type AccountingTaxValues,
} from '@nora/contracts';

const listRoutes: Record<string, string> = {
  thresholds: 'tax-accounting/base-information/lists/quarterly-thresholds',
  periods: 'tax-accounting/vat/lists/tax-periods',
  aggregation: 'tax-accounting/vat/lists/aggregation-methods',
  identity: 'tax-accounting/vat/lists/taxpayer-identities',
  general: 'tax-accounting/vat/lists/general-returns',
  pollution: 'tax-accounting/vat/lists/pollution-returns',
  parties: 'tax-accounting/vat/lists/tax-parties',
  history: 'tax-accounting/vat/lists/aggregate-history',
};
export function accountingTaxRoute(route: string) {
  const form = accountingTaxForms.find(
    (item) => item.route === route || listRoutes[item.key] === route,
  );
  return form
    ? { form, list: route.includes('/lists/'), listRoute: listRoutes[form.key] }
    : undefined;
}
export function emptyTaxValues(form: AccountingTaxForm): AccountingTaxValues {
  return Object.fromEntries(
    form.fields.map((field) => [
      field.key,
      field.initial ??
        (field.kind === 'check'
          ? false
          : field.kind === 'decimal'
            ? '0'
            : field.kind === 'multi'
              ? []
              : ''),
    ]),
  );
}
export function changeTaxValue(
  form: AccountingTaxForm,
  values: AccountingTaxValues,
  key: string,
  value: string | boolean | string[],
): AccountingTaxValues {
  const next = { ...values, [key]: value };
  for (const field of form.fields) {
    if (field.dependsOn && next[field.dependsOn] !== field.dependsValue)
      next[field.key] = field.kind === 'check' ? false : '';
  }
  if (form.key === 'thresholds')
    next.decSmallDealsMergeAmount_input = thresholdProduct(
      String(next.decSmallDealsQuorum_input ?? ''),
      String(next.decSmallDealsMergeRate_input ?? ''),
    );
  return next;
}
/** Exact decimal arithmetic; never convert a monetary value through Number. */
export function thresholdProduct(amount: string, rate: string): string {
  const parse = (s: string) => {
    const text = s
      .replace(/[۰-۹]/g, (d) => String('۰۱۲۳۴۵۶۷۸۹'.indexOf(d)))
      .replace(/[٠-٩]/g, (d) => String('٠١٢٣٤٥٦٧٨٩'.indexOf(d)))
      .replace(/٫/g, '.');
    if (!/^\d{1,20}(\.\d{1,8})?$/.test(text)) return null;
    const [integer, fraction = ''] = text.split('.');
    return { units: BigInt(integer + fraction), scale: fraction.length };
  };
  const a = parse(amount),
    b = parse(rate);
  if (!a || !b) return '';
  const scale = a.scale + b.scale + 2;
  const digits = (a.units * b.units).toString().padStart(scale + 1, '0');
  const fractional = digits.slice(-scale).replace(/0+$/, '');
  return `${digits.slice(0, -scale)}${fractional ? `.${fractional}` : ''}`;
}
export const taxListKeys: Record<string, string[]> = {
  thresholds: [
    'txtTitle',
    'dpEffectiveDate_MaskedTextBox',
    'decSmallDealsQuorum_input',
  ],
  periods: [
    'txtTitle',
    'dpkStartDate_MaskedTextBox',
    'dpkEndDate_MaskedTextBox',
    'lkpGatheringType_ComboBox_Input',
  ],
  aggregation: ['numNumber', 'txtTitle', '$active'],
};
