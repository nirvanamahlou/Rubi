import {
  accountReviewAxes,
  type AccountReviewAxis,
  type AccountReviewLine,
  type AccountReviewResult,
  type AccountReviewRow,
} from '@nora/contracts';
import { Prisma } from '@nora/database';
import * as v from './accounting.validation';

const sql = Prisma.sql;
const hierarchy = { GROUP: sql`grp`, GENERAL: sql`gl`, SUBSIDIARY: sql`sub` };
const levels = {
  DETAIL4: sql`l."detail4Id"`,
  DETAIL5: sql`l."detail5Id"`,
  DETAIL6: sql`l."detail6Id"`,
};
const tracking = sql`NULLIF(l.attributes->>'trackingNumber','')`;
const followUpDate = sql`NULLIF(l.attributes->>'trackingDate','')`;
const noClassification = sql`NULL::text`;

function axisOf(value: unknown): AccountReviewAxis {
  return (
    accountReviewAxes.find((axis) => axis === value) ??
    v.invalid('سطح گزارش معتبر نیست.')
  );
}

function detailMatch(axis: AccountReviewAxis) {
  return Object.hasOwn(levels, axis)
    ? sql`d.id = ${levels[axis as keyof typeof levels]}`
    : sql`d.id IN (l."detail4Id",l."detail5Id",l."detail6Id")`;
}

function dimension(axis: AccountReviewAxis, typeId: string | null) {
  const empty = Prisma.empty;
  if (Object.hasOwn(hierarchy, axis)) {
    const node = hierarchy[axis as keyof typeof hierarchy];
    return {
      join: empty,
      key: sql`${node}.id::text`,
      code: sql`${node}.code`,
      title: sql`${node}.title`,
      classification: noClassification,
    };
  }
  if (axis === 'DETAIL_TYPE') {
    return {
      join: sql`JOIN accounting_configurations ct ON ct."bookId"=j."bookId" AND ct.kind='detail-types'
        AND EXISTS (SELECT 1 FROM accounting_details d WHERE d."bookId"=j."bookId"
          AND d."typeId"=ct.id AND ${detailMatch(axis)})`,
      key: sql`ct.id::text`,
      code: sql`''::text`,
      title: sql`ct.title`,
      classification: noClassification,
    };
  }
  if (axis.startsWith('DETAIL')) {
    return {
      join: sql`JOIN accounting_details d ON d."bookId"=j."bookId" AND ${detailMatch(axis)}
        ${typeId ? sql`AND d."typeId"=${typeId}::uuid` : empty}`,
      key: sql`d.id::text`,
      code: sql`d.code`,
      title: sql`d.title`,
      classification: sql`NULLIF(d.attributes->>'classificationNumber','')`,
    };
  }
  const value = axis === 'CURRENCY' ? sql`l.currency` : tracking;
  const key =
    axis === 'TRACKING'
      ? sql`CASE WHEN ${tracking} IS NOT NULL THEN jsonb_build_array(${tracking},${followUpDate})::text END`
      : value;
  return {
    join: empty,
    key,
    code: value,
    title: value,
    classification: noClassification,
  };
}

function detailPredicate(axis: AccountReviewAxis, id: Prisma.Sql) {
  return sql`EXISTS (SELECT 1 FROM accounting_details d WHERE d."bookId"=j."bookId"
    AND ${detailMatch(axis)} AND ${id})`;
}

function selectionPredicate(value: unknown) {
  const item = v.object(value);
  const axis = axisOf(item.axis);
  if (axis === 'CURRENCY' || axis === 'TRACKING') {
    const key = v.text(item.key, 160, true);
    if (axis === 'CURRENCY' && !/^[A-Z]{3}$/.test(key))
      v.invalid('کد ارز معتبر نیست.');
    if (axis === 'CURRENCY') return sql`l.currency=${key}`;
    const date =
      item.trackingDate === undefined
        ? Prisma.empty
        : sql`AND ${followUpDate} IS NOT DISTINCT FROM ${v.date(item.trackingDate, true)}::text`;
    return sql`${tracking}=${key} ${date}`;
  }
  const key = v.uuid(item.key)!;
  if (axis.startsWith('DETAIL')) {
    const column = axis === 'DETAIL_TYPE' ? sql`d."typeId"` : sql`d.id`;
    const typeId = v.uuid(item.typeId, true);
    if (typeId && axis !== 'DETAIL') v.invalid('گزینه گزارش معتبر نیست.');
    return detailPredicate(
      axis,
      sql`${column}=${key}::uuid
      ${typeId ? sql`AND d."typeId"=${typeId}::uuid` : Prisma.empty}`,
    );
  }
  const node = hierarchy[axis as keyof typeof hierarchy];
  return sql`${node}.id=${key}::uuid`;
}

