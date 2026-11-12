import {
  ForbiddenException,
  Inject,
  Injectable,
  NotFoundException,
  Optional,
} from '@nestjs/common';
import type { AuthenticatedActor } from '@nora/contracts';
import { Prisma } from '@nora/database';
import { DatabaseService } from '../../database/database.service';
import { AccountingCompanyScope } from './accounting-company-scope';
import { IamFinanceDirectory } from '../../iam/iam-finance-directory';
import {
  journalBrowserAxes,
  journalBrowserObservations,
  journalBrowserRows,
  type JournalBrowserAxis,
} from './accounting-journal-browser';
import { DecimalValue } from '../finance.money';
import * as v from './accounting.validation';
import {
  aggregateInternalReport,
  ageInternalLines,
  reportAxes,
} from './accounting.report-engine';

type Query = Record<string, unknown>;
const allowed = [
  'periodId',
  'from',
  'to',
  'accountId',
  'detail4Id',
  'detail5Id',
  'detail6Id',
  'page',
];

/** A bounded internal posted-line report, not a statutory book or filing. */
@Injectable()
export class AccountingCompletionService {
  async internalReport(
    bookId: string,
    kind: string,
    query: Query,
    actor: AuthenticatedActor,
  ) {
    if (
      ![
        'analysis',
        'matrix',
        'comprehensive',
        'ledgers',
        'aging',
        'dashboard',
        'legal-ledgers',
      ].includes(kind)
    )
      v.invalid('نوع گزارش معتبر نیست.');
    if (
      Object.keys(query).some(
        (key) =>
          ![
            ...allowed,
            'axes',
            'typeId',
            'toPeriodId',
            'groupId',
            'detailId',
            'detailTypeId',
            'fromNumber',
            'toNumber',
            'activeOnly',
            'noDetails',
            'traceableOnly',
            'includeOpening',
            'includeAnyNature',
            'calendar',
          ].includes(key),
      )
    )
      v.invalid('فیلتر گزارش معتبر نیست.');
    if (Object.values(query).some((value) => typeof value !== 'string'))
      v.invalid('فیلتر گزارش معتبر نیست.');
    const calendar = String(query.calendar || 'GREGORIAN');
    if (!['GREGORIAN', 'PERSIAN'].includes(calendar))
      v.invalid('فیلتر گزارش معتبر نیست.');
    for (const key of [
      'activeOnly',
      'noDetails',
      'traceableOnly',
      'includeOpening',
      'includeAnyNature',
    ])
      if (
        query[key] !== undefined &&
        !['true', 'false'].includes(String(query[key]))
      )
        v.invalid('گزینه گزارش معتبر نیست.');
    const dimensions = reportAxes(
      query.axes ?? (kind === 'matrix' ? 'account,month' : undefined),
    );
    if (kind === 'matrix' && dimensions.length !== 2)
      v.invalid('گزارش ماتریسی به دو بعد متمایز نیاز دارد.');
    return this.database.client.$transaction(
      async (tx) => {
        const book = await this.scope(tx, bookId, actor);
        const { period, from, to, periodIds } = await this.period(
          tx,
          bookId,
          Object.fromEntries(
            Object.entries(query).filter(([key]) => allowed.includes(key)),
          ),
          query.toPeriodId,
        );
        if (
          query.typeId &&
          !(await tx.accountingConfiguration.findFirst({
            where: { id: v.uuid(query.typeId)!, bookId, kind: 'voucher-types' },
          }))
        )
          throw new NotFoundException();
        const number = (value: unknown) => {
          if (value === undefined) return undefined;
          if (
            typeof value !== 'string' ||
            !/^[1-9]\d{0,9}$/.test(value) ||
            Number(value) > 2147483647
          )
            v.invalid('شماره سند معتبر نیست.');
          return Number(value);
        };
        const firstNumber = number(query.fromNumber),
          lastNumber = number(query.toNumber);
        if (firstNumber && lastNumber && firstNumber > lastNumber)
          v.invalid('بازه شماره سند معتبر نیست.');
        const numberFilter = {
          ...(firstNumber ? { gte: firstNumber } : {}),
          ...(lastNumber ? { lte: lastNumber } : {}),
        };
        const dateFilter = {
          lte: to,
          ...(query.includeOpening === 'false' ? { gte: from } : {}),
        };
        const journal: Prisma.AccountingJournalWhereInput = {
          bookId,
          periodId: { in: periodIds },
          status: 'POSTED',
          ...(kind === 'legal-ledgers'
            ? {
                generalDocumentMember: {
                  is: {
                    bookId,
                    document: {
                      bookId,
                      documentDate: dateFilter,
                      ...(firstNumber || lastNumber
                        ? { number: numberFilter }
                        : {}),
                    },
                  },
                },
              }
            : {
                documentDate: dateFilter,
                ...(firstNumber || lastNumber ? { number: numberFilter } : {}),
              }),
          ...(query.typeId ? { typeId: v.uuid(query.typeId)! } : {}),
        };
        const where: Prisma.AccountingJournalLineWhereInput = {
          journal,
          account: {
            bookId,
            ...(query.activeOnly === 'true' ? { active: true } : {}),
            ...(query.traceableOnly === 'true'
              ? { attributes: { path: ['traceable'], equals: true } }
              : {}),
            ...(kind === 'aging' && query.includeAnyNature !== 'true'
              ? { nature: { not: 'ANY' } }
              : {}),
          },
        };
        const accounts = await tx.accountingAccount.findMany({
          where: { bookId },
          select: { id: true, parentId: true },
        });
        const expand = (ids: string[]) => {
          const selected = new Set(ids);
          for (let count = 0; count <= accounts.length; count++) {
            let changed = false;
            for (const a of accounts)
              if (
                a.parentId &&
                selected.has(a.parentId) &&
                !selected.has(a.id)
              ) {
                selected.add(a.id);
                changed = true;
              }
            if (!changed) return [...selected];
          }
          v.rule('ساختار حساب معتبر نیست.');
        };
        if (query.accountId) {
          const id = v.uuid(query.accountId)!;
          if (!accounts.some((a) => a.id === id)) throw new NotFoundException();
          where.accountId = { in: expand([id]) };
        }
        if (query.groupId) {
          const group = await tx.accountingAccountGroup.findFirst({
            where: { id: v.uuid(query.groupId)!, bookId },
            include: { members: true },
          });
          if (!group) throw new NotFoundException();
          const grouped = expand(group.members.map((m) => m.accountId));
          where.accountId = {
            in: query.accountId
              ? grouped.filter((id) =>
                  expand([String(query.accountId)]).includes(id),
                )
              : grouped,
          };
        }
        const extraFilters: Prisma.AccountingJournalLineWhereInput[] = [];
        if (query.noDetails === 'true')
          extraFilters.push({
            detail4Id: null,
            detail5Id: null,
            detail6Id: null,
          });
        if (query.detailId) {
          const id = v.uuid(query.detailId)!;
          if (!(await tx.accountingDetail.findFirst({ where: { id, bookId } })))
            throw new NotFoundException();
          where.OR = [{ detail4Id: id }, { detail5Id: id }, { detail6Id: id }];
        }
        if (query.detailTypeId) {
          const id = v.uuid(query.detailTypeId)!;
          if (
            !(await tx.accountingConfiguration.findFirst({
              where: { id, bookId, kind: 'detail-types' },
            }))
          )
            throw new NotFoundException();
          extraFilters.push({
            OR: [
              { detail4: { typeId: id, bookId } },
              { detail5: { typeId: id, bookId } },
              { detail6: { typeId: id, bookId } },
            ],
          });
        }
        if (extraFilters.length) where.AND = extraFilters;
        for (const level of [4, 5, 6] as const)
          if (query[`detail${level}Id`])
            where[`detail${level}Id`] = v.uuid(query[`detail${level}Id`])!;
        const count = await tx.accountingJournalLine.count({ where });
        if (count > 20000)
          v.rule(
            'بازه گزارش را به حداکثر ۲۰۰۰۰ قلم محدود کنید؛ نتیجه ناقص تولید نمی‌شود.',
          );
        const records = await tx.accountingJournalLine.findMany({
          where,
          include: {
            account: true,
            journal: {
              include: {
                generalDocumentMember: { include: { document: true } },
              },
            },
          },
          orderBy: [
            { journal: { documentDate: 'asc' } },
            { journalId: 'asc' },
            { position: 'asc' },
          ],
        });
        if (
          records.some(
            (r) =>
              !r.account ||
              r.account.bookId !== bookId ||
              !r.journal.documentDate ||
              (kind === 'legal-ledgers' &&
                (!r.journal.generalDocumentMember ||
                  r.journal.generalDocumentMember.document.periodId !==
                    r.journal.periodId)),
          )
        )
          v.rule('اقلام قطعی گزارش مرجع معتبر ندارند.');
        if (kind === 'legal-ledgers')
          records.sort((a, b) => {
            const left = a.journal.generalDocumentMember!.document,
              right = b.journal.generalDocumentMember!.document;
            return (
              left.documentDate.localeCompare(right.documentDate) ||
              left.number - right.number ||
              a.journalId.localeCompare(b.journalId) ||
              a.position - b.position
            );
          });
        const lines = records.map((r) => ({
          id: r.id,
          journalId: r.journalId,
          accountId: r.accountId!,
          accountCode: r.account?.bookId === bookId ? r.account.code : '',
          accountTitle: r.account?.bookId === bookId ? r.account.title : '',
          detail4Id: r.detail4Id,
          detail5Id: r.detail5Id,
          detail6Id: r.detail6Id,
          documentDate:
            kind === 'legal-ledgers'
              ? r.journal.generalDocumentMember!.document.documentDate
              : r.journal.documentDate!,
          debit: r.debit.toFixed(),
          credit: r.credit.toFixed(),
          currency:
            r.currency ??
            (/^(REVALUE|OPEN|CLOSE|FINAL|NATURE|REVERSE):/.test(
              r.journal.sourceKey ?? '',
            ) &&
            typeof v.attributes(r.attributes).valuationCurrency === 'string'
              ? String(v.attributes(r.attributes).valuationCurrency)
              : book.baseCurrency),
          foreignAmount: r.foreignAmount?.toFixed() ?? null,
          opening:
            r.journal.sourceKey?.startsWith('OPEN:') ||
            v.attributes(r.journal.attributes).sourcePage === 'setup-opening',
        }));
        const aggregate =
          kind === 'aging'
            ? undefined
            : aggregateInternalReport(
                lines,
                dimensions,
                from,
                calendar as 'PERSIAN' | 'GREGORIAN',
              );
        if (kind === 'matrix' && aggregate) {
          const rows = new Set(
            aggregate.rows.map((r) => r.dimensions[dimensions[0]!]),
          );
          const columns = new Set(
            aggregate.rows.map((r) => r.dimensions[dimensions[1]!]),
          );
          if (rows.size * columns.size > 10000)
            v.rule('بازه یا ابعاد ماتریس را به حداکثر ۱۰۰۰۰ خانه محدود کنید.');
        }
        return {
          kind,
          engineVersion: 'nora-accounting-reports-v1',
          generatedAt: new Date().toISOString(),
          statutory: false,
          basis: 'POSTED',
          calendar,
          currency: book.baseCurrency,
          periodId: period.id,
          periodIds,
          from,
          to,
          sourceCount: count,
          axes: dimensions,
          ...(kind === 'legal-ledgers' || kind === 'ledgers'
            ? {
                lines: records
                  .filter(
                    (r) =>
                      (kind === 'legal-ledgers'
                        ? r.journal.generalDocumentMember!.document.documentDate
                        : r.journal.documentDate!) >= from,
                  )
                  .map((r) => ({
                    id: r.id,
                    journalId: r.journalId,
                    number:
                      kind === 'legal-ledgers'
                        ? r.journal.generalDocumentMember!.document.number
                        : r.journal.number,
                    date:
                      kind === 'legal-ledgers'
                        ? r.journal.generalDocumentMember!.document.documentDate
                        : r.journal.documentDate,
                    accountCode: r.account!.code,
                    accountTitle: r.account!.title,
                    description: r.description || r.journal.description,
                    debit: r.debit.toFixed(),
                    credit: r.credit.toFixed(),
                  })),
              }
            : {}),
          journalCount: new Set(records.map((r) => r.journalId)).size,
          ...(kind === 'dashboard'
            ? {
                accounts: aggregateInternalReport(lines, ['account'], from)
                  .rows,
                unfinished: await tx.accountingJournal.count({
                  where: {
                    bookId,
                    periodId: period.id,
                    status: { in: ['DRAFT', 'PENDING_APPROVAL', 'APPROVED'] },
                  },
                }),
              }
            : {}),
          ...(kind === 'aging'
            ? {
                ageBasis: 'DOCUMENT_DATE',
                settlementMethod: 'FIFO_ESTIMATE',
                bucketDays: [30, 60, 90, 120],
                rows: ageInternalLines(lines, to),
              }
            : aggregate!),
        };
      },
      { isolationLevel: Prisma.TransactionIsolationLevel.RepeatableRead },
    );
  }
  constructor(
    @Inject(DatabaseService) private readonly database: DatabaseService,
    @Optional()
    @Inject(AccountingCompanyScope)
    private readonly companyScope?: AccountingCompanyScope,
    @Optional()
    @Inject(IamFinanceDirectory)
    private readonly identity?: IamFinanceDirectory,
  ) {}

