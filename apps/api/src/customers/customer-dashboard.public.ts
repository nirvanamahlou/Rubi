import { Inject, Injectable, Module } from '@nestjs/common';
import type {
  DashboardSourceQuery,
  DashboardSourceResult,
} from '../common/dashboard-source';
import { unsupportedDashboardFilters } from '../common/dashboard-source';
import { DatabaseService } from '../database/database.service';

/** Customers-owned registration count; passengers alone and merged identities do not count. */
@Injectable()
export class CustomerDashboardSource {
  constructor(@Inject(DatabaseService) private readonly db: DatabaseService) {}
  async read(query: DashboardSourceQuery): Promise<DashboardSourceResult> {
    const source = 'customers.dashboard.registrations.v1';
    if (
      !query.actor.permissions.includes('customers.read') ||
      !query.actor.branchIds.length
    )
      return { source, state: 'forbidden', metrics: {} };
    if (unsupportedDashboardFilters(query, ['branch']))
      return {
        source,
        state: 'unsupported',
        reason: 'CUSTOMER_FILTER_UNSUPPORTED',
        metrics: {},
      };
    const branches = query.branchId
      ? query.actor.branchIds.filter((id) => id === query.branchId)
      : [...query.actor.branchIds];
    const rows = await this.db.client.customer.findMany({
      where: {
        ownerBranchId: { in: branches },
        isCustomer: true,
        mergedIntoId: null,
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
        'new-customers': {
          kind: 'count',
          aggregation:
            'count distinct registered Customer identities by CREATED_AT; exclude merged identities and passenger-only records',
          observations: rows.map((row) => ({ at: row.createdAt, value: '1' })),
        },
      },
    };
  }
}

@Module({
  providers: [CustomerDashboardSource],
  exports: [CustomerDashboardSource],
})
export class CustomerDashboardPublicModule {}
