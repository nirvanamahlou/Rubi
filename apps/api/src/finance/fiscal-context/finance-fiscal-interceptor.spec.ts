import { describe, expect, it, vi } from 'vitest';
import { lastValueFrom, of } from 'rxjs';
import { FinanceFiscalInterceptor } from './finance-fiscal.interceptor';
import { FinanceFiscalStorage } from './finance-fiscal-storage';
import type { FinanceFiscalRequestV1 } from '@nora/contracts';

const scope = {
  actorId: 'actor',
  companySelection: 'A',
  period: {
    id: 'year',
    bookId: 'book',
    startDate: '2026-03-21',
    endDate: '2027-03-20',
    status: 'OPEN',
    yearActive: true,
  },
} as FinanceFiscalRequestV1;
function fixture(path: string, method = 'GET', body = {}, selected = scope) {
  const storage = new FinanceFiscalStorage();
  const resolver = { resolve: vi.fn().mockResolvedValue(selected) };
  const interceptor = new FinanceFiscalInterceptor(resolver as never, storage, {
    getOrThrow: () => 'api',
  } as never);
  const request = {
    path,
    method,
    body,
    params: {},
    actor: { userId: 'actor' },
    get: (header: string) =>
      ({
        'x-finance-company': 'A',
        'x-finance-actor-id': 'actor',
        'x-finance-period-mode': 'temporary',
        'x-finance-period-id': 'year',
        'x-finance-period-version': '2',
      })[header],
  };
  const context = {
    getType: () => 'http',
    switchToHttp: () => ({ getRequest: () => request }),
  };
  const handler = {
    handle: vi.fn(() => of(storage.current()?.companySelection ?? 'unscoped')),
  };
  return { interceptor, context, handler, resolver, storage };
}
describe('Finance HTTP fiscal boundary', () => {
  it('keeps shared reference pickers used outside Finance under their native authorization', async () => {
    const f = fixture('/api/finance/banks/id/accounts/options');
    f.context.switchToHttp().getRequest().get = () => undefined as never;
    expect(
      await lastValueFrom(
        await f.interceptor.intercept(f.context as never, f.handler),
      ),
    ).toBe('unscoped');
    expect(f.resolver.resolve).not.toHaveBeenCalled();
  });
  it('preserves context throughout subscription and resets it after completion', async () => {
    const f = fixture('/api/finance/inbox');
    expect(
      await lastValueFrom(
        await f.interceptor.intercept(f.context as never, f.handler),
      ),
    ).toBe('A');
    expect(f.resolver.resolve).toHaveBeenCalledWith(
      { userId: 'actor' },
      {
        company: 'A',
        actorId: 'actor',
        mode: 'temporary',
        periodId: 'year',
        version: '2',
      },
    );
    expect(f.storage.current()).toBeUndefined();
  });
  it('blocks legacy monetary paths outside the year before delegating, including HR Finance commands', async () => {
    for (const path of [
      '/api/finance/inbox/sales/payment/decision',
      '/api/hr/payroll-finance/id/action',
    ]) {
      const f = fixture(path, 'POST', { transferAt: '2025-01-01T00:00:00Z' });
      await expect(
        lastValueFrom(
          await f.interceptor.intercept(f.context as never, f.handler),
        ),
      ).rejects.toThrow();
      expect(f.handler.handle).not.toHaveBeenCalled();
    }
  });
  it('keeps setup reachable when no default exists and prevents unscoped operational reads', async () => {
    const missing = { ...scope, period: null };
    const setup = fixture(
      '/api/finance/accounting/books/book',
      'GET',
      {},
      missing,
    );
    expect(
      await lastValueFrom(
        await setup.interceptor.intercept(
          setup.context as never,
          setup.handler,
        ),
      ),
    ).toBe('A');
    const read = fixture(
      '/api/finance/transaction-history',
      'GET',
      {},
      missing,
    );
    await expect(
      lastValueFrom(
        await read.interceptor.intercept(read.context as never, read.handler),
      ),
    ).rejects.toThrow('تعریف نشده');
    expect(read.handler.handle).not.toHaveBeenCalled();
  });
  it.each([
    '/api/finance/reports/sales-receipts',
    '/api/finance/customer-document-delivery',
  ])(
    'reads %s without a fiscal year and keeps writes guarded',
    async (path) => {
      const missing = { ...scope, period: null };
      const read = fixture(path, 'GET', {}, missing);
      expect(
        await lastValueFrom(
          await read.interceptor.intercept(read.context as never, read.handler),
        ),
      ).toBe('A');
      const write = fixture(
        path.includes('delivery') ? path + '/contract-id' : path,
        'POST',
        {},
        missing,
      );
      await expect(
        lastValueFrom(
          await write.interceptor.intercept(
            write.context as never,
            write.handler,
          ),
        ),
      ).rejects.toThrow();
      expect(write.handler.handle).not.toHaveBeenCalled();
    },
  );
  it('loads the read-only detail code suggestion before a fiscal year is assigned', async () => {
    const f = fixture(
      '/api/finance/accounting/books/book/detail-code-suggestion',
      'GET',
      {},
      { ...scope, period: null },
    );
    expect(
      await lastValueFrom(
        await f.interceptor.intercept(f.context as never, f.handler),
      ),
    ).toBe('A');
  });
  it('allows setting up detail coding before a fiscal year is assigned', async () => {
    const action = 'setup-finance-coding-types';
    const f = fixture(
      '/api/finance/accounting/books/book/actions/' + action,
      'POST',
      {},
      { ...scope, period: null },
    );
    Object.assign(f.context.switchToHttp().getRequest().params, { action });
    expect(
      await lastValueFrom(
        await f.interceptor.intercept(f.context as never, f.handler),
      ),
    ).toBe('A');
    expect(f.resolver.resolve).toHaveBeenCalledWith(
      { userId: 'actor' },
      { company: 'A', actorId: 'actor' },
    );
  });
  it('does not scope unrelated source-owner routes or the metadata endpoint', async () => {
    for (const path of [
      '/api/sales/contracts',
      '/api/finance/fiscal-context',
    ]) {
      const f = fixture(path);
      expect(
        await lastValueFrom(
          await f.interceptor.intercept(f.context as never, f.handler),
        ),
      ).toBe('unscoped');
      expect(f.resolver.resolve).not.toHaveBeenCalled();
    }
  });
});
