import type { MasterDataRecord, MasterDataResource } from '@nora/contracts';
import {
  masterDataApi,
  MasterDataApiError,
} from '@/modules/master-data/api/client';
import { refreshAuthenticatedSession } from '@/lib/auth-session';
import { getPublicApiBaseUrl } from '@/lib/environment';

export const salesReferenceGroups = [
  ['countries', 'countries', 'کشورها'],
  ['cities', 'cities', 'شهرها'],
  ['hotels', 'hotels', 'هتل‌ها'],
  ['room-types', 'roomTypes', 'نوع اتاق‌ها'],
  ['visa-services', 'visaServices', 'خدمات ویزا'],
  ['banks', 'banks', 'بانک‌ها'],
  ['currencies', 'currencies', 'ارزها'],
] as const;
export type SalesReferences = Record<
  (typeof salesReferenceGroups)[number][1],
  readonly MasterDataRecord[]
>;
export const emptySalesReferences: SalesReferences = {
  countries: [],
  cities: [],
  hotels: [],
  roomTypes: [],
  visaServices: [],
  banks: [],
  currencies: [],
};
export interface SalesReferenceFailure {
  label: string;
  status?: number;
}

async function readPage(resource: MasterDataResource, page: number) {
  const query = {
    search: '',
    status: 'active' as const,
    sortBy: 'name' as const,
    sortDirection: 'asc' as const,
    page,
    pageSize: 100,
  };
  try {
    return await masterDataApi.list(resource, query);
  } catch (error) {
    if (error instanceof MasterDataApiError && error.status === 401) {
      const base = getPublicApiBaseUrl();
      if (base && (await refreshAuthenticatedSession(base)))
        return masterDataApi.list(resource, query);
    } else if (
      error instanceof TypeError ||
      (error instanceof MasterDataApiError && error.status >= 500)
    ) {
      return masterDataApi.list(resource, query);
    }
    throw error;
  }
}

/** Failed groups never overwrite already loaded options on a later retry. */
export async function loadSalesReferences() {
  const results = await Promise.allSettled(
    salesReferenceGroups.map(async ([resource]) => {
      const data: MasterDataRecord[] = [];
      for (let page = 1; ; page++) {
        const response = await readPage(resource, page);
        data.push(...response.data);
        if (!response.data.length || data.length >= response.meta.total)
          return data;
      }
    }),
  );
  const references: Partial<SalesReferences> = {};
  const failures: SalesReferenceFailure[] = [];
  results.forEach((result, index) => {
    const [, key, label] = salesReferenceGroups[index]!;
    if (result.status === 'fulfilled') references[key] = result.value;
    else
      failures.push({
        label,
        ...(result.reason instanceof MasterDataApiError
          ? { status: result.reason.status }
          : {}),
      });
  });
  return { references, failures };
}
