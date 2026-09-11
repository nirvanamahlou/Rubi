import type { MasterDataRecord } from '@rubi/contracts';
import { describe, expect, it, vi } from 'vitest';
import {
  hasIncompleteOrganizationIdentity,
  loadOrganizationMetrics,
} from './organization-metrics';
import type { agencyClient } from '../api/agency-client';

const record = (
  id: string,
  attributes = { personType: 'LEGAL', nationalId: '' },
) => ({ id, attributes }) as unknown as MasterDataRecord;

describe('live organization metrics', () => {
  it('includes later pages, forwards filters, and deduplicates multi-role identities', async () => {
    const list = vi
      .fn<typeof agencyClient.list>()
      .mockImplementation(async (query) => {
        const data =
          query.role === 'CORPORATE_CUSTOMER'
            ? [record('shared')]
            : query.page === 1
              ? [record('shared')]
              : [
                  record('agency', {
                    personType: 'LEGAL',
                    nationalId: '12345678901',
                  }),
                ];
        return {
          data,
          meta: {
            page: query.page,
            pageSize: 1,
            total: query.role === 'AGENCY' ? 2 : 1,
          },
        };
      });
    expect(
      await loadOrganizationMetrics(
        { search: 'سفر', status: 'active' },
        () => true,
        list,
      ),
    ).toEqual({
      agencies: 2,
      corporateCustomers: 1,
      incompleteIdentity: 1,
    });
    expect(list).toHaveBeenCalledTimes(3);
    for (const [query] of list.mock.calls) {
      expect(query).toMatchObject({
        search: 'سفر',
        status: 'active',
        sortBy: 'code',
      });
    }
  });
  it('does not present failed or cancelled reads as zero counts', async () => {
    const list = vi
      .fn<typeof agencyClient.list>()
      .mockRejectedValue(new Error('Forbidden'));
    await expect(
      loadOrganizationMetrics({ search: '', status: 'all' }, () => true, list),
    ).rejects.toThrow('Forbidden');
    list.mockClear();
    await expect(
      loadOrganizationMetrics({ search: '', status: 'all' }, () => false, list),
    ).rejects.toThrow('Superseded');
    expect(list).not.toHaveBeenCalled();
  });
  it('requires national ID only for legal persons and distinguishes empty successful data', async () => {
    expect(
      hasIncompleteOrganizationIdentity(
        record('natural', { personType: 'NATURAL', nationalId: '' }),
      ),
    ).toBe(false);
    expect(
      hasIncompleteOrganizationIdentity(
        record('unknown', { personType: '', nationalId: '' }),
      ),
    ).toBe(true);
    const list = vi.fn<typeof agencyClient.list>().mockResolvedValue({
      data: [],
      meta: { page: 1, pageSize: 100, total: 0, totalPages: 0 },
    });
    expect(
      await loadOrganizationMetrics(
        { search: '', status: 'all' },
        () => true,
        list,
      ),
    ).toEqual({ agencies: 0, corporateCustomers: 0, incompleteIdentity: 0 });
  });
});
