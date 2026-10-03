import { readFileSync } from 'node:fs';
import { resolve } from 'node:path';

import { describe, expect, it } from 'vitest';
import {
  getMasterDataColumnFilters,
  type MasterDataRecord,
} from '@nora/contracts';
import { transportColumns, transportColumnValue } from './transport-columns';
import { serializeMasterDataListQuery } from '../api/contracts';

const workspaceSource = readFileSync(
  resolve(
    process.cwd(),
    'src/modules/master-data/components/master-data-transportation-workspace.tsx',
  ),
  'utf8',
);
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
    expect(transportColumns(resource).length).toBeGreaterThanOrEqual(
      resource === 'airlines' ? 4 : 5,
    );
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
    ]);
    expect(
      transportColumns('airlines').map(([, label]) => label),
    ).not.toContain('سازمان');
    for (const hidden of [
      'لوگو Reference',
      'Integration Connection',
      'Version / Audit',
    ])
      expect(
        transportColumns('airlines').map(([, label]) => label),
      ).not.toContain(hidden);
    expect(workspaceSource).toContain("{key === 'code' ? (");
    expect(workspaceSource).toContain('<MasterDataLogoCell record={record} />');
    expect(workspaceSource).toMatch(
      /<td className="p-4 text-center">\s*<div className="flex flex-wrap justify-center gap-2">/,
    );
    for (const action of ['مشاهده', 'ویرایش'])
      expect(workspaceSource).toContain(`aria-label={\`${action} \${`);
    expect(workspaceSource).toContain('<MasterDataDeleteButton');
    expect(transportColumns('airlines')).toHaveLength(4);
    expect(
      transportColumns('aircraft-types').map(([, label]) => label),
    ).toEqual([
      'کد',
      'سازنده و مدل',
      'عنوان انگلیسی',
      'نوع بدنه',
      'ظرفیت',
      'ترتیب نمایش',
    ]);
    expect(
      transportColumns('aircraft-types').map(([, label]) => label),
    ).not.toContain('عنوان فارسی');
  });
  it('shows only the required English title for cabin classes', () => {
    expect(transportColumns('cabin-classes').map(([, label]) => label)).toEqual(
      ['کد', 'عنوان انگلیسی', 'کد رزرو', 'ترتیب', 'استفاده در Ticket Catalog'],
    );
    expect(
      transportColumns('cabin-classes').map(([, label]) => label),
    ).not.toContain('عنوان فارسی');
  });
  it('removes combined audit columns while preserving independent versions', () => {
    for (const resource of [
      'airlines',
      'cabin-classes',
      'rail-companies',
      'bus-companies',
    ] as const) {
      expect(transportColumns(resource).map(([key]) => key)).not.toContain(
        'versionAudit',
      );
      expect(
        transportColumns(resource).map(([, label]) => label),
      ).not.toContain('Version / Audit');
    }
    expect(transportColumns('baggage-rules')).toContainEqual([
      'version',
      'Version',
    ]);
    expect(transportColumns('manifest-templates')).toContainEqual([
      'versionNumber',
      'نسخه قالب',
    ]);
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
