import { ForbiddenException } from '@nestjs/common';
import type { DatabaseClient } from '@nora/database';
import { boundedSource, type ReportSourceActor } from '../common/report-source';

/** Minimal current contract eligibility for Reservations; no pricing or customer data. */
export async function readSalesReportingEligibility(
  client: DatabaseClient,
  actor: ReportSourceActor,
): Promise<string[]> {
  const all = actor.permissions.includes('sales.contracts.read.all'),
    branch = actor.permissions.includes('sales.contracts.read.branch'),
    own = actor.permissions.includes('sales.contracts.read.own');
  if (!all && ((!branch && !own) || !actor.branchIds.length))
    throw new ForbiddenException('دسترسی قرارداد مجاز نیست.');
  const rows = boundedSource(
    await client.salesContract.findMany({
      where: {
        status: {
          in: ['CONFIRMED', 'SENT_TO_RESERVATIONS', 'IN_PROGRESS', 'COMPLETED'],
        },
        confirmedAt: { not: null },
        ...(!all
          ? {
              branchId: { in: [...actor.branchIds] },
              ...(!branch ? { ownerUserId: actor.userId } : {}),
            }
          : {}),
      },
      select: { id: true },
      take: 10001,
    }),
  );
  return rows.map((r) => r.id);
}
