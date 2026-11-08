import type { DatabaseClient } from '@nora/database';
import type { DashboardSourceQuery } from '../common/dashboard-source';
import { unsupportedDashboardFilters } from '../common/dashboard-source';
import type {
  CustomerBehaviorSignal,
  CustomerBehaviorSignals,
} from '../common/customer-behavior-signals';
import { reportingCityLabels } from '../master-data/reporting-cities.public';

/** Only typed service kinds and existing destination references; never narrative inference. */
export async function readLeadInterestSignals(
  client: DatabaseClient,
  q: DashboardSourceQuery,
): Promise<CustomerBehaviorSignals> {
  if (
    !q.actor.permissions.includes('customer_affairs.lead.read') ||
    !q.actor.branchIds.length
  )
    return { state: 'forbidden' };
  if (unsupportedDashboardFilters(q, ['branch']))
    return { state: 'unsupported', reason: 'LEAD_FILTER_UNSUPPORTED' };
  const rows = await client.customerAffairsLead.findMany({
    where: {
      branchId: {
        in: q.branchId
          ? q.actor.branchIds.filter((b) => b === q.branchId)
          : [...q.actor.branchIds],
      },
      customerId: { not: null },
      createdAt: { gte: q.from, lt: q.to },
    },
    select: {
      customerId: true,
      createdAt: true,
      requestedServices: true,
      destinationReference: true,
    },
    take: 10001,
  });
  if (rows.length > 10000)
    return { state: 'unavailable', reason: 'SOURCE_ROW_LIMIT' };
  const cities = await reportingCityLabels(
    client,
    rows
      .flatMap((r) => (r.destinationReference ? [r.destinationReference] : []))
      .filter((id) => /^[0-9a-f-]{36}$/i.test(id)),
  );
  const kinds = new Set([
    'FLIGHT',
    'HOTEL',
    'TOUR',
    'TRANSFER',
    'VISA',
    'INSURANCE',
    'BUS',
    'TRAIN',
    'CIP',
    'OTHER',
  ]);
  const signals: CustomerBehaviorSignal[] = [];
  for (const r of rows) {
    if (!r.customerId) continue;
    if (r.destinationReference && cities.has(r.destinationReference))
      signals.push({
        customerId: r.customerId,
        at: r.createdAt,
        destinationId: r.destinationReference,
      });
    if (Array.isArray(r.requestedServices))
      for (const v of r.requestedServices) {
        const kind =
          typeof v === 'string'
            ? v
            : v &&
                typeof v === 'object' &&
                !Array.isArray(v) &&
                typeof v.kind === 'string'
              ? v.kind
              : '';
        if (kinds.has(kind))
          signals.push({
            customerId: r.customerId,
            at: r.createdAt,
            service: kind,
          });
      }
  }
  return { state: 'ready', signals };
}
