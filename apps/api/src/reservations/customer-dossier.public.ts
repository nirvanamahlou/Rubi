import {
  canViewRoute,
  type AuthenticatedActor,
  type CustomerDossierSection,
} from '@nora/contracts';
import type { DatabaseClient } from '@nora/database';
export async function readReservationCustomerDossier(
  db: DatabaseClient,
  actor: AuthenticatedActor,
  customerId: string,
  contractIds: readonly string[] | null,
): Promise<CustomerDossierSection[]> {
  const denied = (
    state: 'forbidden' | 'unavailable',
  ): CustomerDossierSection[] =>
    ['tickets', 'vouchers', 'insurance'].map((id) => ({
      id: id as CustomerDossierSection['id'],
      state,
      rows: [],
      hasMore: false,
    }));
  if (
    !contractIds ||
    !actor.permissions.includes('reservations.read') ||
    !canViewRoute(actor.permissions, '/reservations')
  )
    return denied('forbidden');
  if (contractIds.length > 1000) return denied('unavailable');
  const intake = {
    branchId: { in: actor.branchIds },
    contractId: { in: [...contractIds] },
  };
  const tickets = await db.reservationTicketDocument.findMany({
    where: { customerId, intake },
    select: { id: true, number: true, issuedAt: true },
    orderBy: [{ issuedAt: 'desc' }, { id: 'desc' }],
    take: 51,
  });
  const insurance = await db.reservationInsurancePolicy.findMany({
    where: { customerId, intake },
    select: { id: true, policyNumber: true, status: true, createdAt: true },
    orderBy: [{ createdAt: 'desc' }, { id: 'desc' }],
    take: 51,
  });
  // Vouchers are recorded in the latest workflow, not inferred from hotel purchases.
  const intakes = await db.reservationIntake.findMany({
    where: intake,
    select: {
      id: true,
      receivedAt: true,
      workflowRevisions: {
        orderBy: { version: 'desc' },
        take: 1,
        select: { state: true },
      },
    },
    orderBy: [{ receivedAt: 'desc' }, { id: 'desc' }],
    take: 1001,
  });
  const vouchers = intakes.filter((r) => {
    const s = r.workflowRevisions[0]?.state;
    return (
      s !== null &&
      typeof s === 'object' &&
      !Array.isArray(s) &&
      s.voucherIssued === true
    );
  });
  return [
    {
      id: 'tickets',
      state: 'ready',
      hasMore: tickets.length > 50,
      rows: tickets
        .slice(0, 50)
        .map((r) => ({
          id: r.id,
          reference: r.number,
          status: 'ISSUED',
          occurredAt: r.issuedAt.toISOString(),
        })),
    },
    {
      id: 'insurance',
      state: 'ready',
      hasMore: insurance.length > 50,
      rows: insurance
        .slice(0, 50)
        .map((r) => ({
          id: r.id,
          reference: r.policyNumber ?? r.id,
          status: r.status,
          occurredAt: r.createdAt.toISOString(),
        })),
    },
    {
      id: 'vouchers',
      state: intakes.length > 1000 ? 'unavailable' : 'ready',
      hasMore: vouchers.length > 50,
      rows:
        intakes.length > 1000
          ? []
          : vouchers
              .slice(0, 50)
              .map((r) => ({
                id: r.id,
                reference: r.id,
                status: 'ISSUED',
                occurredAt: r.receivedAt.toISOString(),
              })),
    },
  ];
}
