import { describe, expect, it } from 'vitest';

import {
  accountingNavigationGroups,
  documentListOnlyRoutes,
  findSelectedAccountingSection,
} from './accounting-navigation-workspace';
import { accountingParityDefinitions } from './accounting-parity-definitions';

const targetTitles = [
  'سند حسابداری',
  'سند کل',
  'تسعیر ارز',
  'الگوی سند اتوماتیک',
  'الگوی تسعیر ارز',
];

const documents = accountingNavigationGroups
  .find((group) => group.id === 'general-ledger')!
  .sections.find((section) => section.title === 'اسناد')!;

describe('accounting document navigation', () => {
  it('removes all Rubi-only navigation additions', () => {
    const items = accountingNavigationGroups.flatMap((group) =>
      group.sections.flatMap((section) => section.items),
    );
    expect(
      items.some((item) =>
        /روبی|allocation-templates|transfer-batches|reports\/catalog|receipts-payments\/reports/.test(
          item.title + item.href,
        ),
      ),
    ).toBe(false);
  });

  it('resolves every canonical page title, including editors absent from the menu', () => {
    for (const definition of accountingParityDefinitions) {
      expect(
        findSelectedAccountingSection(`/finance/accounting/${definition.route}`)
          ?.title,
      ).toBe(definition.title);
    }
    expect(findSelectedAccountingSection('/finance')).toBeNull();
    expect(
      findSelectedAccountingSection(
        '/finance/accounting/general-ledger/accounts',
      )?.title,
    ).toBe('حساب‌ها');
    expect(
      findSelectedAccountingSection('/finance/accounting/general-ledger')
        ?.title,
    ).toBe('دفتر کل');
  });
  it('keeps the five document destinations only in the list subgroup', () => {
    const listItems = documents.items.filter((item) =>
      item.href.includes('/documents/lists/'),
    );
    const directItems = documents.items.filter(
      (item) => !item.href.includes('/documents/lists/'),
    );

    expect(listItems.map((item) => item.title)).toEqual(targetTitles);
    expect(
      directItems.some((item) =>
        documentListOnlyRoutes.some((route) => item.href.endsWith(route)),
      ),
    ).toBe(false);
    expect(
      accountingNavigationGroups
        .flatMap((group) => group.sections)
        .flatMap((section) => section.items)
        .filter((item) => targetTitles.includes(item.title)),
    ).toHaveLength(5);
  });
});
