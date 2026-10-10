import type { MasterDataRecord } from '@nora/contracts';
import { describe, expect, it, vi } from 'vitest';

import {
  loadSupplierBrokerFourthKpi,
  recordQualifiesForPartnerKpi,
} from './supplier-broker-kpis';

function record(
  resource: 'suppliers' | 'brokers',
  id: string,
  attributes: MasterDataRecord['attributes'],
): MasterDataRecord {
  return {
    id,
    resource,
    code: id,
    name: id,
    status: 'active',
    version: 1,
    createdAt: '2026-10-04T00:00:00.000Z',
    updatedAt: '2026-10-04T00:00:00.000Z',
    attributes,
  };
}

describe('supplier and broker fourth KPIs', () => {
  it.each([
    ['suppliers', 'serviceCodes'],
    ['brokers', 'primaryContactName'],
  ] as const)(
    'counts only nonblank canonical %s projection values',
    (resource, key) => {
      expect(
        recordQualifiesForPartnerKpi(
          resource,
          record(resource, '1', { [key]: 'HOTEL' }),
        ),
      ).toBe(true);
      for (const value of ['', '   ', null, undefined, 0, false])
        expect(
          recordQualifiesForPartnerKpi(
            resource,
            record(resource, String(value), { [key]: value ?? null }),
          ),
        ).toBe(false);
    },
  );

  it('loads complete unfiltered pages and returns truthful counts', async () => {
    const first = Array.from({ length: 100 }, (_, index) =>
      record('suppliers', `supplier-${index}`, {
        serviceCodes: index % 2 ? 'HOTEL' : '',
      }),
    );
    const second = [
      record('suppliers', 'supplier-100', { serviceCodes: 'FLIGHT' }),
    ];
    const list = vi
      .fn()
      .mockResolvedValueOnce({
        data: first,
        meta: { page: 1, pageSize: 100, total: 101 },
      })
      .mockResolvedValueOnce({
        data: second,
        meta: { page: 2, pageSize: 100, total: 101 },
      });

    await expect(loadSupplierBrokerFourthKpi(list, 'suppliers')).resolves.toBe(
      51,
    );
    expect(list).toHaveBeenNthCalledWith(1, 'suppliers', {
      search: '',
      status: 'all',
      sortBy: 'name',
      sortDirection: 'asc',
      page: 1,
      pageSize: 100,
    });
    expect(list).toHaveBeenNthCalledWith(
      2,
      'suppliers',
      expect.objectContaining({ page: 2, pageSize: 100 }),
    );
  });

  it('returns zero only for a complete empty dataset', async () => {
    await expect(
      loadSupplierBrokerFourthKpi(
        vi.fn().mockResolvedValue({
          data: [],
          meta: { page: 1, pageSize: 100, total: 0 },
        }),
        'brokers',
      ),
    ).resolves.toBe(0);
  });

  it.each([
    {
      data: [],
      meta: { page: 1, pageSize: 100, total: 1 },
    },
    {
      data: [record('suppliers', 'duplicate', { serviceCodes: 'HOTEL' })],
      meta: { page: 2, pageSize: 100, total: 101 },
    },
    {
      data: [],
      meta: { page: 1, pageSize: 100, total: Number.NaN },
    },
    {
      data: [],
      meta: { page: 1, pageSize: 100, total: 0.5 },
    },
  ])('rejects malformed or incomplete pagination %#', async (response) => {
    await expect(
      loadSupplierBrokerFourthKpi(
        vi.fn().mockResolvedValue(response),
        'suppliers',
      ),
    ).rejects.toThrow();
  });

  it('rejects duplicate IDs and totals that change between pages', async () => {
    const page = Array.from({ length: 100 }, (_, index) =>
      record('brokers', `broker-${index}`, { primaryContactName: 'Contact' }),
    );
    const duplicate = vi
      .fn()
      .mockResolvedValueOnce({
        data: page,
        meta: { page: 1, pageSize: 100, total: 101 },
      })
      .mockResolvedValueOnce({
        data: [page[0]],
        meta: { page: 2, pageSize: 100, total: 101 },
      });
    await expect(
      loadSupplierBrokerFourthKpi(duplicate, 'brokers'),
    ).rejects.toThrow('record page');

    const changedTotal = vi
      .fn()
      .mockResolvedValueOnce({
        data: page,
        meta: { page: 1, pageSize: 100, total: 101 },
      })
      .mockResolvedValueOnce({
        data: [record('brokers', 'broker-100', { primaryContactName: 'C' })],
        meta: { page: 2, pageSize: 100, total: 102 },
      });
    await expect(
      loadSupplierBrokerFourthKpi(changedTotal, 'brokers'),
    ).rejects.toThrow('pagination');
  });
});