  async journalBrowser(
    bookId: string,
    query: Query,
    actor: AuthenticatedActor,
  ) {
    if (
      Object.keys(query).some(
        (key) =>
          ![
            'periodId',
            'from',
            'to',
            'axis',
            'selectedKey',
            'page',
            'calendar',
          ].includes(key),
      ) ||
      Object.values(query).some((value) => typeof value !== 'string')
    )
      v.invalid('فیلتر گزارش معتبر نیست.');
    const axis = String(query.axis ?? 'user') as JournalBrowserAxis;
    if (!journalBrowserAxes.includes(axis)) v.invalid('نوع گزارش معتبر نیست.');
    const calendar = String(query.calendar || 'GREGORIAN');
    if (!['PERSIAN', 'GREGORIAN'].includes(calendar))
      v.invalid('فیلتر گزارش معتبر نیست.');
    const pageText = String(query.page ?? '1');
    if (!/^[1-9]\d{0,4}$/.test(pageText)) v.invalid('صفحه معتبر نیست.');
    const page = Number(pageText);
    const selectedKey =
      query.selectedKey === undefined
        ? undefined
        : v.text(query.selectedKey, 40);
    return this.database.client.$transaction(
      async (tx) => {
        await this.scope(tx, bookId, actor);
        const { period, from, to } = await this.period(
          tx,
          bookId,
          Object.fromEntries(
            Object.entries(query).filter(([key]) =>
              ['periodId', 'from', 'to'].includes(key),
            ),
          ),
        );
        const observations = await journalBrowserObservations(
          tx,
          bookId,
          period.id,
          from,
          to,
        );
        const rows = journalBrowserRows(
          observations,
          axis,
          calendar as 'PERSIAN' | 'GREGORIAN',
        );
        const selected = rows.find((row) => row.key === selectedKey);
        const documents = selected
          ? await tx.accountingJournal.findMany({
              where: {
                bookId,
                periodId: period.id,
                id: { in: [...selected.journalIds] },
              },
              select: {
                id: true,
                number: true,
                documentDate: true,
                description: true,
                status: true,
              },
              orderBy: [
                { documentDate: 'asc' },
                { number: 'asc' },
                { id: 'asc' },
              ],
              skip: (page - 1) * 50,
              take: 50,
            })
          : [];
        const names =
          axis === 'user' && this.identity
            ? await this.identity.displayNames(
                rows.map((row) => row.key).filter(Boolean),
                actor.branchIds,
              )
            : [];
        const types =
          axis === 'type'
            ? await tx.accountingConfiguration.findMany({
                where: {
                  bookId,
                  kind: 'voucher-types',
                  id: { in: rows.map((row) => row.key).filter(Boolean) },
                },
                select: { id: true, title: true },
              })
            : [];
        return {
          axis,
          calendar,
          periodId: period.id,
          from,
          to,
          basis: 'SAVED_HISTORY' as const,
          historicalGap: observations.some((row) => row.historicalGap),
          documents,
          totalDocuments: selected?.journalIds.size ?? 0,
          page,
          pageSize: 50,
          rows: rows.map((row) => ({
            key: row.key,
            issued: row.issued,
            issuedLines: row.issuedLines,
            changed: row.changed,
            changedLines: row.changedLines,
            reviewed: row.reviewed,
            historicalGap: row.historicalGap,
            title:
              axis === 'user'
                ? (names.find((name) => name.id === row.key)?.displayName ??
                  null)
                : axis === 'type'
                  ? (types.find((type) => type.id === row.key)?.title ?? null)
                  : row.key,
          })),
        };
      },
      { isolationLevel: 'RepeatableRead' },
    );
  }

