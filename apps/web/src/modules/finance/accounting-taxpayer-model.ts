import {
  taxpayerPages,
  type TaxpayerPage,
  type TaxpayerField,
} from './accounting-taxpayer-catalog';
export type TaxpayerValues = Record<string, string | boolean>;
export function taxpayerPage(route: string) {
  return taxpayerPages.find((p) => p.route === route);
}
export function initialTaxpayerValues(page: TaxpayerPage): TaxpayerValues {
  return Object.fromEntries(
    page.fields.map((f) => [
      f.id,
      f.type === 'checkbox' || f.type === 'radio' ? f.id === 'rdoDaily' : '',
    ]),
  );
}
export function visibleTaxpayerFields(
  page: TaxpayerPage,
  values: TaxpayerValues,
): TaxpayerField[] {
  return page.fields
    .filter((f) => !f.when || values[f.when.field] === f.when.value)
    .map((f) => {
      if (f.id === 'fvwMain_txtNationalID')
        return {
          ...f,
          label:
            values.fvwMain_lkpPartyType_ComboBox_Input === 'شرکت'
              ? 'شناسه ملی'
              : 'کد ملی',
          disabled:
            values.fvwMain_lkpPartyType_ComboBox_Input === 'مشارکت مدنی',
        };
      if (f.id === 'fvwMain_txtCivilParticipationID')
        return {
          ...f,
          disabled:
            values.fvwMain_lkpPartyType_ComboBox_Input !== 'مشارکت مدنی',
        };
      if (
        page.route.endsWith('operations/batch-schedules') &&
        [
          'lkpActionType_ComboBox_Input',
          'lkpTaxPayerBillType_ComboBox_Input',
          'lkpTaxPayerBillPattern_ComboBox_Input',
        ].includes(f.id)
      )
        return {
          ...f,
          disabled:
            !values.lkpOperatins_ComboBox_Input ||
            values.lkpOperatins_ComboBox_Input === 'جمع آوری داده',
        };
      return f;
    });
}
export function changeTaxpayerValue(
  page: TaxpayerPage,
  current: TaxpayerValues,
  id: string,
  value: string | boolean,
): TaxpayerValues {
  const next = { ...current, [id]: value };
  if (id === 'rdoDaily' || id === 'rdoMonthly') {
    next.rdoDaily = id === 'rdoDaily';
    next.rdoMonthly = id === 'rdoMonthly';
  }
  // Clear conditional and disabled inputs so invisible data cannot survive a mode change.
  const visible = visibleTaxpayerFields(page, next);
  for (const field of page.fields) {
    const active = visible.find((f) => f.id === field.id);
    if (!active || active.disabled)
      next[field.id] = field.type === 'checkbox' ? false : '';
  }
  return next;
}
export function publicTaxpayerDraft(
  page: TaxpayerPage,
  values: TaxpayerValues,
): TaxpayerValues {
  return Object.fromEntries(
    visibleTaxpayerFields(page, values)
      .filter((f) => !f.sensitive && !f.disabled && !f.readOnly)
      .map((f) => [f.id, values[f.id] ?? '']),
  );
}
