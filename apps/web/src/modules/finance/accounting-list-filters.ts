import type { AccountingBookV1, AccountingSnapshotV1 } from '@nora/contracts';

export type AccountingListKind =
  'fiscal-years' | 'ledgers' | 'voucher-types' | 'coding-standards';
export type FilterMode = 'all' | 'any' | 'not-all' | 'none';
export type FilterOperator =
  | 'contains'
  | 'not-contains'
  | 'equals'
  | 'not-equals'
  | 'starts'
  | 'empty'
  | 'not-empty'
  | 'before'
  | 'after';
export type FilterRule = {
  type: 'rule';
  id: string;
  field: string;
  operator: FilterOperator;
  value: string;
  relationMode: FilterMode;
};
export type FilterGroup = {
  type: 'group';
  id: string;
  mode: FilterMode;
  children: FilterNode[];
  scope?: 'allocations';
  relationMode?: FilterMode;
};
export type FilterNode = FilterRule | FilterGroup;
export type ListField = {
  key: string;
  label: string;
  type: 'text' | 'boolean' | 'date';
  relation?: boolean;
};
export type ListRecord = {
  id: string;
  nullFields?: string[];
  values: Record<string, string>;
  allocations: Record<string, string>[];
};
export const filterModes: { value: FilterMode; label: string }[] = [
  { value: 'all', label: 'همه' },
  { value: 'any', label: 'حداقل یکی باشد' },
  { value: 'not-all', label: 'حداقل یکی نباشد' },
  { value: 'none', label: 'هیچ‌کدام' },
];
export const accountingLists: {
  kind: AccountingListKind;
  title: string;
  allTitle: string;
}[] = [
  {
    kind: 'fiscal-years',
    title: 'فهرست دوره مالی',
    allTitle: 'لیست تمام سال های مالی',
  },
  { kind: 'ledgers', title: 'فهرست دفتر کل', allTitle: 'همه دفترهای کل' },
  { kind: 'voucher-types', title: 'فهرست نوع سند', allTitle: 'همه انواع سند' },
  {
    kind: 'coding-standards',
    title: 'فهرست کدینگ استاندارد',
    allTitle: 'همه کدینگ استاندارد',
  },
];
export const listRoute = (kind: AccountingListKind) =>
  kind === 'coding-standards'
    ? '/finance/accounting/general-ledger/reports/legal-reports/lists/standards'
    : `/finance/accounting/general-ledger/base-information/lists/${kind}`;
export const definitionRoute = (kind: AccountingListKind) =>
  kind === 'coding-standards'
    ? '/finance/accounting/general-ledger/reports/legal-reports/standards'
    : `/finance/accounting/general-ledger/base-information/${kind}`;
export const normalizeFilterText = (text: string) =>
  text
    .normalize('NFKC')
    .replace(/[يى]/g, 'ی')
    .replace(/ك/g, 'ک')
    .replace(/[\u064B-\u065F\u200C]/g, '')
    .replace(/[۰-۹]/g, (digit) => String('۰۱۲۳۴۵۶۷۸۹'.indexOf(digit)))
    .replace(/[٠-٩]/g, (digit) => String('٠١٢٣٤٥٦٧٨٩'.indexOf(digit)))
    .trim()
    .toLocaleLowerCase();

export function listFields(kind: AccountingListKind): ListField[] {
  if (kind === 'coding-standards')
    return [
      { key: 'title', label: 'عنوان کدینگ استاندارد', type: 'text' },
      { key: 'titleEn', label: 'عنوان لاتین کدینگ استاندارد', type: 'text' },
      { key: 'protocolTitle', label: 'عنوان پروتکل', type: 'text' },
      { key: 'protocolVersion', label: 'نسخه پروتکل', type: 'text' },
      { key: 'isSystem', label: 'استاندارد پیش فرض', type: 'boolean' },
    ];
  const common: ListField[] = [
    { key: 'title', label: 'عنوان', type: 'text' },
    { key: 'titleEn', label: 'عنوان به زبان دوم', type: 'text' },
    { key: 'description', label: 'توضیحات', type: 'text' },
    { key: 'code', label: 'کد', type: 'text' },
    { key: 'active', label: 'فعال', type: 'boolean' },
  ];
  return kind === 'fiscal-years'
    ? [
        ...common,
        {
          key: 'allocation.title',
          label: 'دوره مالی دفتر کل — عنوان دفتر',
          type: 'text',
          relation: true,
        },
        {
          key: 'allocation.code',
          label: 'دوره مالی دفتر کل — کد دفتر',
          type: 'text',
          relation: true,
        },
        {
          key: 'allocation.startDate',
          label: 'دوره مالی دفتر کل — تاریخ شروع',
          type: 'date',
          relation: true,
        },
        {
          key: 'allocation.endDate',
          label: 'دوره مالی دفتر کل — تاریخ پایان',
          type: 'date',
          relation: true,
        },
      ]
    : kind === 'ledgers'
      ? [
          ...common,
          { key: 'baseCurrency', label: 'ارز پایه', type: 'text' },
          { key: 'isMain', label: 'دفتر کل اصلی', type: 'boolean' },
          { key: 'allowsPosting', label: 'امکان صدور سند', type: 'boolean' },
        ]
      : [...common, { key: 'isDefault', label: 'پیش‌فرض', type: 'boolean' }];
}

