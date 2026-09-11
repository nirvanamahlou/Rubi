import type { MasterDataRecord } from '@rubi/contracts';
import type { AgencyListQuery } from '../api/agency-client';
import { agencyClient } from '../api/agency-client';

export interface OrganizationMetrics {
  agencies: number;
  corporateCustomers: number;
  incompleteIdentity: number;
}

export function hasIncompleteOrganizationIdentity(record: MasterDataRecord) {
  const { personType, nationalId } = record.attributes;
  return (
    !['NATURAL', 'LEGAL'].includes(String(personType)) ||
    (personType === 'LEGAL' && !String(nationalId ?? '').trim())
  );
}

/** Read through the public directory API, retaining its authorization and filters. */
export async function loadOrganizationMetrics(
  filters: Pick<AgencyListQuery, 'search' | 'status'>,
  isCurrent: () => boolean = () => true,
  list = agencyClient.list,
): Promise<OrganizationMetrics> {
  const readRole = async (role: 'AGENCY' | 'CORPORATE_CUSTOMER') => {
    const records = new Map<string, MasterDataRecord>();
    let page = 1;
    let totalPages = 1;
    do {
      if (!isCurrent()) throw new Error('Superseded metrics request');
      const response = await list({
        ...filters,
        role,
        page,
        pageSize: 100,
        sortBy: 'code',
        sortDirection: 'asc',
      });
      if (!isCurrent()) throw new Error('Superseded metrics request');
      response.data.forEach((record) => records.set(record.id, record));
      totalPages = Math.max(
        1,
        Math.ceil(response.meta.total / response.meta.pageSize),
      );
      page += 1;
    } while (page <= totalPages);
    return records;
  };
  const [agencies, corporations] = await Promise.all([
    readRole('AGENCY'),
    readRole('CORPORATE_CUSTOMER'),
  ]);
  const organizations = new Map([...agencies, ...corporations]);
  return {
    agencies: agencies.size,
    corporateCustomers: corporations.size,
    incompleteIdentity: [...organizations.values()].filter(
      hasIncompleteOrganizationIdentity,
    ).length,
  };
}
