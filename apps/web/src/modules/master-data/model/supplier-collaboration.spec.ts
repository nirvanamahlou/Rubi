import type {
  MasterCollaborationStatus,
  MasterDataListQuery,
  MasterDataListResponse,
  MasterDataRecord,
} from '@rubi/contracts';
import { describe, expect, it, vi } from 'vitest';

import {
  groupSupplierCollaborationRecords,
  loadSupplierCollaborationPage,
} from './supplier-collaboration';

function record(
  resource: 'suppliers' | 'brokers',
  collaborationStatus: MasterCollaborationStatus,
  id = `${resource}-${collaborationStatus}`,
): MasterDataRecord {
  return {
    id,
    resource,
    code: id,
    name: id,
    status: 'active',
    attributes: { collaborationStatus },
    version: 1,
    createdAt: '2026-08-31T00:00:00.000Z',
    updatedAt: '2026-08-31T00:00:00.000Z',
  };
}

function response(
  data: MasterDataRecord[],
  total = data.length,
  page = 1,
): MasterDataListResponse {
  return { data, meta: { total, page, pageSize: 25 } };
}

describe('supplier collaboration read model', () => {
  it('reads suppliers and brokers using the same search, status and page', async () => {
    const supplier = record('suppliers', 'ACTIVE');
    const broker = record('brokers', 'UNDER_REVIEW');
    const list = vi.fn(async (resource: 'suppliers' | 'brokers') =>
      response(resource === 'suppliers' ? [supplier] : [broker], 26, 2),
    );

    const result = await loadSupplierCollaborationPage(
      { list },
      { search: 'test', status: 'inactive', page: 2 },
    );

    expect(list).toHaveBeenCalledTimes(2);
    for (const resource of ['suppliers', 'brokers'])
      expect(list).toHaveBeenCalledWith(resource, {
        search: 'test',
        status: 'inactive',
        page: 2,
        pageSize: 25,
        sortBy: 'name',
        sortDirection: 'asc',
      });
    expect(result).toEqual({
      suppliers: [supplier],
      brokers: [broker],
      total: 52,
      pageCount: 2,
    });
  });

  it('keeps every row reachable when one source has more than 100 records', async () => {
    const suppliers = Array.from({ length: 101 }, (_, index) =>
      record('suppliers', 'ACTIVE', `supplier-${index}`),
    );
    const brokers = [record('brokers', 'ENDED'), record('brokers', 'ACTIVE')];
    const list = vi.fn(
      async (resource: 'suppliers' | 'brokers', query: MasterDataListQuery) => {
        const rows = resource === 'suppliers' ? suppliers : brokers;
        const start = (query.page - 1) * query.pageSize;
        return response(
          rows.slice(start, start + query.pageSize),
          rows.length,
          query.page,
        );
      },
    );
    const seen: MasterDataRecord[] = [];
    for (let page = 1; page <= 5; page += 1) {
      const result = await loadSupplierCollaborationPage(
        { list },
        { search: '', status: 'all', page },
      );
      expect(result.total).toBe(103);
      expect(result.pageCount).toBe(5);
      seen.push(...result.suppliers, ...result.brokers);
      if (page === 5) {
        expect(result.suppliers).toEqual([suppliers[100]]);
        expect(result.brokers).toEqual([]);
      }
    }
    expect(seen).toHaveLength(103);
    expect(
      new Set(seen.map((item) => `${item.resource}:${item.id}`)).size,
    ).toBe(103);
  });

  it('uses one empty page when neither source has records', async () => {
    const result = await loadSupplierCollaborationPage(
      { list: async () => response([]) },
      { search: '', status: 'all', page: 1 },
    );
    expect(result).toEqual({
      suppliers: [],
      brokers: [],
      total: 0,
      pageCount: 1,
    });
  });

  it('rejects a partial result if either source fails', async () => {
    const reader = {
      list: async (resource: 'suppliers' | 'brokers') => {
        if (resource === 'brokers') throw new Error('read denied');
        return response([record('suppliers', 'ACTIVE')]);
      },
    };
    await expect(
      loadSupplierCollaborationPage(reader, {
        search: '',
        status: 'all',
        page: 1,
      }),
    ).rejects.toThrow('read denied');
  });

  it('groups both sources by saved collaboration status, independently of active flags', () => {
    const statuses: MasterCollaborationStatus[] = [
      'ACTIVE',
      'UNDER_REVIEW',
      'PURCHASE_SUSPENDED',
      'ENDED',
    ];
    const suppliers = statuses.map((status) =>
      record('suppliers', status, status),
    );
    const brokers = statuses.map((status) => ({
      ...record('brokers', status, status),
      status: 'inactive' as const,
    }));
    const groups = groupSupplierCollaborationRecords(suppliers, brokers);
    statuses.forEach((status, index) => {
      expect(groups[status]).toEqual([suppliers[index], brokers[index]]);
    });
  });

  it('reflects a changed source status without rewriting the original record', () => {
    const original = record('suppliers', 'UNDER_REVIEW');
    const updated = {
      ...original,
      attributes: { collaborationStatus: 'ENDED' },
    };
    expect(
      groupSupplierCollaborationRecords([original], []).UNDER_REVIEW,
    ).toEqual([original]);
    const groups = groupSupplierCollaborationRecords([updated], []);
    expect(groups.UNDER_REVIEW).toEqual([]);
    expect(groups.ENDED).toEqual([updated]);
    expect(original.attributes.collaborationStatus).toBe('UNDER_REVIEW');
  });

  it('does not invent a collaboration status for missing or unknown values', () => {
    const unknown = { ...record('suppliers', 'ACTIVE'), attributes: {} };
    const invalid = {
      ...record('brokers', 'ACTIVE'),
      attributes: { collaborationStatus: 'toString' },
    };
    const groups = groupSupplierCollaborationRecords([unknown], [invalid]);
    expect(Object.values(groups).flat()).toEqual([]);
  });
});
