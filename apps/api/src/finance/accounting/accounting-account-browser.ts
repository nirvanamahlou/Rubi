import { accountingDetailLevels } from '@nora/contracts';
import { journalDetailSql } from './accounting.detail-levels';
import { Prisma } from '@nora/database';
import * as v from './accounting.validation';

const sql = Prisma.sql;
const hierarchy = {
  GROUP: sql`grp`,
  GENERAL: sql`gl`,
  SUBSIDIARY: sql`sub`,
};
const detailLevels = Object.fromEntries(
  accountingDetailLevels.map((level) => [
    `DETAIL${level}`,
    Prisma.raw(`l."detail${level}Id"`),
  ]),
);

function dimension(axis: string) {
  if (Object.hasOwn(hierarchy, axis)) {
    const node = hierarchy[axis as keyof typeof hierarchy];
    return {
      join: Prisma.empty,
      key: sql`${node}.id::text`,
      code: sql`${node}.code`,
      title: sql`${node}.title`,
    };
  }
  if (Object.hasOwn(detailLevels, axis) || axis === 'DETAIL') {
    const match =
      axis === 'DETAIL'
        ? sql`d.id IN (${journalDetailSql})`
        : sql`d.id = ${detailLevels[axis as keyof typeof detailLevels]}`;
    return {
      join: sql`JOIN accounting_details d ON d."bookId"=j."bookId" AND ${match}`,
      key: sql`d.id::text`,
      code: sql`d.code`,
      title: sql`d.title`,
    };
  }
  const value =
    axis === 'CURRENCY'
      ? sql`l.currency`
      : axis === 'TRACKING'
        ? sql`NULLIF(l.attributes->>'trackingNumber','')`
        : v.invalid('سطح گزارش معتبر نیست.');
  return { join: Prisma.empty, key: value, code: value, title: value };
}

export async function readAccountBrowser(
  tx: Prisma.TransactionClient,
  bookId: string,
  periodId: string,
  from: string,
  to: string,
  query: Record<string, string>,
) {
  const axis = query.axis ?? 'GROUP';
  const { join, key, code, title } = dimension(axis);
  const min = v.decimal(query.minAmount, true),
    max = v.decimal(query.maxAmount, true);
  if (
    (min && min.startsWith('-')) ||
    (max && max.startsWith('-')) ||
    (min && max && new Prisma.Decimal(min).greaterThan(max))
  )
    v.invalid('محدوده مبلغ سند معتبر نیست.');
  for (const flag of [query.traceableOnly, query.currencyOnly])
    if (flag !== undefined && !['true', 'false'].includes(flag))
      v.invalid('گزینه گزارش معتبر نیست.');
  const page = Number(query.page ?? 1);
  if (!Number.isSafeInteger(page) || page < 1 || page > 100000)
    v.invalid('صفحه معتبر نیست.');
  const ids = query.accountIds ? query.accountIds.split(',') : [];
  if (ids.length > 100) v.invalid('حداکثر صد حساب انتخاب کنید.');
  const accountIds = ids.map((id) => v.uuid(id)!);
  const detailType = v.uuid(query.detailTypeId, true);
  if (detailType && !axis.startsWith('DETAIL'))
    v.invalid('نوع تفصیلی فقط برای سطح تفصیلی قابل انتخاب است.');
  const search = v.text(query.search, 160),
    drill = v.text(query.selectedKey, 160);
  const journalType = v.uuid(query.typeId, true);
  const filters = [
    sql`j."bookId"=${bookId}::uuid AND j."periodId"=${periodId}::uuid AND j.status='POSTED' AND j."documentDate"<=${to}`,
    ...(journalType ? [sql`j."typeId"=${journalType}::uuid`] : []),
    ...(min || max
      ? [
          sql`(SELECT COALESCE(sum(total.debit),0) FROM accounting_journal_lines total WHERE total."journalId"=j.id)
        BETWEEN COALESCE(${min}::numeric,0) AND COALESCE(${max}::numeric,'Infinity'::numeric)`,
        ]
      : []),
    ...(query.currencyOnly === 'true'
      ? [
          sql`EXISTS (SELECT 1 FROM accounting_journal_lines fx WHERE fx."journalId"=j.id AND fx.currency IS NOT NULL)`,
        ]
      : []),
    ...(query.traceableOnly === 'true'
      ? [sql`sub.attributes->'traceable'='true'::jsonb`]
      : []),
    ...(accountIds.length
      ? [
          sql`ARRAY[sub.id, gl.id, grp.id] && ARRAY[${Prisma.join(accountIds)}]::uuid[]`,
        ]
      : []),
    ...(detailType ? [sql`d."typeId"=${detailType}::uuid`] : []),
    sql`${key} IS NOT NULL`,
    ...(search
      ? [
          sql`(strpos(lower(${title}),lower(${search}))>0 OR strpos(lower(${code}),lower(${search}))>0)`,
        ]
      : []),
    ...(drill ? [sql`${key}=${drill} AND j."documentDate">=${from}`] : []),
  ];
  const source = sql`FROM accounting_journals j
    JOIN accounting_journal_lines l ON l."journalId"=j.id
    JOIN accounting_accounts sub ON sub.id=l."accountId" AND sub."bookId"=j."bookId"
    LEFT JOIN accounting_accounts gl ON gl.id=sub."parentId" AND gl."bookId"=j."bookId"
    LEFT JOIN accounting_accounts grp ON grp.id=gl."parentId" AND grp."bookId"=j."bookId"
    ${join} WHERE ${Prisma.join(filters, ' AND ')}`;
  const pageSize = 50;
  const pagination = sql`LIMIT ${pageSize + 1} OFFSET ${(page - 1) * pageSize}`;
  const lines = drill
    ? await tx.$queryRaw<
        {
          id: string;
          journalId: string;
          number: number;
          date: string;
          description: string;
          debit: string;
          credit: string;
        }[]
      >(sql`
    SELECT l.id,j.id AS "journalId",j.number,j."documentDate" AS date,l.description,
      trim_scale(l.debit)::text AS debit,trim_scale(l.credit)::text AS credit ${source}
    ORDER BY j."documentDate",j.number,j.id,l.position ${pagination}`)
    : [];
  const rows = drill
    ? []
    : await tx.$queryRaw<
        {
          key: string;
          code: string;
          title: string;
          opening: string;
          debit: string;
          credit: string;
          balance: string;
        }[]
      >(sql`
    SELECT ${key} AS key,${code} AS code,${title} AS title,
      trim_scale(sum(CASE WHEN j."documentDate"<${from} THEN l.debit-l.credit ELSE 0 END))::text AS opening,
      trim_scale(sum(CASE WHEN j."documentDate">=${from} THEN l.debit ELSE 0 END))::text AS debit,
      trim_scale(sum(CASE WHEN j."documentDate">=${from} THEN l.credit ELSE 0 END))::text AS credit,
      trim_scale(sum(l.debit-l.credit))::text AS balance ${source}
    GROUP BY 1,2,3 ORDER BY 2,3,1 ${pagination}`);
  return {
    periodId,
    from,
    to,
    page,
    pageSize,
    hasNext: Math.max(lines.length, rows.length) > pageSize,
    rows: rows.slice(0, pageSize),
    lines: lines.slice(0, pageSize),
  };
}
