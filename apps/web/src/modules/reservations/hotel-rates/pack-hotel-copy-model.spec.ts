import { expect, it, vi } from 'vitest';
import {
  copyableHotelPacks,
  loadCopiedHotelIds,
  selectCopiedHotels,
} from './pack-hotel-copy-model';
import { savedPack } from './existing-packs.fixture';
import type { PackSummary } from './packs-workspace';
import type { Factors } from './model';

it('shows only other active packs in the current city and branch', () => {
  const pack = {
    ...savedPack(),
    hotelCount: 2,
    updatedAt: '2026-11-05T00:00:00Z',
  } satisfies PackSummary;
  expect(
    copyableHotelPacks(
      [
        pack,
        { ...pack, id: 'other-city', cityId: 'city-2' },
        { ...pack, id: 'other-branch', branchId: 'branch-2' },
        { ...pack, id: 'archived', archivedAt: '2026-11-01' },
        { ...pack, id: 'current' },
      ],
      'branch-1',
      'city-1',
      'current',
    ),
  ).toEqual([pack]);
});

it('copies unique available hotel IDs, reporting unavailable hotels without returning prices or dates', async () => {
  const pack = savedPack();
  pack.rows.push({ ...pack.rows[0]! });
  const request = vi.fn().mockResolvedValue(pack);
  expect(
    await loadCopiedHotelIds(
      'pack-1',
      'branch-1',
      'city-1',
      ['hotel-0'],
      request,
    ),
  ).toEqual({ hotelIds: ['hotel-0'], skipped: 1 });
  expect(request).toHaveBeenCalledWith('/packs/pack-1');
});

it.each([
  { cityId: 'other' },
  { branchId: 'other' },
  { id: 'other' },
  { archivedAt: '2026-11-01' },
])(
  'rejects a source changed or moved after loading the list: %o',
  async (patch) => {
    const request = vi.fn().mockResolvedValue({ ...savedPack(), ...patch });
    await expect(
      loadCopiedHotelIds('pack-1', 'branch-1', 'city-1', ['hotel-0'], request),
    ).rejects.toThrow('مطابقت ندارد');
  },
);

it('keeps selections unchanged on missing hotels or a failed detail request', async () => {
  await expect(
    loadCopiedHotelIds(
      'pack-1',
      'branch-1',
      'city-1',
      [],
      vi.fn().mockResolvedValue(savedPack()),
    ),
  ).rejects.toThrow('هیچ‌یک');
  await expect(
    loadCopiedHotelIds(
      'pack-1',
      'branch-1',
      'city-1',
      ['hotel-0'],
      vi.fn().mockRejectedValue(new Error('unavailable')),
    ),
  ).rejects.toThrow('unavailable');
});

it('ticks new hotels like manual selection while preserving current prices, room data and selections', () => {
  const row = (id: string, selected = false, inCityList = true) => ({
    hotel: { id },
    selected,
    inCityList,
    base: '987',
    factors: { double: '2' } as Factors,
    roomRates: [{ amount: '55' }],
    currency: 'EUR',
  });
  const rows = [
    row('selected', true),
    row('new'),
    row('not-in-city', false, false),
    row('other'),
  ];
  const before = structuredClone(rows);
  const copied = selectCopiedHotels(rows, [
    'selected',
    'new',
    'not-in-city',
    'unknown',
  ]);
  expect(copied[0]).toBe(rows[0]);
  expect(copied[1]).toMatchObject({
    selected: true,
    base: '1',
    currency: 'EUR',
    roomRates: [{ amount: '55' }],
  });
  expect(Object.values(copied[1]!.factors).every((value) => value === '')).toBe(
    true,
  );
  expect(copied[2]).toBe(rows[2]);
  expect(copied[3]).toBe(rows[3]);
  expect(rows).toEqual(before);
});
