import { createHash } from 'node:crypto';
import {
  BadRequestException,
  ForbiddenException,
  HttpException,
  Inject,
  Injectable,
  Logger,
  NotFoundException,
  type OnModuleDestroy,
  type OnModuleInit,
} from '@nestjs/common';
import { hasAccessControl, type AuthenticatedActor } from '@nora/contracts';
import type { Prisma } from '@nora/database';

import { IamService } from '../iam/iam.service';
import type { ExportCreateDto } from './reporting.dto';
import {
  ReportingExportQueueRepository,
  type QueuedReportExport,
} from './reporting-export-queue.repository';
import { ReportingExportService } from './reporting-export.service';
import { ReportingService } from './reporting.service';

const accessControl = 'reports.view.downloads';
const failureMessage = 'تولید خروجی ناموفق بود.';
const contentTypes = {
  CSV: 'text/csv; charset=utf-8',
  XLSX: 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet',
  PDF: 'application/pdf',
};

function fingerprint(actor: AuthenticatedActor) {
  return createHash('sha256')
    .update(
      JSON.stringify([
        [...actor.permissions].sort(),
        [...actor.branchIds].sort(),
      ]),
    )
    .digest('hex');
}

@Injectable()
export class ReportingExportQueue implements OnModuleInit, OnModuleDestroy {
  private readonly logger = new Logger(ReportingExportQueue.name);
  private timer?: ReturnType<typeof setInterval>;
  private running = false;

  constructor(
    @Inject(ReportingExportQueueRepository)
    private readonly queue: ReportingExportQueueRepository,
    @Inject(ReportingService) private readonly reports: ReportingService,
    @Inject(ReportingExportService)
    private readonly files: ReportingExportService,
    @Inject(IamService) private readonly iam: IamService,
  ) {}

  onModuleInit() {
    this.timer = setInterval(() => void this.poll(), 5_000);
    this.timer.unref();
  }

  onModuleDestroy() {
    clearInterval(this.timer);
  }

  enqueue(code: string, input: ExportCreateDto, actor: AuthenticatedActor) {
    this.assertAccess(actor);
    const { report, query } = this.reports.prepareQueuedExport(
      code,
      input.query,
      actor,
    );
    const safeCode = code.replace(/[^a-z0-9_-]/g, '_');
    const date = new Date().toISOString().slice(0, 10);
    return this.queue.enqueue({
      reportCode: code,
      reportName: report.title,
      viewName: report.approvedView,
      viewVersion: report.version,
      creatorUserId: actor.userId,
      format: input.format,
      contentType: contentTypes[input.format],
      fileName: [safeCode + '_' + date, input.format.toLowerCase()].join('.'),
      filterSnapshot: JSON.parse(
        JSON.stringify(query),
      ) as Prisma.InputJsonObject,
      payload: {
        sessionId: actor.sessionId,
        authorizationFingerprint: fingerprint(actor),
        viewName: report.approvedView,
        viewVersion: report.version,
        query,
        ...(input.simulateFailure ? { simulateFailure: true } : {}),
      },
    });
  }

  async retry(id: string, actor: AuthenticatedActor) {
    this.assertAccess(actor);
    const { code, input } = await this.reports.prepareExportRetry(id, actor);
    return this.enqueue(code, input, actor);
  }

  async status(id: string, actor: AuthenticatedActor) {
    this.assertAccess(actor);
    const row = await this.queue.status(id, actor.userId);
    if (!row) throw new NotFoundException('خروجی پیدا نشد.');
    return row;
  }

  async poll() {
    if (this.running) return;
    this.running = true;
    try {
      const job = await this.queue.claim();
      if (job) await this.process(job);
    } catch {
      this.logger.warn('Reporting export queue polling failed.');
    } finally {
      this.running = false;
    }
  }

  private async process(job: QueuedReportExport) {
    const started = Date.now();
    let artifact:
      Awaited<ReturnType<ReportingService['renderQueuedExport']>> | undefined;
    try {
      const actor = await this.authorize(job);
      if (job.queuePayload.simulateFailure)
        throw new HttpException(
          'سناریوی کنترل‌شده خطای تولید خروجی برای دمو.',
          409,
        );
      artifact = await this.reports.renderQueuedExport(
        job.id,
        job.reportCode,
        job.format,
        job.queuePayload.query,
        actor,
        job.queuePayload,
      );
      await this.authorize(job);
    } catch (error) {
      if (artifact) await this.discard(artifact.objectKey);
      const message =
        error instanceof BadRequestException ||
        (error instanceof HttpException &&
          typeof error.getResponse() === 'string')
          ? error.message
          : failureMessage;
      await this.queue.complete(
        job,
        { errorMessage: message },
        Date.now() - started,
      );
      return;
    }
    // A rejected database commit can be ambiguous. Delete only when the fence
    // conclusively reports that no row was changed by this attempt.
    if (!(await this.queue.complete(job, artifact, Date.now() - started)))
      await this.discard(artifact.objectKey);
  }

  private async discard(objectKey: string) {
    try {
      await this.files.discard(objectKey);
    } catch {
      this.logger.warn(
        'Could not discard an unclaimed reporting export artifact.',
      );
    }
  }

  private assertAccess(actor: AuthenticatedActor) {
    this.reports.assertExportAccess(actor);
    if (!hasAccessControl(actor.permissions, accessControl))
      throw new ForbiddenException('مجوز ساخت خروجی گزارش وجود ندارد.');
  }

  private async authorize(job: QueuedReportExport) {
    const actor = await this.iam.authenticateSessionReferenceV1(
      job.creatorUserId,
      job.queuePayload.sessionId,
      true,
    );
    this.assertAccess(actor);
    if (fingerprint(actor) !== job.queuePayload.authorizationFingerprint)
      throw new HttpException(
        'دسترسی گزارش تغییر کرده است. خروجی را دوباره درخواست کنید.',
        403,
      );
    return actor;
  }
}
