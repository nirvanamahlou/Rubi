import { afterEach, describe, expect, it, vi } from 'vitest';

import { masterDataApi } from '@/modules/master-data/api/client';
import { agencyClient } from './agency-client';

afterEach(() => vi.restoreAllMocks());

describe('agency public Master Data adapter', () => {
  it('lists only canonical Organizations carrying the AGENCY role', async () => {
    const list = vi.spyOn(masterDataApi, 'list').mockResolvedValue({
      data: [],
      meta: { page: 2, pageSize: 20, total: 0 },
    });

    await agencyClient.list({
      search: 'سپهر',
      status: 'active',
      page: 2,
      pageSize: 20,
    });

    expect(list).toHaveBeenCalledWith('organizations', {
      search: 'سپهر',
      status: 'active',
      page: 2,
      pageSize: 20,
      organizationRole: 'AGENCY',
      sortBy: 'updatedAt',
      sortDirection: 'desc',
    });
  });

  it('loads masked contacts through the public scoped contact resource', async () => {
    const list = vi.spyOn(masterDataApi, 'list').mockResolvedValue({
      data: [],
      meta: { page: 1, pageSize: 100, total: 0 },
    });

    await agencyClient.contacts('organization-id');

    expect(list).toHaveBeenCalledWith('organization-contacts', {
      search: '',
      status: 'all',
      sortBy: 'name',
      sortDirection: 'asc',
      page: 1,
      pageSize: 100,
      organizationId: 'organization-id',
    });
  });
});
