import type { MasterDataRecord } from '@nora/contracts';
import { salesApi } from './client';
/** Fetch the complete selectable catalogue without a destination or hotel-rate filter. */
export async function loadContractHotels(
  signal?: AbortSignal,
  list = salesApi.listReferences,
) {
  const hotels = new Map<string, MasterDataRecord>();
  for (let page = 1; ; page++) {
    signal?.throwIfAborted();
    const result = await list('hotels', {
      search: '',
      status: 'active',
      sortBy: 'name',
      sortDirection: 'asc',
      page,
      pageSize: 100,
    });
    signal?.throwIfAborted();
    const before = hotels.size;
    for (const hotel of result.data) hotels.set(hotel.id, hotel);
    if (hotels.size >= result.meta.total) return [...hotels.values()];
    if (!result.data.length || hotels.size === before)
      throw Error('دریافت فهرست کامل هتل‌ها انجام نشد.');
  }
}
