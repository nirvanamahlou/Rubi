import { Inject, Injectable } from '@nestjs/common';
import { Prisma } from '@nora/database';

import { DatabaseService } from '../database/database.service';
import type { ReportQueryV1 } from './reporting.contracts';

export interface ReportingFactRow {
  id: string;
  orderNumber: string;
  occurredAt: Date;
  legalEntityCode: string;
  legalEntityName: string;
  branchId: string | null;
  branchName: string;
  ownerName: string;
  siteCode: string;
  salesChannel: string;
  serviceType: string;
  customerType: string;
  customerName: string;
  agencyName: string | null;
  leadSource: string | null;
  providerName: string | null;
  airlineName: string | null;
  originCity: string | null;
  destinationCity: string | null;
  routeLabel: string | null;
  orderStatus: string;
  reservationStatus: string;
  issueStatus: string;
  paymentStatus: string;
  pnrCode: string | null;
  passengerCount: number;
  segmentCount: number;
  ticketCount: number;
  currencyCode: string;
  salesAmount: Prisma.Decimal;
  purchaseAmount: Prisma.Decimal;
  commissionAmount: Prisma.Decimal;
  refundAmount: Prisma.Decimal;
  settledAmount: Prisma.Decimal;
  dataAsOf: Date;
}

export interface DashboardFilterOptions {
  salesChannel: readonly string[];
  branch: readonly string[];
  agent: readonly string[];
  service: readonly string[];
  agency: readonly string[];
  provider: readonly string[];
  currency: readonly string[];
  status: readonly string[];
}

type RecordRow = Record<string, unknown>;

function json(value: unknown): Prisma.InputJsonValue {
  return JSON.parse(JSON.stringify(value)) as Prisma.InputJsonValue;
}

@Injectable()
export class ReportingRepository {
  constructor(
    @Inject(DatabaseService) private readonly database: DatabaseService,
  ) {}

  async facts(input: ReportQueryV1, serverBranchIds: readonly string[]) {
    const conditions: Prisma.Sql[] = [];
    const scalar = (key: string) => {
      const value = input.filters[key];
      return typeof value === 'string' && value ? value : undefined;
    };
    if (serverBranchIds.length)
      conditions.push(
        Prisma.sql`"branchId" IN (${Prisma.join(serverBranchIds)})`,
      );
    if (input.legalEntityId)
      conditions.push(Prisma.sql`"legalEntityCode" = ${input.legalEntityId}`);
    const fromUtc = scalar('fromUtc');
    const toUtc = scalar('toUtc');
    if (fromUtc)
      conditions.push(Prisma.sql`"occurredAt" >= ${new Date(fromUtc)}`);
    if (toUtc) conditions.push(Prisma.sql`"occurredAt" < ${new Date(toUtc)}`);
    const mapping = {
      currencyCode: 'currencyCode',
      branchId: 'branchId',
      ownerUserId: 'ownerUserId',
      branch: 'branchName',
      expert: 'ownerName',
      status: 'orderStatus',
      site: 'siteCode',
      salesChannel: 'salesChannel',
      serviceType: 'serviceType',
      origin: 'originCity',
      destination: 'destinationCity',
      route: 'routeLabel',
      airline: 'airlineName',
      provider: 'providerName',
      agency: 'agencyName',
      customerType: 'customerType',
      reservationStatus: 'reservationStatus',
      issueStatus: 'issueStatus',
      paymentStatus: 'paymentStatus',
      leadSource: 'leadSource',
    } as const;
    for (const [filter, column] of Object.entries(mapping)) {
      const value = scalar(filter);
      if (value)
        conditions.push(Prisma.sql`${Prisma.raw(`"${column}"`)} = ${value}`);
    }
    const where = conditions.length
      ? Prisma.sql`WHERE ${Prisma.join(conditions, ' AND ')}`
      : Prisma.empty;
    const rows = await this.database.client.$queryRaw<
      ReportingFactRow[]
    >(Prisma.sql`
      SELECT * FROM "reporting_travel_facts" ${where} ORDER BY "occurredAt" DESC, "id" ASC
    `);
    return rows;
  }

