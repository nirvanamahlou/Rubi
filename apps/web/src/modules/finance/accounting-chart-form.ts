import type {
  AccountingAccountV1,
  AccountingAttributes,
} from '@nora/contracts';

export const accountTypeOptions = [
  ['PERMANENT', 'دائم'],
  ['TEMPORARY', 'موقت'],
  ['MEMORANDUM', 'انتظامی'],
] as const;
export const accountNatureOptions = [
  ['ANY', 'مهم نیست'],
  ['DEBIT', 'بدهکار'],
  ['CREDIT', 'بستانکار'],
] as const;
export const natureControlOptions = [
  ['NONE', 'بدون کنترل'],
  ['ACCOUNT', 'معین'],
  ['ALL_DETAILS', 'معین و تمام سطوح تفصیلی'],
  ['SELECTED_DETAIL', 'معین و تفصیل انتخابی'],
] as const;
export const taxTypeOptions = [
  'مالیات بر ارزش افزوده پرداختنی',
  'عوارض پرداختنی',
  'پیش پرداخت مالیات بر ارزش افزوده',
  'پیش پرداخت عوارض',
  'مالیات تکلیفی',
];
export const subsidiaryTabs = [
  'سطوح تفصیلی',
  'طرف مقابل',
  'تعیین ویژگی مالیاتی',
  'شرح های پیش فرض',
] as const;
export type ChartDraft = {
  code: string;
  title: string;
  titleEn: string;
  description: string;
  level: AccountingAccountV1['level'];
  parentId: string;
  nature: AccountingAccountV1['nature'];
  active: boolean;
  attributes: AccountingAttributes;
};
export const chartDetailLevels = [4, 5, 6] as const;
export type ChartDetailLevel = (typeof chartDetailLevels)[number];
export const chartDetailLevelTitles = {
  4: 'سطح چهار',
  5: 'سطح پنج',
  6: 'سطح شش',
} as const;

export function detailTypeIds(
  attributes: AccountingAttributes,
  level: ChartDetailLevel,
): string[] {
  const ids = attributes[`detail${level}TypeIds`];
  if (Array.isArray(ids)) return ids;
  const legacy = attributes[`detail${level}TypeId`];
  return legacy ? [String(legacy)] : [];
}

export function enableChartDetailLevel(
  attributes: AccountingAttributes,
  level: ChartDetailLevel,
): AccountingAttributes {
  // Older imports captured only enabled rows. Editing a newly visible level
  // must also make it available to the existing detail-allocation API.
  if (!Array.isArray(attributes.detailLevels)) return attributes;
  return {
    ...attributes,
    detailLevels: [
      ...new Set([...attributes.detailLevels, String(level)]),
    ].sort(),
  };
}

export function changeDetailType(
  attributes: AccountingAttributes,
  level: ChartDetailLevel,
  id: string,
  checked: boolean,
): AccountingAttributes {
  const selected = detailTypeIds(attributes, level);
  const ids = checked
    ? [...new Set([...selected, id])]
    : selected.filter((value) => value !== id);
  const next = {
    ...(checked ? enableChartDetailLevel(attributes, level) : attributes),
    [`detail${level}TypeIds`]: ids,
  };
  delete next[`detail${level}TypeId`];
  const controlled = next[`detail${level}NatureTypeIds`];
  if (Array.isArray(controlled))
    next[`detail${level}NatureTypeIds`] = controlled.filter((value) =>
      ids.includes(value),
    );
  return next;
}
export function accountToDraft(account: AccountingAccountV1): ChartDraft {
  return {
    code: account.code,
    title: account.title,
    titleEn: account.titleEn ?? '',
    description:
      account.description ?? String(account.attributes.description ?? ''),
    level: account.level,
    parentId: account.parentId ?? '',
    nature: account.nature,
    active: account.active,
    attributes: {
      ...account.attributes,
      accountType:
        account.attributes.accountType ??
        (account.permanent ? 'PERMANENT' : 'TEMPORARY'),
      natureControlScope:
        account.attributes.natureControlScope ??
        (account.attributes.natureControl &&
        account.attributes.natureControl !== 'NONE'
          ? 'ACCOUNT'
          : 'NONE'),
    },
  };
}
export function chartPayload(draft: ChartDraft, id?: string) {
  const attributes = { ...draft.attributes };
  // Keep a legacy warning policy when an existing record is opened and saved.
  attributes.natureControl =
    attributes.natureControlScope === 'NONE'
      ? 'NONE'
      : attributes.natureControl === 'WARN'
        ? 'WARN'
        : 'BLOCK';
  if (attributes.multiCurrency !== true) attributes.revaluable = false;
  for (const n of [4, 5, 6]) {
    const ids = attributes[`detail${n}TypeIds`];
    if (Array.isArray(ids)) {
      delete attributes[`detail${n}TypeId`];
      const controlled = attributes[`detail${n}NatureTypeIds`];
      if (Array.isArray(controlled))
        attributes[`detail${n}NatureTypeIds`] = controlled.filter((id) =>
          ids.includes(id),
        );
    }
  }
  return {
    ...draft,
    ...(id ? { id } : {}),
    attributes,
    permanent: attributes.accountType !== 'TEMPORARY',
  };
}
export function descriptionRows(
  attributes: AccountingAttributes,
): { text: string; textEn: string }[] {
  try {
    const rows: unknown = JSON.parse(
      String(attributes.defaultDescriptions ?? '[]'),
    );
    return Array.isArray(rows)
      ? rows.filter(
          (row): row is { text: string; textEn: string } =>
            !!row &&
            typeof row.text === 'string' &&
            typeof row.textEn === 'string',
        )
      : [];
  } catch {
    return [];
  }
}
