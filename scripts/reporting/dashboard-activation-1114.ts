/** Aggregate-only candidate probe. Run in an isolated process; never bootstrap the app. */
import { createDatabaseClient, type DatabaseClient } from '@nora/database';
import { readHrDashboard } from '../../apps/api/src/hr/hr-dashboard.public';
import { readSupportDashboard } from '../../apps/api/src/customer-affairs/support-dashboard.public';
import { SalesDashboardSource } from '../../apps/api/src/sales/sales-dashboard.public';
import type { DatabaseService } from '../../apps/api/src/database/database.service';
import { renderDashboardBreakdown } from '../../apps/api/src/reporting/reporting-dashboard-breakdowns';

async function main() {
  const db = createDatabaseClient();
  try {
    const receipt = await db.$transaction(
      async (tx) => {
        await tx.$executeRawUnsafe('SET TRANSACTION READ ONLY');
        await tx.$executeRawUnsafe("SET LOCAL statement_timeout='15s'");
        const branches = await tx.$queryRaw<{ id: string }[]>`
        SELECT id FROM branches WHERE "isActive"=true
      `;
        // Explicit infrastructure probe, never a logged-in user or authorization grant.
        const query = {
          actor: {
            userId: '00000000-0000-4000-8000-000000000000',
            branchIds: branches.map((b) => b.id),
            permissions: [
              'hr.read',
              'customer_affairs.ticket.read',
              'sales.contracts.read.all',
            ],
          },
          from: new Date('2026-01-01T00:00:00Z'),
          to: new Date(),
          filters: {},
          dateBasis: 'effective',
        };
        const sources = [];
        const sales = (client: DatabaseClient, q: typeof query) =>
          new SalesDashboardSource({ client } as DatabaseService).read(q);
        for (const [read, visualId] of [
          [readHrDashboard, 'workforce-performance'],
          [readSupportDashboard, 'support-time-trend'],
          [sales, 'customer-destination-distribution'],
        ] as const) {
          const source = await read(tx as unknown as DatabaseClient, query);
          const rendered = renderDashboardBreakdown(visualId, source.metrics);
          const denied = await read({} as DatabaseClient, {
            ...query,
            actor: { ...query.actor, permissions: [] },
          });
          const unsupported = await read({} as DatabaseClient, {
            ...query,
            filters: { provider: 'probe-unsupported' },
          });
          if (
            denied.state !== 'forbidden' ||
            unsupported.state !== 'unsupported'
          )
            throw Error('SOURCE_GUARD_FAILED');
          sources.push({
            source: source.source,
            state: source.state,
            visualId,
            metrics: Object.fromEntries(
              Object.entries(source.metrics).map(([id, m]) => [
                id,
                {
                  observations: m.observations.length,
                  unit: m.unit ?? 'count',
                },
              ]),
            ),
            unavailableMetrics: source.unavailableMetrics,
            chart: rendered.visual
              ? {
                  points: rendered.visual.labels.length,
                  unit: rendered.visual.unit,
                  missingMetrics: rendered.visual.missingMetrics,
                  finite: rendered.visual.values.every(Number.isFinite),
                }
              : { reason: rendered.reason },
            permissionGuard: true,
            unsupportedFilterGuard: true,
          });
        }
        return {
          generatedAtUtc: new Date().toISOString(),
          databaseWrites: false,
          applicationDeployment: false,
          businessRowsExported: false,
          sources,
        };
      },
      { isolationLevel: 'RepeatableRead', timeout: 90000 },
    );
    process.stdout.write(JSON.stringify(receipt));
  } finally {
    await db.$disconnect();
  }
}
void main().catch(() => {
  process.stderr.write('Read-only Dashboard activation probe failed');
  process.exitCode = 1;
});
