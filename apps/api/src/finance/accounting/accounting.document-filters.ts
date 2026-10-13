import { Prisma } from '@nora/database';
import * as v from './accounting.validation';

type Field = {
  column: string;
  kind: 'text' | 'number' | 'date' | 'uuid';
  attribute?: boolean;
};
const headerFields: Record<string, Field> = {
  number: { column: 'number', kind: 'number' },
  reference: { column: 'reference', kind: 'text' },
  dailyNumber: { column: 'dailyNumber', kind: 'text', attribute: true },
  auxiliaryNumber: { column: 'auxiliaryNumber', kind: 'text', attribute: true },
  documentDate: { column: 'documentDate', kind: 'date' },
  description: { column: 'description', kind: 'text' },
  descriptionEn: { column: 'descriptionEn', kind: 'text', attribute: true },
  status: { column: 'status', kind: 'text' },
  referenceNumber: { column: 'referenceNumber', kind: 'text', attribute: true },
  makerId: { column: 'makerId', kind: 'uuid' },
  periodId: { column: 'periodId', kind: 'uuid' },
  typeId: { column: 'typeId', kind: 'uuid' },
};
const lineFields: Record<string, Field> = {
  position: { column: 'position', kind: 'number' },
  debit: { column: 'debit', kind: 'number' },
  credit: { column: 'credit', kind: 'number' },
  rate: { column: 'rate', kind: 'number' },
  description: { column: 'description', kind: 'text' },
  descriptionEn: { column: 'descriptionEn', kind: 'text', attribute: true },
  trackingNumber: { column: 'trackingNumber', kind: 'text', attribute: true },
  trackingDate: { column: 'trackingDate', kind: 'date', attribute: true },
  detail4Id: { column: 'detail4Id', kind: 'uuid' },
  detail5Id: { column: 'detail5Id', kind: 'uuid' },
  detail6Id: { column: 'detail6Id', kind: 'uuid' },
  currency: { column: 'currency', kind: 'text' },
  accountId: { column: 'accountId', kind: 'uuid' },
};

/** Compile the observed recursive filter into database predicates before pagination.
 * Book/branch authorization is always applied separately by the caller.
 */
export function journalFilter(
  input: unknown,
): Prisma.AccountingJournalWhereInput {
  let count = 0;
  const compile = (
    inputNode: unknown,
    scope: 'header' | 'line',
    depth: number,
  ): Record<string, unknown> => {
    if (++count > 100 || depth > 8) v.invalid('فیلتر بیش از حد پیچیده است.');
    const node = v.object(inputNode);
    if (node.type === 'group') {
      if (!Array.isArray(node.children) || node.children.length > 50)
        v.invalid('گروه فیلتر معتبر نیست.');
      const children = node.children.map((child) =>
        compile(child, scope, depth + 1),
      );
      // Empty groups have no effect, including negated groups.
      if (!children.length) return {};
      if (node.mode === 'all') return { AND: children };
      if (node.mode === 'any') return { OR: children };
      if (node.mode === 'not-all') return { NOT: { AND: children } };
      if (node.mode === 'none') return { NOT: { OR: children } };
      v.invalid('عملگر گروه فیلتر معتبر نیست.');
    }
    if (node.type === 'lines' && scope === 'header') {
      const child = compile(node.condition, 'line', depth + 1);
      if (node.mode === 'all') return { lines: { every: child } };
      if (node.mode === 'any') return { lines: { some: child } };
      v.invalid('شرط اقلام سند معتبر نیست.');
    }
    if (node.type !== 'rule' || typeof node.field !== 'string')
      v.invalid('شرط فیلتر معتبر نیست.');
    const field = (scope === 'header' ? headerFields : lineFields)[
      node.field as string
    ];
    if (!field) v.invalid('فیلد فیلتر پشتیبانی نمی‌شود.');
    const value = (raw: unknown): string | number => {
      if (field.kind === 'date') return v.date(raw)!;
      if (field.kind === 'uuid') return v.uuid(raw)!;
      if (field.kind === 'number') {
        if (field.column === 'number' || field.column === 'position') {
          const number = Number(raw);
          if (!Number.isSafeInteger(number) || number < 0)
            v.invalid('عدد فیلتر معتبر نیست.');
          return number;
        }
        return v.decimal(raw)!;
      }
      return v.text(raw, 2000);
    };
    const condition = (
      op: string,
      operand?: unknown,
    ): Record<string, unknown> => {
      if (field.attribute) {
        if (op !== 'equals') v.invalid('عملگر ویژگی فیلتر معتبر نیست.');
        return { attributes: { path: [field.column], equals: operand } };
      }
      return { [field.column]: { [op]: operand } };
    };
    if (node.operator === 'equals')
      return condition('equals', value(node.value));
    if (node.operator === 'not-equals')
      return { NOT: condition('equals', value(node.value)) };
    if (node.operator === 'in' || node.operator === 'not-in') {
      if (
        !Array.isArray(node.values) ||
        !node.values.length ||
        node.values.length > 50
      )
        v.invalid('مقادیر فیلتر معتبر نیست.');
      const any = {
        OR: node.values.map((item) => condition('equals', value(item))),
      };
      return node.operator === 'in' ? any : { NOT: any };
    }
    if (
      node.operator === 'between' &&
      !field.attribute &&
      (field.kind === 'number' || field.kind === 'date')
    )
      return {
        AND: [
          condition('gte', value(node.value)),
          condition('lte', value(node.end)),
        ],
      };
    if (
      (node.operator === 'contains' || node.operator === 'starts') &&
      field.kind === 'text' &&
      !field.attribute
    )
      return condition(
        node.operator === 'starts' ? 'startsWith' : 'contains',
        value(node.value),
      );
    if (node.operator === 'empty' || node.operator === 'not-empty') {
      const nullable = [
        'number',
        'reference',
        'documentDate',
        'periodId',
        'typeId',
        'accountId',
        'detail4Id',
        'detail5Id',
        'detail6Id',
        'currency',
        'rate',
      ].includes(field.column);
      const empty = field.attribute
        ? {
            OR: [
              { attributes: { path: [field.column], equals: '' } },
              { attributes: { path: [field.column], equals: Prisma.AnyNull } },
            ],
          }
        : {
            OR: [
              ...(nullable ? [{ [field.column]: null }] : []),
              ...(field.kind === 'text' ? [{ [field.column]: '' }] : []),
            ],
          };
      return node.operator === 'empty' ? empty : { NOT: empty };
    }
    v.invalid('عملگر فیلتر پشتیبانی نمی‌شود.');
  };
  return compile(input, 'header', 0) as Prisma.AccountingJournalWhereInput;
}
