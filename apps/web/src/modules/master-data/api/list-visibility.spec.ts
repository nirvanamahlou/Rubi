import type { MasterDataListQuery } from '@rubi/contracts';
import { readFileSync } from 'node:fs';
import { afterEach, describe, expect, it, vi } from 'vitest';

import { masterDataApi } from './client';
import { masterDataListQuerySchema } from './contracts';

afterEach(() => {
  vi.unstubAllGlobals();
  vi.unstubAllEnvs();
});

describe('Master Data list visibility after saving', () => {
  it.each(['finance', 'geography'])(
    '%s never requests a page below the API minimum',
    (workspace) => {
      const source = readFileSync(
        new URL(
          `../components/master-data-${workspace}-workspace.tsx`,
          import.meta.url,
        ),
        'utf8',
      );
      const sizes = [...source.matchAll(/pageSize:\s*(\d+)/g)].map((match) =>
        Number(match[1]),
      );
      expect(sizes.length).toBeGreaterThan(0);
      expect(sizes.filter((size) => size < 10 || size > 100)).toEqual([]);
    },
  );

  it('keeps the saved row visible when loading the list and its summaries together', async () => {
    vi.stubEnv('NEXT_PUBLIC_API_BASE_URL', 'http://localhost:4000/api/v1');
    const record = {
      id: 'test-airport',
      code: 'TST',
      name: 'فرودگاه آزمون',
      status: 'active',
    };
    let saved = false;
    const queries: ReturnType<typeof masterDataListQuerySchema.parse>[] = [];
    vi.stubGlobal(
      'fetch',
      vi.fn(async (url: string, init: RequestInit) => {
        if (init.method === 'POST') {
          saved = true;
          return { ok: true, json: async () => ({ data: record }) };
        }
        const query = masterDataListQuerySchema.parse(
          Object.fromEntries(new URL(url).searchParams),
        );
        queries.push(query);
        return {
          ok: true,
          json: async () => ({
            data: saved ? [record] : [],
            meta: {
              page: query.page,
              pageSize: query.pageSize,
              total: saved ? 1 : 0,
            },
          }),
        };
      }),
    );
    const query: MasterDataListQuery = {
      search: '',
      status: 'all',
      sortBy: 'name',
      sortDirection: 'asc',
      page: 1,
      pageSize: 25,
      countryId: '11111111-1111-4111-8111-111111111111',
    };
    await masterDataApi.create('airports', { values: { name: record.name } });
    const activeQuery = { ...query, page: 9, status: 'active' as const };
    const [list, active, latest] = await Promise.all([
      masterDataApi.list('airports', query),
      masterDataApi.listSummary('airports', activeQuery),
      masterDataApi.listSummary('airports', {
        ...query,
        sortBy: 'updatedAt',
        sortDirection: 'desc',
      }),
    ]);
    expect(list.data).toEqual([record]);
    expect(active.meta.total).toBe(1);
    expect(latest.data[0]).toEqual(record);
    expect(queries.slice(1)).toEqual([
      { ...query, status: 'active', page: 1, pageSize: 10 },
      {
        ...query,
        sortBy: 'updatedAt',
        sortDirection: 'desc',
        page: 1,
        pageSize: 10,
      },
    ]);
  });
});
