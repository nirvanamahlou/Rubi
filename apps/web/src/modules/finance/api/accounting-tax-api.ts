'use client';
import type { AccountingTaxRecord, AccountingTaxValues } from '@nora/contracts';
import { apiRequest } from './finance-inbox-api';
const endpoint = (bookId: string, kind: string) =>
  `/finance/accounting/books/${encodeURIComponent(bookId)}/tax/${encodeURIComponent(kind)}`;
export const accountingTaxApi = {
  remove: (
    bookId: string,
    kind: string,
    id: string,
    version: number,
    key: string,
  ) =>
    apiRequest<{ id: string; deleted: boolean }>(
      `${endpoint(bookId, kind)}/${encodeURIComponent(id)}/delete`,
      { method: 'POST', body: JSON.stringify({ version, key }) },
    ),
  list: (bookId: string, kind: string) =>
    apiRequest<{ items: AccountingTaxRecord[]; truncated: boolean }>(
      endpoint(bookId, kind),
    ),
  save: (
    bookId: string,
    kind: string,
    body: {
      id?: string;
      version?: number;
      key: string;
      values: AccountingTaxValues;
      notes: unknown[];
    },
  ) =>
    apiRequest<AccountingTaxRecord>(endpoint(bookId, kind), {
      method: 'POST',
      body: JSON.stringify(body),
    }),
};
