import { readFileSync } from 'node:fs';
import { resolve } from 'node:path';

import {
  getMasterDataColumnFilters,
  MASTER_DATA_RESOURCES,
  type MasterDataResource,
} from '@nora/contracts';
import { createElement } from 'react';
import { renderToStaticMarkup } from 'react-dom/server';
import { describe, expect, it, vi } from 'vitest';

import {
  effectiveMasterDataColumnFilters,
  useMasterDataColumnFilters,
  visibleMasterDataColumnFilters,
} from './master-data-column-filters';

function FilterHarness({ resource }: { resource: MasterDataResource }) {
  const { columnFilterControls } = useMasterDataColumnFilters(
    resource,
    vi.fn(),
  );
  return createElement('div', null, columnFilterControls);
}

describe('Master Data dedicated column filters', () => {
  it.each(MASTER_DATA_RESOURCES)(
    'removes only the dedicated English-name control for %s',
    (resource) => {
      const original = getMasterDataColumnFilters(resource);
      const visible = visibleMasterDataColumnFilters(resource);
      expect(
        visible.every(({ filter }) => filter.path[0] !== 'englishName'),
      ).toBe(true);
      expect(visible.map(({ originalIndex }) => originalIndex)).toEqual(
        original.flatMap((filter, index) =>
          filter.path.length === 1 && filter.path[0] === 'englishName'
            ? []
            : [index],
        ),
      );
      const values = original.map((filter, index) =>
        filter.path.length === 1 && filter.path[0] === 'englishName'
          ? 'stale-english-value'
          : `retained-${index}`,
      );
      expect(effectiveMasterDataColumnFilters(resource, values)).toEqual(
        Object.fromEntries(
          visible.map(({ originalIndex }) => [
            `columnFilter${originalIndex + 1}`,
            `retained-${originalIndex}`,
          ]),
        ),
      );
      expect(
        effectiveMasterDataColumnFilters(
          resource,
          original.map(() => ''),
        ),
      ).toEqual({});
      const html = renderToStaticMarkup(
        createElement(FilterHarness, { resource }),
      );
      expect(html).not.toContain('فیلتر نام انگلیسی');
      expect(html).not.toContain('جست‌وجوی نام انگلیسی');
      for (const { originalIndex } of visible) {
        expect(html).toContain(`${resource}-column-filter-${originalIndex}`);
      }
    },
  );

  it('preserves original backend slots while dropping stale English values', () => {
    expect(
      effectiveMasterDataColumnFilters('countries', ['IR', 'Iran']),
    ).toEqual({
      columnFilter1: 'IR',
    });
    expect(
      effectiveMasterDataColumnFilters('regions', ['Tehran', 'PROVINCE']),
    ).toEqual({
      columnFilter2: 'PROVINCE',
    });
    expect(
      effectiveMasterDataColumnFilters('cities', ['Tehran', 'Province']),
    ).toEqual({
      columnFilter2: 'Province',
    });
    expect(
      effectiveMasterDataColumnFilters('insurers', ['Iran', 'Insurer EN']),
    ).toEqual({
      columnFilter1: 'Iran',
    });
    expect(
      effectiveMasterDataColumnFilters('airports', ['IKA', 'OIIE']),
    ).toEqual({
      columnFilter1: 'IKA',
      columnFilter2: 'OIIE',
    });
    expect(
      effectiveMasterDataColumnFilters('sales-channels', ['WEB', 'Web']),
    ).toEqual({
      columnFilter1: 'WEB',
    });
  });

  it('binds the shared projected filters to list and export in all specialized consumers', () => {
    for (const file of [
      'master-data-accommodation-workspace.tsx',
      'master-data-finance-workspace.tsx',
      'master-data-geography-workspace.tsx',
      'master-data-insurance-workspace.tsx',
      'master-data-sales-references-workspace.tsx',
      'master-data-suppliers-workspace.tsx',
      'master-data-transportation-workspace.tsx',
      'master-data-travel-services-workspace.tsx',
    ]) {
      const source = readFileSync(
        resolve(process.cwd(), 'src/modules/master-data/components', file),
        'utf8',
      );
      expect(source).toContain('useMasterDataColumnFilters(resource');
      expect(
        source.match(/\.\.\.columnFilters/g)?.length ?? 0,
      ).toBeGreaterThanOrEqual(2);
    }
  });
});
