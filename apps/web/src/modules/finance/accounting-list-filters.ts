import type { AccountingBookV1, AccountingSnapshotV1 } from '@nora/contracts';

export type AccountingListKind = 'fiscal-years' | 'ledgers' | 'voucher-types';
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
    allTitle: 'همه دوره‌های مالی',
  },
  { kind: 'ledgers', title: 'فهرست دفتر کل', allTitle: 'همه دفترهای کل' },
  { kind: 'voucher-types', title: 'فهرست نوع سند', allTitle: 'همه انواع سند' },
];
export const listRoute = (kind: AccountingListKind) =>
  `/finance/accounting/general-ledger/base-information/lists/${kind}`;
export const definitionRoute = (kind: AccountingListKind) =>
  `/finance/accounting/general-ledger/base-information/${kind}`;
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
      : common;
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
    values: {
      code: row.code,
      title: row.title,
      titleEn: row.titleEn ?? '',
      description: row.description ?? '',
      active: String(row.active),
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
