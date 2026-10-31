import type {
  MasterDataResource,
  MasterDataStatus,
  MasterTransportStatus,
} from '@nora/contracts';

export function transportStatusFilters(
  resource: MasterDataResource,
  status: 'all' | MasterDataStatus,
  transportStatus: 'all' | MasterTransportStatus,
) {
  return {
    // Aircraft use the visible three-state filter, not a hidden active-only gate.
    status: resource === 'aircraft-types' ? ('all' as const) : status,
    ...(transportStatus !== 'all' ? { transportStatus } : {}),
  };
}
