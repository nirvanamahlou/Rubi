import {
  accountingDetailLevels,
  type AccountingDetailLevel,
  type AccountingSourceDetailField,
} from '@nora/contracts';
import type {
  AccountingSnapshotV1,
  AccountingSubsidiaryMappingV1,
} from '@nora/contracts';
import type { ListField, ListRecord } from './accounting-list-filters';
export type AccountsListKind =
  'detail-types' | 'details' | 'detail-type-converters';
export function accountListProjection(
  book: AccountingSnapshotV1,
  kind: AccountsListKind,
): { fields: ListField[]; records: ListRecord[] } {
  const types = book.configurations.filter(
    (row) => row.kind === 'detail-types',
  );
  const text = (key: string, label: string): ListField => ({
    key,
    label,
    type: 'text',
  });
  if (kind === 'detail-types')
    return {
      fields: [
        text('title', 'عنوان'),
        { key: 'isSystem', label: 'پیش فرض', type: 'boolean' },
        text('parent', 'نوع تفصیل پدر'),
        {
          key: 'enforceParent',
          label: 'کنترل رابطه پدر فرزندی',
          type: 'boolean',
        },
      ],
      records: types.map((row) => ({
        id: row.id,
        allocations: [],
        values: {
          title: row.title,
          isSystem: String(row.attributes.isSystem === true),
          parent:
            types.find((type) => type.id === row.attributes.parentTypeId)
              ?.title ?? '',
          enforceParent: String(row.attributes.enforceParent === true),
        },
      })),
    };
  if (kind === 'details')
    return {
      fields: [
        text('code', 'کد'),
        text('title', 'عنوان'),
        text('type', 'نوع تفصیلی'),
        text('parent', 'عنوان تفصیل پدر'),
        text('classification', 'شماره طبقه بندی'),
        { key: 'active', label: 'وضعیت', type: 'boolean' },
      ],
      records: book.details.map((row) => ({
        id: row.id,
        allocations: [],
        values: {
          code: row.code,
          title: row.title,
          type: types.find((type) => type.id === row.typeId)?.title ?? '',
          parent:
            book.details.find((parent) => parent.id === row.parentId)?.title ??
            '',
          classification: String(row.attributes.classificationNumber ?? ''),
          active: String(row.active),
        },
      })),
    };
  return {
    fields: [
      text('title', 'نوع تفصیل'),
      text('entity', 'موجودیت'),
      { key: 'date', label: 'تاریخ', type: 'date' },
      text('state', 'وضعیت'),
    ],
    records: (book.detailConversions ?? []).map((row) => ({
      id: row.id,
      allocations: [],
      values: {
        title: types.find((type) => type.id === row.userTypeId)?.title ?? '',
        entity: row.entity,
        date: row.date,
        state: row.state === 'CONVERTED' ? 'تبدیل شده' : 'ثبت شده',
      },
    })),
  };
}

export type MappingPath = Pick<
  AccountingSubsidiaryMappingV1,
  'sourceAccountId' | AccountingSourceDetailField
>;

export const mappingKey = (row: MappingPath) => {
  const details = accountingDetailLevels.map(
    (level) => row[`sourceDetail${level}Id`] ?? '',
  );
  return [
    row.sourceAccountId,
    ...(details.slice(3).some(Boolean) ? details : details.slice(0, 3)),
  ].join(':');
};
export function mappingChildren(
  rows: MappingPath[],
  accountId: string,
  path: string[],
  levels: readonly AccountingDetailLevel[] = [4, 5, 6],
) {
  const keys = levels.map((level) => `sourceDetail${level}Id` as const);
  const nextKey = keys[path.length];
  if (!nextKey) return [];
  const result = new Map<string, MappingPath>();
  for (const row of rows) {
    if (
      row.sourceAccountId !== accountId ||
      path.some((id, i) => row[keys[i]!] !== id) ||
      !row[nextKey]
    )
      continue;
    const item: MappingPath = {
      sourceAccountId: accountId,
      sourceDetail4Id: null,
      sourceDetail5Id: null,
      sourceDetail6Id: null,
      ...Object.fromEntries(
        keys.slice(0, path.length + 1).map((key) => [key, row[key]]),
      ),
    };
    result.set(mappingKey(item), item);
  }
  return [...result.values()];
}
