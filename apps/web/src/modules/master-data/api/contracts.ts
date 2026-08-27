import { z } from 'zod';

import { masterDataResourceKeys } from '../model/catalog';

export const MASTER_DATA_API_PROPOSAL_VERSION = 'master-data.v1-draft';
export const MASTER_DATA_API_PREFIX = '/api/v1/master-data';
export const MASTER_DATA_BLOCKED_REASON =
  'PDF archival export remains dependent on the Documents Worker; direct Excel download is available.';

export const masterDataResourceSchema = z.enum(masterDataResourceKeys);
export const masterDataStatusSchema = z.enum(['active', 'inactive']);
export const masterDataListQuerySchema = z.object({
  search: z.string().trim().max(100).default(''),
  status: z.enum(['all', 'active', 'inactive']).default('all'),
  sortBy: z.enum(['name', 'code', 'updatedAt']).default('name'),
  sortDirection: z.enum(['asc', 'desc']).default('asc'),
  page: z.coerce.number().int().min(1).default(1),
  pageSize: z.coerce.number().int().min(10).max(100).default(25),
  countryId: z.string().uuid().optional(),
  regionId: z.string().uuid().optional(),
  cityId: z.string().uuid().optional(),
  airportId: z.string().uuid().optional(),
  terminalType: z.enum(['DOMESTIC', 'INTERNATIONAL', 'VIP']).optional(),
});

export const masterDataExportRequestSchema = z.object({
  resource: masterDataResourceSchema,
  format: z.enum(['xlsx', 'pdf']),
  filters: masterDataListQuerySchema.omit({ page: true, pageSize: true }),
  columns: z.array(z.string().min(1)).min(1).max(30),
  locale: z.literal('fa-IR').default('fa-IR'),
  timezone: z.string().min(1),
});

export type MasterDataResource = z.infer<typeof masterDataResourceSchema>;
export type MasterDataStatus = z.infer<typeof masterDataStatusSchema>;
export type MasterDataListQuery = z.infer<typeof masterDataListQuerySchema>;
export type MasterDataExportRequest = z.infer<
  typeof masterDataExportRequestSchema
>;

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
  meta: {
    requestId: string;
    page: number;
    pageSize: number;
    total: number;
  };
}

export interface MasterDataOperationAccepted {
  data: { operationId: string; status: 'queued' };
  meta: { requestId: string };
}

export interface MasterDataApiError {
  error: {
    code:
      | 'MASTER_DATA_VALIDATION_FAILED'
      | 'MASTER_DATA_NOT_FOUND'
      | 'MASTER_DATA_IN_USE'
      | 'MASTER_DATA_PERMISSION_DENIED'
      | 'CONCURRENT_MODIFICATION';
    message: string;
    details: readonly { field?: string; reason: string }[];
    retryable: boolean;
  };
  meta: { requestId: string; traceId?: string };
}

export const masterDataEndpoints = {
  list: (resource: MasterDataResource) =>
    `${MASTER_DATA_API_PREFIX}/${resource}` as const,
  create: (resource: MasterDataResource) =>
    `${MASTER_DATA_API_PREFIX}/${resource}` as const,
  detail: (resource: MasterDataResource, id: string) =>
    `${MASTER_DATA_API_PREFIX}/${resource}/${encodeURIComponent(id)}` as const,
  action: (
    resource: MasterDataResource,
    id: string,
    action: 'activate' | 'deactivate',
  ) =>
    `${MASTER_DATA_API_PREFIX}/${resource}/${encodeURIComponent(id)}/actions/${action}` as const,
  exports: `${MASTER_DATA_API_PREFIX}/exports` as const,
  excelDownload: `${MASTER_DATA_API_PREFIX}/exports/xlsx/download` as const,
  exportStatus: (operationId: string) =>
    `${MASTER_DATA_API_PREFIX}/exports/${encodeURIComponent(operationId)}` as const,
};

export function parseMasterDataListQuery(input: unknown) {
  return masterDataListQuerySchema.parse(input);
}

export function serializeMasterDataListQuery(query: MasterDataListQuery) {
  const params = new URLSearchParams({
    search: query.search,
    status: query.status,
    sortBy: query.sortBy,
    sortDirection: query.sortDirection,
    page: String(query.page),
    pageSize: String(query.pageSize),
  });
  for (const field of [
    'countryId',
    'regionId',
    'cityId',
    'airportId',
    'terminalType',
  ] as const) {
    const value = query[field];
    if (value) params.set(field, value);
  }
  return params.toString();
}
