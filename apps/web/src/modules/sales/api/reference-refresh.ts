import type { MasterDataRecord, MasterDataResource } from '@nora/contracts';
import { salesApi } from './client';
import { loadContractHotels } from './hotel-catalog';

const resources = {
  countries: 'countries',
  cities: 'cities',
  hotels: 'hotels',
  roomTypes: 'room-types',
  visaServices: 'visa-services',
  banks: 'banks',
  currencies: 'currencies',
  airlines: 'airlines',
} as const satisfies Record<string, MasterDataResource>;
export type SalesReferences = {
  -readonly [K in keyof typeof resources]: readonly MasterDataRecord[];
};

/** Publish each resource only after all its pages arrive; failed lists retain their previous value. */
export async function loadSalesReferences(
  api: { list: typeof salesApi.listReferences } = {
    list: salesApi.listReferences,
  },
  signal?: AbortSignal,
) {
  signal?.throwIfAborted();
  const entries = Object.entries(resources) as [
    keyof SalesReferences,
    MasterDataResource,
  ][];
  const results = await Promise.allSettled(
    entries.map(async ([, resource]) => {
      if (resource === 'hotels') return loadContractHotels(signal, api.list);
      const data: MasterDataRecord[] = [];
      for (let page = 1; ; page++) {
        signal?.throwIfAborted();
        const response = await api.list(resource, {
          search: '',
          status: 'active',
          sortBy: 'name',
          sortDirection: 'asc',
          page,
          pageSize: 100,
        });
        signal?.throwIfAborted();
        data.push(...response.data);
        if (!response.data.length || data.length >= response.meta.total)
          return data;
      }
    }),
  );
  signal?.throwIfAborted();
  const references: Partial<SalesReferences> = {};
  const failed: (keyof SalesReferences)[] = [];
  results.forEach((result, index) => {
    const key = entries[index]![0];
    if (result.status === 'fulfilled') references[key] = result.value;
    else failed.push(key);
  });
  return { references, failed };
}
