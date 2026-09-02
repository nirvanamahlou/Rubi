import { describe, expect, it } from 'vitest';

import {
  masterDataEndpoints,
  masterDataExportRequestSchema,
  parseMasterDataListQuery,
  serializeMasterDataListQuery,
} from './contracts';

describe('master data API proposal', () => {
  it('normalizes allowlisted list query defaults', () => {
    const query = parseMasterDataListQuery({ search: ' ایران ' });
    expect(query).toMatchObject({
      search: 'ایران',
      status: 'all',
      sortBy: 'name',
      sortDirection: 'asc',
      page: 1,
      pageSize: 25,
    });
    expect(serializeMasterDataListQuery(query)).toContain('pageSize=25');
  });

  it('serializes allowlisted geography filters', () => {
    const query = parseMasterDataListQuery({
      countryId: '11111111-1111-4111-8111-111111111111',
      regionId: '22222222-2222-4222-8222-222222222222',
      terminalType: 'VIP',
    });
    const serialized = serializeMasterDataListQuery(query);
    expect(serialized).toContain(
      'countryId=11111111-1111-4111-8111-111111111111',
    );
    expect(serialized).toContain(
      'regionId=22222222-2222-4222-8222-222222222222',
    );
    expect(serialized).toContain('terminalType=VIP');
  });

  it('serializes an inclusive creation-date range for list and export requests', () => {
    const query = parseMasterDataListQuery({
      createdFrom: '2026-08-01',
      createdTo: '2026-08-31',
    });
    const serialized = serializeMasterDataListQuery(query);
    expect(serialized).toContain('createdFrom=2026-08-01');
    expect(serialized).toContain('createdTo=2026-08-31');
    expect(
      masterDataExportRequestSchema.safeParse({
        resource: 'hotels',
        format: 'xlsx',
        filters: query,
        columns: ['code', 'name'],
        locale: 'fa-IR',
        timezone: 'Asia/Tehran',
      }).success,
    ).toBe(true);
  });

  it('rejects non-ISO date-only filter values', () => {
    expect(() =>
      parseMasterDataListQuery({ createdFrom: '1405/06/09' }),
    ).toThrow();
    expect(() =>
      parseMasterDataListQuery({ createdTo: '2026-02-31' }),
    ).toThrow();
  });

  it('serializes accommodation filters without leaking unknown keys', () => {
    const query = parseMasterDataListQuery({
      starRating: 5,
      referenceCapacity: 2,
      mealServiceCategory: 'MEAL_PLAN',
      facilityCategory: 'عمومی',
    });
    const serialized = serializeMasterDataListQuery(query);
    expect(serialized).toContain('starRating=5');
    expect(serialized).toContain('referenceCapacity=2');
    expect(serialized).toContain('mealServiceCategory=MEAL_PLAN');
    expect(serialized).toContain(
      `facilityCategory=${encodeURIComponent('عمومی')}`,
    );
  });

  it('serializes normalized insurance filters', () => {
    const query = parseMasterDataListQuery({
      insurerId: '11111111-1111-4111-8111-111111111111',
      currencyId: '22222222-2222-4222-8222-222222222222',
      destinationRegion: 'شنگن',
    });
    const serialized = serializeMasterDataListQuery(query);
    expect(serialized).toContain(
      'insurerId=11111111-1111-4111-8111-111111111111',
    );
    expect(serialized).toContain(
      'currencyId=22222222-2222-4222-8222-222222222222',
    );
    expect(serialized).toContain(
      `destinationRegion=${encodeURIComponent('شنگن')}`,
    );
  });

  it('serializes normalized travel service filters', () => {
    const query = parseMasterDataListQuery({
      supplierId: '11111111-1111-4111-8111-111111111111',
      tourScope: 'INTERNATIONAL',
      transferServiceMode: 'PRIVATE',
      passengerScope: 'ALL',
      busServiceClass: 'VIP',
    });
    const serialized = serializeMasterDataListQuery(query);
    expect(serialized).toContain(
      'supplierId=11111111-1111-4111-8111-111111111111',
    );
    expect(serialized).toContain('tourScope=INTERNATIONAL');
    expect(serialized).toContain('transferServiceMode=PRIVATE');
    expect(serialized).toContain('passengerScope=ALL');
    expect(serialized).toContain('busServiceClass=VIP');
  });

  it('rejects uncontrolled page sizes', () => {
    expect(() => parseMasterDataListQuery({ pageSize: 101 })).toThrow();
  });

  it('uses explicit status actions and async export routes', () => {
    expect(
      masterDataEndpoints.action('countries', 'country/ir', 'deactivate'),
    ).toBe('/api/v1/master-data/countries/country%2Fir/actions/deactivate');
    expect(masterDataEndpoints.exports).toBe('/api/v1/master-data/exports');
    expect(masterDataEndpoints.excelDownload).toBe(
      '/api/v1/master-data/exports/xlsx/download',
    );
  });

  it('validates an auditable export request', () => {
    const result = masterDataExportRequestSchema.safeParse({
      resource: 'airlines',
      format: 'xlsx',
      filters: {
        search: '',
        status: 'active',
        sortBy: 'name',
        sortDirection: 'asc',
      },
      columns: ['code', 'name', 'status'],
      timezone: 'Asia/Tehran',
    });
    expect(result.success).toBe(true);
  });
});
