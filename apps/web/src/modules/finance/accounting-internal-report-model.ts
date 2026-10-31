import type { AccountingParityField } from './components/accounting-parity-definitions';
export const internalAccountingReportKinds = [
  'legal-ledgers',
  'ledgers',
  'aging',
  'analysis',
  'comprehensive',
  'matrix',
] as const;
export type InternalAccountingReportKind =
  (typeof internalAccountingReportKinds)[number];
export function internalAccountingReportKind(route: string) {
  return internalAccountingReportKinds.find(
    (kind) => route === `general-ledger/reports/${kind}`,
  );
}
export const internalReportAxes = [
  { value: 'account', label: 'حساب' },
  { value: 'detail4', label: 'تفصیلی سطح ۴' },
  { value: 'detail5', label: 'تفصیلی سطح ۵' },
  { value: 'detail6', label: 'تفصیلی سطح ۶' },
  { value: 'month', label: 'ماه' },
  { value: 'currency', label: 'ارز' },
];
export function internalReportFieldKey(
  field: AccountingParityField,
  kind: InternalAccountingReportKind,
) {
  const id = field.sourceControlId ?? '';
  if (/FromFiscalYear/.test(id)) return 'periodId';
  if (/ToFiscalYear/.test(id)) return 'toPeriodId';
  if (/FromDate/.test(id)) return 'from';
  if (/ToDate/.test(id)) return 'to';
  if (['cboVoucherType_Input', 'cmbVoucherType_Input'].includes(id))
    return 'typeId';
  if (id === 'numtxtFromNumber') return 'fromNumber';
  if (id === 'numtxtToNumber') return 'toNumber';
  if (
    id === 'sltSLSelector_Input' ||
    (kind === 'legal-ledgers' && id === 'cboType_Input')
  )
    return 'accountId';
  if (id === 'sltDL_Input') return 'detailId';
  if (id === 'cboDLType_Input') return 'detailTypeId';
  if (id === 'cboRow_Input') return 'rowAxis';
  if (id === 'cboColumn_Input') return 'columnAxis';
  if (id === 'lkpAnalyseType_ComboBox_Input') return 'axes';
  // Source report/account specification is not an account group. Keep it
  // unsupported until its currency presentation semantics are implemented.
  return (
    {
      chkSLWithNoDL: 'noDetails',
      chkShowNonActiveSLs: 'includeInactive',
      chkIsTraceable: 'traceableOnly',
      chkRemainingFromInitialFiscalYear: 'includeOpening',
      chkNoneNatureSL: 'includeAnyNature',
    } as Record<string, string>
  )[id];
}
export function internalReportQuery(
  values: Record<string, string | boolean>,
  kind: InternalAccountingReportKind,
) {
  const query: Record<string, string> = {};
  for (const [key, value] of Object.entries(values))
    if (
      value !== '' &&
      ![
        'rowAxis',
        'columnAxis',
        'axes',
        'printSeparate',
        'includeInactive',
      ].includes(key)
    )
      query[key] = String(value);
  if (values.includeInactive !== undefined)
    query.activeOnly = String(!values.includeInactive);
  query.axes =
    kind === 'matrix'
      ? `${values.rowAxis || 'account'},${values.columnAxis || 'month'}`
      : String(values.axes || 'account');
  if (query.fromNumber)
    query.fromNumber = query.fromNumber.replace(/[۰-۹]/g, (d) =>
      String('۰۱۲۳۴۵۶۷۸۹'.indexOf(d)),
    );
  if (query.toNumber)
    query.toNumber = query.toNumber.replace(/[۰-۹]/g, (d) =>
      String('۰۱۲۳۴۵۶۷۸۹'.indexOf(d)),
    );
  return query;
}
/** Matrix totals stay decimal strings; floating point is never used. */
export function sumReportValues(values: string[]) {
  let coefficient = 0n,
    scale = 0;
  for (const value of values) {
    if (!/^-?\d+(\.\d{1,18})?$/.test(value))
      throw new Error('مبلغ گزارش معتبر نیست.');
    const negative = value.startsWith('-'),
      [integer, fraction = ''] = value.replace(/^-/, '').split('.');
    const nextScale = Math.max(scale, fraction.length);
    coefficient =
      coefficient * 10n ** BigInt(nextScale - scale) +
      (negative ? -1n : 1n) *
        BigInt(integer! + fraction) *
        10n ** BigInt(nextScale - fraction.length);
    scale = nextScale;
  }
  const sign = coefficient < 0n ? '-' : '',
    digits = (coefficient < 0n ? -coefficient : coefficient)
      .toString()
      .padStart(scale + 1, '0');
  if (!scale) return sign + digits;
  const tail = digits.slice(-scale).replace(/0+$/, '');
  return sign + digits.slice(0, -scale) + (tail ? `.${tail}` : '');
}
