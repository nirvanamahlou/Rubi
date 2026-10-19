import { agencyClient } from '@/modules/organizations/api/agency-client';
import { masterDataApi } from '@/modules/master-data/api/client';
import type { SalesBuyerContactV1 } from '@nora/contracts';
export async function agencyBuyerContact(
  organizationId: string,
  fallback: SalesBuyerContactV1,
): Promise<SalesBuyerContactV1> {
  const optional = async <T>(load: () => Promise<T>, empty: T): Promise<T> => {
    try {
      return await load();
    } catch (error) {
      if (
        error &&
        typeof error === 'object' &&
        'status' in error &&
        [403, 404].includes(Number(error.status))
      )
        return empty;
      throw error;
    }
  };
  const [contacts, addresses] = await Promise.all([
    optional(() => agencyClient.contacts(organizationId), {
      data: [],
      meta: { total: 0, page: 1, pageSize: 100 },
    }),
    optional(() => masterDataApi.organizationAddresses(organizationId), {
      data: [],
    }),
  ]);
  const candidates = contacts.data
    .filter(
      (c) =>
        c.status === 'active' && c.attributes.organizationId === organizationId,
    )
    .sort(
      (a, b) =>
        Number(Boolean(b.attributes.isPrimary)) -
        Number(Boolean(a.attributes.isPrimary)),
    )
    .slice(0, 10);
  const phones = (
    await Promise.all(
      candidates.map((c) =>
        optional(() => masterDataApi.unmaskOrganizationContact(c.id), {
          data: { id: c.id, phone: null, email: null },
        }),
      ),
    )
  )
    .map((c) => c.data.phone)
    .filter((v): v is string => Boolean(v && !v.includes('*')));
  const mobile = phones.find((v) => /^(\+98|0)?9/.test(v));
  const office = phones.find((v) => v !== mobile);
  const address = addresses.data.find((a) => a.isPrimary) ?? addresses.data[0];
  return {
    ...fallback,
    phone: mobile ?? office ?? fallback.phone,
    landline: office ?? fallback.landline ?? '',
    address: address?.addressLine ?? fallback.address,
    postalCode: address?.postalCode ?? fallback.postalCode,
  };
}
