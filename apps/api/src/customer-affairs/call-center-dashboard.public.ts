import { dashboardDimensionKey } from '../common/dashboard-dimensions';
import type { AuthenticatedActor } from '@nora/contracts';
import { ForbiddenException, Inject, Injectable } from '@nestjs/common';
import type {
  DashboardSourceQuery,
  DashboardSourceResult,
} from '../common/dashboard-source';
import { unsupportedDashboardFilters } from '../common/dashboard-source';
import { CallCenterReadService } from './call-center-read.service';
import { CallCenterSearchDto } from './call-center-search.dto';

/** Reuses the full Call Center report authorization and native answer attribution. */
@Injectable()
export class CallCenterDashboardSource {
  constructor(
    @Inject(CallCenterReadService)
    private readonly reports: CallCenterReadService,
  ) {}
  async read(query: DashboardSourceQuery): Promise<DashboardSourceResult> {
    const source = 'customer-affairs.dashboard.attributed-calls.v1';
    if (
      !query.actor.permissions.includes('customer_affairs.call_center.read') ||
      !query.actor.branchIds.length
    )
      return { source, state: 'forbidden', metrics: {} };
    if (
      unsupportedDashboardFilters(query, ['branch']) ||
      query.dateBasis !== 'effective'
    )
      return {
        source,
        state: 'unsupported',
        reason: 'CALL_FILTER_OR_DATE_UNSUPPORTED',
        metrics: {},
      };
    const branches = query.branchId
      ? query.actor.branchIds.filter((b) => b === query.branchId)
      : [...query.actor.branchIds];
    const actor = {
      userId: query.actor.userId,
      sessionId: '',
      permissions: [
        ...query.actor.permissions,
      ] as AuthenticatedActor['permissions'],
      branchIds: [...query.actor.branchIds],
    };
    let reports: Awaited<ReturnType<CallCenterReadService['report']>>[];
    try {
      reports = await Promise.all(
        branches.map((branch) =>
          this.reports.report(
            actor,
            branch,
            Object.assign(new CallCenterSearchDto(), {
              from: query.from.toISOString(),
              to: query.to.toISOString(),
            }),
          ),
        ),
      );
    } catch (error) {
      if (error instanceof ForbiddenException)
        return { source, state: 'forbidden', metrics: {} };
      throw error;
    }
    // The native expert attribution covers telephony calls. Never silently omit manual calls.
    if (
      reports.some((r) =>
        r.data.groups.some((g) => g.origin !== 'TELEPHONY' && g.count > 0),
      )
    )
      return {
        source,
        state: 'unsupported',
        reason: 'MANUAL_CALL_ATTRIBUTION_REQUIRED',
        metrics: {},
      };
    const at = new Date(query.to.getTime() - 1);
    const rows = reports.flatMap((r) => r.data.expertActivity.rows);
    return {
      source,
      state: 'ready',
      metrics: {
        'employee-call-count': {
          kind: 'count',
          snapshot: true,
          aggregation:
            'تماس تلفنی یکتا و کارشناس دارای انتساب معتبر در محدوده گزارش مجاز؛ تماس مشترک برای هر کارشناس مشارکت‌کننده شمرده می‌شود. بدون خط روند ساختگی.',
          observations: rows.map((r) => ({
            at,
            value: String(r.total),
            dimensions: { agent: r.name },
            dimensionKeys: { agent: dashboardDimensionKey('agent', r.id) },
          })),
        },
        'employee-connected-call-count': {
          kind: 'count',
          snapshot: true,
          aggregation:
            'تماس ورودی پاسخ‌داده‌شده و خروجی متصل‌شده با انتساب معتبر.',
          observations: rows.map((r) => ({
            at,
            value: String(r.inboundAnswered + r.outboundConnected),
            dimensions: { agent: r.name },
            dimensionKeys: { agent: dashboardDimensionKey('agent', r.id) },
          })),
        },
      },
    };
  }
}
