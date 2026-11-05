import type { AccountingBookV1 } from '@nora/contracts';

/** Resolve only among authorized books returned by the API; never fabricate a book. */
export function accountingBookId(
  books: AccountingBookV1[],
  requestedId?: string | null,
): string {
  return (
    books.find((book) => book.id === requestedId)?.id ??
    books.find((book) => book.active && book.isMain)?.id ??
    books.find((book) => book.active)?.id ??
    books[0]?.id ??
    ''
  );
}
