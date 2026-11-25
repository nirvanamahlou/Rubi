import { readFileSync } from 'node:fs';
import { strFromU8, strToU8, unzipSync, zipSync } from 'fflate';
import { expect, it, vi } from 'vitest';
import {
  matchingPublishedRooms,
  type AuthenticatedActor,
  type TourDepartureV1,
} from '@nora/contracts';
import { CharterExcelPricingService } from './charter-excel-pricing.service';

vi.mock('../database/database.service', () => ({ DatabaseService: class {} }));
vi.mock('../master-data/master-travel-directory', () => ({
  MasterTravelDirectory: class {},
}));
vi.mock('./package-pricing.service', () => ({
  PackagePricingService: class {},
}));

const actor = {
  userId: 'publisher',
  branchIds: ['branch'],
  permissions: ['package_pricing.period.manage'],
} as unknown as AuthenticatedActor;
const tour = {
  id: 'departure',
  version: 2,
  startsOn: '2026-12-24',
  endsOn: '2026-12-29',
  remainingCapacity: 4,
  returnOfferId: 'return',
  outbound: { supplyType: 'COMPANY', version: 3 },
  returning: { supplyType: 'COMPANY', version: 2 },
  package: { version: 1, destinationId: 'city' },
} as unknown as TourDepartureV1;

function workbook(date = tour.startsOn) {
  const files = unzipSync(
    readFileSync('../web/public/templates/floating-tour-price.xlsx'),
  );
  const name = 'xl/worksheets/sheet1.xml';
  const cells = [
    date,
    'Hotel One',
    '',
    'STD',
    'BB',
    '€100',
    '€175',
    '€60',
    '',
    '',
    '50000000 IRR',
  ];
  const row = `<row r="2">${cells.map((value, i) => `<c r="${String.fromCharCode(65 + i)}2" t="inlineStr"><is><t>${value}</t></is></c>`).join('')}</row>`;
  files[name] = strToU8(
    strFromU8(files[name]!).replace('</sheetData>', row + '</sheetData>'),
  );
  return Buffer.from(zipSync(files));
}

function fixture(
  departure = tour,
  purchaseBatches: { rows: unknown[] }[] = [],
) {
  let stored: Record<string, unknown> | null = null;
  const prices = {
    findFirst: vi.fn(async () => stored),
    create: vi.fn(async ({ data }: { data: Record<string, unknown> }) => {
      stored = { ...data, id: 'publication' };
      return stored;
    }),
  };
  const tx = { packagePricingCharterExcelVersion: prices, $queryRaw: vi.fn() };
  const db = {
    client: {
      ...tx,
      $transaction: (callback: (input: typeof tx) => unknown) => callback(tx),
    },
  };
  const pricing = {
    tourCostGrid: vi.fn(async () => ({
      tour: departure,
      nights: 5,
      purchaseBatches,
    })),
  };
  const directory = {
    hotelRatePackChoices: vi.fn(async () => ({
      data: [
        {
          id: 'hotel',
          name: 'Hotel One',
          englishName: 'Hotel One',
          roomTypes: [{ id: 'room', name: 'Standard', code: 'STD' }],
        },
      ],
      meta: { total: 1, pageSize: 100 },
    })),
  };
  const service = new CharterExcelPricingService(
    db as never,
    pricing as never,
    directory as never,
  );
  return { service, prices };
}

it('publishes a real floating-format workbook into matching dated Sales room prices', async () => {
  const { service } = fixture();
  const bytes = workbook();
  const preview = await service.preview(tour.id, bytes, {}, actor);
  expect(preview.rows[0]?.sourceRows).toEqual([2]);
  expect(await service.catalog(tour)).toEqual([]);
  expect(
    (await service.commit(tour.id, bytes, {}, preview.digest, actor)).version,
  ).toBe(1);
  const rows = await service.catalog(tour);
  expect(
    matchingPublishedRooms(rows, {
      hotelId: 'hotel',
      roomTypeId: 'room',
      checkIn: tour.startsOn,
      checkOut: tour.endsOn,
      adults: 2,
      childAges: [8],
    })[0],
  ).toMatchObject({
    publicationId: 'publication',
    prices: [
      { currencyCode: 'EUR', amount: '260.00' },
      { currencyCode: 'IRR', amount: '150000000' },
    ],
  });
  expect(await service.catalog({ ...tour, version: 3 })).toEqual([]);
  await expect(
    service.commit(tour.id, bytes, {}, preview.digest, actor),
  ).rejects.toThrow('پیش‌نمایش');
});

it('rejects an Excel date outside the selected departure and existing hotel costs', async () => {
  const { service, prices } = fixture();
  await expect(
    service.preview(tour.id, workbook('2026-12-25'), {}, actor),
  ).rejects.toThrow('Row 2');
  await expect(
    fixture(tour, [{ rows: [{}] }]).service.preview(
      tour.id,
      workbook(),
      {},
      actor,
    ),
  ).rejects.toThrow('نرخ خرید');
  expect(prices.create).not.toHaveBeenCalled();
});

it('rejects full flights, a non-charter return, and missing pricing permission', async () => {
  await expect(
    fixture({ ...tour, remainingCapacity: 0 }).service.preview(
      tour.id,
      workbook(),
      {},
      actor,
    ),
  ).rejects.toThrow('ظرفیت');
  await expect(
    fixture({
      ...tour,
      returning: { ...tour.returning!, supplyType: 'FLOATING' },
    }).service.preview(tour.id, workbook(), {}, actor),
  ).rejects.toThrow('چارتر');
  await expect(
    fixture().service.preview(
      tour.id,
      workbook(),
      {},
      { ...actor, permissions: [] },
    ),
  ).rejects.toThrow();
});
