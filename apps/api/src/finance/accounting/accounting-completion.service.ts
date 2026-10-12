import {
  ForbiddenException,
  Inject,
  Injectable,
  NotFoundException,
} from '@nestjs/common';
import type { AuthenticatedActor } from '@nora/contracts';
import { Prisma } from '@nora/database';
import { DatabaseService } from '../../database/database.service';
import { DecimalValue } from '../finance.money';
import * as v from './accounting.validation';

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
  constructor(
    @Inject(DatabaseService) private readonly database: DatabaseService,
  ) {}

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
    return book;
  }

  private async period(
    tx: Prisma.TransactionClient,
    bookId: string,
    query: Query,
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
    const from = query.from ? v.date(query.from)! : period.startDate;
    const to = query.to ? v.date(query.to)! : period.endDate;
    if (from > to || from < period.startDate || to > period.endDate)
      v.invalid('بازه گزارش باید داخل یک دوره مالی باشد.');
    return { period, from, to };
  }

  async journalLines(bookId: string, query: Query, actor: AuthenticatedActor) {
    return this.database.client.$transaction(
      async (tx) => {
        const book = await this.scope(tx, bookId, actor);
        const { period, from, to } = await this.period(tx, bookId, query);
        const pageText = query.page ?? '1';
        if (typeof pageText !== 'string' || !/^[1-9]\d{0,4}$/.test(pageText))
          v.invalid('صفحه معتبر نیست.');
        const page = Number(pageText),
          pageSize = 50;
        const where: Prisma.AccountingJournalLineWhereInput = {
          journal: {
            bookId,
            periodId: period.id,
            status: 'POSTED',
            documentDate: { gte: from, lte: to },
          },
        };
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
        const totals = await tx.accountingJournalLine.aggregate({
          where,
          _sum: { debit: true, credit: true },
        });
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
              select: { id: true, bookId: true, code: true, title: true },
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
          basis: 'POSTED' as const,
          currency: book.baseCurrency,
          periodId: period.id,
          from,
          to,
          page,
          pageSize,
          total,
          debit: totals._sum.debit?.toFixed() ?? '0',
          credit: totals._sum.credit?.toFixed() ?? '0',
          rows: rows.map((row) => ({
            id: row.id,
            journalId: row.journal.id,
            number: row.journal.number,
            date: row.journal.documentDate,
            position: row.position,
            account: label(row.account),
            detail4: label(row.detail4),
            detail5: label(row.detail5),
            detail6: label(row.detail6),
            description: row.description || row.journal.description,
            debit: row.debit.toFixed(),
            credit: row.credit.toFixed(),
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
