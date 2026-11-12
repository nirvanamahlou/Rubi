'use client';
import type { AccountingSnapshotV1 } from '@nora/contracts';
import { accountingCompletionRoute } from '../accounting-completion-routes';
import { AccountingTaxWorkspace } from './accounting-tax-workspace';
import { AccountingTaxpayerWorkspace } from './accounting-taxpayer-workspace';
import { AccountingChartReport } from './accounting-chart-report';
import { AccountingCompletionReport } from './accounting-completion-report';
import { AccountingJournalBrowser } from './accounting-journal-browser';
import { AccountingElectronicBook } from './accounting-electronic-book';

/** Dispatches prepared screens only after the workspace has loaded an authorized book. */
export function AccountingCompletionWorkspace({
  book,
  route,
}: {
  book: AccountingSnapshotV1;
  route: string;
}) {
  switch (accountingCompletionRoute(route)) {
    case 'electronic-book':
      return <AccountingElectronicBook key={book.book.id} book={book} />;
    case 'journal-browser':
      return <AccountingJournalBrowser key={book.book.id} book={book} />;
    case 'tax':
      return (
        <AccountingTaxWorkspace
          key={`${book.book.id}:${route}`}
          book={book}
          route={route}
        />
      );
    case 'taxpayer':
      return (
        <AccountingTaxpayerWorkspace
          key={`${book.book.id}:${route}`}
          book={book}
          route={route}
        />
      );
    case 'chart':
      return <AccountingChartReport key={book.book.id} book={book} />;
    case 'journal-lines':
      return <AccountingCompletionReport key={book.book.id} book={book} />;
    default:
      return null;
  }
}
