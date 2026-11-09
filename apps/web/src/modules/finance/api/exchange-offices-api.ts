'use client';
import type {
  ExchangeOfficeInputV1,
  ExchangeOfficeListV1,
  ExchangeOfficeOptionsV1,
} from '@nora/contracts';
import { apiRequest } from './finance-inbox-api';
const root = '/finance/exchange-offices';
export const exchangeOfficesApi = {
  list: (query: Record<string, string> = {}) =>
    apiRequest<ExchangeOfficeListV1>(`${root}?${new URLSearchParams(query)}`),
  options: () => apiRequest<ExchangeOfficeOptionsV1>(`${root}/options`),
  save: (id: string | null, input: ExchangeOfficeInputV1) =>
    apiRequest<{ id: string; version: number }>(
      id ? `${root}/${encodeURIComponent(id)}` : root,
      { method: id ? 'PATCH' : 'POST', body: JSON.stringify(input) },
    ),
  remove: (id: string, expectedVersion: number) =>
    apiRequest(root + '/' + encodeURIComponent(id), {
      method: 'DELETE',
      body: JSON.stringify({ expectedVersion }),
    }),
};
