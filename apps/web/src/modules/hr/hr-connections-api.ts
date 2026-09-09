'use client';
import type {
  HrConnectionCreate,
  HrConnectionDecision,
  HrConnectionDto,
  HrConnectionList,
} from '@rubi/contracts';
import { hrRequest } from './hr-api';
export const connectionsApi = {
  list: (query: Record<string, string>) =>
    hrRequest<HrConnectionList>(`/connections?${new URLSearchParams(query)}`),
  create: (input: HrConnectionCreate, key: string) =>
    hrRequest<HrConnectionDto>('/connections', {
      method: 'POST',
      headers: { 'content-type': 'application/json', 'Idempotency-Key': key },
      body: JSON.stringify(input),
    }),
  respond: (id: string, input: HrConnectionDecision, key: string) =>
    hrRequest<HrConnectionDto>(
      `/connections/${encodeURIComponent(id)}/response`,
      {
        method: 'POST',
        headers: { 'content-type': 'application/json', 'Idempotency-Key': key },
        body: JSON.stringify(input),
      },
    ),
};