  /**
   * Return distinct dimension values from the same scoped fact grain used by
   * the dashboard. Dimension predicates are intentionally omitted so a
   * selected value never hides the other choices in the filter control.
   */
  async dashboardFilterOptions(
    input: ReportQueryV1,
    serverBranchIds: readonly string[],
  ): Promise<DashboardFilterOptions> {
    const rows = await this.facts(input, serverBranchIds);
    const options = (pick: (row: ReportingFactRow) => string | null) =>
      Object.freeze(
        [
          ...new Set(
            rows
              .map(pick)
              .filter(
                (value): value is string =>
                  typeof value === 'string' && value.length > 0,
              ),
          ),
        ].sort((a, b) => a.localeCompare(b, 'fa')),
      );
    return {
      salesChannel: options((row) => row.salesChannel),
      branch: options((row) => row.branchName),
      agent: options((row) => row.ownerName),
      service: options((row) => row.serviceType),
      agency: options((row) => row.agencyName),
      provider: options((row) => row.providerName),
      currency: options((row) => row.currencyCode),
      status: options((row) => row.orderStatus),
    };
  }

  listSaved(actorUserId: string) {
    return this.database.client.$queryRaw<RecordRow[]>(Prisma.sql`
      SELECT r.*, u."displayName" AS "ownerName",
        EXISTS (
          SELECT 1 FROM "reporting_saved_report_shares" share
          WHERE share."savedReportId" = r.id
            AND share."recipientUserId" = ${actorUserId}::uuid
        ) AS "isSharedWithActor",
        (SELECT COUNT(*)::int FROM "reporting_runs" x WHERE x."savedReportId" = r.id) AS "runCount"
      FROM "reporting_saved_reports" r JOIN "iam_users" u ON u.id = r."ownerUserId"
      WHERE r."ownerUserId" = ${actorUserId}::uuid
        OR EXISTS (
          SELECT 1 FROM "reporting_saved_report_shares" share
          WHERE share."savedReportId" = r.id
            AND share."recipientUserId" = ${actorUserId}::uuid
        )
      ORDER BY r."isFavorite" DESC, r."updatedAt" DESC
    `);
  }

  async workspaceCounts(actorUserId: string) {
    const rows = await this.database.client.$queryRaw<
      Array<{
        myReports: number;
        sharedWithMe: number;
        runs: number;
        exports: number;
      }>
    >(Prisma.sql`
      SELECT
        (SELECT COUNT(*)::int FROM "reporting_saved_reports" WHERE "ownerUserId" = ${actorUserId}::uuid) AS "myReports",
        (SELECT COUNT(*)::int FROM "reporting_saved_report_shares" WHERE "recipientUserId" = ${actorUserId}::uuid) AS "sharedWithMe",
        (SELECT COUNT(*)::int FROM "reporting_runs" WHERE "actorUserId" = ${actorUserId}::uuid) AS "runs",
        (SELECT COUNT(*)::int FROM "reporting_export_artifacts" WHERE "creatorUserId" = ${actorUserId}::uuid) AS "exports"
    `);
    return (
      rows[0] ?? {
        myReports: 0,
        sharedWithMe: 0,
        runs: 0,
        exports: 0,
      }
    );
  }

  async createSaved(
    actorUserId: string,
    input: {
      reportCode: string;
      name: string;
      sharingScope: string;
      isFavorite?: boolean;
      filterState: unknown;
      runMetadata?: { viewName: string; viewVersion: number };
    },
  ) {
    if (!input.runMetadata) {
      const rows = await this.database.client.$queryRaw<RecordRow[]>(Prisma.sql`
        INSERT INTO "reporting_saved_reports" ("reportCode", name, "ownerUserId", "sharingScope", "isFavorite", "filterState", "updatedAt")
        VALUES (${input.reportCode}, ${input.name}, ${actorUserId}::uuid, ${input.sharingScope}::"ReportingSharingScope", ${input.isFavorite ?? false}, ${JSON.stringify(json(input.filterState))}::jsonb, NOW()) RETURNING *
      `);
      return rows[0];
    }
    return this.database.client.$transaction(async (transaction) => {
      const rows = await transaction.$queryRaw<RecordRow[]>(Prisma.sql`
        INSERT INTO "reporting_saved_reports" ("reportCode", name, "ownerUserId", "sharingScope", "isFavorite", "filterState", "updatedAt")
        VALUES (${input.reportCode}, ${input.name}, ${actorUserId}::uuid, ${input.sharingScope}::"ReportingSharingScope", ${input.isFavorite ?? false}, ${JSON.stringify(json(input.filterState))}::jsonb, NOW()) RETURNING *
      `);
      const saved = rows[0]!;
      if (input.runMetadata) {
        await transaction.$executeRaw(Prisma.sql`
          INSERT INTO "reporting_runs" ("reportCode", "savedReportId", "actorUserId", status, "filterSnapshot", "viewName", "viewVersion", "startedAt", "finishedAt")
          VALUES (${input.reportCode}, ${String(saved.id)}::uuid, ${actorUserId}::uuid, 'SUCCEEDED',
            ${json({ ...(input.filterState as Record<string, unknown>), actionType: 'SAVE' })},
            ${input.runMetadata.viewName}, ${input.runMetadata.viewVersion}, NOW(), NOW())
        `);
      }
      return saved;
    });
  }

