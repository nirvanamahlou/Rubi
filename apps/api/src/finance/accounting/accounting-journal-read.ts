import { accountingDetailLevels } from '@nora/contracts';
import { NotFoundException } from '@nestjs/common';
import type { FinanceJournalReadV1 } from '@nora/contracts';
import type { Prisma } from '@nora/database';
import { DecimalValue } from '../finance.money';

export function journalAuxiliaryNumber(attributes: unknown): string | null {
  if (
    !attributes ||
    typeof attributes !== 'object' ||
    Array.isArray(attributes)
  )
    return null;
  const value = (attributes as Record<string, unknown>).auxiliaryNumber;
  return typeof value === 'string' && value.length > 0 ? value : null;
}

/** Caller must authorize the exact book. This is a read, never a period/editor switch. */
export async function readAccountingJournal(
  db: Prisma.TransactionClient,
  bookId: string,
  journalId: string,
): Promise<FinanceJournalReadV1> {
  const identity = { code: true, title: true } as const;
  const row = await db.accountingJournal.findFirst({
    where: { id: journalId, bookId },
    include: {
      book: { select: { title: true, baseCurrency: true } },
      period: { select: { fiscalYear: { select: { title: true } } } },
      lines: {
        orderBy: { position: 'asc' },
        include: {
          account: { select: identity },
          ...(Object.fromEntries(
            accountingDetailLevels.map((level) => [
              `detail${level}`,
              { select: identity },
            ]),
          ) as Record<
            `detail${(typeof accountingDetailLevels)[number]}`,
            { select: typeof identity }
          >),
        },
      },
    },
  });
  if (!row) throw new NotFoundException();
  return {
    id: row.id,
    bookId: row.bookId,
    bookTitle: row.book.title,
    periodTitle: row.period?.fiscalYear.title ?? null,
    number: row.number,
    auxiliaryNumber: journalAuxiliaryNumber(row.attributes),
    baseCurrency: row.book.baseCurrency,
    debit: row.lines
      .reduce(
        (sum, line) => sum.add(DecimalValue.parse(line.debit.toString())),
        DecimalValue.zero(),
      )
      .toString(),
    credit: row.lines
      .reduce(
        (sum, line) => sum.add(DecimalValue.parse(line.credit.toString())),
        DecimalValue.zero(),
      )
      .toString(),
    documentDate: row.documentDate,
    description: row.description,
    reference: row.reference,
    status: row.status,
    lines: row.lines.map((line) => ({
      position: line.position,
      account: line.account,
      details: accountingDetailLevels.flatMap((level) => {
        const detail = line[`detail${level}`];
        return detail ? [{ ...detail, level }] : [];
      }),
      description: line.description,
      debit: line.debit.toString(),
      credit: line.credit.toString(),
      currency: line.currency,
      foreignAmount: line.foreignAmount?.toString() ?? null,
      rate: line.rate?.toString() ?? null,
    })),
  };
}
