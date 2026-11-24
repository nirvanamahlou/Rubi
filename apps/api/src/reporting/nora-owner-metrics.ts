import { ForbiddenException } from '@nestjs/common';
import type { ModuleRef } from '@nestjs/core';
import type { AuthenticatedActor } from '@nora/contracts';
import { AccountingService } from '../finance/accounting/accounting.service';
import { MarketingRecordsService } from '../marketing/marketing-records.service';
import { ProcurementService } from '../procurement/procurement.service';
import { dashboardCalendarRangeStart } from './reporting-dashboard-calendar';

export const noraInventoryMetrics = new Set([
  'accounting-books',
  'active-marketing-campaigns',
  'procurement-request-count',
]);
export const noraAccountingMetrics = new Set([
  'accounting-books',
  'posted-accounting-journals',
]);
export const noraOwnerMetrics = new Set([
  ...noraInventoryMetrics,
  ...noraAccountingMetrics,
]);

const civilDate = new Intl.DateTimeFormat('en-CA', {
  timeZone: 'Asia/Tehran',
  year: 'numeric',
  month: '2-digit',
  day: '2-digit',
});

export async function readNoraOwnerMetric(
  modules: ModuleRef,
  id: string,
  range: 'today' | 'week' | 'month' | 'current',
  actor: AuthenticatedActor,
  now: Date,
) {
  if (id === 'active-marketing-campaigns') {
    const { total } = await modules
      .get(MarketingRecordsService, { strict: false })
      .listCampaignPage({ page: 1, pageSize: 1, status: 'ACTIVE' }, actor);
    return { total, companyScoped: false };
  }
  if (id === 'procurement-request-count') {
    const { counts } = await modules
      .get(ProcurementService, { strict: false })
      .report({ dimension: 'currency', page: 1 }, actor);
    return {
      total: counts.reduce((sum, row) => sum + row.count, 0),
      companyScoped: false,
    };
  }
  const service = modules.get(AccountingService, { strict: false });
  const inventory = await service.books(actor);
  const companyScoped = 'isAggregate' in inventory && !inventory.isAggregate;
  if (id === 'accounting-books')
    return { total: inventory.books.length, companyScoped };
  if (range === 'current' || inventory.books.length > 12)
    return { total: null, companyScoped };
  const query = {
    from: civilDate.format(dashboardCalendarRangeStart(now, range)),
    to: civilDate.format(now),
    status: 'POSTED',
    page: '1',
  };
  let total = 0;
  for (const book of inventory.books) {
    const result = await service.journals(book.id, query, actor);
    if (!Number.isSafeInteger(result.total) || result.total < 0)
      return { total: null, companyScoped };
    total += result.total;
  }
  const latest = await service.books(actor);
  if (
    ('selection' in inventory ? inventory.selection : undefined) !==
      ('selection' in latest ? latest.selection : undefined) ||
    JSON.stringify(inventory.books.map(({ id: key }) => key).sort()) !==
      JSON.stringify(latest.books.map(({ id: key }) => key).sort())
  )
    throw new ForbiddenException();
  return { total, companyScoped };
}
