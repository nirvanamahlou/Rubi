import {
  BadRequestException,
  Controller,
  ForbiddenException,
  Get,
  Header,
  Inject,
  Query,
  Req,
  UseGuards,
} from '@nestjs/common';
import { ModuleRef } from '@nestjs/core';
import type { IamPermissionCode } from '@nora/contracts';
import { DatabaseService } from '../database/database.service';
import { AuthGuard } from '../iam/auth.guard';
import { IamService } from '../iam/iam.service';
import type { AuthenticatedRequest } from '../iam/iam.types';
import {
  hasNoraGlobalBusinessRead,
  noraBusinessReadBranchIds,
} from '../iam/nora-business-read';
import { readReservationReporting } from '../reservations/reservation-reporting.public';
import { dashboardCalendarRangeStart } from './reporting-dashboard-calendar';
import { ReportingService } from './reporting.service';
import {
  noraAccountingMetrics,
  noraInventoryMetrics,
  noraOwnerMetrics,
  readNoraOwnerMetric,
} from './nora-owner-metrics';

const metrics = new Set([
  'employee-overtime',
  'employee-workdays',
  'issued-documents',
  'document-count',
  'registered-customers',
  'support-ticket-count',
  'new-leads',
  'collected',
  'refunded',
  'registered-service-purchases',
  'employee-call-count',
  'employee-connected-call-count',
  'active-offers',
  ...noraOwnerMetrics,
]);
const businessReadPermissions: IamPermissionCode[] = [
  'hr.read',
  'reservations.read',
  'documents.list',
  'customers.read',
  'customer_affairs.lead.read',
  'customer_affairs.ticket.read',
  'customer_affairs.call_center.read',
  'ticket_catalog.read',
  'sales.contracts.read.all',
  'sales.payments.read',
  'finance.read',
  'finance.journal.read',
  'legal-entity.aggregate.read',
  'marketing.read',
  'procurement.read.all',
];

@Controller('reports/nora')
@UseGuards(AuthGuard)
export class NoraMetricsController {
  constructor(
    @Inject(ReportingService) private readonly reporting: ReportingService,
    @Inject(DatabaseService) private readonly database: DatabaseService,
    @Inject(IamService) private readonly iam: IamService,
    @Inject(ModuleRef) private readonly modules: ModuleRef,
  ) {}

  @Get('metric')
  @Header('Cache-Control', 'private, no-store')
  async metric(
    @Query('id') id: string,
    @Query('range') range: 'today' | 'week' | 'month' | 'current',
    @Query('aggregate') aggregate: string,
    @Req() request: AuthenticatedRequest,
  ) {
    if (
      !metrics.has(id) ||
      (noraInventoryMetrics.has(id)
        ? range !== 'current'
        : range !== 'today' && range !== 'week' && range !== 'month')
    )
      throw new BadRequestException('NORA_METRIC_UNSUPPORTED');
    const { actor } = request;
    const database = this.database.client;
    const globalRead = await hasNoraGlobalBusinessRead(database, actor);
    if (!globalRead && aggregate !== 'true' && !noraAccountingMetrics.has(id))
      return {
        version: 1,
        id,
        range,
        scope: 'aggregate-required',
        value: null,
      };
    const reportingActor = globalRead
      ? {
          ...actor,
          permissions: [
            ...new Set([...actor.permissions, ...businessReadPermissions]),
          ],
          branchIds: await noraBusinessReadBranchIds(database),
        }
      : actor;
    const now = new Date();
    let value: string | undefined;
    let denied = false;
    let companyScoped = false;
    if (noraOwnerMetrics.has(id)) {
      const result = await readNoraOwnerMetric(
        this.modules,
        id,
        range,
        reportingActor,
        now,
      );
      companyScoped = result.companyScoped;
      if (
        result.total !== null &&
        Number.isSafeInteger(result.total) &&
        result.total >= 0
      )
        value = result.total.toLocaleString('fa-IR');
    } else if (id === 'registered-service-purchases') {
      if (range === 'current')
        throw new BadRequestException('NORA_METRIC_UNSUPPORTED');
      if (!globalRead && !actor.permissions.includes('reservations.read'))
        throw new ForbiddenException();
      const purchases = await readReservationReporting(
        database,
        'purchase_by_supplier',
        reportingActor,
        {
          filters: {
            fromUtc: dashboardCalendarRangeStart(now, range).toISOString(),
            toUtc: now.toISOString(),
          },
        },
      );
      const counts = purchases.rows.map((row) => row.values.recordCount);
      if (
        counts.every(
          (n): n is number =>
            typeof n === 'number' && Number.isSafeInteger(n) && n >= 0,
        )
      ) {
        const total = counts.reduce((sum, n) => sum + n, 0);
        if (Number.isSafeInteger(total)) value = total.toLocaleString('fa-IR');
      }
    } else {
      const result = await this.reporting.dashboardProjection(
        { range, kpiIds: id, visualIds: '', dateBasis: 'effective' },
        globalRead
          ? {
              ...reportingActor,
              permissions: [...reportingActor.permissions, 'reporting.read'],
            }
          : reportingActor,
      );
      denied = result.unavailableMetrics?.[id] === 'SOURCE_PERMISSION_REQUIRED';
      if (
        result.state === 'ready' &&
        result.metadata?.reportVersion === 'reporting.dashboard.native.v1' &&
        !result.unavailableMetrics?.[id]
      )
        value = result.metrics[id]?.value;
    }
    const current = await this.iam.authenticateSessionReferenceV1(
      actor.userId,
      actor.sessionId,
    );
    if (
      JSON.stringify([...actor.permissions].sort()) !==
        JSON.stringify([...current.permissions].sort()) ||
      JSON.stringify([...actor.branchIds].sort()) !==
        JSON.stringify([...current.branchIds].sort()) ||
      globalRead !== (await hasNoraGlobalBusinessRead(database, current))
    )
      throw new ForbiddenException();
    if (denied) throw new ForbiddenException();
    return {
      version: 1,
      id,
      range,
      scope: companyScoped
        ? 'selected-company'
        : globalRead
          ? 'organization'
          : 'authorized',
      value: value ?? null,
    };
  }
}
