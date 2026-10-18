import { afterEach, describe, expect, it, vi } from 'vitest';
import { partnerClient } from './partner-client';
vi.mock('@/lib/environment', () => ({
  getPublicApiBaseUrl: () => 'http://localhost:4999/api/v1',
}));
vi.mock('@/lib/auth-session', () => ({
  refreshAuthenticatedSession: vi.fn().mockResolvedValue(false),
}));
afterEach(() => vi.restoreAllMocks());
describe('role-scoped partner dossier public client', () => {
  it('loads exact role and branch with no-store authenticated transport', async () => {
    const fetch = vi
      .spyOn(globalThis, 'fetch')
      .mockResolvedValue(new Response('{}'));
    await partnerClient.finance('org / id', 'BROKER', 'branch');
    expect(fetch).toHaveBeenCalledWith(
      'http://localhost:4999/api/v1/finance/partners/BROKER/org%20%2F%20id',
      expect.objectContaining({
        credentials: 'include',
        cache: 'no-store',
        headers: expect.objectContaining({ 'x-branch-id': 'branch' }),
      }),
    );
  });
  it('binds new Finance requests to the canonical party, role and idempotency key', async () => {
    const fetch = vi
      .spyOn(globalThis, 'fetch')
      .mockResolvedValue(new Response('{}'));
    await partnerClient.createFinanceRequest('org', 'SUPPLIER', 'branch', {
      operationId: 'operation',
      kind: 'CHECK',
      title: 'QA',
      party: 'QA',
      reference: 'QA',
      description: '',
      amount: '5',
      currencyCode: 'IRR',
      dueAt: '2026-11-01',
    });
    const init = fetch.mock.calls[0]?.[1];
    expect(JSON.parse(String(init?.body))).toMatchObject({
      counterpartyOrganizationId: 'org',
      counterpartyRole: 'SUPPLIER',
      branchId: 'branch',
      operationId: 'operation',
    });
  });
  it('preserves validation error status for safe form retry', async () => {
    vi.spyOn(globalThis, 'fetch').mockResolvedValue(
      new Response(JSON.stringify({ message: 'Invalid' }), { status: 400 }),
    );
    await expect(
      partnerClient.connect('suppliers', 'id', 1, 'branch'),
    ).rejects.toMatchObject({ status: 400, message: 'Invalid' });
  });
});
