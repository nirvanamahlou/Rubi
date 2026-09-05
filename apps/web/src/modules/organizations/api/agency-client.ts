import type {
  MasterDataListResponse,
  MasterDataStatus,
} from '@rubi/contracts';

import { masterDataApi } from '@/modules/master-data/api/client';

export interface AgencyListQuery {
  search: string;
  status: 'all' | MasterDataStatus;
  page: number;
  pageSize: number;
}

export const agencyClient = {
  list(query: AgencyListQuery): Promise<MasterDataListResponse> {
    return masterDataApi.list('organizations', {
      ...query,
      organizationRole: 'AGENCY',
      sortBy: 'updatedAt',
      sortDirection: 'desc',
    });
  },
  contacts(organizationId: string): Promise<MasterDataListResponse> {
    return masterDataApi.list('organization-contacts', {
      search: '',
      status: 'all',
      sortBy: 'name',
      sortDirection: 'asc',
      page: 1,
      pageSize: 100,
      organizationId,
    });
  },
};
