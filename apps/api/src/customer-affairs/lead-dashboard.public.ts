import { Inject, Injectable, Module } from '@nestjs/common';
import type {
  DashboardSourceQuery,
  DashboardSourceResult,
} from '../common/dashboard-source';
import { unsupportedDashboardFilters } from '../common/dashboard-source';
import { DatabaseService } from '../database/database.service';

@Injectable()
export class LeadDashboardSource {
  constructor(@Inject(DatabaseService) private readonly db: DatabaseService) {}
  async read(query: DashboardSourceQuery): Promise<DashboardSourceResult> {
    const source = 'customer-affairs.dashboard.leads.v1';
    if (
      !query.actor.permissions.includes('customer_affairs.lead.read') ||
      !query.actor.branchIds.length
    )
      return { source, state: 'forbidden', metrics: {} };
    if (unsupportedDashboardFilters(query, ['branch']))
      return {
        source,
        state: 'unsupported',
        reason: 'LEAD_FILTER_UNSUPPORTED',
        metrics: {},
      };
    const branches = query.branchId
      ? query.actor.branchIds.filter((id) => id === query.branchId)
      : [...query.actor.branchIds];
    const rows = await this.db.client.customerAffairsLead.findMany({
      where: {
        branchId: { in: branches },
        createdAt: { gte: query.from, lt: query.to },
      },
      select: { createdAt: true },
      take: 10001,
    });
    if (rows.length > 10000)
      return {
        source,
        state: 'unavailable',
        reason: 'SOURCE_ROW_LIMIT',
        metrics: {},
      };
    return {
      source,
      state: 'ready',
      metrics: {
        'new-leads': {
          kind: 'count',
          aggregation:
            'count distinct actual lead records by CREATED_AT; not inferred from travel orders',
          observations: rows.map((row) => ({ at: row.createdAt, value: '1' })),
        },
      },
    };
  }
}

@Module({ providers: [LeadDashboardSource], exports: [LeadDashboardSource] })
export class LeadDashboardPublicModule {}
