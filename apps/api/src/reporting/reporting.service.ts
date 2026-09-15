import {
  BadRequestException,
  ConflictException,
  ForbiddenException,
  Inject,
  Injectable,
  NotFoundException,
  Optional,
} from '@nestjs/common';
import { ReportingExportService } from './reporting-export.service';
import { REPORTING_CATALOG_V1 } from './reporting.catalog';
import type {
  ReportQueryV1,
  ReportingExportRequestV1,
  TravelReportResultV1,
  DashboardProjectionV1,
} from './reporting.contracts';
import { buildTravelReportResult } from './reporting.projection';
import { ReportingRepository } from './reporting.repository';
import {
  MAX_PREVIEW_PAGE_SIZE,
  validateExportRequest,
  validateReportQuery,
} from './reporting.policy';

export interface ReportingActor {
  userId: string;
  permissions: readonly string[];
  branchIds: readonly string[];
}

const UNRELEASED_REPORT_CODES = new Set([
  'sales_contract_pipeline', 'agency_contract_risk', 'ticket_capacity',
  'supplier_payment_queue', 'reservation_delivery_readiness', 'lead_pipeline',
  'customer_satisfaction', 'customer_consent_coverage', 'document_compliance',
  'hr_record_expiry', 'workbench_due_actions', 'hotel_rate_comparison',
  'future_travel_commitments', 'customer_payment_aging', 'reservation_cycle_time',
  'manifest_finance_exclusions', 'customer_portfolio_growth',
]);

@Injectable()
export class ReportingService {
  constructor(
    @Optional() @Inject(ReportingRepository) private readonly repository?: ReportingRepository,
    @Optional() @Inject(ReportingExportService) private readonly exportFiles?: ReportingExportService,
  ) {}

  private hasSalesRead(actor: ReportingActor): boolean {
    return [
      'sales.contracts.read.all',
      'sales.contracts.read.branch',
      'sales.contracts.read.own',
    ].some((permission) => actor.permissions.includes(permission));
  }

  private canReadReport(actor: ReportingActor, permission: string): boolean {
    return (
      actor.permissions.includes(permission) ||
      (permission === 'reporting.sales.read' && this.hasSalesRead(actor))
    );
  }

  private require(actor: ReportingActor, permission: string): void {
    if (!this.canReadReport(actor, permission))
      throw new ForbiddenException('دسترسی گزارش مجاز نیست.');
  }

  private requireShare(actor: ReportingActor): void {
    if (
      !actor.permissions.includes('reporting.share') &&
      !actor.permissions.includes('reporting.manage')
    )
      throw new ForbiddenException('مجوز اشتراک‌گذاری گزارش وجود ندارد.');
  }

  catalog(actor: ReportingActor) {
    if (
      !actor.permissions.includes('reporting.read') &&
      !this.hasSalesRead(actor)
    )
      throw new ForbiddenException('دسترسی گزارش مجاز نیست.');
    return REPORTING_CATALOG_V1.filter((report) =>
      this.canReadReport(actor, report.permission),
    );
  }

  metadata(code: string, actor: ReportingActor) {
    const report = REPORTING_CATALOG_V1.find((item) => item.code === code) ??
      (UNRELEASED_REPORT_CODES.has(code)
        ? { code, title: `گزارش عملیاتی ${code}`, grain: 'ORDER_ITEM_CURRENCY' as const,
            permission: 'reporting.read', producerStatus: 'PENDING_CONNECTION' as const,
            approvedView: `reporting_${code}_facts_v1`, outputs: ['XLSX', 'PDF', 'CSV', 'API'] as const, version: 1 }
        : undefined);
    if (!report) throw new NotFoundException('گزارش پیدا نشد.');
    if (
      !actor.permissions.includes('reporting.read') &&
      !(
        report.permission === 'reporting.sales.read' && this.hasSalesRead(actor)
      )
    )
      throw new ForbiddenException('دسترسی گزارش مجاز نیست.');
    this.require(actor, report.permission);
    return report;
  }

  async query(
    code: string,
    input: ReportQueryV1,
    actor: ReportingActor,
  ): Promise<TravelReportResultV1> {
    return this.preview(code, input, actor);
  }