export function listRecords(
  kind: AccountingListKind,
  snapshot: AccountingSnapshotV1,
  books: AccountingBookV1[],
): ListRecord[] {
  const rows =
    kind === 'ledgers'
      ? books
      : snapshot.configurations.filter((row) => row.kind === kind);
  return rows.map((row) => ({
    id: row.id,
    nullFields: [
      ...(row.titleEn == null ? ['titleEn'] : []),
      ...(row.description == null ? ['description'] : []),
      ...('attributes' in row && kind === 'coding-standards'
        ? ['protocolTitle', 'protocolVersion'].filter(
            (key) => row.attributes[key] == null,
          )
        : []),
    ],
    values: {
      code: row.code,
      title: row.title,
      titleEn: row.titleEn ?? '',
      description: row.description ?? '',
      active: String(row.active),
      ...('attributes' in row && kind === 'coding-standards'
        ? {
            protocolTitle: String(row.attributes.protocolTitle ?? ''),
            protocolVersion: String(row.attributes.protocolVersion ?? ''),
            isSystem: String(row.attributes.isSystem === true),
          }
        : {}),
      ...('attributes' in row && kind === 'voucher-types'
        ? {
            isDefault: String(
              row.attributes.isDefault === true ||
                row.attributes.isDefault === 'true',
            ),
          }
        : {}),
      ...('baseCurrency' in row
        ? {
            baseCurrency: row.baseCurrency,
            isMain: String(row.isMain),
            allowsPosting: String(row.allowsPosting),
          }
        : {}),
    },
    allocations:
      kind === 'fiscal-years'
        ? snapshot.periods
            .filter((period) => period.fiscalYearId === row.id)
            .map((period) => ({
              title: snapshot.book.title,
              code: snapshot.book.code,
              startDate: period.startDate,
              endDate: period.endDate,
            }))
        : [],
  }));
}

export function combineMatches(matches: boolean[], mode: FilterMode): boolean {
  switch (mode) {
    case 'all':
      return matches.every(Boolean);
    case 'any':
      return matches.some(Boolean);
    case 'not-all':
      return !matches.every(Boolean);
    case 'none':
      return !matches.some(Boolean);
  }
}
function compare(raw: string, rule: FilterRule): boolean {
  const value = normalizeFilterText(raw),
    target = normalizeFilterText(rule.value);
  switch (rule.operator) {
    case 'contains':
      return value.includes(target);
    case 'not-contains':
      return !value.includes(target);
    case 'equals':
      return value === target;
    case 'not-equals':
      return value !== target;
    case 'starts':
      return value.startsWith(target);
    case 'empty':
      return value === '';
    case 'not-empty':
      return value !== '';
    case 'before':
      return value !== '' && target !== '' && value < target;
    case 'after':
      return value !== '' && target !== '' && value > target;
  }
}
export function matchesFilter(
  record: ListRecord,
  node: FilterNode,
  fields: ListField[],
): boolean {
  if (node.type === 'group') {
    if (node.scope === 'allocations') {
      if (filterRuleCount(node) === 0) return true;
      // All child conditions must refer to the same related period, rather than
      // independently finding different periods that satisfy individual rules.
      return combineMatches(
        record.allocations.map((allocation) =>
          matchesFilter(
            {
              ...record,
              values: Object.fromEntries(
                Object.entries(allocation).map(([key, value]) => [
                  `allocation.${key}`,
                  value,
                ]),
              ),
              allocations: [],
            },
            {
              type: 'group',
              id: node.id,
              mode: node.mode,
              children: node.children,
            },
            fields.map((field) => ({ ...field, relation: false })),
          ),
        ),
        node.relationMode ?? 'any',
      );
    }
    // An empty group is an unused filter, independent of its chosen logical mode.
    const children = node.children.filter(
      (child) => filterRuleCount(child) > 0,
    );
    return (
      children.length === 0 ||
      combineMatches(
        children.map((child) => matchesFilter(record, child, fields)),
        node.mode,
      )
    );
  }
  const field = fields.find((item) => item.key === node.field);
  if (!field) return false;
  return field.relation
    ? combineMatches(
        record.allocations.map((allocation) =>
          compare(
            allocation[node.field.slice('allocation.'.length)] ?? '',
            node,
          ),
        ),
        node.relationMode,
      )
    : compare(record.values[node.field] ?? '', node);
}
export function filterRecords(
  records: ListRecord[],
  filter: FilterGroup,
  fields: ListField[],
  search: string,
): ListRecord[] {
  const term = normalizeFilterText(search);
  return records.filter(
    (record) =>
      matchesFilter(record, filter, fields) &&
      (!term ||
        Object.values(record.values).some((value) =>
          normalizeFilterText(value).includes(term),
        )),
  );
}
export function incompleteFilter(node: FilterNode): boolean {
  return node.type === 'group'
    ? node.children.some(incompleteFilter)
    : !['empty', 'not-empty'].includes(node.operator) &&
        node.value.trim() === '';
}
export function filterRuleCount(node: FilterNode): number {
  return node.type === 'rule'
    ? 1
    : node.children.reduce((total, child) => total + filterRuleCount(child), 0);
}