function parseScope(raw: unknown) {
  const text = v.text(raw, 4000);
  if (!text) return [];
  let scope: unknown;
  try {
    scope = JSON.parse(text);
  } catch {
    v.invalid('گزینه گزارش معتبر نیست.');
  }
  if (!Array.isArray(scope) || scope.length > 10)
    v.invalid('گزینه گزارش معتبر نیست.');
  return scope.map(selectionPredicate);
}

function documentNumber(value: unknown) {
  const text = v.text(value, 10);
  if (!text) return null;
  if (!/^\d{1,10}$/.test(text) || Number(text) > 2147483647)
    v.invalid('شماره سند معتبر نیست.');
  return Number(text);
}

const eligibleStatuses = ['DRAFT', 'PENDING_APPROVAL', 'APPROVED', 'POSTED'];
const lineOrder = sql`date,number NULLS LAST,"journalId",position,id`;
const reportSorts = {
  code: sql`code,title,key`,
  title: sql`title,code,key`,
  debit: sql`grouped.debit DESC,code,key`,
  credit: sql`grouped.credit DESC,code,key`,
  balance: sql`abs(grouped.balance) DESC,code,key`,
};

export async function readAccountBrowser(
  tx: Prisma.TransactionClient,
  bookId: string,
  periodId: string,
  from: string,
  to: string,
  query: Record<string, string>,
): Promise<AccountReviewResult> {
  const axis = axisOf(query.axis || 'GROUP');
  const typed = v.uuid(query.groupDetailTypeId, true);
  if (typed && axis !== 'DETAIL') v.invalid('گزینه گزارش معتبر نیست.');
  const scope = parseScope(query.scope);
  const legacyKey = v.text(query.selectedKey, 360);
  if (legacyKey) {
    const selection = { axis, key: legacyKey, typeId: typed };
    if (axis === 'TRACKING' && legacyKey.startsWith('[')) {
      let pair: unknown;
      try {
        pair = JSON.parse(legacyKey);
      } catch {
        pair = null;
      }
      if (Array.isArray(pair) && pair.length === 2)
        scope.push(
          selectionPredicate({
            ...selection,
            key: pair[0],
            trackingDate: pair[1],
          }),
        );
      else scope.push(selectionPredicate(selection));
    } else scope.push(selectionPredicate(selection));
  }
  const linesMode = query.view === 'lines' || !!legacyKey;
  if (
    (query.view && !['summary', 'lines'].includes(query.view)) ||
    (linesMode && !scope.length)
  )
    v.invalid('گزینه گزارش معتبر نیست.');
  const detailType = v.uuid(query.detailTypeId, true);
  const search = v.text(query.search, 160);
  const lineSearch = v.text(query.lineSearch, 160);
  const documentTypes = v.text(query.typeIds || query.typeId, 3700);
  const statuses = (v.text(query.statuses, 60) || 'POSTED').split(',');
  if (
    statuses.length > eligibleStatuses.length ||
    statuses.some((value) => !eligibleStatuses.includes(value))
  )
    v.invalid('گزینه گزارش معتبر نیست.');
  const csv = (value: string) => (value ? value.split(',') : []);
  const ids = csv(v.text(query.accountIds, 3700));
  if (ids.length > 100) v.invalid('حداکثر صد حساب انتخاب کنید.');
  const types = csv(documentTypes);
  if (types.length > 100) v.invalid('گزینه گزارش معتبر نیست.');
  const accountIds = ids.map((id) => v.uuid(id)!);
  const typeIds = types.map((id) => v.uuid(id)!);
  const min = v.decimal(query.minAmount, true),
    max = v.decimal(query.maxAmount, true);
  const numberFrom = documentNumber(query.numberFrom),
    numberTo = documentNumber(query.numberTo);
  if (min && max && new Prisma.Decimal(min).greaterThan(max))
    v.invalid('محدوده مبلغ سند معتبر نیست.');
  if (numberFrom !== null && numberTo !== null && numberFrom > numberTo)
    v.invalid('شماره سند معتبر نیست.');
  for (const flag of [
    query.traceableOnly,
    query.currencyOnly,
    query.hasBalance,
    query.export,
  ])
    if (flag !== undefined && !['true', 'false'].includes(flag))
      v.invalid('گزینه گزارش معتبر نیست.');
  const accountType = query.accountType;
  if (accountType && !['PERMANENT', 'TEMPORARY'].includes(accountType))
    v.invalid('گزینه گزارش معتبر نیست.');
  const sort = query.sort || 'code';
  if (!Object.hasOwn(reportSorts, sort)) v.invalid('گزینه گزارش معتبر نیست.');
  const summaryOrder = reportSorts[sort as keyof typeof reportSorts];
  const page = Number(query.page ?? 1);
  if (!Number.isSafeInteger(page) || page < 1 || page > 100000)
    v.invalid('صفحه معتبر نیست.');
  const exporting = query.export === 'true';
  const pageSize = exporting ? 5000 : 50;
  const pagination = sql`LIMIT ${pageSize + 1} OFFSET ${exporting ? 0 : (page - 1) * pageSize}`;

  const detailOnAxis = axis.startsWith('DETAIL') && axis !== 'DETAIL_TYPE';
  const { join, key, code, title, classification } = dimension(
    axis,
    typed ?? (detailOnAxis ? detailType : null),
  );
  const trackingDate = axis === 'TRACKING' ? followUpDate : sql`NULL::text`;
  const filters = [
    sql`j."bookId"=${bookId}::uuid AND j."periodId"=${periodId}::uuid AND j."documentDate"<=${to}`,
    sql`j.status IN (${Prisma.join(statuses)})`,
    ...scope,
  ];
  if (typeIds.length)
    filters.push(sql`j."typeId" = ANY(ARRAY[${Prisma.join(typeIds)}]::uuid[])`);
  if (numberFrom !== null) filters.push(sql`j.number>=${numberFrom}`);
  if (numberTo !== null) filters.push(sql`j.number<=${numberTo}`);
  if (min || max)
    filters.push(sql`(SELECT COALESCE(sum(total.debit),0) FROM accounting_journal_lines total
      WHERE total."journalId"=j.id) BETWEEN COALESCE(${min}::numeric,0) AND COALESCE(${max}::numeric,'Infinity'::numeric)`);
  if (query.currencyOnly === 'true')
    filters.push(
      sql`EXISTS (SELECT 1 FROM accounting_journal_lines fx WHERE fx."journalId"=j.id AND fx.currency IS NOT NULL)`,
    );
  if (query.traceableOnly === 'true')
    filters.push(sql`sub.attributes->'traceable'='true'::jsonb`);
  if (accountType)
    filters.push(sql`sub.permanent=${accountType === 'PERMANENT'}`);
  if (accountIds.length)
    filters.push(
      sql`ARRAY[sub.id,gl.id,grp.id] && ARRAY[${Prisma.join(accountIds)}]::uuid[]`,
    );

  if (detailType) {
    if (!linesMode && axis === 'DETAIL_TYPE')
      filters.push(sql`ct.id=${detailType}::uuid`);
    else if (linesMode || !detailOnAxis || (typed && typed !== detailType))
      filters.push(detailPredicate(axis, sql`d."typeId"=${detailType}::uuid`));
  }
  if (!linesMode) {
    filters.push(sql`${key} IS NOT NULL`);
    if (search)
      filters.push(
        sql`(strpos(lower(${title}),lower(${search}))>0 OR strpos(lower(${code}),lower(${search}))>0 OR strpos(COALESCE(${trackingDate},''),${search})>0)`,
      );
  }

  const source = sql`FROM accounting_journals j
    JOIN accounting_journal_lines l ON l."journalId"=j.id
    JOIN accounting_accounts sub ON sub.id=l."accountId" AND sub."bookId"=j."bookId"
    LEFT JOIN accounting_accounts gl ON gl.id=sub."parentId" AND gl."bookId"=j."bookId"
    LEFT JOIN accounting_accounts grp ON grp.id=gl."parentId" AND grp."bookId"=j."bookId"`;
  const where = sql`WHERE ${Prisma.join(filters, ' AND ')}`;

  const lines = linesMode
    ? await tx.$queryRaw<(AccountReviewLine & { opening: string })[]>(sql`
    WITH scoped AS (
      SELECT l.id,j.id AS "journalId",j.number,j."documentDate" AS date,l.position,
        COALESCE(NULLIF(j.attributes->>'referenceNumber',''),j.reference) AS reference,
        j.attributes->>'auxiliaryNumber' AS "secondaryNumber",j.status,
        j.description AS "journalDescription",l.description,sub.code AS "accountCode",
        sub.title AS "accountTitle",d4.code || ' ـ ' || d4.title AS detail4,
        d5.code || ' ـ ' || d5.title AS detail5,d6.code || ' ـ ' || d6.title AS detail6,
        l.currency,trim_scale(l."foreignAmount")::text AS "foreignAmount",trim_scale(l.rate)::text AS rate,
        ${tracking} AS "trackingNumber",l.attributes->>'trackingDate' AS "trackingDate",l.debit,l.credit
      ${source}
      LEFT JOIN accounting_details d4 ON d4.id=l."detail4Id" AND d4."bookId"=j."bookId"
      LEFT JOIN accounting_details d5 ON d5.id=l."detail5Id" AND d5."bookId"=j."bookId"
      LEFT JOIN accounting_details d6 ON d6.id=l."detail6Id" AND d6."bookId"=j."bookId"
      ${where}
    ), running AS (
      SELECT id,"journalId",number,date,position,reference,"secondaryNumber",status,"journalDescription",description,
        "accountCode","accountTitle",detail4,detail5,detail6,currency,"foreignAmount",rate,"trackingNumber","trackingDate",
        trim_scale(debit)::text AS debit,trim_scale(credit)::text AS credit,
        trim_scale(sum(debit-credit) OVER (ORDER BY ${lineOrder} ROWS UNBOUNDED PRECEDING))::text AS "runningBalance",
        trim_scale(COALESCE(sum(debit-credit) FILTER (WHERE date<${from}) OVER (),0))::text AS opening
      FROM scoped
    )
    SELECT * FROM running WHERE date>=${from}
    ${
      lineSearch
        ? sql`AND strpos(lower(concat_ws(' ',number::text,position::text,reference,"secondaryNumber",
      "journalDescription",description,"accountCode","accountTitle",detail4,detail5,detail6,"trackingNumber",currency)),
      lower(${lineSearch}))>0`
        : Prisma.empty
    }
    ORDER BY ${lineOrder} ${pagination}`)
    : [];

  const rows = linesMode
    ? []
    : await tx.$queryRaw<AccountReviewRow[]>(sql`
    WITH grouped AS (
      SELECT ${key} AS key,${code} AS code,${title} AS title,${classification} AS "classificationNumber",${trackingDate} AS "trackingDate",
        COALESCE(sum(l.debit-l.credit) FILTER (WHERE j."documentDate"<${from}),0) AS opening,
        COALESCE(sum(l.debit) FILTER (WHERE j."documentDate">=${from}),0) AS debit,
        COALESCE(sum(l.credit) FILTER (WHERE j."documentDate">=${from}),0) AS credit,
        sum(l.debit-l.credit) AS balance
        ${
          axis === 'CURRENCY'
            ? sql`,
          COALESCE(sum(CASE WHEN l.credit>0 THEN -l."foreignAmount" ELSE l."foreignAmount" END)
            FILTER (WHERE j."documentDate"<${from}),0) AS "foreignOpening",
          COALESCE(sum(l."foreignAmount") FILTER (WHERE j."documentDate">=${from} AND l.debit>0),0) AS "foreignDebit",
          COALESCE(sum(l."foreignAmount") FILTER (WHERE j."documentDate">=${from} AND l.credit>0),0) AS "foreignCredit",
          COALESCE(sum(CASE WHEN l.credit>0 THEN -l."foreignAmount" ELSE l."foreignAmount" END),0) AS "foreignBalance"`
            : sql`,NULL::numeric AS "foreignOpening",NULL::numeric AS "foreignDebit",NULL::numeric AS "foreignCredit",NULL::numeric AS "foreignBalance"`
        }
      ${source} ${join} ${where}
      GROUP BY 1,2,3,4,5
      ${query.hasBalance === 'true' ? sql`HAVING sum(l.debit-l.credit)<>0` : Prisma.empty}
    )
    SELECT key,code,title,"classificationNumber","trackingDate",trim_scale(opening)::text AS opening,trim_scale(debit)::text AS debit,
      trim_scale(credit)::text AS credit,trim_scale(balance)::text AS balance,
      trim_scale(greatest(balance,0))::text AS "balanceDebit",trim_scale(greatest(-balance,0))::text AS "balanceCredit",
      trim_scale("foreignOpening")::text AS "foreignOpening",trim_scale("foreignDebit")::text AS "foreignDebit",
      trim_scale("foreignCredit")::text AS "foreignCredit",trim_scale("foreignBalance")::text AS "foreignBalance"
    FROM grouped ORDER BY ${summaryOrder} ${pagination}`);

  const hasNext = Math.max(lines.length, rows.length) > pageSize;
  if (exporting && hasNext) v.rule('برای خروجی گزارش، محدوده را کوچک‌تر کنید.');
  const opening = lines[0]?.opening ?? null;
  const visibleLines: (AccountReviewLine & { opening?: string })[] =
    lines.slice(0, pageSize);
  for (const line of visibleLines) delete line.opening;
  return {
    periodId,
    from,
    to,
    page,
    pageSize,
    hasNext,
    opening,
    rows: rows.slice(0, pageSize),
    lines: visibleLines,
  };
}
