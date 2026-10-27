import { expect, it, vi } from 'vitest';
import { loadSalesReferences } from './reference-refresh';
it('reloads every active reference list and follows all pages', async () => {
  const list = vi.fn(async (resource: string, q: { page: number }) => ({
    data: [{ id: resource + q.page }],
    meta: { total: resource === 'countries' ? 2 : 1 },
  }));
  const result = await loadSalesReferences({ list } as never);
  expect(result.failed).toEqual([]);
  expect(Object.keys(result.references)).toHaveLength(8);
  expect(result.references.countries?.map((r) => r.id)).toEqual([
    'countries1',
    'countries2',
  ]);
  expect(list.mock.calls.every(([, q]) => q.page >= 1)).toBe(true);
});
it('publishes only complete lists so a failed second page preserves the old options', async () => {
  const list = vi.fn(async (resource: string, q: { page: number }) => {
    if (resource === 'hotels' && q.page === 2) throw Error('offline');
    return {
      data: [{ id: resource + q.page }],
      meta: { total: resource === 'hotels' ? 2 : 1 },
    };
  });
  const oldHotels = [{ id: 'selected-hotel' }];
  const result = await loadSalesReferences({ list } as never);
  expect(result.failed).toEqual(['hotels']);
  expect(result.references.hotels).toBeUndefined();
  expect({ ...{ hotels: oldHotels }, ...result.references }.hotels).toBe(
    oldHotels,
  );
  expect(result.references.currencies).toBeDefined();
});
it('does not request or publish references for a cancelled refresh', async () => {
  const controller = new AbortController();
  controller.abort();
  const list = vi.fn();
  await expect(
    loadSalesReferences({ list } as never, controller.signal),
  ).rejects.toThrow();
  expect(list).not.toHaveBeenCalled();
});
it('discards cancelled in-flight pages instead of publishing stale data', async () => {
  const controller = new AbortController();
  let finish: (() => void) | undefined;
  const delayed = new Promise<void>((resolve) => {
    finish = resolve;
  });
  const list = vi.fn(async (resource: string) => {
    if (resource === 'countries') await delayed;
    return {
      data: [{ id: resource }],
      meta: { total: resource === 'countries' ? 2 : 1 },
    };
  });
  const pending = loadSalesReferences({ list } as never, controller.signal);
  controller.abort();
  finish!();
  await expect(pending).rejects.toThrow();
  expect(
    list.mock.calls.filter(([resource]) => resource === 'countries'),
  ).toHaveLength(1);
});

it('does not treat repeated hotel rows as a complete catalogue before every unique hotel arrives', async () => {
  const list = vi.fn(async (resource: string, q: { page: number }) => ({
    data:
      resource !== 'hotels'
        ? []
        : q.page === 1
          ? [{ id: 'first' }, { id: 'first' }]
          : [{ id: 'RAMADA RESORT & GOLF' }],
    meta: { total: resource === 'hotels' ? 2 : 0 },
  }));
  const result = await loadSalesReferences({ list } as never);
  expect(result.failed).toEqual([]);
  expect(result.references.hotels?.map((h) => h.id)).toEqual([
    'first',
    'RAMADA RESORT & GOLF',
  ]);
  expect(
    list.mock.calls.filter(([resource]) => resource === 'hotels'),
  ).toHaveLength(2);
});
