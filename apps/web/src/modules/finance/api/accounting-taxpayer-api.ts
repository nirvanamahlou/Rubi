'use client';
import type { AccountingTaxpayerSeller } from '@nora/contracts';
import type {
  AccountingTaxpayerDraft,
  TaxpayerDraftKind,
} from '@nora/contracts';
import { apiRequest } from './finance-inbox-api';
const endpoint = (id: string) =>
  `/finance/accounting/books/${encodeURIComponent(id)}/taxpayer/seller`;
export const accountingTaxpayerApi = {
  drafts: (
    id: string,
    kind: TaxpayerDraftKind,
    query: Record<string, string>,
  ) =>
    apiRequest<{
      items: AccountingTaxpayerDraft[];
      total: number;
      page: number;
      pageSize: number;
      secretStorageAvailable?: boolean;
    }>(
      `/finance/accounting/books/${encodeURIComponent(id)}/taxpayer/drafts/${kind}?${new URLSearchParams(query)}`,
    ),
  saveDraft: (
    id: string,
    kind: TaxpayerDraftKind,
    body: {
      id?: string;
      version: number;
      key: string;
      values: Record<string, string | boolean>;
    },
  ) =>
    apiRequest<AccountingTaxpayerDraft>(
      `/finance/accounting/books/${encodeURIComponent(id)}/taxpayer/drafts/${kind}`,
      { method: 'POST', body: JSON.stringify(body) },
    ),
  seller: (id: string) =>
    apiRequest<AccountingTaxpayerSeller | null>(endpoint(id)),
  saveSeller: (id: string, body: AccountingTaxpayerSeller & { key: string }) =>
    apiRequest<AccountingTaxpayerSeller>(endpoint(id), {
      method: 'POST',
      body: JSON.stringify(body),
    }),
};
