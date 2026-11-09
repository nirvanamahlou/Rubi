import {
  canViewRoute,
  type AuthenticatedActor,
  type CustomerDossierSection,
} from '@nora/contracts';
import type { DatabaseClient } from '@nora/database';
export async function readAffairsCustomerDossier(
  db: DatabaseClient,
  actor: AuthenticatedActor,
  customerId: string,
): Promise<CustomerDossierSection[]> {
  const scope = { customerId, branchId: { in: actor.branchIds } };
  const result: CustomerDossierSection[] = [];
  for (const id of ['requests', 'support'] as const) {
    const permission =
      id === 'requests'
        ? 'customer_affairs.lead.read'
        : 'customer_affairs.ticket.read';
    if (
      !actor.permissions.includes(permission) ||
      !canViewRoute(actor.permissions, '/customer-affairs')
    ) {
      result.push({ id, state: 'forbidden', rows: [], hasMore: false });
      continue;
    }
    if (id === 'requests') {
      const rows = await db.customerAffairsLead.findMany({
        where: scope,
        select: {
          id: true,
          trackingNumber: true,
          stage: true,
          createdAt: true,
        },
        orderBy: [{ createdAt: 'desc' }, { id: 'desc' }],
        take: 51,
      });
      result.push({
        id,
        state: 'ready',
        hasMore: rows.length > 50,
        rows: rows
          .slice(0, 50)
          .map((r) => ({
            id: r.id,
            reference: r.trackingNumber,
            status: r.stage,
            occurredAt: r.createdAt.toISOString(),
          })),
      });
    } else {
      const rows = await db.customerAffairsTicket.findMany({
        where: {
          ...scope,
          NOT: [
            { category: 'CALL_CENTER_REQUEST' },
            { category: { startsWith: 'WORKBENCH_' } },
          ],
        },
        select: {
          id: true,
          trackingNumber: true,
          status: true,
          createdAt: true,
        },
        orderBy: [{ createdAt: 'desc' }, { id: 'desc' }],
        take: 51,
      });
      result.push({
        id,
        state: 'ready',
        hasMore: rows.length > 50,
        rows: rows
          .slice(0, 50)
          .map((r) => ({
            id: r.id,
            reference: r.trackingNumber,
            status: r.status,
            occurredAt: r.createdAt.toISOString(),
          })),
      });
    }
  }
  return result;
}
