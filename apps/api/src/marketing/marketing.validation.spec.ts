import { describe, expect, it } from 'vitest';

import { normalizeMarketingListQuery } from './marketing.validation';

describe('marketing list query', () => {
  it('normalizes pagination, filter and sort defaults', () => {
    expect(normalizeMarketingListQuery({ search: '  نوروز  ' })).toEqual({
      search: 'نوروز',
      status: 'ALL',
      channel: 'ALL',
      company: 'ALL',
      startsFrom: null,
      endsUntil: null,
      sortBy: 'updatedAt',
      sortDirection: 'desc',
      page: 1,
      pageSize: 10,
    });
  });

  it('accepts an allowlisted filter and sort request', () => {
    expect(
      normalizeMarketingListQuery({
        status: 'RUNNING',
        channel: 'SMS',
        company: 'NIAYESH_SEIR_SAHAR',
        startsFrom: '2026-09-01T00:00:00.000Z',
        endsUntil: '2026-10-01T00:00:00.000Z',
        sortBy: 'version',
        sortDirection: 'asc',
        page: 2,
        pageSize: 20,
      }),
    ).toMatchObject({ status: 'RUNNING', sortBy: 'version', page: 2 });
  });

  it.each([
    { page: 0 },
    { pageSize: 101 },
    { search: '<script>' },
    { startsFrom: '2026-09-01' },
    {
      startsFrom: '2026-10-01T00:00:00.000Z',
      endsUntil: '2026-09-01T00:00:00.000Z',
    },
  ])('rejects invalid pagination/filter/sort input %#', (query) => {
    expect(() => normalizeMarketingListQuery(query)).toThrow();
  });
});
