'use client';
import type { AccountingTaxpayerSeller } from '@nora/contracts';
import { apiRequest } from './finance-inbox-api';
const endpoint = (id: string) =>
  `/finance/accounting/books/${encodeURIComponent(id)}/taxpayer/seller`;
export const accountingTaxpayerApi = {
  seller: (id: string) =>
    apiRequest<AccountingTaxpayerSeller | null>(endpoint(id)),
  saveSeller: (id: string, body: AccountingTaxpayerSeller & { key: string }) =>
    apiRequest<AccountingTaxpayerSeller>(endpoint(id), {
      method: 'POST',
      body: JSON.stringify(body),
    }),
};
