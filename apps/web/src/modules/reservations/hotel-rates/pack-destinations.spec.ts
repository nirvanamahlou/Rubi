import { expect, it, vi } from 'vitest';
import { loadPackDestinations } from './pack-destinations';
const request = (fn: ReturnType<typeof vi.fn>) =>
  fn as unknown as Parameters<typeof loadPackDestinations>[1];
it('does not load cities before selecting a country', async () => {
  const fn = vi.fn();
  expect(await loadPackDestinations('cities', request(fn))).toEqual([]);
  expect(fn).not.toHaveBeenCalled();
});
it('loads all country-filtered city pages with an encoded search query', async () => {
  const fn = vi
    .fn()
    .mockResolvedValueOnce({
      data: [{ id: 'city1', name: 'آنتالیا', countryId: 'country1' }],
      meta: { total: 2 },
    })
    .mockResolvedValueOnce({
      data: [{ id: 'city2', name: 'استانبول', countryId: 'country1' }],
      meta: { total: 2 },
    });
  expect(
    await loadPackDestinations('cities', request(fn), 'country1', 'x&y'),
  ).toHaveLength(2);
  const query = new URLSearchParams(fn.mock.calls[1]?.[0].split('?')[1]);
  expect(query.get('countryId')).toBe('country1');
  expect(query.get('page')).toBe('2');
  expect(query.get('search')).toBe('x&y');
});
it('rejects a city from another country and incomplete or changing lists', async () => {
  const fn = vi.fn().mockResolvedValue({
    data: [{ id: 'city', name: 'Dubai', countryId: 'other' }],
    meta: { total: 1 },
  });
  await expect(
    loadPackDestinations('cities', request(fn), 'country1'),
  ).rejects.toThrow();
  fn.mockResolvedValue({ data: [], meta: { total: 1 } });
  await expect(
    loadPackDestinations('countries', request(fn)),
  ).rejects.toThrow();
  fn.mockResolvedValueOnce({
    data: [{ id: '1', name: 'Turkey' }],
    meta: { total: 2 },
  }).mockResolvedValue({ data: [], meta: { total: 3 } });
  await expect(
    loadPackDestinations('countries', request(fn)),
  ).rejects.toThrow();
});
