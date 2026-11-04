import type { DatabaseClient } from '@nora/database';

/** Minimal lifecycle composition for already Sales-authorized contracts.
 * Only the latest intake and its latest workflow count; REOPEN supersedes CANCEL.
 */
export async function readReservationReportingCancellations(
  client: DatabaseClient,
  authorizedContractIds: readonly string[],
): Promise<Map<string, Date>> {
  if (!authorizedContractIds.length) return new Map();
  const rows = await client.reservationIntake.findMany({
    where: { contractId: { in: [...authorizedContractIds] } },
    distinct: ['contractId'],
    orderBy: [{ contractId: 'asc' }, { contractVersion: 'desc' }],
    select: {
      contractId: true,
      workflowRevisions: {
        orderBy: { version: 'desc' },
        take: 1,
        select: { state: true, createdAt: true },
      },
    },
  });
  return new Map(
    rows.flatMap((row) => {
      const latest = row.workflowRevisions[0];
      const state = latest?.state;
      return state &&
        typeof state === 'object' &&
        !Array.isArray(state) &&
        state.supplierStatus === 'CANCELLED'
        ? [[row.contractId, latest!.createdAt] as const]
        : [];
    }),
  );
}
