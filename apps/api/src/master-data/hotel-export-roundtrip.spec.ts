import { describe, expect, it, vi } from 'vitest';
import type { AuthenticatedActor } from '@nora/contracts';
import { MasterDataService } from './master-data.service';
import { strFromU8, unzipSync } from 'fflate';
import type { MasterDataRepository } from './master-data.repository';
import type { MasterDataRecord } from '@nora/contracts';
import { buildMasterDataXlsx } from './master-data.xlsx';
import {
  parseHotelImportWorkbook,
  HOTEL_IMPORT_MIME,
} from './hotel-import.parser';

describe('hotel export native import compatibility', () => {
  it('keeps the selected city on every export page and audits its filter', async () => {
    const cityId = '66666666-6666-4666-8666-666666666666';
    const makeRow = (index: number) => ({
      id: String(index),
      code: `HOTEL_${index}`,
      name: `Hotel ${index}`,
      englishName: `Hotel ${index}`,
      cityId,
      city: { name: 'کیش' },
      isActive: true,
      version: 1,
      createdAt: new Date(),
      updatedAt: new Date(),
    });
    const list = vi
      .fn()
      .mockResolvedValueOnce({
        rows: Array.from({ length: 100 }, (_, i) => makeRow(i)),
        total: 101,
      })
      .mockResolvedValueOnce({ rows: [makeRow(100)], total: 101 });
    const createExport = vi.fn().mockResolvedValue({ id: 'export' });
    const service = new MasterDataService({
      list,
      createExport,
    } as unknown as MasterDataRepository);
    const file = await service.downloadXlsx(
      {
        resource: 'hotels',
        format: 'xlsx',
        filters: { cityId, status: 'all' },
        columns: ['name'],
        locale: 'fa-IR',
        timezone: 'Asia/Tehran',
      },
      {
        userId: 'actor',
        sessionId: 'session',
        branchIds: ['branch'],
        permissions: ['master_data.read', 'master_data.export'],
      } as AuthenticatedActor,
    );
    expect(list).toHaveBeenNthCalledWith(
      1,
      'hotels',
      expect.objectContaining({ cityId, page: 1 }),
    );
    expect(list).toHaveBeenNthCalledWith(
      2,
      'hotels',
      expect.objectContaining({ cityId, page: 2 }),
    );
    expect(createExport).toHaveBeenCalledWith(
      expect.objectContaining({
        filterSnapshot: { cityId, status: 'all' },
        status: 'COMPLETED',
      }),
    );
    const parsed = parseHotelImportWorkbook({
      buffer: file.buffer,
      fileName: file.fileName,
      mimeType: HOTEL_IMPORT_MIME,
      expectedCityName: 'کیش',
    });
    expect(parsed.issues).toEqual([]);
    expect(parsed.rows).toHaveLength(101);
  });
  it.each(['fa-IR', 'en-US'] as const)(
    'exports canonical columns independently of UI columns and language %s',
    (locale) => {
      const record = {
        id: 'synthetic',
        resource: 'hotels',
        code: 'HOTEL_TEST',
        name: 'هتل آزمایشی',
        status: 'active',
        version: 1,
        createdAt: '2026-11-19T00:00:00Z',
        updatedAt: '2026-11-19T00:00:00Z',
        attributes: {
          englishName: 'Test Hotel',
          cityName: 'کیش',
          address: 'Test address',
          starRating: 5,
          mealServiceIds: 'other-meal,primary-meal',
          mealServiceId: 'primary-meal',
          mealServiceCodes: 'HB,BB',
          roomTypeIds: 'other-room,primary-room',
          defaultRoomTypeId: 'primary-room',
          roomTypeNames: 'SUITE,STANDARD',
          facilityNames: 'Pool,Wifi',
          freeSale: false,
          website: 'https://example.com',
          sourceFeatured: true,
        },
      } as MasterDataRecord;
      const buffer = buildMasterDataXlsx({
        resource: 'hotels',
        columns: ['name', 'cityId'],
        records: [record],
        locale,
        timezone: 'Asia/Tehran',
      });
      const parsed = parseHotelImportWorkbook({
        buffer,
        fileName: 'hotels.xlsx',
        mimeType: HOTEL_IMPORT_MIME,
        expectedCityName: 'کیش',
      });
      expect(parsed.issues).toEqual([]);
      const sheet = strFromU8(unzipSync(buffer)['xl/worksheets/sheet1.xml']!);
      expect(sheet.indexOf('<dimension')).toBeLessThan(
        sheet.indexOf('<sheetViews'),
      );
      expect(sheet).toContain('rightToLeft="1"');
      expect(parsed.rows).toHaveLength(1);
      expect(parsed.rows[0]).toMatchObject({
        code: 'HOTEL_TEST',
        englishName: 'Test Hotel',
        persianName: 'هتل آزمایشی',
        city: 'کیش',
        mealServiceCode: 'BB',
        defaultRoomType: 'STANDARD',
        facilities: ['Pool', 'Wifi'],
        freeSale: false,
        featuredSource: true,
        isActive: true,
      });
    },
  );
});