  async savedReportById(id: string) {
    const rows = await this.database.client.$queryRaw<RecordRow[]>(Prisma.sql`
      SELECT * FROM "reporting_saved_reports" WHERE id = ${id}::uuid LIMIT 1
    `);
    return rows[0];
  }

  async sharingCandidates(actorUserId: string, branchIds: readonly string[]) {
    const branchCondition = branchIds.length
      ? Prisma.sql`AND EXISTS (
          SELECT 1 FROM "iam_user_branches" candidate_branch
          WHERE candidate_branch."userId" = candidate.id
            AND candidate_branch."branchId" IN (${Prisma.join(branchIds)})
        )`
      : Prisma.empty;
    return this.database.client.$queryRaw<
      Array<{
        id: string;
        displayName: string;
        username: string;
        permissions: string[];
      }>
    >(Prisma.sql`
      SELECT candidate.id, candidate."displayName", candidate.username,
        COALESCE(array_agg(DISTINCT permission.code) FILTER (WHERE permission.code IS NOT NULL), ARRAY[]::varchar[]) AS permissions
      FROM "iam_users" candidate
      LEFT JOIN "iam_user_roles" user_role ON user_role."userId" = candidate.id
      LEFT JOIN "iam_roles" role ON role.id = user_role."roleId" AND role."isActive" = TRUE
      LEFT JOIN "iam_role_permissions" role_permission ON role_permission."roleId" = role.id
      LEFT JOIN "iam_permissions" permission ON permission.id = role_permission."permissionId"
      WHERE candidate.status = 'ACTIVE'
        AND candidate.id <> ${actorUserId}::uuid
        ${branchCondition}
      GROUP BY candidate.id, candidate."displayName", candidate.username
      ORDER BY candidate."displayName" ASC, candidate.id ASC
    `);
  }

  async sharedRecipientIds(savedReportId: string) {
    const rows = await this.database.client.$queryRaw<
      Array<{ recipientUserId: string }>
    >(Prisma.sql`
      SELECT "recipientUserId" FROM "reporting_saved_report_shares"
      WHERE "savedReportId" = ${savedReportId}::uuid
      ORDER BY "createdAt" ASC
    `);
    return rows.map((row) => row.recipientUserId);
  }

  async replaceSavedReportShares(
    savedReportId: string,
    actorUserId: string,
    recipientUserIds: readonly string[],
  ) {
    return this.database.client.$transaction(async (transaction) => {
      await transaction.$executeRaw(Prisma.sql`
        DELETE FROM "reporting_saved_report_shares"
        WHERE "savedReportId" = ${savedReportId}::uuid
      `);
      if (recipientUserIds.length) {
        await transaction.$executeRaw(Prisma.sql`
          INSERT INTO "reporting_saved_report_shares"
            ("savedReportId", "recipientUserId", "sharedByUserId", "updatedAt")
          SELECT ${savedReportId}::uuid, recipient_id, ${actorUserId}::uuid, NOW()
          FROM unnest(ARRAY[${Prisma.join(recipientUserIds)}]::uuid[]) AS recipient_id
        `);
      }
      await transaction.$executeRaw(Prisma.sql`
        UPDATE "reporting_saved_reports"
        SET "sharingScope" = ${recipientUserIds.length ? 'TEAM' : 'PERSONAL'}::"ReportingSharingScope",
            "updatedAt" = NOW()
        WHERE id = ${savedReportId}::uuid
      `);
      return { savedReportId, recipientUserIds: [...recipientUserIds] };
    });
  }

  deleteSaved(id: string, actorUserId: string) {
    return this.database.client.$executeRaw(
      Prisma.sql`DELETE FROM "reporting_saved_reports" WHERE id = ${id}::uuid AND "ownerUserId" = ${actorUserId}::uuid`,
    );
  }

  listRuns(actorUserId: string) {
    return this.database.client.$queryRaw<RecordRow[]>(Prisma.sql`
      SELECT x.*, x."filterSnapshot" ->> 'actionType' AS "actionType",
        u."displayName" AS "actorName", r.name AS "savedReportName"
      FROM "reporting_runs" x JOIN "iam_users" u ON u.id = x."actorUserId"
      LEFT JOIN "reporting_saved_reports" r ON r.id = x."savedReportId"
      WHERE x."actorUserId" = ${actorUserId}::uuid ORDER BY x."createdAt" DESC LIMIT 30
    `);
  }

