import type { MasterDataRecord } from '@nora/contracts';
import { renderToStaticMarkup } from 'react-dom/server';
import { describe, expect, it } from 'vitest';

import {
  airportKpiItems,
  currentPageTerminalTotal,
} from './master-data-geography-kpis';
import { MasterDataKpiGrid } from './master-data-kpi-grid';

function airport(
  terminalCount?: string | number | boolean | null,
  cityName = 'تهران',
): MasterDataRecord {
  return {
    id: crypto.randomUUID(),
    resource: 'airports',
    code: 'IKA',
    name: 'فرودگاه امام خمینی',
    status: 'active',
    version: 1,
    createdAt: '2026-10-01T00:00:00.000Z',
    updatedAt: '2026-10-01T00:00:00.000Z',
    attributes: {
      cityName,
      ...(terminalCount === undefined ? {} : { terminalCount }),
    },
  };
}

describe('airport terminal KPI', () => {
  it('returns zero for an empty current page', () => {
    expect(currentPageTerminalTotal([])).toBe(0);
  });

  it('sums terminal counts across the current airport page', () => {
    expect(currentPageTerminalTotal([airport(2), airport(3), airport(0)])).toBe(
      5,
    );
  });

  it('marks a page with a missing terminal count as unavailable', () => {
    expect(currentPageTerminalTotal([airport(), airport(2)])).toBe('—');
  });

  it.each([
    -1,
    1.5,
    Number.NaN,
    Number.POSITIVE_INFINITY,
    Number.MAX_SAFE_INTEGER + 1,
    '4',
    null,
  ])('marks invalid terminal count %s as unavailable', (invalid) => {
    expect(currentPageTerminalTotal([airport(invalid), airport(2)])).toBe('—');
  });

  it('does not replace an unavailable count with a partial total', () => {
    expect(airportKpiItems([airport(2), airport()], 2, 2)[3]?.value).toBe('—');
  });

  it('marks a sum beyond the safe integer range as unavailable', () => {
    expect(
      currentPageTerminalTotal([airport(Number.MAX_SAFE_INTEGER), airport(1)]),
    ).toBe('—');
  });

  it('renders exactly four airport cards with explicit current-page terminal scope', () => {
    const items = airportKpiItems(
      [airport(2, 'تهران'), airport(1, 'شیراز')],
      12,
      9,
    );
    const html = renderToStaticMarkup(
      <MasterDataKpiGrid items={items} label="شاخص‌های فرودگاه‌ها" />,
    );

    expect(items.map(({ label, value }) => ({ label, value }))).toEqual([
      { label: 'کل فرودگاه‌ها', value: 12 },
      { label: 'فرودگاه فعال', value: 9 },
      { label: 'شهرهای مرتبط', value: 2 },
      { label: 'ترمینال‌های مرتبط', value: 3 },
    ]);
    expect(html).toContain('کل فرودگاه‌ها');
    expect(html).toContain('فرودگاه فعال');
    expect(html).toContain('شهرهای مرتبط');
    expect(html).toContain('ترمینال‌های مرتبط');
    expect(html).toContain('در صفحه جاری');
    expect(html).toContain('>۳<');
  });
});
