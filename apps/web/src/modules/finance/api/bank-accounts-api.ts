'use client';
import type {
  CompanyBankAccountV1,
  CompanyBankAccountInputV1,
  CompanyBankAccountOptionsV1,
} from '@nora/contracts';
import { apiRequest } from './finance-inbox-api';
const path = (bankId: string) =>
  `/finance/banks/${encodeURIComponent(bankId)}/accounts`;
export const bankAccountsApi = {
  remove: (bankId: string, id: string, expectedVersion: number) =>
    apiRequest<{ id: string }>(`${path(bankId)}/${encodeURIComponent(id)}`, {
      method: 'DELETE',
      body: JSON.stringify({ expectedVersion }),
    }),
  options: (bankId: string) =>
    apiRequest<CompanyBankAccountOptionsV1>(`${path(bankId)}/options`),
  list: (bankId: string, page: number) =>
    apiRequest<{
      items: CompanyBankAccountV1[];
      hasMore: boolean;
      page: number;
    }>(`${path(bankId)}?page=${page}`),
  details: (bankId: string, id: string) =>
    apiRequest<CompanyBankAccountV1>(
      `${path(bankId)}/${encodeURIComponent(id)}/details`,
      { method: 'POST' },
    ),
  create: (
    bankId: string,
    input: CompanyBankAccountInputV1 & { branchId: string; requestId: string },
  ) =>
    apiRequest<CompanyBankAccountV1>(path(bankId), {
      method: 'POST',
      body: JSON.stringify(input),
    }),
  update: (
    bankId: string,
    id: string,
    input: CompanyBankAccountInputV1 & { expectedVersion: number },
  ) =>
    apiRequest<CompanyBankAccountV1>(
      `${path(bankId)}/${encodeURIComponent(id)}`,
      { method: 'PATCH', body: JSON.stringify(input) },
    ),
};
