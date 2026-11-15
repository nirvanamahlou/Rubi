import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { authenticatedFetch } from '@/lib/authenticated-fetch';
import { localizedFetch } from '@/i18n/localized-fetch';
import { refreshAuthenticatedSession } from '@/lib/auth-session';
import {
  fiscalRequestHeaders,
  fiscalRequestSnapshot,
  setFiscalRequestHint,
  beginFiscalWrite,
  fiscalHintKey,
} from './fiscal-request-state';
import type { FiscalRequestHint } from './fiscal-request-state';

vi.mock('@/i18n/localized-fetch', () => ({ localizedFetch: vi.fn() }));
vi.mock('@/lib/auth-session', () => ({ refreshAuthenticatedSession: vi.fn() }));
const hint: FiscalRequestHint = {
  actorKey: 'actor-a',
  companySelection: 'A',
  mode: 'temporary',
  period: {
    id: 'year-a',
    bookId: 'book-a',
    fiscalYearId: 'definition-a',
    version: 2,
    startDate: '2026-03-21',
    endDate: '2027-03-20',
    status: 'OPEN',
    yearActive: true,
    title: '1405',
    code: '1405',
  },
};
beforeEach(() => {
  vi.stubGlobal('window', {});
  setFiscalRequestHint(null);
});
afterEach(() => {
  setFiscalRequestHint(null);
  vi.unstubAllGlobals();
  vi.resetAllMocks();
});
describe('frozen Finance transport context', () => {
  it('supports a same-origin relative API base without leaking hints to other paths', () => {
    vi.stubGlobal('window', { location: { origin: 'https://web.test' } });
    setFiscalRequestHint(hint);
    expect(
      fiscalRequestHeaders('/api/v1/finance/inbox', '/api/v1')?.get(
        'x-finance-period-id',
      ),
    ).toBe('year-a');
    expect(
      fiscalRequestHeaders('/api/other/finance/inbox', '/api/v1'),
    ).toBeNull();
  });
  it('sends actor, company and period constraints only to this API Finance endpoints', () => {
    setFiscalRequestHint(hint);
    const headers = fiscalRequestHeaders(
      'https://api.test/api/finance/inbox',
      'https://api.test/api',
      { 'idempotency-key': 'same' },
    );
    expect(Object.fromEntries(headers!)).toMatchObject({
      'x-finance-actor-id': 'actor-a',
      'x-finance-company': 'A',
      'x-finance-period-id': 'year-a',
      'x-finance-period-version': '2',
      'x-finance-period-mode': 'temporary',
      'idempotency-key': 'same',
    });
    for (const url of [
      'https://other.test/api/finance/inbox',
      'https://api.test/other/finance/inbox',
      'https://api.test/api/sales',
      'https://api.test/api/finance/fiscal-context',
    ])
      expect(fiscalRequestHeaders(url, 'https://api.test/api')).toBeNull();
    expect(
      fiscalRequestHeaders(
        'https://api.test/api/hr/payroll-finance/id/action',
        'https://api.test/api',
      )?.get('x-finance-period-id'),
    ).toBe('year-a');
  });
  it('clears hints on Finance exit and keys different actors, companies, years and versions separately', () => {
    setFiscalRequestHint(hint);
    expect(fiscalRequestSnapshot().key).toBe(fiscalHintKey(hint));
    for (const changed of [
      { ...hint, actorKey: 'b' },
      { ...hint, companySelection: 'B' },
      { ...hint, period: { ...hint.period!, version: 3 } },
      { ...hint, mode: 'default' as const },
    ])
      expect(fiscalHintKey(changed)).not.toBe(fiscalHintKey(hint));
    setFiscalRequestHint(null);
    expect(
      fiscalRequestHeaders(
        'https://api.test/api/finance/inbox',
        'https://api.test/api',
      ),
    ).toBeNull();
  });
  it('never stores per-user/year state during server rendering', () => {
    vi.unstubAllGlobals();
    setFiscalRequestHint(hint);
    expect(fiscalRequestSnapshot().hint).toBeNull();
  });
  it('keeps one write context during authentication retry even if the active UI changes', async () => {
    setFiscalRequestHint(hint);
    vi.mocked(localizedFetch)
      .mockResolvedValueOnce(new Response(null, { status: 401 }))
      .mockResolvedValueOnce(new Response(null, { status: 204 }));
    vi.mocked(refreshAuthenticatedSession).mockImplementationOnce(async () => {
      expect(fiscalRequestSnapshot().writing).toBe(1);
      setFiscalRequestHint({
        ...hint,
        actorKey: 'actor-b',
        companySelection: 'B',
        period: null,
      });
      return { user: { id: 'actor-b' } } as never;
    });
    expect(
      (
        await authenticatedFetch(
          'https://api.test/api/finance/requests',
          'https://api.test/api',
          {
            method: 'POST',
            body: 'unchanged',
            headers: { 'idempotency-key': 'same' },
          },
        )
      ).status,
    ).toBe(204);
    const attempts = vi.mocked(localizedFetch).mock.calls;
    expect(attempts[1]![1]).toBe(attempts[0]![1]);
    expect(
      new Headers(attempts[1]![1]!.headers).get('x-finance-actor-id'),
    ).toBe('actor-a');
    expect(
      new Headers(attempts[1]![1]!.headers).get('x-finance-period-id'),
    ).toBe('year-a');
    expect(fiscalRequestSnapshot().writing).toBe(0);
  });
  it('releases concurrent write locks exactly once, including failures', async () => {
    const first = beginFiscalWrite(),
      second = beginFiscalWrite();
    first();
    first();
    expect(fiscalRequestSnapshot().writing).toBe(1);
    second();
    setFiscalRequestHint(hint);
    vi.mocked(localizedFetch).mockRejectedValueOnce(new Error('network'));
    await expect(
      authenticatedFetch(
        'https://api.test/api/finance/requests',
        'https://api.test/api',
        { method: 'POST' },
      ),
    ).rejects.toThrow('network');
    expect(fiscalRequestSnapshot().writing).toBe(0);
  });
});