  async preview(
    code: string,
    input: ReportQueryV1,
    actor: ReportingActor,
  ): Promise<TravelReportResultV1> {
    const report = this.metadata(code, actor);
    if (report.producerStatus === 'READY') {
      const serverBranchScope = actor.permissions.includes('sales.contracts.read.all') || actor.permissions.includes('reporting.read')
        ? [] : actor.branchIds;
      const query = validateReportQuery({ ...input, branchIds: serverBranchScope }, MAX_PREVIEW_PAGE_SIZE);
      if (!this.repository) throw new ConflictException('Persistence گزارش در دسترس نیست.');
      const facts = await this.repository.facts(query, serverBranchScope);
      return buildTravelReportResult({ code, query, facts, now: new Date() });
    }
    throw new ConflictException(`Approved View ${report.approvedView} هنوز توسط مالک دامنه منتشر نشده است.`);
  }

  export(input: ReportingExportRequestV1, actor: ReportingActor): never {
    const report = this.metadata(input.reportCode, actor);
    this.require(actor, 'reporting.export');
    validateExportRequest(input, actor.permissions);
    throw new ConflictException(
      `Export برای ${report.approvedView} تا اتصال Producer، Worker و Documents فعال نیست.`,
    );
  }

  savedReports(actor: ReportingActor) {
    this.require(actor, 'reporting.read');
    if (!this.repository) throw new ConflictException('Persistence گزارش در دسترس نیست.');
    return this.repository.listSaved(actor.userId);
  }

  workspaceCounts(actor: ReportingActor) {
    this.require(actor, 'reporting.read');
    if (!this.repository) throw new ConflictException('Persistence گزارش در دسترس نیست.');
    return this.repository.workspaceCounts(actor.userId);
  }

