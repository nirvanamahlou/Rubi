import type { CustomerAffairsDashboard } from '@nora/contracts';

import { customerAffairsApi } from '../api/customer-affairs-client';

type OverviewAccess = Pick<
  CustomerAffairsDashboard['access'],
  'leadsRead' | 'ticketsRead'
>;
type OverviewClient = Pick<typeof customerAffairsApi, 'leads' | 'tickets'>;

/** Each panel has its own server scoped query; recent requests include every stage. */
export async function loadCustomerAffairsOverview(
  access: OverviewAccess,
  client: OverviewClient = customerAffairsApi,
) {
  const [handoffs, recent, tickets, overdue] = await Promise.all([
    access.leadsRead
      ? client.leads('', { stage: 'HANDOFF_PROPOSED', pageSize: 5 })
      : Promise.resolve({ data: [] }),
    access.leadsRead
      ? client.leads('', { pageSize: 5 })
      : Promise.resolve({ data: [] }),
    access.ticketsRead
      ? client.tickets('', 'ALL', { pageSize: 5 })
      : Promise.resolve({ data: [] }),
    access.leadsRead
      ? client.leads('', { overdueOnly: true, pageSize: 5 })
      : Promise.resolve({ data: [] }),
  ]);

  return {
    handoffs: handoffs.data,
    recent: recent.data,
    tickets: tickets.data,
    overdue: overdue.data,
  };
}