  private async scope(
    tx: Prisma.TransactionClient,
    bookId: string,
    actor: AuthenticatedActor,
  ) {
    if (
      !actor.permissions.includes('finance.read') ||
      !actor.permissions.includes('finance.journal.read')
    )
      throw new ForbiddenException();
    const book = await tx.accountingBook.findFirst({
      where: { id: v.uuid(bookId)!, branchId: { in: actor.branchIds } },
    });
    if (!book) throw new NotFoundException('دفتر حسابداری پیدا نشد.');
    await this.companyScope?.assertBook(book, actor);
    return book;
  }

  private async period(
    tx: Prisma.TransactionClient,
    bookId: string,
    query: Query,
    endPeriodId?: unknown,
  ) {
    if (
      Object.keys(query).some((key) => !allowed.includes(key)) ||
      Object.values(query).some((value) => typeof value !== 'string')
    )
      v.invalid('فیلتر گزارش معتبر نیست.');
    const period = await tx.accountingPeriod.findFirst({
      where: { id: v.uuid(query.periodId)!, bookId },
    });
    if (!period) throw new NotFoundException();
    const endPeriod = endPeriodId
      ? await tx.accountingPeriod.findFirst({
          where: { id: v.uuid(endPeriodId)!, bookId },
        })
      : period;
    if (!endPeriod) throw new NotFoundException();
    if (endPeriod.startDate < period.startDate)
      v.invalid('ترتیب دوره‌های مالی معتبر نیست.');
    const from = query.from ? v.date(query.from)! : period.startDate;
    const to = query.to ? v.date(query.to)! : endPeriod.endDate;
    if (from > to || from < period.startDate || to > endPeriod.endDate)
      v.invalid('بازه گزارش باید داخل یک دوره مالی باشد.');
    const periods =
      endPeriod.id === period.id
        ? [period]
        : await tx.accountingPeriod.findMany({
            where: {
              bookId,
              startDate: { gte: period.startDate },
              endDate: { lte: endPeriod.endDate },
            },
          });
    return { period, from, to, periodIds: periods.map((p) => p.id) };
  }

