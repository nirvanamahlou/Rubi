import { describe, expect, it } from 'vitest';

import {
  accountingNavigationGroups,
  documentListOnlyRoutes,
} from './accounting-navigation-workspace';

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
