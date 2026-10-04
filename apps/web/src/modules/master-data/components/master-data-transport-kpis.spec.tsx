import { createElement } from 'react';
import { renderToStaticMarkup } from 'react-dom/server';
import type { MasterDataRecord } from '@nora/contracts';
import { describe, expect, it } from 'vitest';

import {
  hasValidTransportSummaryProgress,
  transportKpiItems,
  type TransportResource,
  type TransportSummaryState,
} from './master-data-transportation-workspace';
import { MasterDataKpiGrid } from './master-data-kpi-grid';

function record(
  resource: TransportResource,
  attributes: MasterDataRecord['attributes'],
  index: number,
  status: MasterDataRecord['status'] = 'active',
): MasterDataRecord {
  return {
    id: `${resource}-${index}`,
    resource,
    code: `CODE-${index}`,
    name: `رکورد ${index}`,
    status,
    attributes,
    version: 1,
    createdAt: '2026-10-01T00:00:00.000Z',
    updatedAt: '2026-10-01T00:00:00.000Z',
  };
}

const replacements = [
  ['airlines', 'countryId', 'کشورهای مبدأ'],
  ['aircraft-types', 'model', 'مدل‌های یکتا'],
  ['rail-companies', 'countryId', 'کشورهای ثبت‌شده'],
  ['train-types', 'category', 'دسته‌های قطار'],
  ['bus-companies', 'countryId', 'کشورهای ثبت‌شده'],
  ['bus-types', 'serviceClass', 'کلاس‌های خدمات'],
] as const satisfies readonly (readonly [TransportResource, string, string])[];

describe('transport KPI replacements', () => {
  it.each(replacements)(
    'counts distinct canonical %s values globally and ignores malformed values',
    (resource, attribute, label) => {
      const records = [
        record(resource, { [attribute]: 'alpha' }, 1),
        record(resource, { [attribute]: ' alpha ' }, 2),
        record(resource, { [attribute]: 'beta' }, 3, 'inactive'),
        record(resource, { [attribute]: '' }, 4),
        record(resource, { [attribute]: null }, 5),
        record(resource, { [attribute]: 7 }, 6),
      ];

      const items = transportKpiItems(resource, records, 'ready');

      expect(items).toHaveLength(4);
      expect(items[3]).toMatchObject({
        label,
        value: 2,
        hint: 'در کل اطلاعات پایه',
      });
    },
  );

  it.each(replacements)(
    'reports a truthful zero for an empty ready %s summary',
    (resource, _attribute, label) => {
      expect(transportKpiItems(resource, [], 'ready')[3]).toMatchObject({
        label,
        value: 0,
      });
    },
  );

  it.each([
    'loading',
    'error',
  ] as const satisfies readonly TransportSummaryState[])(
    'reports unavailable while the replacement summary is %s',
    (state) => {
      for (const [resource] of replacements)
        expect(transportKpiItems(resource, [], state)[3]?.value).toBe('—');
    },
  );

  it('renders four ordered airline cards with the explicit global hint', () => {
    const items = transportKpiItems(
      'airlines',
      [record('airlines', { countryId: 'country-1' }, 1)],
      'ready',
    );
    const html = renderToStaticMarkup(
      createElement(MasterDataKpiGrid, {
        items,
        label: 'شاخص‌های حمل‌ونقل',
      }),
    );

    expect(items.map(({ label }) => label)).toEqual([
      'کل ایرلاین‌ها',
      'ایرلاین فعال',
      'Connection فعال',
      'کشورهای مبدأ',
    ]);
    expect(html).toContain('کشورهای مبدأ');
    expect(html).toContain('در کل اطلاعات پایه');
    expect(html).not.toContain('نیازمند تکمیل برند');
  });

  it('preserves the first three aircraft cards and replaces only body types', () => {
    const items = transportKpiItems(
      'aircraft-types',
      [
        record('aircraft-types', { manufacturer: 'Airbus', model: 'A320' }, 1),
        record(
          'aircraft-types',
          { manufacturer: 'Airbus', model: ' A320 ' },
          2,
        ),
        record('aircraft-types', { manufacturer: 'Boeing', model: '777' }, 3),
      ],
      'ready',
    );

    expect(items.map(({ label }) => label)).toEqual([
      'انواع هواپیما',
      'نوع فعال',
      'سازندگان',
      'مدل‌های یکتا',
    ]);
    expect(items.map(({ value }) => value)).toEqual([3, 3, 2, 2]);
    expect(items.some(({ label }) => label === 'انواع بدنه')).toBe(false);
  });

  it('replaces the cabin review card and preserves manifest publication', () => {
    expect(
      transportKpiItems('cabin-classes', [], 'ready').map(({ label }) => label),
    ).toEqual(['کلاس‌ها', 'فعال', 'انواع کابین', 'کلاس غیرفعال']);
    expect(transportKpiItems('cabin-classes', [], 'ready')[3]?.label).toBe(
      'کلاس غیرفعال',
    );
    expect(transportKpiItems('cabin-classes', [], 'ready')[3]?.value).toBe(0);
    expect(transportKpiItems('cabin-classes', [], 'loading')[3]?.value).toBe(
      '—',
    );
    expect(transportKpiItems('manifest-templates', [], 'ready')[3]?.label).toBe(
      'در انتظار انتشار',
    );
  });

  it('rejects malformed or stalled global pagination instead of inventing a total', () => {
    expect(hasValidTransportSummaryProgress(0, 0, 0)).toBe(true);
    expect(hasValidTransportSummaryProgress(2, 2, 5)).toBe(true);
    expect(hasValidTransportSummaryProgress(0, 2, 5)).toBe(false);
    expect(hasValidTransportSummaryProgress(2, 2, Number.NaN)).toBe(false);
    expect(hasValidTransportSummaryProgress(2, 2, -1)).toBe(false);
    expect(
      hasValidTransportSummaryProgress(2, 2, Number.MAX_SAFE_INTEGER + 1),
    ).toBe(false);
    expect(hasValidTransportSummaryProgress(3, 3, 2)).toBe(false);
  });
});
