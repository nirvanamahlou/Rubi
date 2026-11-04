import {
  normalizeFilterText,
  type ListRecord,
} from './accounting-list-filters';

// The text-column menu observed in the source fiscal-year list.
export const columnOperators = [
  ['none', 'بدون فیلتر'],
  ['contains', 'شامل'],
  ['not-contains', 'بدون'],
  ['starts', 'شروع با'],
  ['ends', 'مختوم به'],
  ['equals', 'مساوی با'],
  ['not-equals', 'نامساوی با'],
  ['gt', 'بزرگتر از'],
  ['lt', 'کوچکتر از'],
  ['gte', 'بزرگتر یا مساوی'],
  ['lte', 'کوچکتر یا مساوی'],
  ['null', 'تهی'],
  ['not-null', 'پر'],
  ['empty', 'بدون مقدار'],
  ['not-empty', 'با مقدار'],
] as const;
export type ColumnOperator = (typeof columnOperators)[number][0];
export function matchesColumn(
  record: ListRecord,
  key: string,
  operator: ColumnOperator,
  input: string,
): boolean {
  const isNull = record.nullFields?.includes(key) ?? false;
  if (operator === 'none') return true;
  if (operator === 'null') return isNull;
  if (operator === 'not-null') return !isNull;
  const raw = record.values[key] ?? '';
  if (operator === 'empty') return !isNull && raw === '';
  if (operator === 'not-empty') return !isNull && raw !== '';
  if (!input) return true;
  if (isNull) return false;
  const value = normalizeFilterText(raw),
    target = normalizeFilterText(input);
  switch (operator) {
    case 'contains':
      return value.includes(target);
    case 'not-contains':
      return !value.includes(target);
    case 'starts':
      return value.startsWith(target);
    case 'ends':
      return value.endsWith(target);
    case 'equals':
      return value === target;
    case 'not-equals':
      return value !== target;
    case 'gt':
      return value.localeCompare(target, 'fa') > 0;
    case 'gte':
      return value.localeCompare(target, 'fa') >= 0;
    case 'lt':
      return value.localeCompare(target, 'fa') < 0;
    case 'lte':
      return value.localeCompare(target, 'fa') <= 0;
  }
}
