import type {
  MasterCollaborationStatus,
  MasterDataListQuery,
  MasterDataListResponse,
  MasterDataRecord,
} from '@rubi/contracts';

interface CollaborationReader {
  list(
    resource: 'suppliers' | 'brokers',
    query: MasterDataListQuery,
  ): Promise<MasterDataListResponse>;
}

export async function loadSupplierCollaborationPage(
  reader: CollaborationReader,
  query: Pick<MasterDataListQuery, 'search' | 'status' | 'page'>,
) {
  const pageSize = 25;
  const filters: MasterDataListQuery = {
    ...query,
    pageSize,
    sortBy: 'name',
    sortDirection: 'asc',
  };
  const [suppliers, brokers] = await Promise.all([
    reader.list('suppliers', filters),
    reader.list('brokers', filters),
  ]);
  return {
    suppliers: suppliers.data,
    brokers: brokers.data,
    total: suppliers.meta.total + brokers.meta.total,
    // Each page reads up to 25 rows from each source, not 25 from their sum.
    pageCount: Math.max(
      1,
      Math.ceil(suppliers.meta.total / pageSize),
      Math.ceil(brokers.meta.total / pageSize),
    ),
  };
}

export function groupSupplierCollaborationRecords(
  suppliers: readonly MasterDataRecord[],
  brokers: readonly MasterDataRecord[],
) {
  const groups: Record<MasterCollaborationStatus, MasterDataRecord[]> = {
    ACTIVE: [],
    UNDER_REVIEW: [],
    PURCHASE_SUSPENDED: [],
    ENDED: [],
  };
  for (const record of [...suppliers, ...brokers]) {
    const status = record.attributes.collaborationStatus;
    if (typeof status === 'string' && Object.hasOwn(groups, status))
      groups[status as MasterCollaborationStatus].push(record);
  }
  return groups;
}
