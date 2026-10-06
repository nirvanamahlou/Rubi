import { QueryClient, QueryObserver } from '@tanstack/react-query';
import { afterEach, describe, expect, it, vi } from 'vitest';
import { procurementApi } from './api';
import { procurementOwnerQuery } from './owner-picker';

afterEach(() => vi.restoreAllMocks());

describe('Procurement owner loading', () => {
  it('loads the first authorized branch page without requiring search', async () => {
    const owners = vi.spyOn(procurementApi, 'owners').mockResolvedValue({
      items: [{ id: 'buyer-1', label: 'مسئول خرید' }],
      page: 1,
      pageSize: 50,
      hasMore: true,
    });
    const client = new QueryClient();
    const observer = new QueryObserver(
      client,
      procurementOwnerQuery('branch-1'),
    );
    const unsubscribe = observer.subscribe(() => undefined);
    try {
      await vi.waitFor(() =>
        expect(observer.getCurrentResult().isSuccess).toBe(true),
      );
      expect(owners).toHaveBeenCalledWith('branch-1', '', 1);
      expect(observer.getCurrentResult().data?.items[0]?.id).toBe('buyer-1');
      await client.fetchQuery(procurementOwnerQuery('branch-1', '', 2));
      expect(owners).toHaveBeenLastCalledWith('branch-1', '', 2);
    } finally {
      unsubscribe();
      client.clear();
    }
  });

  it('does not request owners without a branch', async () => {
    const owners = vi.spyOn(procurementApi, 'owners');
    const client = new QueryClient();
    const observer = new QueryObserver(client, procurementOwnerQuery(''));
    const unsubscribe = observer.subscribe(() => undefined);
    try {
      await new Promise((resolve) => setTimeout(resolve, 10));
      expect(owners).not.toHaveBeenCalled();
      expect(observer.getCurrentResult().fetchStatus).toBe('idle');
    } finally {
      unsubscribe();
      client.clear();
    }
  });

  it('keeps failures visible and preserves branch/search/page scoping', async () => {
    const failure = new Error('دریافت مسئولان ناموفق بود');
    const owners = vi
      .spyOn(procurementApi, 'owners')
      .mockRejectedValue(failure);
    const client = new QueryClient();
    const observer = new QueryObserver(
      client,
      procurementOwnerQuery('branch-2', '  سارا  ', 3),
    );
    const unsubscribe = observer.subscribe(() => undefined);
    try {
      await vi.waitFor(() =>
        expect(observer.getCurrentResult().isError).toBe(true),
      );
      expect(observer.getCurrentResult().error).toBe(failure);
      expect(owners).toHaveBeenCalledOnce();
      expect(owners).toHaveBeenCalledWith('branch-2', 'سارا', 3);
    } finally {
      unsubscribe();
      client.clear();
    }
  });
});
