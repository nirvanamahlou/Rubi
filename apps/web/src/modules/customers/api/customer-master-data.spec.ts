import type { CustomerDetail, MasterDataRecord } from '@rubi/contracts';
import { afterEach, describe, expect, it, vi } from 'vitest';

import { masterDataApi } from '@/modules/master-data/api/client';
import {
  isMasterReferenceSelectable,
  loadCustomerMasterData,
} from './customer-master-data';

function record(
  id: string,
  resource: MasterDataRecord['resource'],
  status: MasterDataRecord['status'],
  attributes: MasterDataRecord['attributes'] = {},
): MasterDataRecord {
  return {
    id,
    resource,
    code: id,
    name: id,
    status,
    attributes,
    version: 1,
    createdAt: '2026-09-05T00:00:00.000Z',
    updatedAt: '2026-09-05T00:00:00.000Z',
  };
}

afterEach(() => vi.restoreAllMocks());

describe('customer Master Data references', () => {
  it('keeps referenced inactive values visible while rejecting new selection', () => {
    const inactive = record('old-org', 'organizations', 'inactive');
    expect(isMasterReferenceSelectable(inactive, 'old-org')).toBe(true);
    expect(isMasterReferenceSelectable(inactive, 'another-org')).toBe(false);
  });

  it('loads active options and appends only existing referenced inactive records through the public client', async () => {
    vi.spyOn(masterDataApi, 'list').mockImplementation(
      async (resource) =>
        ({
          data: [record(`active-${resource}`, resource, 'active')],
          meta: { page: 1, pageSize: 100, total: 1 },
        }) as never,
    );
    const inactive = {
      'old-org': record('old-org', 'organizations', 'inactive'),
      'old-method': record('old-method', 'acquaintance-methods', 'inactive'),
      'old-city': record('old-city', 'cities', 'inactive', {
        countryId: 'old-country',
      }),
      'old-country': record('old-country', 'countries', 'inactive'),
    } as const;
    const detail = vi
      .spyOn(masterDataApi, 'detail')
      .mockImplementation(async (_resource, id) => ({
        data: inactive[id as keyof typeof inactive],
      }));
    const customer = {
      organizationId: 'old-org',
      acquaintanceMethodId: 'old-method',
      addresses: [{ cityId: 'old-city' }],
    } as unknown as CustomerDetail;

    const result = await loadCustomerMasterData(customer);

    expect(result.organizations.map((item) => item.id)).toContain('old-org');
    expect(result.acquaintanceMethods.map((item) => item.id)).toContain(
      'old-method',
    );
    expect(result.cities.map((item) => item.id)).toContain('old-city');
    expect(result.countries.map((item) => item.id)).toContain('old-country');
    expect(detail).toHaveBeenCalledWith('organizations', 'old-org');
    expect(detail).toHaveBeenCalledWith('cities', 'old-city');
  });
});
