import { Prisma } from '@nora/database';
import * as v from './accounting.validation';

type Field = {
  sql: string | Prisma.Sql;
  kind: 'text' | 'number' | 'date' | 'uuid' | 'boolean';
};
const attribute = (
  alias: string,
  name: string,
  kind: Field['kind'] = 'text',
): Field => ({ sql: `${alias}.attributes->>'${name}'`, kind });
const headers: Record<string, Field> = {
  number: { sql: 'j.number', kind: 'number' },
  reference: { sql: 'j.reference', kind: 'number' },
  dailyNumber: attribute('j', 'dailyNumber', 'number'),
  auxiliaryNumber: attribute('j', 'auxiliaryNumber', 'number'),
  documentDate: { sql: 'j."documentDate"', kind: 'date' },
  description: { sql: 'j.description', kind: 'text' },
  descriptionEn: attribute('j', 'descriptionEn'),
  revaluationCurrency: {
    sql: 'NULL',
    kind: 'text',
  },
  revaluationRate: {
    sql: '(SELECT r.rate FROM accounting_fx_snapshots r WHERE r.id::text=j.attributes->>\'revaluationRateId\' AND r."bookId"=j."bookId")',
    kind: 'number',
  },
  status: { sql: 'j.status', kind: 'text' },
  referenceNumber: attribute('j', 'referenceNumber'),
  makerId: { sql: 'j."makerId"::text', kind: 'uuid' },
  bookId: { sql: 'j."bookId"::text', kind: 'uuid' },
  branchId: {
    sql: '(SELECT b."branchId"::text FROM accounting_books b WHERE b.id=j."bookId")',
    kind: 'uuid',
  },
  periodId: { sql: 'j."periodId"::text', kind: 'uuid' },
  typeId: { sql: 'j."typeId"::text', kind: 'uuid' },
  lastModifierId: attribute('j', 'lastModifierId', 'uuid'),
  approverId: { sql: 'j."approverId"::text', kind: 'uuid' },
  amount: {
    sql: '(SELECT COALESCE(SUM(a.debit),0) FROM accounting_journal_lines a WHERE a."journalId"=j.id)',
    kind: 'number',
  },
  isCurrency: {
    sql: 'EXISTS (SELECT 1 FROM accounting_journal_lines l JOIN accounting_accounts a ON a.id=l."accountId" AND a."bookId"=j."bookId" WHERE l."journalId"=j.id AND a.attributes->>\'multiCurrency\'=\'true\')',
    kind: 'boolean',
  },
  deletedAt: {
    sql: '(SELECT TO_CHAR(e."occurredAt",\'YYYY-MM-DD\') FROM accounting_journal_state_events e WHERE e."journalId"=j.id AND e."toStatus"=\'CANCELLED\' ORDER BY e."occurredAt" DESC,e.id LIMIT 1)',
    kind: 'date',
  },
  deletedById: {
    sql: '(SELECT e."actorId"::text FROM accounting_journal_state_events e WHERE e."journalId"=j.id AND e."toStatus"=\'CANCELLED\' ORDER BY e."occurredAt" DESC,e.id LIMIT 1)',
    kind: 'uuid',
  },
};
const lineFields: Record<string, Field> = {
  position: { sql: '(l.position+1)', kind: 'number' },
  debit: { sql: 'l.debit', kind: 'number' },
  credit: { sql: 'l.credit', kind: 'number' },
  baseDebit: { sql: 'l.debit', kind: 'number' },
  baseCredit: { sql: 'l.credit', kind: 'number' },
  rate: { sql: 'l.rate', kind: 'number' },
  foreignDebit: {
    sql: 'CASE WHEN l.debit>0 THEN l."foreignAmount" ELSE 0 END',
    kind: 'number',
  },
  foreignCredit: {
    sql: 'CASE WHEN l.credit>0 THEN l."foreignAmount" ELSE 0 END',
    kind: 'number',
  },
  description: { sql: 'l.description', kind: 'text' },
  descriptionEn: attribute('l', 'descriptionEn'),
  trackingNumber: attribute('l', 'trackingNumber'),
  trackingDate: attribute('l', 'trackingDate', 'date'),
  detail4Id: { sql: 'l."detail4Id"::text', kind: 'uuid' },
  detail5Id: { sql: 'l."detail5Id"::text', kind: 'uuid' },
  detail6Id: { sql: 'l."detail6Id"::text', kind: 'uuid' },
  accountId: { sql: 'l."accountId"::text', kind: 'uuid' },
  currency: { sql: 'l.currency', kind: 'text' },
  taxAccountType: attribute('l', 'taxAccountType'),
  taxStatus: attribute('l', 'taxStatus'),
  transactionType: attribute('l', 'transactionType'),
  purchaseOrSale: attribute('l', 'purchaseOrSale'),
  goodsOrService: attribute('l', 'goodsOrService'),
  isCurrency: { sql: '(l.currency IS NOT NULL)', kind: 'boolean' },
  quantity: attribute('l', 'quantity', 'number'),
  taxAmount: attribute('l', 'taxAmount', 'number'),
  dutyAmount: attribute('l', 'dutyAmount', 'number'),
  periodNature: attribute('l', 'periodNature'),
  nonRefundableTax: attribute('l', 'nonRefundableTax', 'boolean'),
  nonRefundableDuty: attribute('l', 'nonRefundableDuty', 'boolean'),
  personId: attribute('l', 'personId', 'uuid'),
  // Branch/base currency are properties of the authorized book, not client input.
  branchId: headers.branchId!,
  baseCurrency: {
    sql: '(SELECT b."baseCurrency" FROM accounting_books b WHERE b.id=j."bookId")',
    kind: 'text',
  },
  conversionRate: attribute('l', 'conversionRate', 'number'),
};

