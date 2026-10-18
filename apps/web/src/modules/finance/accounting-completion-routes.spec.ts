import { describe, expect, it } from 'vitest';
import { accountingTaxForms } from '@nora/contracts';
import {
  accountingCompletionRoute,
  completionJournalHref,
} from './accounting-completion-routes';
import { taxpayerPages } from './accounting-taxpayer-catalog';

describe('completion route integration boundary', () => {
  it('dispatches each observed taxpayer screen and each tax form explicitly', () => {
    for (const page of taxpayerPages.filter(
      (page) => page.route !== 'taxpayer-system/settings',
    ))
      expect(accountingCompletionRoute(page.route)).toBe('taxpayer');
    for (const form of accountingTaxForms)
      expect(accountingCompletionRoute(form.route)).toBe('tax');
  });
  it('keeps all six editable reference form/list routes reachable', () => {
    for (const route of [
      'tax-accounting/base-information/quarterly-thresholds',
      'tax-accounting/base-information/lists/quarterly-thresholds',
      'tax-accounting/vat/tax-periods',
      'tax-accounting/vat/lists/tax-periods',
      'tax-accounting/vat/aggregation-methods',
      'tax-accounting/vat/lists/aggregation-methods',
    ])
      expect(accountingCompletionRoute(route)).toBe('tax');
  });
  it('does not capture working closing/opening commands or unknown tax endpoints', () => {
    for (const route of [
      'general-ledger/year-end/closing',
      'general-ledger/year-end/opening',
      'general-ledger/year-end/final',
      'general-ledger/year-end/nature-adjustment',
      'taxpayer-system/settings',
      'taxpayer-system/execute',
      'tax-accounting/vat/filing',
      'general-ledger/reports/legal-ledgers',
      'general-ledger/documents/journals',
    ])
      expect(accountingCompletionRoute(route)).toBeUndefined();
  });
  it('preserves exact book and journal context in drilldown', () => {
    const url = new URL(
      completionJournalHref('book A&x', 'journal?1'),
      'https://local.invalid',
    );
    expect(url.pathname).toBe(
      '/finance/accounting/general-ledger/documents/journals',
    );
    expect(url.searchParams.get('bookId')).toBe('book A&x');
    expect(url.searchParams.get('journalId')).toBe('journal?1');
  });
});
