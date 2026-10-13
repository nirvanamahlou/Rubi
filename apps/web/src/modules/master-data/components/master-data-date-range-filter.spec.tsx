import { readFileSync } from 'node:fs';
import { resolve } from 'node:path';
import { createElement } from 'react';
import { renderToStaticMarkup } from 'react-dom/server';
import { describe, expect, it, vi } from 'vitest';

import { MasterDataDateRangeFilter } from './master-data-date-range-filter';

describe('MasterDataDateRangeFilter', () => {
  it('renders a compact accessible from/to range with Persian and Gregorian support', () => {
    const html = renderToStaticMarkup(
      createElement(MasterDataDateRangeFilter, {
        fromDate: '2026-08-01',
        idPrefix: 'test-created',
        onFromDateChange: vi.fn(),
        onReset: vi.fn(),
        onToDateChange: vi.fn(),
        toDate: '2026-08-31',
      }),
    );

    expect(html).toContain('بازه تاریخ');
    expect(html).toContain('شمسی / میلادی');
    expect(html).toContain('از تاریخ');
    expect(html).toContain('تا تاریخ');
    expect(html).toContain('id="test-created-from-date"');
    expect(html).toContain('id="test-created-to-date"');
    expect(html).toContain('پاک‌کردن بازه');
  });

  it.each([
    'master-data-finance-workspace.tsx',
    'master-data-geography-workspace.tsx',
    'master-data-suppliers-workspace.tsx',
    'master-data-accommodation-workspace.tsx',
    'master-data-transportation-workspace.tsx',
    'master-data-insurance-workspace.tsx',
    'master-data-travel-services-workspace.tsx',
    'master-data-sales-references-workspace.tsx',
    'master-data-live-workspace.tsx',
  ])('connects the shared date range to %s', (fileName) => {
    const source = readFileSync(
      resolve(process.cwd(), 'src/modules/master-data/components', fileName),
      'utf8',
    );
    expect(source).toContain('<MasterDataDateRangeFilter');
    expect(source).toContain('...dateFilters');
  });
});
