import { afterEach, expect, it, vi } from 'vitest';
import { listReferences } from '@/modules/ticket-catalog/api/references';
import {
  loadFloatingAirports,
  preferredFloatingAirport,
} from './floating-flight-airport';
vi.mock('@/modules/ticket-catalog/api/references', () => ({
  listReferences: vi.fn(),
}));
afterEach(() => vi.resetAllMocks());
it('includes all destination-country cities, preserving directory priority across pages and excluding invalid codes', async () => {
  const record = (id: string, cityId = 'city', code = 'AYT') => ({
    id,
    status: 'active',
    name: id,
    code,
    attributes: { cityId, englishName: id, iataCode: code },
  });
  vi.mocked(listReferences)
    .mockResolvedValueOnce({
      data: [
        record('first'),
        record('wrong-city', 'other'),
        record('bad-code', 'city', 'bad-code'),
      ],
      meta: { page: 1, pageSize: 25, total: 26 },
    } as never)
    .mockResolvedValueOnce({
      data: [record('second', 'city', 'GZP')],
      meta: { page: 2, pageSize: 25, total: 26 },
    } as never);
  const result = await loadFloatingAirports('country', 'reservations');
  expect(result.map((row) => row.id)).toEqual([
    'first',
    'wrong-city',
    'second',
  ]);
  expect(preferredFloatingAirport(result, 'city')?.id).toBe('first');
  expect(preferredFloatingAirport(result, 'other')?.id).toBe('wrong-city');
  expect(preferredFloatingAirport(result, 'no-airport-city')?.id).toBe('first');
  expect(listReferences).toHaveBeenCalledWith(
    'airports',
    '',
    2,
    undefined,
    { countryId: 'country' },
    'reservations',
  );
});
it('fails instead of choosing a default from an incomplete directory', async () => {
  vi.mocked(listReferences).mockRejectedValue(new Error('forbidden'));
  await expect(loadFloatingAirports('city', 'sales')).rejects.toThrow(
    'forbidden',
  );
});