/** Whitelisted expressions only; all user operands are bound SQL parameters.
 * COALESCE gives missing attributes consistent empty/negation semantics. */
export function documentSqlFilter(
  input: unknown,
  domain: 'journal' | 'general' = 'journal',
  currencyName?: Prisma.Sql,
): Prisma.Sql {
  let count = 0;
  const compile = (
    input: unknown,
    scope: 'header' | 'line',
    depth: number,
  ): Prisma.Sql => {
    if (++count > 100 || depth > 8) v.invalid('فیلتر بیش از حد پیچیده است.');
    const node = v.object(input);
    if (node.type === 'group') {
      if (!Array.isArray(node.children) || node.children.length > 50)
        v.invalid('گروه فیلتر معتبر نیست.');
      if (!['all', 'any', 'not-all', 'none'].includes(String(node.mode)))
        v.invalid('عملگر گروه فیلتر معتبر نیست.');
      if (!node.children.length) return Prisma.sql`TRUE`;
      const children = node.children.map(
        (child) => Prisma.sql`(${compile(child, scope, depth + 1)})`,
      );
      const clause = Prisma.join(
        children,
        node.mode === 'all' || node.mode === 'not-all' ? ' AND ' : ' OR ',
      );
      return node.mode === 'none' || node.mode === 'not-all'
        ? Prisma.sql`NOT (${clause})`
        : Prisma.sql`(${clause})`;
    }
    if (node.type === 'lines' && scope === 'header') {
      if (domain === 'general')
        v.invalid('شرط اقلام سند کل در این فهرست پشتیبانی نمی‌شود.');
      const clause = compile(node.condition, 'line', depth + 1);
      if (node.mode === 'any')
        return Prisma.sql`EXISTS (SELECT 1 FROM accounting_journal_lines l WHERE l."journalId"=j.id AND (${clause}))`;
      if (node.mode === 'all')
        return Prisma.sql`NOT EXISTS (SELECT 1 FROM accounting_journal_lines l WHERE l."journalId"=j.id AND NOT (${clause}))`;
      v.invalid('شرط اقلام سند معتبر نیست.');
    }
    if (node.type !== 'rule' || typeof node.field !== 'string')
      v.invalid('شرط فیلتر معتبر نیست.');
    const generalFields: Record<string, Field> = {
      number: headers.number!,
      documentDate: headers.documentDate!,
      makerId: headers.makerId!,
      amount: {
        sql: '(SELECT COALESCE(SUM(a.debit),0) FROM accounting_general_document_lines a WHERE a."documentId"=j.id)',
        kind: 'number',
      },
    };
    const field = (
      domain === 'general'
        ? generalFields
        : scope === 'header'
          ? headers
          : lineFields
    )[String(node.field)];
    if (!field) v.invalid('فیلد فیلتر پشتیبانی نمی‌شود.');
    const raw =
      node.field === 'revaluationCurrency' && currencyName
        ? currencyName
        : typeof field.sql === 'string'
          ? Prisma.raw(field.sql)
          : field.sql;
    const text = Prisma.sql`(${raw})::text`;
    const expression =
      field.kind === 'number'
        ? Prisma.sql`CASE WHEN ${text} ~ '^[+-]?[0-9]{1,60}([.][0-9]{1,18})?$' THEN (${text})::numeric ELSE NULL END`
        : text;
    const value = (input: unknown) => {
      if (field.kind === 'number') return v.decimal(input)!;
      if (field.kind === 'uuid') return v.uuid(input)!;
      if (field.kind === 'date') return v.date(input)!;
      if (field.kind === 'boolean') {
        if (
          input !== true &&
          input !== false &&
          input !== 'true' &&
          input !== 'false'
        )
          v.invalid('مقدار منطقی فیلتر معتبر نیست.');
        return String(input);
      }
      return v.text(input, 2000);
    };
    const bound = (input: unknown) =>
      field.kind === 'number'
        ? Prisma.sql`${value(input)}::numeric`
        : Prisma.sql`${value(input)}`;
    const equal = (input: unknown) =>
      Prisma.sql`COALESCE(${expression}=${bound(input)},FALSE)`;
    if (node.operator === 'equals') return equal(node.value);
    if (node.operator === 'not-equals')
      return Prisma.sql`NOT (${equal(node.value)})`;
    if (node.operator === 'empty')
      return Prisma.sql`(${raw} IS NULL OR ${text}='')`;
    if (node.operator === 'not-empty')
      return Prisma.sql`NOT (${raw} IS NULL OR ${text}='')`;
    if (node.operator === 'in' || node.operator === 'not-in') {
      if (
        !Array.isArray(node.values) ||
        !node.values.length ||
        node.values.length > 50
      )
        v.invalid('مقادیر فیلتر معتبر نیست.');
      const clause = Prisma.join(
        node.values.map((item) => equal(item)),
        ' OR ',
      );
      return node.operator === 'in'
        ? Prisma.sql`(${clause})`
        : Prisma.sql`NOT (${clause})`;
    }
    if (
      node.operator === 'between' &&
      (field.kind === 'number' || field.kind === 'date')
    )
      return Prisma.sql`COALESCE(${expression} BETWEEN ${bound(node.value)} AND ${bound(node.end)},FALSE)`;
    if (
      field.kind === 'text' &&
      (node.operator === 'contains' ||
        node.operator === 'starts' ||
        node.operator === 'not-contains')
    ) {
      const operand = value(node.value);
      const clause =
        node.operator === 'starts'
          ? Prisma.sql`COALESCE(LEFT(${text},LENGTH(${operand}))=${operand},FALSE)`
          : Prisma.sql`COALESCE(STRPOS(${text},${operand})>0,FALSE)`;
      return node.operator === 'not-contains'
        ? Prisma.sql`NOT (${clause})`
        : clause;
    }
    v.invalid('عملگر فیلتر پشتیبانی نمی‌شود.');
  };
  return compile(input, 'header', 0);
}
