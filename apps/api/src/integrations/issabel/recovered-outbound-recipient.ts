import type { TelephonyEventV1 } from '@nora/contracts';
import type { Prisma } from '@nora/database';
import type { IamCallCenterDirectory } from '../../iam/iam-call-center-directory';

/** Recovery-only fallback: unchanged historical provider mapping AND current HR
 * must agree. An unrelated later personnel edit must not erase proven origin.
 * Never used to infer an incoming answer or to issue a historical popup. */
export async function recoveredOutboundAccounts(
  event: TelephonyEventV1,
  branchId: string,
  tx: Prisma.TransactionClient,
  directory: IamCallCenterDirectory,
) {
  if (
    event.direction !== 'OUT' ||
    event.kind !== 'ANSWERED' ||
    !event.extension
  )
    return [];
  const mapping = await tx.integrationTelephonyMapping.findFirst({
    where: {
      connectionId: event.connectionId,
      extension: event.extension,
      active: true,
      version: { gt: 0 },
      updatedAt: { lte: new Date(event.occurredAt) },
    },
  });
  if (!mapping) return [];
  const current = await directory.answeredAccounts(
    branchId,
    event.extension,
    new Date().toISOString(),
    tx,
  );
  if (current.length !== 1 || current[0] !== mapping.userId) return [];
  return (await directory.eligibleMapping(
    branchId,
    mapping.userId,
    mapping.teamId,
    tx,
  ))
    ? [mapping.userId]
    : [];
}