  async dashboardProjection(
    input: Record<string, string | undefined>,
    actor: ReportingActor,
  ): Promise<DashboardProjectionV1> {
    this.require(actor, 'reporting.read');
    if (!this.repository) throw new ConflictException('Persistence داشبورد در دسترس نیست.');
    const now = new Date();
    const rangeDays: Record<string, number> = { today: 1, week: 7, month: 31, quarter: 92, year: 366 };
    const from = input.from || (input.range && input.range !== 'custom'
      ? new Date(now.getTime() - (rangeDays[input.range] ?? 31) * 86_400_000).toISOString()
      : undefined);
    const filters: Record<string, string> = {};
    const boundary = (value: string, endOfDay: boolean) => {
      const dateOnly = /^\d{4}-\d{2}-\d{2}$/.test(value);
      const parsed = new Date(dateOnly ? `${value}T${endOfDay ? '23:59:59.999' : '00:00:00.000'}Z` : value);
      if (!Number.isFinite(parsed.getTime())) throw new BadRequestException('تاریخ فیلتر داشبورد معتبر نیست.');
      return parsed.toISOString();
    };
    if (from) filters.fromUtc = boundary(from, false);
    if (input.to) filters.toUtc = boundary(input.to, true);
    if (filters.fromUtc && filters.toUtc && filters.fromUtc > filters.toUtc)
      throw new BadRequestException('تاریخ شروع باید قبل از تاریخ پایان باشد.');
    const aliases: Record<string, string> = {
      salesChannel: 'salesChannel', branch: 'branch', agent: 'expert', service: 'serviceType',
      agency: 'agency', provider: 'provider', currency: 'currencyCode', status: 'status',
    };
    for (const [source, target] of Object.entries(aliases)) if (input[source]) filters[target] = input[source]!;
    const serverBranchScope = actor.permissions.includes('reporting.manage') || actor.permissions.includes('sales.contracts.read.all') ? [] : actor.branchIds;
    const legalEntityId = input.legalEntity === 'NIYAYESH_SEIR_SAHAR' ? 'NIYAYESH'
      : input.legalEntity === 'ALL' || !input.legalEntity ? undefined : input.legalEntity;
    const facts = await this.repository.facts({ filters, ...(legalEntityId ? { legalEntityId } : {}), page: 1, pageSize: 1000, timezone: 'Asia/Tehran' }, serverBranchScope);
    if (!facts.length) return { state: 'empty', message: 'برای فیلتر انتخاب‌شده دادهٔ تأییدشده‌ای وجود ندارد.', metadata: null, metrics: {}, visuals: {} };
    const sum = (rows: typeof facts, pick: (fact: (typeof facts)[number]) => number) => rows.reduce((total, fact) => total + pick(fact), 0);
    const metricIds = (input.kpiIds ?? '').split(',').filter(Boolean);
    const countMetrics: Record<string, (rows: typeof facts) => number> = {
      'cancelled-reservations': (rows) => rows.filter((fact) => fact.reservationStatus === 'CANCELLED').length,
      'issue-success-rate': (rows) => rows.length ? Math.round(100 * rows.filter((fact) => fact.issueStatus === 'ISSUED').length / rows.length) : 0,
      'customer-destination-demand': (rows) => rows.filter((fact) => Boolean(fact.destinationCity)).length,
    };
    const amountMetrics: Record<string, (rows: typeof facts) => number> = {
      'gross-sales': (rows) => sum(rows, (fact) => Number(fact.salesAmount)),
      'net-sales': (rows) => sum(rows, (fact) => Number(fact.salesAmount) - Number(fact.refundAmount)),
      collected: (rows) => sum(rows.filter((fact) => fact.paymentStatus === 'SETTLED'), (fact) => Number(fact.settledAmount)),
      refunded: (rows) => sum(rows, (fact) => Number(fact.refundAmount)),
      'gross-profit': (rows) => sum(rows, (fact) => Number(fact.salesAmount) - Number(fact.purchaseAmount) + Number(fact.commissionAmount)),
      'supplier-spend': (rows) => sum(rows, (fact) => Number(fact.purchaseAmount)),
      'agency-sales': (rows) => sum(rows.filter((fact) => Boolean(fact.agencyName)), (fact) => Number(fact.salesAmount)),
      'agency-profit': (rows) => sum(rows.filter((fact) => Boolean(fact.agencyName)), (fact) => Number(fact.salesAmount) - Number(fact.purchaseAmount) + Number(fact.commissionAmount)),
    };
    const currencies = [...new Set(facts.map((fact) => fact.currencyCode))].sort();
    const metrics = Object.fromEntries(metricIds.flatMap((id) => {
      const amount = amountMetrics[id];
      if (amount) return [[id, {
        value: currencies.map((code) => `${Math.round(amount(facts.filter((fact) => fact.currencyCode === code))).toLocaleString('fa-IR')} ${code}`).join(' · '),
        unit: 'ارزها مستقل', detail: `${facts.length.toLocaleString('fa-IR')} قلم سفر دمو، بدون تبدیل ارز یا تکثیر مبلغ`,
      }]];
      const count = countMetrics[id];
      if (count) return [[id, { value: count(facts).toLocaleString('fa-IR'), unit: id.endsWith('rate') ? 'درصد' : 'قلم سفر', detail: 'فقط دادهٔ سفر موجود در Projection دمو' }]];
      return [];
    }));
    const by = (field: keyof (typeof facts)[number], rows: typeof facts) => {
      const groups = new Map<string, number>();
      for (const fact of rows) { const label = String(fact[field] ?? 'نامشخص'); groups.set(label, (groups.get(label) ?? 0) + Number(fact.salesAmount)); }
      return [...groups.entries()].sort((a, b) => b[1] - a[1]).slice(0, 6);
    };
    const visualIds = (input.visualIds ?? '').split(',').filter(Boolean);
    const visualFields: Record<string, keyof (typeof facts)[number]> = {
      'executive-sales-by-service': 'serviceType', 'sales-channel': 'salesChannel',
      'service-type': 'serviceType', 'service-sales-portfolio': 'serviceType',
      'sales-destination-ranking': 'destinationCity', 'sales-by-route': 'routeLabel',
      'route-sales-performance': 'routeLabel', 'airline-sales-performance': 'airlineName',
      'agency-sales': 'agencyName', 'supplier-spend': 'providerName',
    };
    // Charts represent one currency only. An unselected currency uses IRR in
    // the local fixture; unlike KPIs, numeric marks cannot combine IRR and USD.
    const visualCurrency = input.currency ?? (currencies.includes('IRR') ? 'IRR' : currencies[0]!);
    const visualFacts = facts.filter((fact) => fact.currencyCode === visualCurrency);
    const visuals = Object.fromEntries(visualIds.flatMap((id) => {
      const field = visualFields[id];
      if (!field) return [];
      const entries = by(field, visualFacts);
      return [[id, { labels: entries.map(([label]) => label), values: entries.map(([, value]) => Math.round(value)), currencyCode: visualCurrency }]];
    }));
    const dataAsOf = facts.reduce((latest, fact) => latest > fact.dataAsOf ? latest : fact.dataAsOf, facts[0]!.dataAsOf).toISOString();
    return {
      state: 'ready', message: 'فقط شاخص‌های دارای منبع fact سفر در دمو محاسبه شده‌اند.', metrics, visuals,
      metadata: { generatedAt: now.toISOString(), dataAsOf, timezone: 'Asia/Tehran', dateBasis: input.dateBasis ?? 'effective', currencyFxBasis: `KPI به تفکیک ارز؛ نمودار ${visualCurrency} بدون FX`, reportVersion: 'reporting.dashboard.travel.v1', permissionSnapshot: 'server-enforced' },
    };
  }

