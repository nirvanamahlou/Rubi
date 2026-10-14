import { expect, it, vi } from 'vitest';
import { loadOutputReferences } from './output-references';
import { englishOutputName } from './reservation-form';
it('resolves English airline and public supplier names and handles missing optional directories', async () => {
  const read = vi.fn(async (path: string) =>
    path.includes('airlines')
      ? {
          data: [
            {
              id: 'a',
              name: 'ایرلاین',
              attributes: { englishName: 'AIRLINE' },
            },
          ],
        }
      : { data: [{ id: 'b', name: 'کارگزار', englishName: 'BROKER' }] },
  );
  const refs = await loadOutputReferences(read, 'r');
  expect(englishOutputName('ایرلاین', refs)).toBe('AIRLINE');
  expect(englishOutputName('کارگزار', refs)).toBe('BROKER');
  expect(
    await loadOutputReferences(async () => {
      throw Error('unavailable');
    }, 'r'),
  ).toEqual({});
});
