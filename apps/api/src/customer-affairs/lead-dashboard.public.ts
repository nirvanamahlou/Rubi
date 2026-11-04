import { Inject, Injectable, Module } from '@nestjs/common';
import type {
  DashboardSourceQuery,
  DashboardSourceResult,
} from '../common/dashboard-source';
import { unsupportedDashboardFilters } from '../common/dashboard-source';
import { DatabaseService } from '../database/database.service';
import {
  SalesDashboardCustomers,
  SalesDashboardCustomersModule,
} from '../sales/sales-dashboard-customers.public';

@Injectable()
export class LeadDashboardSource {
  constructor(
    @Inject(DatabaseService) private readonly db: DatabaseService,
    @Inject(SalesDashboardCustomers)
    private readonly purchases: SalesDashboardCustomers,
  ) {}
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
      select: {
        createdAt: true,
        customerId: true,
        handoffs: {
          where: { status: 'ACCEPTED', salesContractId: { not: null } },
          select: { salesContractId: true },
          take: 101,
        },
      },
      take: 10001,
    });
    if (rows.length > 10000)
      return {
        source,
        state: 'unavailable',
        reason: 'SOURCE_ROW_LIMIT',
        metrics: {},
      };
    if (rows.some((row) => row.handoffs.length > 100))
      return {
        source,
        state: 'unavailable',
        reason: 'SOURCE_ROW_LIMIT',
        metrics: {},
      };
    const conversion = rows.length
      ? await this.purchases.convertedLeadReferencesV1(query, {
          customerIds: [
            ...new Set(
              rows.flatMap((row) => (row.customerId ? [row.customerId] : [])),
            ),
          ],
          contractIds: [
            ...new Set(
              rows.flatMap((row) =>
                row.handoffs.flatMap((h) =>
                  h.salesContractId ? [h.salesContractId] : [],
                ),
              ),
            ),
          ],
        })
      : { state: 'ready' as const, customerIds: [], contractIds: [] };
    if (conversion.state !== 'ready')
      return {
        source,
        state: conversion.state,
        ...('reason' in conversion ? { reason: conversion.reason } : {}),
        metrics: {},
      };
    const customers = new Set(conversion.customerIds),
      contracts = new Set(conversion.contractIds);
    const unconverted = rows.filter(
      (row) =>
        !(row.customerId && customers.has(row.customerId)) &&
        !row.handoffs.some(
          (h) => h.salesContractId && contracts.has(h.salesContractId),
        ),
    );
    return {
      source,
      state: 'ready',
      metrics: {
        'new-leads': {
          kind: 'count',
          aggregation:
            'actual leads created in window without a successful paid purchase before window end; canonical customer or accepted Sales handoff match; scoped Sales confirmation, no phone/name inference',
          observations: unconverted.map((row) => ({
            at: row.createdAt,
            value: '1',
          })),
        },
      },
    };
  }
}

@Module({
  imports: [SalesDashboardCustomersModule],
  providers: [LeadDashboardSource],
  exports: [LeadDashboardSource],
})
export class LeadDashboardPublicModule {}