  saveReport(input: { reportCode: string; name: string; sharingScope: string; isFavorite?: boolean; filterState: unknown }, actor: ReportingActor) {
    this.metadata(input.reportCode, actor);
    if (!this.repository) throw new ConflictException('Persistence گزارش در دسترس نیست.');
    return this.repository.createSaved(actor.userId, input);
  }

  async sharingRecipients(reportCode: string, actor: ReportingActor) {
    this.requireShare(actor);
    const report = this.metadata(reportCode, actor);
    if (!this.repository) throw new ConflictException('Persistence گزارش در دسترس نیست.');
    const candidates = await this.repository.sharingCandidates(
      actor.userId,
      actor.permissions.includes('reporting.manage') ? [] : actor.branchIds,
    );
    return candidates
      .filter((candidate) => {
        const recipient: ReportingActor = {
          userId: candidate.id,
          permissions: candidate.permissions,
          branchIds: [],
        };
        return (
          candidate.permissions.includes('reporting.read') &&
          this.canReadReport(recipient, report.permission)
        );
      })
      .map((candidate) => ({
        id: candidate.id,
        displayName: candidate.displayName,
        username: candidate.username,
      }));
  }

  async savedReportShares(id: string, actor: ReportingActor) {
    this.requireShare(actor);
    if (!this.repository) throw new ConflictException('Persistence گزارش در دسترس نیست.');
    const savedReport = await this.repository.savedReportById(id);
    if (!savedReport || savedReport.ownerUserId !== actor.userId)
      throw new NotFoundException('گزارش ذخیره‌شده پیدا نشد.');
    return {
      savedReportId: id,
      recipientUserIds: await this.repository.sharedRecipientIds(id),
    };
  }

  async shareSavedReport(
    id: string,
    recipientUserIds: readonly string[],
    actor: ReportingActor,
  ) {
    this.requireShare(actor);
    if (!this.repository) throw new ConflictException('Persistence گزارش در دسترس نیست.');
    const savedReport = await this.repository.savedReportById(id);
    if (!savedReport || savedReport.ownerUserId !== actor.userId)
      throw new NotFoundException('گزارش ذخیره‌شده پیدا نشد.');
    const reportCode = String(savedReport.reportCode);
    const eligible = await this.sharingRecipients(reportCode, actor);
    const allowedIds = new Set(eligible.map((candidate) => candidate.id));
    const uniqueRecipientIds = [...new Set(recipientUserIds)];
    if (uniqueRecipientIds.includes(actor.userId))
      throw new ForbiddenException('اشتراک‌گذاری گزارش با خودتان مجاز نیست.');
    if (uniqueRecipientIds.some((recipientId) => !allowedIds.has(recipientId)))
      throw new ForbiddenException('یک یا چند گیرنده، مجوز مشاهده این گزارش را ندارند.');
    return this.repository.replaceSavedReportShares(
      id,
      actor.userId,
      uniqueRecipientIds,
    );
  }

  async deleteSavedReport(id: string, actor: ReportingActor) {
    if (!this.repository) throw new ConflictException('Persistence گزارش در دسترس نیست.');
    const count = await this.repository.deleteSaved(id, actor.userId);
    if (!count) throw new NotFoundException('گزارش ذخیره‌شده پیدا نشد.');
    return { deleted: true };
  }

  runs(actor: ReportingActor) {
    this.require(actor, 'reporting.read');
    if (!this.repository) throw new ConflictException('Persistence گزارش در دسترس نیست.');
    return this.repository.listRuns(actor.userId);
  }

  exports(actor: ReportingActor) {
    this.require(actor, 'reporting.export');
    if (!this.repository) throw new ConflictException('Persistence گزارش در دسترس نیست.');
    return this.repository.listExports(actor.userId);
  }

  private async travelResult(code: string, queryInput: ReportQueryV1, actor: ReportingActor) {
    const report = this.metadata(code, actor);
    if (report.producerStatus !== 'READY')
      throw new ConflictException('خروجی این گزارش هنوز به Public Projection متصل نیست.');
    const serverBranchScope = actor.permissions.includes('sales.contracts.read.all') || actor.permissions.includes('reporting.read') ? [] : actor.branchIds;
    const query = validateReportQuery({ ...queryInput, branchIds: serverBranchScope }, MAX_PREVIEW_PAGE_SIZE);
    if (!this.repository) throw new ConflictException('Persistence گزارش در دسترس نیست.');
    const facts = await this.repository.facts(query, serverBranchScope);
    return { report, result: buildTravelReportResult({ code, query, facts, now: new Date() }) };
  }

