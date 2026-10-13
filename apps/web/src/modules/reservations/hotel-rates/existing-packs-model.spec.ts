import { describe, expect, it, vi } from 'vitest';
import type { PackSummary } from './packs-workspace';
import { savedPack, savedRate as rate } from './existing-packs.fixture';
import {
  loadPackDirectory,
  packCities,
  packsForCity,
  packPriceUpdateBody,
  PackPriceSave,
  visiblePackHotels,
} from './existing-packs-model';

const summary = (id = 'pack-1'): PackSummary => ({
  ...savedPack(),
  id,
  hotelCount: 2,
  updatedAt: '2026-10-01T00:00:00Z',
});
const request = (fn: ReturnType<typeof vi.fn>) =>
  fn as unknown as Parameters<typeof loadPackDirectory>[1];

describe('saved city/date pack directory', () => {
  it('reads every page before exposing cities and dates, including page two', async () => {
    const fn = vi
      .fn()
      .mockResolvedValueOnce({
        data: Array.from({ length: 50 }, (_, i) => summary(`pack-${i}`)),
        total: 51,
      })
      .mockResolvedValueOnce({
        data: [{ ...summary('pack-51'), cityId: 'city-2', cityName: 'دبی' }],
        total: 51,
      });
    const packs = await loadPackDirectory('branch-1', request(fn));
    expect(packs).toHaveLength(51);
    expect(fn.mock.calls[1]?.[0]).toContain('page=2');
    expect(packCities(packs)).toHaveLength(2);
    expect(packsForCity(packs, 'city-2')[0]?.value).toBe('pack-51');
    expect(packsForCity(packs, 'city-1')).toHaveLength(50);
  });
  it('distinguishes same dates with different currencies and versions by pack identity', () => {
    const options = packsForCity(
      [summary(), { ...summary('pack-2'), currency: 'USD', version: 4 }],
      'city-1',
    );
    expect(options[0]?.label).toContain('EUR');
    expect(options[1]?.label).toContain('USD');
    expect(options[0]?.value).not.toBe(options[1]?.value);
    expect(packCities([summary(), summary('pack-2')])).toHaveLength(1);
  });
  it.each([
    { data: [summary()], total: 0 },
    { data: [summary(), summary()], total: 2 },
    { data: [{ ...summary(), branchId: 'another-branch' }], total: 1 },
    { data: [], total: -1 },
    { data: [], total: 5001 },
  ])('fails closed for invalid or incomplete directory %j', async (result) => {
    await expect(
      loadPackDirectory('branch-1', request(vi.fn().mockResolvedValue(result))),
    ).rejects.toThrow();
  });
  it('rejects changing totals and an empty page instead of silently truncating', async () => {
    for (const next of [
      { data: [summary('2')], total: 3 },
      { data: [], total: 2 },
    ]) {
      const fn = vi
        .fn()
        .mockResolvedValueOnce({ data: [summary()], total: 2 })
        .mockResolvedValueOnce(next);
      await expect(
        loadPackDirectory('branch-1', request(fn)),
      ).rejects.toThrow();
    }
  });
  it('handles no packs without another request', async () => {
    const fn = vi.fn().mockResolvedValue({ data: [], total: 0 });
    expect(await loadPackDirectory('branch-1', request(fn))).toEqual([]);
    expect(fn).toHaveBeenCalledTimes(1);
  });
});

describe('whole-pack price updates', () => {
  it('search only filters display; updates retain unsearched hotels, exact decimals, metadata and tour linkage', () => {
    const pack = savedPack();
    expect(visiblePackHotels(pack, 'رويال')).toHaveLength(1);
    const body = JSON.parse(packPriceUpdateBody(pack));
    expect(body.expectedVersion).toBe(3);
    expect(body.tourDepartureId).toBe('tour-1');
    expect(body.rows).toHaveLength(2);
    expect(body.rows[1].brokerId).toBe('broker-1');
    expect(body.rows[0].roomRates[0].occupancyRates[0]).toEqual(rate);
    expect(body.rows[0].roomRates[0]).not.toHaveProperty('roomTypeName');
    expect(body.rows[1].roomRates[0]).not.toHaveProperty('occupancyRates');
    expect(pack.rows[0]?.roomRates[0]?.occupancyRates?.[0]?.amount).toBe(
      '123.456789012',
    );
  });
  it('preserves legacy aggregate children when separate age bands are absent', () => {
    const pack = savedPack();
    delete pack.rows[1]!.roomRates[0]!.maxChildren2To6;
    delete pack.rows[1]!.roomRates[0]!.maxChildren6To12;
    delete pack.rows[1]!.roomRates[0]!.maxInfants;
    const room = JSON.parse(packPriceUpdateBody(pack)).rows[1].roomRates[0];
    expect(room).toMatchObject({
      maxChildren: 1,
      maxChildren2To6: 1,
      maxChildren6To12: 0,
      maxInfants: 0,
    });
  });
  it('reuses the operation key and CAS on uncertain retries; a changed body gets a fresh key', async () => {
    const saver = new PackPriceSave();
    const key = vi
      .fn()
      .mockReturnValueOnce('key-1')
      .mockReturnValueOnce('key-2');
    const fn = vi
      .fn()
      .mockRejectedValueOnce(new Error('offline'))
      .mockResolvedValue({ id: 'pack-1', version: 4 });
    await expect(saver.save(savedPack(), request(fn), key)).rejects.toThrow(
      'offline',
    );
    await saver.save(savedPack(), request(fn), key);
    expect(fn.mock.calls[0]?.[1]).toEqual(fn.mock.calls[1]?.[1]);
    expect(fn.mock.calls[1]?.[1].method).toBe('PATCH');
    expect(key).toHaveBeenCalledTimes(1);
    const next = savedPack();
    next.version = 4;
    next.rows[1]!.base = '99.9999';
    fn.mockResolvedValue({ id: 'pack-1', version: 5 });
    await saver.save(next, request(fn), key);
    expect(fn.mock.calls[2]?.[1].headers['idempotency-key']).toBe('key-2');
  });
  it('keeps a rejected CAS draft intact and blocks a simultaneous save', async () => {
    const saver = new PackPriceSave();
    const pack = savedPack();
    let reject!: (e: Error) => void;
    const fn = vi.fn(
      () =>
        new Promise((_resolve, rejectPromise) => {
          reject = rejectPromise;
        }),
    );
    const first = saver.save(pack, request(fn), () => 'key');
    await expect(saver.save(pack, request(fn))).rejects.toThrow('در حال انجام');
    reject(new Error('نسخه تغییر کرده'));
    await expect(first).rejects.toThrow('نسخه تغییر کرده');
    expect(pack.version).toBe(3);
    expect(pack.rows).toHaveLength(2);
    expect(fn).toHaveBeenCalledTimes(1);
  });
  it('rejects oversized bodies without writing and does not accept a misleading success', async () => {
    const saver = new PackPriceSave();
    const fn = vi.fn().mockResolvedValue({ id: 'wrong', version: 4 });
    await expect(
      saver.save(savedPack(), request(fn), () => 'key'),
    ).rejects.toThrow('پاسخ ثبت');
    const pack = savedPack();
    pack.rows[0]!.roomRates[0]!.occupancyRates = Array.from(
      { length: 1000 },
      () => ({ ...rate }),
    );
    await expect(saver.save(pack, request(fn))).rejects.toThrow('حجم بسته');
    expect(fn).toHaveBeenCalledTimes(1);
  });
});
