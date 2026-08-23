export const MASTER_DATA_CONTRACT_VERSION = 1 as const;
export const MASTER_DATA_API_PREFIX = '/api/v1/master-data' as const;

export const MASTER_DATA_RESOURCES = [
  'countries',
  'cities',
  'currencies',
  'exchange-rates',
  'banks',
  'insurers',
  'airlines',
  'hotels',
  'organizations',
  'brokers',
  'leaders',
  'acquaintance-methods',
] as const;

export type MasterDataResource = (typeof MASTER_DATA_RESOURCES)[number];
export type MasterDataStatus = 'active' | 'inactive';
export type MasterDataSortField = 'name' | 'code' | 'updatedAt';
export type MasterDataSortDirection = 'asc' | 'desc';

export interface MasterDataListQuery {
  search: string;
  status: 'all' | MasterDataStatus;
  sortBy: MasterDataSortField;
  sortDirection: MasterDataSortDirection;
  page: number;
  pageSize: number;
}

export interface MasterDataRecord {
  id: string;
  resource: MasterDataResource;
  code: string;
  name: string;
  status: MasterDataStatus;
  attributes: Readonly<Record<string, string | number | boolean | null>>;
  version: number;
  createdAt: string;
  updatedAt: string;
}

export interface MasterDataListResponse {
  data: readonly MasterDataRecord[];
  meta: { page: number; pageSize: number; total: number };
}

export interface MasterDataMutationRequest {
  values: Readonly<Record<string, string | number | readonly string[] | null>>;
  version?: number;
}

export interface MasterDataExportRequest {
  resource: MasterDataResource;
  format: 'xlsx' | 'pdf';
  filters: Omit<MasterDataListQuery, 'page' | 'pageSize'>;
  columns: readonly string[];
  locale: 'fa-IR';
  timezone: string;
}

export interface MasterDataExportOperation {
  id: string;
  status: 'AWAITING_DOCUMENTS_WORKER' | 'PROCESSING' | 'COMPLETED' | 'FAILED';
  artifactId: string | null;
  createdAt: string;
}

export const masterDataEndpoints = {
  list: (resource: MasterDataResource) =>
    `${MASTER_DATA_API_PREFIX}/${resource}` as const,
  detail: (resource: MasterDataResource, id: string) =>
    `${MASTER_DATA_API_PREFIX}/${resource}/${encodeURIComponent(id)}` as const,
  status: (resource: MasterDataResource, id: string) =>
    `${MASTER_DATA_API_PREFIX}/${resource}/${encodeURIComponent(id)}/status` as const,
  exports: `${MASTER_DATA_API_PREFIX}/exports` as const,
  exportStatus: (id: string) =>
    `${MASTER_DATA_API_PREFIX}/exports/${encodeURIComponent(id)}` as const,
};
