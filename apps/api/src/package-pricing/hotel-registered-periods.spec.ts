import { MasterTravelDirectory } from '../master-data/master-travel-directory';
import { it, expect, vi } from 'vitest';
import { randomUUID } from 'node:crypto';
import { BadRequestException, ForbiddenException } from '@nestjs/common';
import type {
  AuthenticatedActor,
  HotelRegisteredPeriodsQueryV1,
} from '@nora/contracts';
import type { DatabaseService } from '../database/database.service';
import { HotelPurchaseRatesPublicService } from '../reservations/hotel-purchase-rates.public';
import { PackagePricingService } from './package-pricing.service';
const branch = randomUUID();
const actor = {
  branchIds: [branch],
  permissions: ['package_pricing.read'],
} as AuthenticatedActor;
function fixture() {
  const registeredPeriods = vi.fn().mockResolvedValue({
    version: 1,
    data: [],
    total: 0,
    page: 1,
    pageSize: 50,
  });
  const service = new PackagePricingService(
    {} as never,
    {} as never,
    {} as never,
    {} as never,
    { registeredPeriods } as never,
    {} as never,
  );
  return { service, registeredPeriods };
}
it('validates filters and delegates only authorized branches to Reservations public projection', async () => {
  const f = fixture();
  await f.service.hotelRegisteredPeriods(
    { search: '  Wings ', page: '2' as unknown as number, from: '2026-10-01' },
    actor,
  );
  expect(f.registeredPeriods).toHaveBeenCalledWith([branch], {
    search: 'Wings',
    page: 2,
    from: '2026-10-01',
  });
  await expect(
    f.service.hotelRegisteredPeriods({ branchId: randomUUID() }, actor),
  ).rejects.toBeInstanceOf(ForbiddenException);
  await expect(
    f.service.hotelRegisteredPeriods({}, { ...actor, permissions: [] }),
  ).rejects.toBeInstanceOf(ForbiddenException);
  expect(f.registeredPeriods).toHaveBeenCalledTimes(1);
});
it.each([
  { from: '2026-02-30' },
  { from: '2026-11-01', to: '2026-10-01' },
  { page: 0 },
  { page: 10001 },
  { search: 'x'.repeat(121) },
  { extra: true },
])('rejects invalid period filter %j before querying', async (query) => {
  const f = fixture();
  await expect(
    f.service.hotelRegisteredPeriods(
      query as HotelRegisteredPeriodsQueryV1,
      actor,
    ),
  ).rejects.toBeInstanceOf(BadRequestException);
  expect(f.registeredPeriods).not.toHaveBeenCalled();
});
it('returns no data without querying when no branch is authorized', async () => {
  const raw = vi.fn();
  const projection = new HotelPurchaseRatesPublicService({
    client: {
      $queryRaw: raw,
      reservationHotelRatePack: { findMany: vi.fn().mockResolvedValue([]) },
    },
  } as unknown as DatabaseService);
  expect(await projection.registeredPeriods([], { page: 2 })).toMatchObject({
    data: [],
    total: 0,
    page: 2,
  });
  expect(raw).not.toHaveBeenCalled();
});
it('projects only latest non-archived pack rows with bound literal search, stable pagination and no amounts', async () => {
  const raw = vi.fn().mockResolvedValue([{ total: 70, data: [] }]);
  const projection = new HotelPurchaseRatesPublicService({
    client: {
      $queryRaw: raw,
      reservationHotelRatePack: { findMany: vi.fn().mockResolvedValue([]) },
    },
  } as unknown as DatabaseService);
  expect(
    await projection.registeredPeriods([branch], {
      page: 2,
      search: "% ' DROP TABLE",
      from: '2026-10-01',
      to: '2026-11-01',
    }),
  ).toMatchObject({ page: 2, total: 70, data: [] });
  const sql = raw.mock.calls[0]![0];
  expect(sql.sql).toContain('b.version=p."currentVersion"');
  expect(sql.sql).toContain('p."archivedAt" IS NULL');
  expect(sql.sql).toContain('b."checkOut" >');
  expect(sql.sql).toContain('b."checkIn" <=');
  expect(sql.sql).not.toContain('DROP TABLE');
  expect(sql.values).toContain(branch);
  expect(sql.values).toContain("% ' DROP TABLE");
  expect(sql.values).toContain(50);
  expect(sql.sql).not.toContain('r.base');
  expect(sql.sql).not.toContain('roomRates');
  expect(sql.sql).not.toContain('master_cities');
  expect(sql.sql).not.toContain('p."tourDepartureId" IS NULL');
});
it('resolves city metadata through the public Master Data reference, including inactive history', async () => {
  const city = randomUUID();
  const detail = vi.fn().mockResolvedValue({
    data: {
      id: city,
      name: 'آنتالیا',
      status: 'inactive',
      attributes: { englishName: 'Antalya' },
    },
  });
  const directory = new MasterTravelDirectory({ detail } as never);
  expect(await directory.hotelRatePeriodCityNames([city, city])).toEqual([
    { id: city, name: 'آنتالیا', englishName: 'Antalya' },
  ]);
  expect(detail).toHaveBeenCalledTimes(1);
  const raw = vi.fn().mockResolvedValue([
    {
      total: 1,
      data: [{ cityId: city, hotelRateId: 'row', branchId: branch }],
    },
  ]);
  const projection = new HotelPurchaseRatesPublicService(
    {
      client: {
        $queryRaw: raw,
        reservationHotelRatePack: {
          findMany: vi.fn().mockResolvedValue([{ cityId: city }]),
        },
      },
    } as unknown as DatabaseService,
    directory,
  );
  expect(
    (await projection.registeredPeriods([branch], { search: 'Antalya' }))
      .data[0]?.cityName,
  ).toBe('آنتالیا');
  expect(raw.mock.calls[0]![0].values).toContain(city);
  expect(raw.mock.calls[0]![0].sql).not.toContain('master_cities');
});
