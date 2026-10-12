'use client';
import type { AccountingSnapshotV1 } from '@nora/contracts';
import { accountingCompletionRoute } from '../accounting-completion-routes';
import { AccountingTaxWorkspace } from './accounting-tax-workspace';
import { AccountingTaxpayerWorkspace } from './accounting-taxpayer-workspace';
import { AccountingChartReport } from './accounting-chart-report';
import { AccountingCompletionReport } from './accounting-completion-report';
import { AccountingCompletionReadiness } from './accounting-completion-readiness';

/** Owner must mount this before the legacy dependency fallback, after book authorization. */
export function AccountingCompletionWorkspace({
  book,
  route,
}: {
  book: AccountingSnapshotV1;
  route: string;
}) {
  switch (accountingCompletionRoute(route)) {
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
    case 'readiness':
      return (
        <AccountingCompletionReadiness
          key={`${book.book.id}:${route}`}
          book={book}
        />
      );
    default:
      return null;
  }
}