  async journalLines(bookId: string, query: Query, actor: AuthenticatedActor) {
    const extras = [
      'toPeriodId',
      'typeId',
      'status',
      'fromNumber',
      'toNumber',
      'description',
      'descriptionMode',
      'currency',
      'amountMode',
      'export',
    ];
    if (
      Object.keys(query).some(
        (key) => ![...allowed, ...extras].includes(key),
      ) ||
      Object.values(query).some((value) => typeof value !== 'string')
    )
      v.invalid('فیلتر گزارش معتبر نیست.');
    if (
      query.export !== undefined &&
      !['true', 'false'].includes(String(query.export))
    )
      v.invalid('گزینه گزارش معتبر نیست.');
    const exporting = query.export === 'true';
    if (exporting && !actor.permissions.includes('finance.export'))
      throw new ForbiddenException();
    const statuses = [
      'MEMORANDUM',
      'DRAFT',
      'PENDING_APPROVAL',
      'APPROVED',
      'POSTED',
      'CANCELLED',
      'ALL',
    ];
    const status = String(query.status || 'POSTED');
    if (!statuses.includes(status)) v.invalid('وضعیت سند معتبر نیست.');
    const descriptionMode = String(query.descriptionMode || 'contains');
    if (
      !['contains', 'equals', 'startsWith', 'endsWith'].includes(
        descriptionMode,
      )
    )
      v.invalid('فیلتر شرح معتبر نیست.');
    const amountMode = String(query.amountMode || 'BASE');
    const currency = v.text(query.currency, 3);
    if (
      (currency && !/^[A-Z]{3}$/.test(currency)) ||
      !['BASE', 'FOREIGN'].includes(amountMode) ||
      (amountMode === 'FOREIGN' && !currency)
    )
      v.invalid('کد ارز معتبر نیست.');
    const number = (value: unknown) => {
      if (!value) return undefined;
      const normalized = String(value).replace(/[۰-۹٠-٩]/g, (d) =>
        String(d.charCodeAt(0) - (d >= '۰' ? 1776 : 1632)),
      );
      if (!/^[1-9]\d{0,9}$/.test(normalized) || Number(normalized) > 2147483647)
        v.invalid('شماره سند معتبر نیست.');
      return Number(normalized);
    };
    const fromNumber = number(query.fromNumber),
      toNumber = number(query.toNumber);
    if (fromNumber && toNumber && fromNumber > toNumber)
      v.invalid('بازه شماره سند معتبر نیست.');
    return this.database.client.$transaction(
      async (tx) => {
        const book = await this.scope(tx, bookId, actor);
        const { period, from, to, periodIds } = await this.period(
          tx,
          bookId,
          Object.fromEntries(
            Object.entries(query).filter(([key]) => allowed.includes(key)),
          ),
          query.toPeriodId || undefined,
        );
        const pageText = query.page ?? '1';
        if (typeof pageText !== 'string' || !/^[1-9]\d{0,4}$/.test(pageText))
          v.invalid('صفحه معتبر نیست.');
        const page = Number(pageText),
          pageSize = exporting ? 20000 : 50;
        if (exporting && page !== 1) v.invalid('صفحه معتبر نیست.');
        if (
          query.typeId &&
          !(await tx.accountingConfiguration.findFirst({
            where: { id: v.uuid(query.typeId)!, bookId, kind: 'voucher-types' },
          }))
        )
          throw new NotFoundException();
        const journal: Prisma.AccountingJournalWhereInput = {
          bookId,
          periodId: { in: periodIds },
          status: status === 'ALL' ? { not: 'CANCELLED' } : status,
          documentDate: { gte: from, lte: to },
          ...(query.typeId ? { typeId: v.uuid(query.typeId)! } : {}),
          ...(fromNumber || toNumber
            ? {
                number: {
                  ...(fromNumber ? { gte: fromNumber } : {}),
                  ...(toNumber ? { lte: toNumber } : {}),
                },
              }
            : {}),
          ...(query.description
            ? {
                description: {
                  [descriptionMode]: v.text(query.description, 2000),
                  mode: 'insensitive',
                },
              }
            : {}),
        };
        const where: Prisma.AccountingJournalLineWhereInput = {
          journal,
          ...(currency ? { currency } : {}),
        };
        if (amountMode === 'FOREIGN') where.foreignAmount = { not: null };
        if (query.accountId) {
          const account = await tx.accountingAccount.findFirst({
            where: { id: v.uuid(query.accountId)!, bookId },
          });
          if (!account) throw new NotFoundException();
          where.accountId = account.id;
        }
        for (const level of [4, 5, 6] as const) {
          const key = `detail${level}Id` as const;
          if (!query[key]) continue;
          const detail = await tx.accountingDetail.findFirst({
            where: { id: v.uuid(query[key])!, bookId },
          });
          if (!detail) throw new NotFoundException();
          where[key] = detail.id;
        }
        const total = await tx.accountingJournalLine.count({ where });
        if (exporting && total > 20000)
          v.rule(
            'بازه گزارش را به حداکثر ۲۰۰۰۰ قلم محدود کنید؛ نتیجه ناقص تولید نمی‌شود.',
          );
        const totals = await tx.accountingJournalLine.aggregate({
          where,
          _sum: { debit: true, credit: true },
        });
        const foreignDebit =
          amountMode === 'FOREIGN'
            ? await tx.accountingJournalLine.aggregate({
                where: { ...where, debit: { gt: 0 } },
                _sum: { foreignAmount: true },
              })
            : null;
        const foreignCredit =
          amountMode === 'FOREIGN'
            ? await tx.accountingJournalLine.aggregate({
                where: { ...where, credit: { gt: 0 } },
                _sum: { foreignAmount: true },
              })
            : null;
        const rows = await tx.accountingJournalLine.findMany({
          where,
          select: {
            id: true,
            position: true,
            description: true,
            debit: true,
            credit: true,
            currency: true,
            foreignAmount: true,
            rate: true,
            journal: {
              select: {
                id: true,
                number: true,
                documentDate: true,
                description: true,
              },
            },
            account: {
              select: {
                id: true,
                bookId: true,
                code: true,
                title: true,
                level: true,
                parent: {
                  select: {
                    bookId: true,
                    level: true,
                    code: true,
                    title: true,
                  },
                },
              },
            },
            detail4: { select: { bookId: true, code: true, title: true } },
            detail5: { select: { bookId: true, code: true, title: true } },
            detail6: { select: { bookId: true, code: true, title: true } },
          },
          orderBy: [
            { journal: { documentDate: 'asc' } },
            { journalId: 'asc' },
            { position: 'asc' },
          ],
          skip: (page - 1) * pageSize,
          take: pageSize,
        });
        const label = (
          row: { bookId: string; code: string; title: string } | null,
        ) => (row?.bookId === bookId ? `${row.code} — ${row.title}` : null);
        return {
          basis: status,
          bookId,
          bookTitle: book.title,
          amountMode,
          currency: amountMode === 'FOREIGN' ? currency : book.baseCurrency,
          periodId: period.id,
          from,
          to,
          page,
          pageSize,
          total,
          debit:
            amountMode === 'FOREIGN'
              ? (foreignDebit?._sum.foreignAmount?.toFixed() ?? '0')
              : (totals._sum.debit?.toFixed() ?? '0'),
          credit:
            amountMode === 'FOREIGN'
              ? (foreignCredit?._sum.foreignAmount?.toFixed() ?? '0')
              : (totals._sum.credit?.toFixed() ?? '0'),
          rows: rows.map((row) => ({
            id: row.id,
            journalId: row.journal.id,
            number: row.journal.number,
            date: row.journal.documentDate,
            position: row.position,
            account: label(row.account),
            accountCode:
              row.account?.bookId === bookId ? row.account.code : null,
            accountTitle:
              row.account?.bookId === bookId ? row.account.title : null,
            generalCode:
              row.account?.bookId === bookId && row.account.level === 'GENERAL'
                ? row.account.code
                : row.account?.parent?.bookId === bookId &&
                    row.account.parent.level === 'GENERAL'
                  ? row.account.parent.code
                  : null,
            generalTitle:
              row.account?.bookId === bookId && row.account.level === 'GENERAL'
                ? row.account.title
                : row.account?.parent?.bookId === bookId &&
                    row.account.parent.level === 'GENERAL'
                  ? row.account.parent.title
                  : null,
            journalDescription: row.journal.description,
            detail4: label(row.detail4),
            detail5: label(row.detail5),
            detail6: label(row.detail6),
            description: row.description || row.journal.description,
            debit:
              amountMode === 'FOREIGN'
                ? row.debit.gt(0)
                  ? (row.foreignAmount?.toFixed() ?? '0')
                  : '0'
                : row.debit.toFixed(),
            credit:
              amountMode === 'FOREIGN'
                ? row.credit.gt(0)
                  ? (row.foreignAmount?.toFixed() ?? '0')
                  : '0'
                : row.credit.toFixed(),
            currency: row.currency,
            foreignAmount: row.foreignAmount?.toFixed() ?? null,
            rate: row.rate?.toFixed() ?? null,
          })),
        };
      },
      { isolationLevel: Prisma.TransactionIsolationLevel.RepeatableRead },
    );
  }

