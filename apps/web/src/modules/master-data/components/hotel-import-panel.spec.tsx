import {
  Children,
  createElement,
  isValidElement,
  type ReactNode,
  type ReactElement,
} from 'react';
import type * as React from 'react';
import type { MasterDataRecord } from '@nora/contracts';
import { renderToStaticMarkup } from 'react-dom/server';
import { afterEach, describe, expect, it, vi } from 'vitest';

import { DisplayLocaleContext } from '@/i18n/locale-context';
import {
  HotelImportPanel,
  loadHotelImportLocations,
} from './hotel-import-panel';
import { NativeSearchSelect } from '@/components/ui/native-search-select';
import { optionText, searchOptions } from '@/components/ui/search-combobox';
import { masterDataApi } from '../api/client';
import { canonicalTestTree } from '@/i18n/test-tree';

const hooks = vi.hoisted(() => ({
  states: null as unknown[] | null,
  index: 0,
  setters: [] as ReturnType<typeof vi.fn>[],
}));
vi.mock('react', async (importOriginal) => {
  const original = await importOriginal<typeof React>();
  return {
    ...original,
    useState: (initial: unknown) =>
      hooks.states
        ? [
            hooks.states[hooks.index],
            (hooks.setters[hooks.index++] ??= vi.fn()),
          ]
        : original.useState(initial),
    useEffect: (...args: Parameters<typeof original.useEffect>) => {
      if (!hooks.states) original.useEffect(...args);
    },
  };
});
vi.mock('../api/client', () => ({
  masterDataApi: { commitHotelImport: vi.fn(), list: vi.fn() },
}));

function commitButton(node: ReactNode): (() => void) | undefined {
  if (Array.isArray(node)) {
    for (const child of node) {
      const found = commitButton(child);
      if (found) return found;
    }
  }
  if (!isValidElement<{ children?: ReactNode; onClick?: () => void }>(node))
    return;
  if (node.props.children === 'ثبت نهایی هتل‌ها') return node.props.onClick;
  return commitButton(node.props.children);
}

afterEach(() => {
  hooks.states = null;
  hooks.index = 0;
  hooks.setters = [];
  vi.unstubAllGlobals();
  vi.clearAllMocks();
});

function location(id: string, countryId?: string): MasterDataRecord {
  return {
    id,
    resource: countryId ? 'cities' : 'countries',
    code: id,
    name: id,
    status: 'active',
    attributes: countryId ? { countryId } : {},
    version: 1,
    createdAt: '2026-10-21T00:00:00.000Z',
    updatedAt: '2026-10-21T00:00:00.000Z',
  };
}
function selector(
  node: ReactNode,
  id: string,
): ReactElement<React.ComponentProps<typeof NativeSearchSelect>> | undefined {
  if (Array.isArray(node)) {
    for (const child of node) {
      const found = selector(child, id);
      if (found) return found;
    }
  }
  if (!isValidElement<{ id?: string; children?: ReactNode }>(node)) return;
  if (node.type === NativeSearchSelect && node.props.id === id)
    return node as ReactElement<
      React.ComponentProps<typeof NativeSearchSelect>
    >;
  return selector(node.props.children, id);
}
function options(
  select: ReactElement<React.ComponentProps<typeof NativeSearchSelect>>,
) {
  return Children.toArray(select.props.children)
    .filter(isValidElement)
    .map((node) => {
      const props = node.props as { value: string; children: ReactNode };
      return { value: props.value, label: optionText(props.children) };
    });
}
describe('hotel import complete geography dropdowns', () => {
  it.each(['countries', 'cities'] as const)(
    'loads every page of active %s',
    async (resource) => {
      const records = Array.from({ length: 205 }, (_, i) =>
        location(
          'location-' + i,
          resource === 'cities' ? 'country-0' : undefined,
        ),
      );
      vi.mocked(masterDataApi.list).mockImplementation(
        async (_resource, query) => ({
          data: records.slice((query.page - 1) * 100, query.page * 100),
          meta: { total: 205, page: query.page, pageSize: 100 },
        }),
      );
      expect(await loadHotelImportLocations(resource)).toEqual(records);
      expect(masterDataApi.list).toHaveBeenCalledTimes(3);
      for (const page of [1, 2, 3])
        expect(masterDataApi.list).toHaveBeenCalledWith(
          resource,
          expect.objectContaining({ page, pageSize: 100, status: 'active' }),
        );
    },
  );
  it('does not silently present a partial list after a page error', async () => {
    vi.mocked(masterDataApi.list)
      .mockResolvedValueOnce({
        data: [location('first')],
        meta: { total: 101, page: 1, pageSize: 100 },
      })
      .mockRejectedValueOnce(new Error('Lookup failed'));
    await expect(loadHotelImportLocations('countries')).rejects.toThrow(
      'Lookup failed',
    );
  });
  it('shows countries and scoped cities beyond the default five with search and canonical IDs', () => {
    const countries = Array.from({ length: 12 }, (_, i) =>
      location('country-' + i),
    );
    const cities = [
      ...Array.from({ length: 15 }, (_, i) =>
        location('city-' + i, 'country-11'),
      ),
      location('other-city', 'country-0'),
    ];
    hooks.states = [
      countries,
      cities,
      'country-11',
      'city-14',
      null,
      null,
      'SKIP',
      true,
      null,
      null,
    ];
    const tree = HotelImportPanel({ onImported: vi.fn() });
    const country = selector(tree, 'hotel-import-country')!;
    const city = selector(tree, 'hotel-import-city')!;
    expect(country.props.optionLimit).toBe(13);
    expect(city.props.optionLimit).toBe(16);
    expect(
      searchOptions(options(country), '', country.props.optionLimit),
    ).toHaveLength(13);
    expect(
      searchOptions(options(city), '', city.props.optionLimit),
    ).toHaveLength(16);
    expect(
      searchOptions(options(city), 'city-14', city.props.optionLimit),
    ).toEqual([{ value: 'city-14', label: 'city-14' }]);
    expect(options(city).some((o) => o.value === 'other-city')).toBe(false);
    expect(city.props.value).toBe('city-14');
    country.props.onChange?.({
      target: { value: 'country-0' },
    } as React.ChangeEvent<HTMLSelectElement>);
    expect(hooks.setters[2]).toHaveBeenCalledWith('country-0');
    expect(hooks.setters[3]).toHaveBeenCalledWith('');
    expect(hooks.setters[5]).toHaveBeenCalledWith(null);
  });
  it('retains the country prerequisite and disables selection during import', () => {
    hooks.states = [[], [], '', '', null, null, 'SKIP', true, 'commit', null];
    const tree = HotelImportPanel({ onImported: vi.fn() });
    expect(selector(tree, 'hotel-import-country')?.props.disabled).toBe(true);
    expect(selector(tree, 'hotel-import-city')?.props.disabled).toBe(true);
  });
});

