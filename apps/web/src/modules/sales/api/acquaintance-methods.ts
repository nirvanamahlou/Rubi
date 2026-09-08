import type { MasterDataRecord } from '@rubi/contracts';
import { masterDataApi } from '@/modules/master-data/api/client';

export async function loadSalesAcquaintanceMethods(list = masterDataApi.list) {
  const records: MasterDataRecord[] = [];
  for (let page = 1; ; page++) {
    const response = await list('acquaintance-methods', {
      search: '',
      status: 'active',
      sortBy: 'name',
      sortDirection: 'asc',
      page,
      pageSize: 100,
    });
    records.push(...response.data);
    if (records.length >= response.meta.total) break;
    if (!response.data.length)
      throw new Error('فهرست نحوه‌های آشنایی کامل دریافت نشد.');
  }
  return records.filter(
    (record, index) =>
      record.resource === 'acquaintance-methods' &&
      record.status === 'active' &&
      records.findIndex((other) => other.id === record.id) === index,
  );
}