  /** Diagnostic only: never closes a period or creates a voucher. */
  async yearEndReadiness(
    bookId: string,
    periodId: string,
    actor: AuthenticatedActor,
  ) {
    return this.database.client.$transaction(
      async (tx) => {
        const book = await this.scope(tx, bookId, actor);
        const { period } = await this.period(tx, bookId, { periodId });
        const journal = { bookId, periodId, status: 'POSTED' };
        const posted = await tx.accountingJournal.count({ where: journal });
        const unfinished = await tx.accountingJournal.count({
          where: {
            bookId,
            periodId,
            status: { notIn: ['POSTED', 'CANCELLED'] },
          },
        });
        const balances = await tx.accountingJournalLine.groupBy({
          by: ['accountId'],
          where: { journal },
          _sum: { debit: true, credit: true },
        });
        const accounts = await tx.accountingAccount.findMany({
          where: { bookId },
          select: {
            id: true,
            code: true,
            title: true,
            nature: true,
            permanent: true,
          },
        });
        const byId = new Map(accounts.map((account) => [account.id, account]));
        const exceptions = balances.flatMap((row) => {
          const account = row.accountId ? byId.get(row.accountId) : undefined;
          if (!account) return [];
          const balance = DecimalValue.parse(
            row._sum.debit?.toFixed() ?? '0',
          ).subtract(DecimalValue.parse(row._sum.credit?.toFixed() ?? '0'));
          if (balance.isZero) return [];
          const contrary =
            (account.nature === 'DEBIT' && balance.isNegative) ||
            (account.nature === 'CREDIT' && !balance.isNegative);
          return !account.permanent || contrary
            ? [
                {
                  accountId: account.id,
                  code: account.code,
                  title: account.title,
                  balance: balance.toString(),
                  temporary: !account.permanent,
                  contrary,
                },
              ]
            : [];
        });
        return {
          periodId,
          status: period.status,
          currency: book.baseCurrency,
          posted,
          unfinished,
          exceptions,
          diagnosticOnly: true as const,
          executionAvailable: false as const,
        };
      },
      { isolationLevel: Prisma.TransactionIsolationLevel.RepeatableRead },
    );
  }
}