describe('hotel import template download', () => {
  it('shows Persian name, website and an explicit false free-sale value in preview', () => {
    hooks.states = [
      [],
      [],
      'country-id',
      'city-id',
      null,
      {
        sessionId: 'session',
        previewToken: 'token',
        counts: { rows: 1, invalid: 0, duplicates: 0 },
        rows: [
          {
            rowNumber: 5,
            code: 'HOTEL_TEST',
            englishName: 'Test Hotel',
            persianName: 'هتل آزمون',
            website: 'https://hotel.example',
            freeSale: false,
            starRating: 5,
            duplicate: false,
          },
        ],
        issues: [],
        security: {},
      },
      'SKIP',
      true,
      null,
      null,
    ];
    const tree = canonicalTestTree(
      HotelImportPanel({ onImported: () => undefined }),
    );
    hooks.states = null;
    const html = renderToStaticMarkup(tree);
    expect(html).toContain('هتل آزمون');
    expect(html).toContain('https://hotel.example');
    expect(html).toContain('فروش آزاد');
    expect(html).toContain('خیر');
  });
  it('commits the preview and refreshes hotels on LAN HTTP without randomUUID', async () => {
    const counts = {
      rows: 3,
      valid: 3,
      invalid: 0,
      duplicates: 0,
      created: 3,
      updated: 0,
      skipped: 0,
    };
    hooks.states = [
      [],
      [],
      'country-id',
      'city-id',
      null,
      {
        sessionId: 'session-id',
        previewToken: 'token',
        counts,
        rows: [],
        issues: [],
        security: {},
      },
      'SKIP',
      true,
      null,
      null,
    ];
    vi.stubGlobal('crypto', {
      getRandomValues: (bytes: Uint8Array) => bytes.fill(12),
    });
    const result = {
      sessionId: 'session-id',
      status: 'COMPLETED' as const,
      counts,
      committedAt: '2026-10-12T00:00:00.000Z',
    };
    vi.mocked(masterDataApi.commitHotelImport).mockResolvedValue({
      data: result,
    });
    const onImported = vi.fn();
    const onClick = commitButton(
      canonicalTestTree(HotelImportPanel({ onImported })),
    );
    expect(onClick).toBeTypeOf('function');
    onClick!();
    await vi.waitFor(() =>
      expect(onImported).toHaveBeenCalledWith({
        result,
        countryId: 'country-id',
        cityId: 'city-id',
      }),
    );
    expect(masterDataApi.commitHotelImport).toHaveBeenCalledWith('session-id', {
      previewToken: 'token',
      duplicateBehavior: 'SKIP',
      createMissingReferences: true,
      idempotencyKey: expect.stringMatching(/^[a-f0-9-]{36}$/),
    });
  });
  it.each(['fa', 'en'] as const)(
    'offers the original workbook in %s',
    (locale) => {
      const html = renderToStaticMarkup(
        createElement(
          DisplayLocaleContext.Provider,
          { value: locale },
          createElement(HotelImportPanel, { onImported: () => undefined }),
        ),
      );
      expect(html).toContain('href="/templates/hotel-master-template.xlsx"');
      expect(html).toContain('download="hotel-master-template.xlsx"');
      expect(html).toContain(
        locale === 'fa'
          ? 'دانلود قالب اکسل هتل‌ها'
          : 'Download hotel Excel template',
      );
    },
  );
});
