import { describe, expect, it } from 'vitest';
import {
  getMasterDataColumnFilters,
  type MasterDataRecord,
} from '@rubi/contracts';
import { transportColumns, transportColumnValue } from './transport-columns';
import { serializeMasterDataListQuery } from '../api/contracts';
describe('mockup column coverage', () => {
  it.each([
    'airlines',
    'aircraft-types',
    'cabin-classes',
    'baggage-rules',
    'manifest-templates',
    'rail-companies',
    'train-types',
    'bus-companies',
    'bus-types',
  ] as const)('has individual columns and two filters for %s', (resource) => {
    expect(transportColumns(resource).length).toBeGreaterThanOrEqual(6);
    expect(getMasterDataColumnFilters(resource)).toHaveLength(2);
    expect(new Set(transportColumns(resource).map(([key]) => key)).size).toBe(
      transportColumns(resource).length,
    );
  });
  it('matches required airline and aircraft columns', () => {
    expect(transportColumns('airlines').map(([, label]) => label)).toEqual([
      'IATA',
      'ICAO',
      'ایرلاین',
      'کشور',
      'سازمان',
      'لوگو Reference',
      'Integration Connection',
      'Version / Audit',
    ]);
    expect(
      transportColumns('aircraft-types').map(([, label]) => label),
    ).toContain('نوع بدنه');
  });
  it('does not invent external connections or capacity', () => {
    const record = {
      resource: 'bus-types',
      attributes: {},
    } as MasterDataRecord;
    expect(transportColumnValue(record, 'capacity')).toBe(
      'در پیکربندی ناوگان / سرویس',
    );
    expect(transportColumnValue(record, 'integrationConnectionReference')).toBe(
      '—',
    );
  });
  it('serializes both column filters for server-side pagination', () => {
    const params = new URLSearchParams(
      serializeMasterDataListQuery({
        search: '',
        status: 'all',
        page: 2,
        pageSize: 25,
        sortBy: 'name',
        sortDirection: 'asc',
        columnFilter1: 'Airbus',
        columnFilter2: 'NARROW_BODY',
      }),
    );
    expect(params.get('columnFilter1')).toBe('Airbus');
    expect(params.get('columnFilter2')).toBe('NARROW_BODY');
    expect(params.get('page')).toBe('2');
  });
});
