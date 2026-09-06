import type {
  CustomerDetail,
  MasterDataRecord,
  MasterDataResource,
} from '@rubi/contracts';

import { masterDataApi } from '@/modules/master-data/api/client';

type CustomerMasterResource =
  'organizations' | 'acquaintance-methods' | 'countries' | 'cities';

async function active(resource: CustomerMasterResource) {
  return (
    await masterDataApi.list(resource, {
      search: '',
      status: 'active',
      sortBy: 'name',
      sortDirection: 'asc',
      page: 1,
      pageSize: 100,
    })
  ).data;
}

async function appendReferenced(
  resource: MasterDataResource,
  records: readonly MasterDataRecord[],
  ids: readonly (string | null | undefined)[],
) {
  const byId = new Map(records.map((record) => [record.id, record]));
  await Promise.all(
    [...new Set(ids.filter((id): id is string => Boolean(id)))].map(
      async (id) => {
        if (byId.has(id)) return;
        try {
          const detail = await masterDataApi.detail(resource, id);
          byId.set(detail.data.id, detail.data);
        } catch {
          // A missing or forbidden reference remains unresolved; never invent it.
        }
      },
    ),
  );
  return [...byId.values()];
}

export async function loadCustomerMasterData(customer?: CustomerDetail) {
  const [organizations, acquaintanceMethods, countries, cities] =
    await Promise.all([
      active('organizations'),
      active('acquaintance-methods'),
      active('countries'),
      active('cities'),
    ]);
  const referencedOrganizations = await appendReferenced(
    'organizations',
    organizations,
    [customer?.organizationId],
  );
  const referencedMethods = await appendReferenced(
    'acquaintance-methods',
    acquaintanceMethods,
    [customer?.acquaintanceMethodId],
  );
  const referencedCities = await appendReferenced(
    'cities',
    cities,
    customer?.addresses.map((address) => address.cityId) ?? [],
  );
  const referencedCountries = await appendReferenced(
    'countries',
    countries,
    referencedCities.map((city) =>
      typeof city.attributes.countryId === 'string'
        ? city.attributes.countryId
        : null,
    ),
  );
  return {
    organizations: referencedOrganizations,
    acquaintanceMethods: referencedMethods,
    countries: referencedCountries,
    cities: referencedCities,
  };
}

export function isMasterReferenceSelectable(
  record: MasterDataRecord,
  currentId?: string | null,
) {
  return record.status === 'active' || record.id === currentId;
}
