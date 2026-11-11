import { randomUUID } from 'node:crypto';
import { Inject, Injectable, HttpException } from '@nestjs/common';
import { Prisma } from '@nora/database';

import { DatabaseService } from '../database/database.service';
import type { ReportQueryV1 } from './reporting.contracts';

type ExportFormat = 'CSV' | 'XLSX' | 'PDF';
export type QueuedReportExport = {
  id: string;
  runId: string;
  reportCode: string;
  creatorUserId: string;
  format: ExportFormat;
  queueToken: string;
  queuePayload: {
    sessionId: string;
    authorizationFingerprint: string;
    viewName: string;
    viewVersion: number;
    query: ReportQueryV1;
    simulateFailure?: boolean;
  };
};

type Enqueue = {
  reportCode: string;
  reportName: string;
  viewName: string;
  viewVersion: number;
  creatorUserId: string;
  format: ExportFormat;
  fileName: string;
  contentType: string;
  filterSnapshot: Prisma.InputJsonObject;
  payload: QueuedReportExport['queuePayload'];
};

const exportStatusSelect = {
  id: true,
  status: true,
  fileName: true,
  errorMessage: true,
} satisfies Prisma.ReportingExportArtifactSelect;

@Injectable()
export class ReportingExportQueueRepository {
  constructor(
    @Inject(DatabaseService) private readonly database: DatabaseService,
  ) {}

  enqueue(input: Enqueue) {
    return this.database.client.$transaction(async (tx) => {
      await tx.$queryRaw`SELECT 1 FROM pg_advisory_xact_lock(hashtextextended(${'reporting-export:' + input.creatorUserId}, 0))`;
      const pending = await tx.reportingExportArtifact.count({
        where: {
          creatorUserId: input.creatorUserId,
          queuePayload: { not: Prisma.DbNull },
          status: { in: ['QUEUED', 'GENERATING'] },
        },
      });
      if (pending >= 3)
        throw new HttpException(
          'تعداد خروجی‌های در انتظار شما به سقف رسیده است.',
          429,
        );
      const run = await tx.reportingRun.create({
        data: {
          reportCode: input.reportCode,
          actorUserId: input.creatorUserId,
          filterSnapshot: { ...input.filterSnapshot, actionType: 'EXPORT' },
          viewName: input.viewName,
          viewVersion: input.viewVersion,
        },
        select: { id: true },
      });
      return tx.reportingExportArtifact.create({
        data: {
          runId: run.id,
          creatorUserId: input.creatorUserId,
          reportCode: input.reportCode,
          reportName: input.reportName,
          format: input.format,
          fileName: input.fileName,
          contentType: input.contentType,
          filterSnapshot: input.filterSnapshot,
          queuePayload: JSON.parse(
            JSON.stringify(input.payload),
          ) as Prisma.InputJsonObject,
        },
        select: exportStatusSelect,
      });
    });
  }

  status(id: string, creatorUserId: string) {
    return this.database.client.reportingExportArtifact.findFirst({
      where: { id, creatorUserId },
      select: exportStatusSelect,
    });
  }

  async claim() {
    const token = randomUUID();
    return this.database.client.$transaction(async (tx) => {
      const expired = await tx.$queryRaw<{ runId: string }[]>`
        WITH expired AS (
          SELECT id FROM reporting_export_artifacts
          WHERE status = 'GENERATING' AND "queueLeaseUntil" <= now()
            AND "queueAttempts" >= 3
          ORDER BY "queueLeaseUntil", id
          LIMIT 20 FOR UPDATE SKIP LOCKED
        )
        UPDATE reporting_export_artifacts AS artifact
        SET status = 'FAILED', "queuePayload" = NULL, "queueToken" = NULL,
            "queueLeaseUntil" = NULL, "updatedAt" = now(),
            "errorMessage" = 'تولید خروجی پس از چند تلاش کامل نشد.'
        FROM expired WHERE artifact.id = expired.id
        RETURNING artifact."runId"
      `;
      if (expired.length)
        await tx.reportingRun.updateMany({
          where: { id: { in: expired.map(({ runId }) => runId) } },
          data: {
            status: 'FAILED',
            errorCode: 'REPORT_EXPORT_LEASE_EXPIRED',
            errorMessage: 'تولید خروجی پس از چند تلاش کامل نشد.',
            finishedAt: new Date(),
          },
        });
      const [job] = await tx.$queryRaw<QueuedReportExport[]>`
        WITH candidate AS (
          SELECT id FROM reporting_export_artifacts
          WHERE "queuePayload" IS NOT NULL AND (
            status = 'QUEUED' OR (
              status = 'GENERATING' AND "queueLeaseUntil" <= now()
              AND "queueAttempts" < 3
            )
          )
          ORDER BY "createdAt", id
          LIMIT 1 FOR UPDATE SKIP LOCKED
        )
        UPDATE reporting_export_artifacts AS artifact
        SET status = 'GENERATING', "queueToken" = ${token}::uuid,
            "queueLeaseUntil" = now() + interval '5 minutes',
            "queueAttempts" = "queueAttempts" + 1, "updatedAt" = now()
        FROM candidate WHERE artifact.id = candidate.id
        RETURNING artifact.id, artifact."runId", artifact."reportCode",
                  artifact."creatorUserId", artifact.format,
                  artifact."queueToken", artifact."queuePayload"
      `;
      if (job)
        await tx.reportingRun.update({
          where: { id: job.runId },
          data: { status: 'RUNNING', startedAt: new Date() },
        });
      return job;
    });
  }

  complete(
    job: QueuedReportExport,
    result:
      | {
          objectKey: string;
          sizeBytes: number;
          checksum: string;
          expiryDays: number;
          recordCount: number;
        }
      | { errorMessage: string },
    durationMs: number,
  ) {
    const failed = 'errorMessage' in result;
    const data = failed
      ? Prisma.sql`status = 'FAILED', "errorMessage" = ${result.errorMessage}`
      : Prisma.sql`status = 'READY', "objectKey" = ${result.objectKey},
          "sizeBytes" = ${result.sizeBytes}, "checksumSha256" = ${result.checksum},
          "expiresAt" = now() + (${result.expiryDays} * interval '1 day')`;
    return this.database.client.$transaction(async (tx) => {
      const changed = await tx.$executeRaw`
        UPDATE reporting_export_artifacts
        SET ${data}, "queuePayload" = NULL, "queueToken" = NULL,
            "queueLeaseUntil" = NULL, "updatedAt" = now()
        WHERE id = ${job.id}::uuid AND "queueToken" = ${job.queueToken}::uuid
          AND status = 'GENERATING' AND "queueLeaseUntil" > now()
      `;
      if (!changed) return false;
      await tx.reportingRun.update({
        where: { id: job.runId },
        data: {
          ...(failed
            ? {
                status: 'FAILED',
                errorCode: 'REPORT_ACTION_FAILED',
                errorMessage: result.errorMessage,
              }
            : { status: 'SUCCEEDED', recordCount: result.recordCount }),
          durationMs,
          finishedAt: new Date(),
        },
      });
      return true;
    });
  }
}
