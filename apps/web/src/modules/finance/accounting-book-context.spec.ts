import { describe, expect, it } from 'vitest';
import type { AccountingBookV1 } from '@nora/contracts';
import { accountingBookId } from './accounting-book-context';
const books = [
  { id: 'archived', active: false, isMain: true },
  { id: 'secondary', active: true, isMain: false },
  { id: 'main', active: true, isMain: true },
] as AccountingBookV1[];
describe('automatic accounting book context', () => {
  it('opens the active main book without a manual picker', () => {
    expect(accountingBookId(books)).toBe('main');
  });
  it('preserves explicit authorized links including historical books', () => {
    expect(accountingBookId(books, 'secondary')).toBe('secondary');
    expect(accountingBookId(books, 'archived')).toBe('archived');
  });
  it('cannot select an inaccessible requested book or invent missing data', () => {
    expect(accountingBookId(books, 'foreign')).toBe('main');
    expect(accountingBookId([], 'foreign')).toBe('');
    expect(accountingBookId(books.slice(0, 2))).toBe('secondary');
  });
});
