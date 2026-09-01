import {
  MASTER_DATA_API_PREFIX,
  masterDataEndpoints,
  type MasterDataListResponse,
  type MasterDataRecord,
} from '@rubi/contracts';
import { getPublicApiBaseUrl } from '../../../lib/environment';
import type { Reference } from '../model/catalog';

export type PublishedResource =
  | 'airlines'
  | 'airports'
  | 'aircraft-types'
  | 'cabin-classes'
  | 'baggage-rules'
  | 'currencies'
  | 'countries'
  | 'cities';
export interface ReferenceFilters {
  countryId?: string;
  cityId?: string;
}
export class ReferenceApiError extends Error {
  constructor(
    readonly state:
      'unavailable' | 'unauthorized' | 'forbidden' | 'conflict' | 'error',
    message: string,
  ) {
    super(message);
  }
}
export function referenceState(status: number): ReferenceApiError['state'] {
  return status === 401
    ? 'unauthorized'
    : status === 403
      ? 'forbidden'
      : status === 409
        ? 'conflict'
        : 'error';
}
export async function listReferences(
  resource: PublishedResource,
  search: string,
  page: number,
  signal?: AbortSignal,
  filters: ReferenceFilters = {},
): Promise<MasterDataListResponse> {
  const base = getPublicApiBaseUrl();
  if (!base)
    throw new ReferenceApiError('unavailable', 'نشانی API پیکربندی نشده است.');
  const query = new URLSearchParams({
    search,
    status: 'active',
    sortBy: 'name',
    sortDirection: 'asc',
    page: String(page),
    pageSize: '25',
  });
  if (filters.countryId) query.set('countryId', filters.countryId);
  if (filters.cityId) query.set('cityId', filters.cityId);
  const path = masterDataEndpoints
    .list(resource)
    .slice(MASTER_DATA_API_PREFIX.length);
  const response = await fetch(`${base}/master-data${path}?${query}`, {
    method: 'GET',
    credentials: 'include',
    headers: { accept: 'application/json' },
    ...(signal ? { signal } : {}),
  });
  if (!response.ok)
    throw new ReferenceApiError(
      referenceState(response.status),
      'دریافت مرجع اطلاعات پایه ممکن نشد.',
    );
  const body = (await response.json()) as MasterDataListResponse;
  if (
    !body ||
    !Array.isArray(body.data) ||
    !body.meta ||
    !Number.isSafeInteger(body.meta.total) ||
    body.meta.total < 0 ||
    body.meta.page !== page ||
    body.meta.pageSize !== 25 ||
    body.data.some(
      (item) =>
        !item.id ||
        item.resource !== resource ||
        !['active', 'inactive'].includes(item.status) ||
        typeof item.name !== 'string' ||
        typeof item.code !== 'string',
    )
  ) {
    throw new ReferenceApiError(
      'error',
      'پاسخ اطلاعات پایه با قرارداد منتشرشده سازگار نیست.',
    );
  }
  return {
    ...body,
    data: body.data.filter((item) => item.status === 'active'),
  };
}
export function asReference(record: MasterDataRecord): Reference | undefined {
  const kinds = {
    airlines: 'airline',
    airports: 'airport',
    'aircraft-types': 'aircraft',
    'cabin-classes': 'flightClass',
    'baggage-rules': 'baggage',
    currencies: 'currency',
    countries: 'country',
    cities: 'city',
  } as const;
  if (!(record.resource in kinds)) return undefined;
  return {
    id: record.id,
    name: record.name,
    active: record.status === 'active',
    kind: kinds[record.resource as PublishedResource],
    ...(typeof record.attributes.countryId === 'string'
      ? { countryId: record.attributes.countryId }
      : {}),
    ...(typeof record.attributes.cityId === 'string'
      ? { cityId: record.attributes.cityId }
      : {}),
    code: record.code,
  };
}
