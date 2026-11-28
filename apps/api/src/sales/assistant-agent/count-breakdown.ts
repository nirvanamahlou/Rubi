import { randomUUID } from 'node:crypto';
import type { DatabaseClient } from '@nora/database';
import { readReservationReportingCancellations } from '../../reservations/reservation-reporting-cancellations.public';
import type { AgentScope } from './query.service';

/** Fixed native read, never model-authored SQL on the native connection. */
export async function readContractCountBreakdown(
  database: DatabaseClient,
  scope: AgentScope,
  ownership: 'visible' | 'mine' = 'visible',
) {
  return database.$transaction(
    async (tx) => {
      await tx.$executeRaw`SET TRANSACTION READ ONLY`;
      await tx.$executeRaw`SET LOCAL statement_timeout = '5000ms'`;
      const rows = await tx.salesContract.findMany({
        where: {
          hiddenAt: null,
          ...(scope.companyId ? { legalEntityId: scope.companyId } : {}),
          ...(scope.mode !== 'all'
            ? { branchId: { in: [...scope.branchIds] } }
            : {}),
          ...(scope.mode === 'own' || ownership === 'mine'
            ? { ownerUserId: scope.userId }
            : {}),
        },
        select: { id: true, status: true },
        take: 50001,
      });
      if (rows.length > 50000) throw new Error('COUNT_SOURCE_LIMIT');
      const cancelled = await readReservationReportingCancellations(
        tx,
        rows.map((row) => row.id),
      );
      const salesCancelled = rows.filter(
        (row) => row.status === 'CANCELLED',
      ).length;
      const reservationCancelled = rows.filter(
        (row) => row.status !== 'CANCELLED' && cancelled.has(row.id),
      ).length;
      const panelRows = rows.filter(
        (row) => row.status !== 'CANCELLED' && !cancelled.has(row.id),
      );
      const completed = panelRows.filter(
        (row) => row.status === 'COMPLETED',
      ).length;
      return {
        version: 1,
        resultId: randomUUID(),
        observedAt: new Date().toISOString(),
        sources: ['contracts'],
        truncated: false,
        calculation: {
          required: true,
          operations: ['count', 'sum', 'arithmetic'],
        },
        columns: [
          'panel_non_cancelled',
          'sales_cancelled',
          'reservation_cancelled_only',
          'completed_non_cancelled',
          'active_panel',
          'total',
        ],
        rows: [
          {
            panel_non_cancelled: panelRows.length,
            sales_cancelled: salesCancelled,
            reservation_cancelled_only: reservationCancelled,
            completed_non_cancelled: completed,
            active_panel: panelRows.length - completed,
            total: rows.length,
          },
        ],
      };
    },
    { isolationLevel: 'RepeatableRead', timeout: 7000 },
  );
}