  async createRun(input: {
    reportCode: string;
    savedReportId?: string;
    actorUserId: string;
    filterSnapshot: unknown;
    viewName: string;
    viewVersion: number;
    status?: string;
    errorMessage?: string;
  }) {
    const rows = await this.database.client.$queryRaw<RecordRow[]>(Prisma.sql`
      INSERT INTO "reporting_runs" ("reportCode", "savedReportId", "actorUserId", status, "filterSnapshot", "viewName", "viewVersion", "errorMessage", "startedAt", "finishedAt")
      VALUES (${input.reportCode}, ${input.savedReportId ?? null}::uuid, ${input.actorUserId}::uuid,
        ${input.status ?? 'RUNNING'}::"ReportingRunStatus", ${json(input.filterSnapshot)}, ${input.viewName}, ${input.viewVersion}, ${input.errorMessage ?? null}, NOW(), ${input.status === 'FAILED' || input.status === 'SUCCEEDED' ? new Date() : null}) RETURNING *
    `);
    return rows[0]!;
  }

  finishRun(id: string, recordCount: number, durationMs: number) {
    return this.database.client.$executeRaw(Prisma.sql`
      UPDATE "reporting_runs" SET status='SUCCEEDED', "recordCount"=${recordCount}, "durationMs"=${durationMs}, "finishedAt"=NOW() WHERE id=${id}::uuid
    `);
  }

  failRun(id: string, message: string, durationMs: number) {
    return this.database.client.$executeRaw(Prisma.sql`
      UPDATE "reporting_runs" SET status='FAILED', "errorCode"='REPORT_ACTION_FAILED',
        "errorMessage"=${message.slice(0, 500)}, "durationMs"=${durationMs}, "finishedAt"=NOW()
      WHERE id=${id}::uuid
    `);
  }

  listExports(actorUserId: string) {
    return this.database.client.$queryRaw<RecordRow[]>(Prisma.sql`
      SELECT e.*, u."displayName" AS "creatorName" FROM "reporting_export_artifacts" e
      JOIN "iam_users" u ON u.id=e."creatorUserId" WHERE e."creatorUserId"=${actorUserId}::uuid
      ORDER BY e."createdAt" DESC LIMIT 30
    `);
  }

  async createExport(input: {
    runId: string;
    creatorUserId: string;
    reportCode: string;
    reportName: string;
    format: string;
    fileName: string;
    contentType: string;
    filterSnapshot: unknown;
  }) {
    const rows = await this.database.client.$queryRaw<RecordRow[]>(Prisma.sql`
      INSERT INTO "reporting_export_artifacts" ("runId", "creatorUserId", "reportCode", "reportName", format, status, "fileName", "contentType", "filterSnapshot", "updatedAt")
      VALUES (${input.runId}::uuid, ${input.creatorUserId}::uuid, ${input.reportCode}, ${input.reportName}, ${input.format}::"ReportingExportFormat", 'GENERATING', ${input.fileName}, ${input.contentType}, ${json(input.filterSnapshot)}, NOW()) RETURNING *
    `);
    return rows[0]!;
  }

  finishExport(
    id: string,
    objectKey: string,
    sizeBytes: number,
    checksumSha256: string,
    expiryDays = 7,
  ) {
    return this.database.client.$executeRaw(
      Prisma.sql`UPDATE "reporting_export_artifacts" SET status='READY', "objectKey"=${objectKey}, "sizeBytes"=${sizeBytes}, "checksumSha256"=${checksumSha256}, "expiresAt"=NOW()+(${expiryDays} * INTERVAL '1 day'), "updatedAt"=NOW() WHERE id=${id}::uuid`,
    );
  }

  failExport(id: string, message: string) {
    return this.database.client.$executeRaw(
      Prisma.sql`UPDATE "reporting_export_artifacts" SET status='FAILED', "errorMessage"=${message}, "updatedAt"=NOW() WHERE id=${id}::uuid`,
    );
  }

  async exportById(id: string, actorUserId: string) {
    const rows = await this.database.client.$queryRaw<RecordRow[]>(
      Prisma.sql`SELECT * FROM "reporting_export_artifacts" WHERE id=${id}::uuid AND "creatorUserId"=${actorUserId}::uuid LIMIT 1`,
    );
    return rows[0];
  }
}
