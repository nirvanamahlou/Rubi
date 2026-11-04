import { expect, it, vi } from 'vitest';
import { loadContractHotels } from './hotel-catalog';
const hotel = (id: string) => ({
  id,
  resource: 'hotels',
  status: 'active',
  name: id,
  attributes: { cityId: 'kusadasi' },
});
it('loads all108 hotels across pages with no city, country or rate filter', async () => {
  const rows = Array.from({ length: 108 }, (_, i) =>
    hotel(i === 107 ? 'RAMADA RESORT & GOLF' : `hotel-${i}`),
  );
  const list = vi.fn(async (_resource: unknown, q: { page: number }) => ({
    data: rows.slice((q.page - 1) * 100, q.page * 100),
    meta: { total: 108 },
  }));
  const result = await loadContractHotels(undefined, list as never);
  expect(result).toHaveLength(108);
  expect(result.at(-1)?.name).toBe('RAMADA RESORT & GOLF');
  expect(list.mock.calls).toEqual([
    [
      'hotels',
      {
        search: '',
        status: 'active',
        sortBy: 'name',
        sortDirection: 'asc',
        page: 1,
        pageSize: 100,
      },
    ],
    [
      'hotels',
      {
        search: '',
        status: 'active',
        sortBy: 'name',
        sortDirection: 'asc',
        page: 2,
        pageSize: 100,
      },
    ],
  ]);
});
it('does not return a partial list after a later page fails', async () => {
  const list = vi
    .fn()
    .mockResolvedValueOnce({ data: [hotel('first')], meta: { total: 2 } })
    .mockRejectedValueOnce(Error('offline'));
  await expect(loadContractHotels(undefined, list)).rejects.toThrow('offline');
});
it.each([{ data: [] }, { data: [hotel('first')] }])(
  'rejects prematurely empty or repeating pages rather than silently omitting hotels (%j)',
  async ({ data }) => {
    const list = vi
      .fn()
      .mockResolvedValueOnce({ data: [hotel('first')], meta: { total: 2 } })
      .mockResolvedValue({ data, meta: { total: 2 } });
    await expect(loadContractHotels(undefined, list)).rejects.toThrow();
    expect(list).toHaveBeenCalledTimes(2);
  },
);
it('does not publish superseded results or make a request when already cancelled', async () => {
  const controller = new AbortController();
  const list = vi.fn(async () => {
    controller.abort();
    return { data: [hotel('ramada')], meta: { total: 1 } };
  });
  await expect(
    loadContractHotels(controller.signal, list as never),
  ).rejects.toThrow();
  expect(list).toHaveBeenCalledTimes(1);
  list.mockClear();
  await expect(
    loadContractHotels(controller.signal, list as never),
  ).rejects.toThrow();
  expect(list).not.toHaveBeenCalled();
});
