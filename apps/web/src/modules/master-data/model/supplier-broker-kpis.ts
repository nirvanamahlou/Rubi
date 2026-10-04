import type { MasterDataListQuery, MasterDataRecord } from '@nora/contracts';

export type SupplierBrokerKpiResource = 'suppliers' | 'brokers';

const PAGE_SIZE = 100;

function hasNonblankString(record: MasterDataRecord, key: string) {
  const value = record.attributes[key];
  return typeof value === 'string' && value.trim().length > 0;
}

export function recordQualifiesForPartnerKpi(
  resource: SupplierBrokerKpiResource,
  record: MasterDataRecord,
) {
  return resource === 'suppliers'
    ? hasNonblankString(record, 'serviceCodes')
    : hasNonblankString(record, 'primaryContactName');
}

export async function loadSupplierBrokerFourthKpi(
  list: (
    resource: SupplierBrokerKpiResource,
    query: MasterDataListQuery,
  ) => Promise<{
    data: readonly MasterDataRecord[];
    meta: { page: number; pageSize: number; total: number };
  }>,
  resource: SupplierBrokerKpiResource,
) {
  const ids = new Set<string>();
  let expectedTotal: number | undefined;
  let matching = 0;

  for (let page = 1; ; page += 1) {
    const response = await list(resource, {
      search: '',
      status: 'all',
      sortBy: 'name',
      sortDirection: 'asc',
      page,
      pageSize: PAGE_SIZE,
    });
    const total = response.meta.total;
    if (
      !Number.isSafeInteger(total) ||
      total < 0 ||
      response.meta.page !== page ||
      response.meta.pageSize !== PAGE_SIZE ||
      (expectedTotal !== undefined && total !== expectedTotal)
    )
      throw new Error('Invalid supplier/broker KPI pagination');
    expectedTotal ??= total;

    for (const record of response.data) {
      if (record.resource !== resource || ids.has(record.id))
        throw new Error('Invalid supplier/broker KPI record page');
      ids.add(record.id);
      if (recordQualifiesForPartnerKpi(resource, record)) matching += 1;
    }

    if (ids.size === total) return matching;
    if (
      ids.size > total ||
      response.data.length === 0 ||
      response.data.length < PAGE_SIZE
    )
      throw new Error('Incomplete supplier/broker KPI pagination');
  }
}
