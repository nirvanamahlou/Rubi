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
  'sourceAccountId' | 'sourceDetail4Id' | 'sourceDetail5Id' | 'sourceDetail6Id'
>;
export const mappingKey = (row: MappingPath) =>
  [
    row.sourceAccountId,
    row.sourceDetail4Id ?? '',
    row.sourceDetail5Id ?? '',
    row.sourceDetail6Id ?? '',
  ].join(':');
export function mappingChildren(
  rows: MappingPath[],
  accountId: string,
  path: string[],
) {
  const depth = path.length;
  const keys = [
    'sourceDetail4Id',
    'sourceDetail5Id',
    'sourceDetail6Id',
  ] as const;
  const result = new Map<string, MappingPath>();
  for (const row of rows) {
    if (
      row.sourceAccountId !== accountId ||
      path.some((id, i) => row[keys[i]!] !== id)
    )
      continue;
    const next = row[keys[depth]!];
    if (!next) continue;
    const item: MappingPath = {
      sourceAccountId: accountId,
      sourceDetail4Id: row.sourceDetail4Id ?? null,
      sourceDetail5Id: depth >= 1 ? (row.sourceDetail5Id ?? null) : null,
      sourceDetail6Id: depth >= 2 ? (row.sourceDetail6Id ?? null) : null,
    };
    result.set(mappingKey(item), item);
  }
  return [...result.values()];
}
