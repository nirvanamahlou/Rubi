import type { AccountingAttributes } from '@nora/contracts';
import * as v from './accounting.validation';

const choices: Record<string, string[]> = {
  accountType: ['PERMANENT', 'TEMPORARY', 'MEMORANDUM'],
  natureControlScope: ['NONE', 'ACCOUNT', 'ALL_DETAILS', 'SELECTED_DETAIL'],
  taxAccountKind: ['TAX', 'TAXABLE'],
  taxType: [
    'مالیات بر ارزش افزوده پرداختنی',
    'عوارض پرداختنی',
    'پیش پرداخت مالیات بر ارزش افزوده',
    'پیش پرداخت عوارض',
    'مالیات تکلیفی',
  ],
  taxItemOrService: ['کالا', 'خدمت'],
  taxPurchaseOrSale: ['خرید', 'فروش'],
  taxState: ['مشمول', 'معاف'],
  taxTransactionType: ['داخلی', 'خارجی'],
};
export function validateAccountForm(
  attrs: AccountingAttributes,
  permanent: boolean,
) {
  for (const [key, allowed] of Object.entries(choices))
    if (attrs[key] && !allowed.includes(String(attrs[key])))
      v.invalid('گزینه فرم حساب معتبر نیست.');
  if (attrs.accountType && (attrs.accountType !== 'TEMPORARY') !== permanent)
    v.invalid('نوع حساب و دائمی بودن آن سازگار نیست.');
  if (attrs.taxAccountKind === 'TAX' && !attrs.taxType)
    v.invalid('نوع مالیاتی را انتخاب کنید.');
  if (
    attrs.natureControlScope &&
    (attrs.natureControlScope === 'NONE') !==
      (!attrs.natureControl || attrs.natureControl === 'NONE')
  )
    v.invalid('محدوده کنترل ماهیت با سیاست کنترل سازگار نیست.');
  if (
    attrs.detailLevels &&
    (!Array.isArray(attrs.detailLevels) ||
      attrs.detailLevels.some((n) => !['4', '5', '6'].includes(n)) ||
      new Set(attrs.detailLevels).size !== attrs.detailLevels.length)
  )
    v.invalid('سطوح تفصیلی معتبر نیست.');
  for (const n of [4, 5, 6]) {
    for (const suffix of ['TypeIds', 'NatureTypeIds']) {
      const ids = attrs[`detail${n}${suffix}`];
      if (ids !== undefined) {
        if (!Array.isArray(ids)) v.invalid('انواع تفصیلی معتبر نیست.');
        for (const id of ids) v.uuid(id);
      }
    }
    const controlled = attrs[`detail${n}NatureTypeIds`] as string[] | undefined;
    const allowed =
      (attrs[`detail${n}TypeIds`] as string[] | undefined) ??
      (attrs[`detail${n}TypeId`] ? [String(attrs[`detail${n}TypeId`])] : []);
    if (controlled?.some((id) => !allowed.includes(id)))
      v.invalid('نوع تفصیلی کنترل ماهیت باید در انواع مجاز انتخاب شود.');
  }
  if (attrs.defaultDescriptions) {
    let rows: unknown;
    try {
      rows = JSON.parse(String(attrs.defaultDescriptions));
    } catch {
      v.invalid('شرح‌های پیش فرض معتبر نیست.');
    }
    if (!Array.isArray(rows) || rows.length > 100)
      v.invalid('شرح‌های پیش فرض معتبر نیست.');
    for (const row of rows) {
      const item = v.object(row);
      v.text(item.text, 2000);
      v.text(item.textEn, 2000);
    }
  }
}

/** Account balance always participates; detail scopes add cumulative level balances. */
export function accountControlFilters(
  attrs: AccountingAttributes,
  row: {
    detail4Id: string | null;
    detail5Id: string | null;
    detail6Id: string | null;
  },
  typeIds: Record<string, string>,
): Record<string, string>[] {
  const filters: Record<string, string>[] = [{}];
  const prefix: Record<string, string> = {};
  for (const n of [4, 5, 6] as const) {
    const id = row[`detail${n}Id`];
    if (!id) continue;
    prefix[`detail${n}Id`] = id;
    const selected = attrs[`detail${n}NatureTypeIds`];
    if (
      attrs.natureControlScope === 'ALL_DETAILS' ||
      (attrs.natureControlScope === 'SELECTED_DETAIL' &&
        Array.isArray(selected) &&
        selected.includes(typeIds[id] ?? ''))
    )
      filters.push({ ...prefix });
  }
  return filters;
}