  async createExport(code: string, input: { format: 'CSV' | 'XLSX' | 'PDF'; query: ReportQueryV1; simulateFailure?: boolean }, actor: ReportingActor) {
    this.require(actor, 'reporting.export');
    const started = Date.now();
    const { report, result } = await this.travelResult(code, input.query, actor);
    if (!this.repository || !this.exportFiles) throw new ConflictException('سرویس خروجی گزارش در دسترس نیست.');
    const run = await this.repository.createRun({ reportCode: code, actorUserId: actor.userId, filterSnapshot: result.filterSnapshot, viewName: result.sourceProjection, viewVersion: result.reportVersion });
    const date = new Date().toISOString().slice(0, 10);
    const safeCode = code.replace(/[^a-z0-9_-]/g, '_');
    const extension = input.format.toLowerCase();
    const artifact = await this.repository.createExport({
      runId: String(run.id), creatorUserId: actor.userId, reportCode: code, reportName: report.title,
      format: input.format, fileName: `${safeCode}_${date}.${extension}`,
      contentType: input.format === 'CSV' ? 'text/csv; charset=utf-8' : input.format === 'XLSX' ? 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet' : 'application/pdf',
      filterSnapshot: result.filterSnapshot,
    });
    if (input.simulateFailure) {
      await this.repository.failExport(String(artifact.id), 'سناریوی کنترل‌شده خطای تولید خروجی برای دمو.');
      return { ...artifact, status: 'FAILED', errorMessage: 'سناریوی کنترل‌شده خطای تولید خروجی برای دمو.' };
    }
    try {
      const file = this.exportFiles.build(input.format, result, report.title);
      const objectKey = await this.exportFiles.store(String(artifact.id), file.extension, file.buffer);
      await this.repository.finishExport(String(artifact.id), objectKey, file.buffer.length, file.checksum);
      await this.repository.finishRun(String(run.id), result.total, Date.now() - started);
      return { ...artifact, status: 'READY', objectKey, sizeBytes: file.buffer.length, checksumSha256: file.checksum };
    } catch (error) {
      const message = error instanceof Error ? error.message : 'تولید خروجی ناموفق بود.';
      await this.repository.failExport(String(artifact.id), message);
      throw new ConflictException(message);
    }
  }

  async downloadExport(id: string, actor: ReportingActor) {
    this.require(actor, 'reporting.export');
    if (!this.repository || !this.exportFiles) throw new ConflictException('سرویس خروجی گزارش در دسترس نیست.');
    const artifact = await this.repository.exportById(id, actor.userId);
    if (!artifact) throw new NotFoundException('خروجی پیدا نشد.');
    if (artifact.status !== 'READY' || !artifact.objectKey || !artifact.sizeBytes)
      throw new ConflictException('فایل خروجی هنوز آماده دانلود نیست.');
    if (artifact.expiresAt && new Date(String(artifact.expiresAt)) <= new Date())
      throw new ConflictException('مهلت دانلود این خروجی پایان یافته است.');
    return {
      buffer: await this.exportFiles.read(String(artifact.objectKey), Number(artifact.sizeBytes)),
      fileName: String(artifact.fileName), contentType: String(artifact.contentType),
    };
  }

  async retryExport(id: string, actor: ReportingActor) {
    this.require(actor, 'reporting.export');
    if (!this.repository) throw new ConflictException('Persistence گزارش در دسترس نیست.');
    const artifact = await this.repository.exportById(id, actor.userId);
    if (!artifact) throw new NotFoundException('خروجی پیدا نشد.');
    if (artifact.status !== 'FAILED' && artifact.status !== 'EXPIRED')
      throw new ConflictException('فقط خروجی ناموفق یا منقضی قابل تلاش مجدد است.');
    const snapshot = artifact.filterSnapshot as unknown as {
      filters?: Record<string, string | string[]>;
      legalEntityId?: string;
      branchIds?: string[];
      sort?: ReportQueryV1['sort'];
      timezone?: 'Asia/Tehran';
    };
    return this.createExport(
      String(artifact.reportCode),
      {
        format: artifact.format as 'CSV' | 'XLSX' | 'PDF',
        query: {
          filters: snapshot.filters ?? {},
          page: 1,
          pageSize: 100,
          ...(snapshot.sort ? { sort: snapshot.sort } : {}),
          ...(snapshot.legalEntityId ? { legalEntityId: snapshot.legalEntityId } : {}),
          ...(snapshot.branchIds?.length ? { branchIds: snapshot.branchIds } : {}),
          timezone: snapshot.timezone ?? 'Asia/Tehran',
        },
      },
      actor,
    );
  }
}
