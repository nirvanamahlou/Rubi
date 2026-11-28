import { Prisma } from '@nora/database';
import type { TravelWorkflowStateV1 } from '@nora/contracts';

type IssuedStay = NonNullable<
  TravelWorkflowStateV1['issuedHotelStays']
>[number];
export type VoucherEvidence = {
  contractId: string;
  intakeId: string;
  branchId: string;
  hasRevision: boolean;
  supplierStatus: string | null;
  issued: string | null;
  coverage: unknown;
};

export function stayVoucherStatus(stay: IssuedStay, evidence: VoucherEvidence) {
  if (!evidence.hasRevision || evidence.issued === 'false') return 'missing';
  if (evidence.issued !== 'true' || !Array.isArray(evidence.coverage))
    return 'unknown';
  const covered = evidence.coverage;
  if (
    !covered.every(
      (s) =>
        s &&
        typeof s.key === 'string' &&
        typeof s.hotelId === 'string' &&
        typeof s.checkInDate === 'string' &&
        typeof s.checkOutDate === 'string',
    )
  )
    return 'unknown';
  return covered.some(
    (s) =>
      s.key === stay.key &&
      s.hotelId === stay.hotelId &&
      s.checkInDate === stay.checkInDate &&
      s.checkOutDate === stay.checkOutDate,
  )
    ? 'issued'
    : 'missing';
}

/** Project only issuance evidence from the latest intake and revision, including REOPEN/CANCEL. */
export async function readVoucherCoverage(
  tx: Pick<Prisma.TransactionClient, '$queryRaw'>,
  authorizedIds: readonly string[],
): Promise<VoucherEvidence[]> {
  if (!authorizedIds.length) return [];
  return tx.$queryRaw<VoucherEvidence[]>(Prisma.sql`
    WITH latest AS (
      SELECT DISTINCT ON ("contractId") "contractId", id, "branchId" FROM "ReservationIntake"
      WHERE "contractId" IN (${Prisma.join(authorizedIds.map((id) => Prisma.sql`${id}::uuid`))})
      ORDER BY "contractId", "contractVersion" DESC
    )
    SELECT i."contractId", i.id AS "intakeId", i."branchId", r.id IS NOT NULL AS "hasRevision",
      r.state->>'supplierStatus' AS "supplierStatus", r.state->>'voucherIssued' AS issued,
      r.state->'issuedHotelStays' AS coverage
    FROM latest i LEFT JOIN LATERAL (
      SELECT id, state FROM "ReservationWorkflowRevision" WHERE "intakeId"=i.id
      ORDER BY version DESC LIMIT 1
    ) r ON true
  `);
}
