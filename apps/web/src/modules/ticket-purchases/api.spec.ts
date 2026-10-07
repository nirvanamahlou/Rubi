import { afterEach, describe, it, expect, vi } from 'vitest';
import { ticketPurchaseApi } from './api';
vi.mock('@/lib/environment', () => ({
  getPublicApiBaseUrl: () => 'http://localhost:4200/api/v1',
}));
vi.mock('@/lib/auth-session', () => ({
  refreshAuthenticatedSession: vi.fn().mockResolvedValue(null),
}));
afterEach(() => vi.unstubAllGlobals());
describe('Purchase inbox client', () => {
  it('sends immutable price operation through purchasing and reads persisted inbox without cache', async () => {
    const fetch = vi.fn(
      async () =>
        new Response(JSON.stringify({ data: [], meta: { canPrice: true } })),
    );
    vi.stubGlobal('fetch', fetch);
    await ticketPurchaseApi.list();
    const input = {
      version: 1 as const,
      operationId: '11111111-1111-4111-8111-111111111111',
      expectedCostVersion: 0,
      seatCount: 20,
      unitCost: '125.5001',
      currencyCode: 'USD',
    };
    await ticketPurchaseApi.price('request', input);
    const calls = fetch.mock.calls as unknown as [string, RequestInit][];
    expect(calls[0]?.[0]).toBe(
      'http://localhost:4200/api/v1/procurement/ticket-purchases/inbox',
    );
    expect(calls[0]?.[1]).toMatchObject({
      credentials: 'include',
      cache: 'no-store',
    });
    expect(calls[1]?.[0]).toBe(
      'http://localhost:4200/api/v1/procurement/ticket-purchases/request/costs',
    );
    expect(JSON.parse(String(calls[1]?.[1].body))).toEqual(input);
  });
});
