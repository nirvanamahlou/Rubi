import { afterEach, describe, expect, it, vi } from 'vitest';
import type { MasterDataRecord } from '@rubi/contracts';

import { masterDataApi } from '@/modules/master-data/api/client';
import { refreshAuthenticatedSession } from '@/lib/auth-session';
import { agencyClient, B2bApiError } from './agency-client';

vi.mock('@/lib/environment', () => ({
  getPublicApiBaseUrl: () => 'http://localhost:4999/api/v1',
}));
vi.mock('@/lib/auth-session', () => ({ refreshAuthenticatedSession: vi.fn() }));

afterEach(() => vi.restoreAllMocks());

describe('agency public Master Data adapter', () => {
  it('pins new contacts to the selected canonical organization', async () => {
    const create = vi
      .spyOn(masterDataApi, 'create')
      .mockResolvedValue({ data: {} as MasterDataRecord });
    await agencyClient.saveContact('selected', {
      organizationId: 'other',
      fullName: 'Synthetic contact',
    });
    expect(create).toHaveBeenCalledWith('organization-contacts', {
      values: { organizationId: 'selected', fullName: 'Synthetic contact' },
    });
  });

  it('retains the contact version and rejects moving a contact from another organization', async () => {
    const update = vi
      .spyOn(masterDataApi, 'update')
      .mockResolvedValue({ data: {} as MasterDataRecord });
    const record = {
      id: 'contact',
      version: 7,
      attributes: { organizationId: 'selected' },
    } as unknown as MasterDataRecord;
    await agencyClient.saveContact(
      'selected',
      { fullName: 'Synthetic contact' },
      record,
    );
    expect(update).toHaveBeenCalledWith('organization-contacts', 'contact', {
      values: { fullName: 'Synthetic contact', organizationId: 'selected' },
      version: 7,
    });
    expect(() => agencyClient.saveContact('other', {}, record)).toThrow(
      'متعلق',
    );
    expect(update).toHaveBeenCalledTimes(1);
  });
  it('preserves stable conflict codes and never replays conflicting writes', async () => {
    const fetch = vi.spyOn(globalThis, 'fetch').mockResolvedValue(
      new Response(
        JSON.stringify({
          error: { code: 'B2B_RATE_OVERLAP', message: 'هم‌پوشانی نرخ' },
        }),
        { status: 409 },
      ),
    );
    const result = agencyClient.createAgreedRate('id', {
      branchId: 'branch',
      serviceReference: 'HOTEL',
      title: 'Rate',
      kind: 'DISCOUNT_PERCENT',
      value: '5',
      validFrom: '2026-09-08',
    });
    await expect(result).rejects.toMatchObject({
      status: 409,
      code: 'B2B_RATE_OVERLAP',
    });
    expect(fetch).toHaveBeenCalledTimes(1);
  });

  it.each([401, 403])(
    'keeps HTTP %i distinct from empty data',
    async (status) => {
      vi.mocked(refreshAuthenticatedSession).mockResolvedValue(null);
      vi.spyOn(globalThis, 'fetch').mockResolvedValue(
        new Response('{}', { status }),
      );
      await expect(agencyClient.workspace('id')).rejects.toBeInstanceOf(
        B2bApiError,
      );
      await expect(agencyClient.workspace('id')).rejects.toMatchObject({
        status,
      });
    },
  );
  it('keeps corporate role filtering and ordering on the server', async () => {
    const list = vi.spyOn(masterDataApi, 'list').mockResolvedValue({
      data: [],
      meta: { page: 3, pageSize: 20, total: 0 },
    });
    await agencyClient.list({
      search: '',
      status: 'all',
      page: 3,
      pageSize: 20,
      role: 'CORPORATE_CUSTOMER',
      sortBy: 'name',
      sortDirection: 'asc',
    });
    expect(list).toHaveBeenCalledWith('organizations', {
      search: '',
      status: 'all',
      page: 3,
      pageSize: 20,
      organizationRole: 'CORPORATE_CUSTOMER',
      sortBy: 'name',
      sortDirection: 'asc',
    });
  });
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
