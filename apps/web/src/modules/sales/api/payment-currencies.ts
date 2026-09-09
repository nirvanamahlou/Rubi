import type { MasterDataRecord } from '@rubi/contracts';
import { masterDataApi } from '@/modules/master-data/api/client';

/** Load the complete active reference list; a partial list is not a fallback. */
export async function loadPaymentCurrencies(): Promise<
  readonly MasterDataRecord[]
> {
  const currencies: MasterDataRecord[] = [];
  for (let page = 1; page <= 100; page++) {
    const response = await masterDataApi.list('currencies', {
      search: '',
      status: 'active',
      sortBy: 'name',
      sortDirection: 'asc',
      page,
      pageSize: 100,
    });
    currencies.push(...response.data);
    if (page * 100 >= response.meta.total) return currencies;
    if (!response.data.length) break;
  }
  throw new Error('دریافت کامل فهرست ارزها ناموفق بود.');
}
