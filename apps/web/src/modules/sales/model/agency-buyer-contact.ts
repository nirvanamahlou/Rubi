import { salesApi } from '../api/client';
import type { SalesBuyerContactV1 } from '@nora/contracts';

export async function agencyBuyerContact(
  organizationId: string,
  fallback: SalesBuyerContactV1,
): Promise<SalesBuyerContactV1> {
  const { data } = await salesApi.agencyBuyerContact(organizationId);
  return {
    ...fallback,
    phone: data.phone || fallback.phone,
    landline: data.landline || fallback.landline || '',
    address: data.address || fallback.address,
    postalCode: data.postalCode || fallback.postalCode,
  };
}
