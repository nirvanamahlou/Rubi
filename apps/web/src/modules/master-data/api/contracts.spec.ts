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

  it('rejects uncontrolled page sizes', () => {
    expect(() => parseMasterDataListQuery({ pageSize: 101 })).toThrow();
  });

  it('uses explicit status actions and async export routes', () => {
    expect(
      masterDataEndpoints.action('countries', 'country/ir', 'deactivate'),
    ).toBe('/api/v1/master-data/countries/country%2Fir/actions/deactivate');
    expect(masterDataEndpoints.exports).toBe('/api/v1/master-data/exports');
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
