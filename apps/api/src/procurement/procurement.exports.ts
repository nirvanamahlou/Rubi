import { createHash } from 'node:crypto';
import {
  ForbiddenException,
  Inject,
  Injectable,
  NotFoundException,
  type OnModuleDestroy,
  type OnModuleInit,
} from '@nestjs/common';
import type { AuthenticatedActor } from '@nora/contracts';
import { Prisma } from '@nora/database';
import { DatabaseService } from '../database/database.service';
import { DocumentsService } from '../documents/documents.service';
import { IamProcurementDirectory } from '../iam/iam-procurement-directory';
import { LegalEntitiesService } from '../legal-entities/legal-entities.service';
import { ProcurementRuleError, requireRule } from './domain/procurement.rules';
import { ProcurementService, json } from './procurement.service';
import {
  PROCUREMENT_XLSX_MIME,
  renderProcurementPdf,
  renderProcurementXlsx,
  type ProcurementExportTable,
} from './procurement.rendering';
import * as v from './procurement.validation';

type Job = Prisma.ProcurementExportJobGetPayload<null>;
const requestStatusLabels: Record<string, string> = {
  DRAFT: 'پیش‌نویس',
  SUBMITTED: 'ارسال‌شده',
  IN_REVIEW: 'در بررسی',
  CHANGES_REQUESTED: 'نیازمند اصلاح',
  APPROVED: 'تأییدشده',
  REJECTED: 'ردشده',
  CANCELLED: 'لغوشده',
  SOURCING: 'در حال تأمین',
  CLOSED: 'بسته‌شده',
};
const dto = (job: Job) => {
  const result = job.resultJson ? v.object(job.resultJson) : null;
  const branding = result?.branding ? v.object(result.branding) : null;
  return {
    id: job.id,
    kind: job.kind,
    format: job.format,
    status: job.status,
    createdAt: job.createdAt.toISOString(),
    errorCode: job.errorCode,
    result: result
      ? {
          documentId: result.documentId,
          versionId: result.versionId,
          scanStatus: result.scanStatus,
          branding: branding
            ? {
                legalEntityId: branding.legalEntityId,
                persianName: branding.persianName,
                version: branding.version,
              }
            : null,
        }
      : null,
  };
};

/** Durable bounded database queue. A crashed worker's lease can be reclaimed. */
@Injectable()
export class ProcurementExports implements OnModuleInit, OnModuleDestroy {
  private timer?: ReturnType<typeof setInterval>;
  private running = false;
  constructor(
    @Inject(DatabaseService) private readonly database: DatabaseService,
    @Inject(ProcurementService)
    private readonly procurement: ProcurementService,
    @Inject(IamProcurementDirectory)
    private readonly iam: IamProcurementDirectory,
    @Inject(DocumentsService) private readonly documents: DocumentsService,
    @Inject(LegalEntitiesService) private readonly legal: LegalEntitiesService,
  ) {}
  onModuleInit() {
    if (process.env.NODE_ENV === 'test') return;
    this.timer = setInterval(() => {
      void this.tick();
    }, 5000);
    this.timer.unref();
  }
  onModuleDestroy() {
    if (this.timer) clearInterval(this.timer);
  }
  private authorize(actor: AuthenticatedActor, branchId?: string) {
    if (
      ![
        'procurement.read.own',
        'procurement.read.unit',
        'procurement.read.all',
      ].some((permission) => actor.permissions.includes(permission as never)) ||
      ![
        'procurement.export',
        'documents.upload',
        'documents.list',
        'documents.metadata.read',
        'documents.procurement.read',
      ].every((permission) =>
        actor.permissions.includes(permission as never),
      ) ||
      (branchId && !actor.branchIds.includes(branchId))
    )
      throw new ForbiddenException(
        'مجوز خروجی و بایگانی مدارک خرید در این شعبه لازم است.',
      );
  }
  async create(body: unknown, key: unknown, actor: AuthenticatedActor) {
    const input = v.object(body, [
      'kind',
      'format',
      'branchId',
      'documentTypeId',
      'categoryId',
      'query',
      'requestId',
      'orderId',
    ]);
    const kind = v.text(input.kind, 'kind', 30);
    const format = v.text(input.format, 'format', 10);
    requireRule(
      ['REQUESTS', 'REPORT', 'ORDER'].includes(kind) &&
        ['PDF', 'XLSX'].includes(format),
      'VALIDATION_ERROR',
      'نوع خروجی معتبر نیست.',
    );
    const branchId = v.uuid(input.branchId);
    this.authorize(actor, branchId);
    const scoped = { ...actor, branchIds: [branchId] };
    const query = v.object(
      input.query ?? {},
      kind === 'REPORT' ? ['dimension'] : ['status', 'search', 'queue'],
    );
    const requestId = kind === 'ORDER' ? v.uuid(input.requestId) : null;
    const orderId = kind === 'ORDER' ? v.uuid(input.orderId) : null;
    if (requestId) await this.procurement.detail(requestId, scoped);
    else if (kind === 'REPORT')
      await this.procurement.report({ ...query, page: 1 }, scoped);
    else await this.procurement.list({ ...query, page: 1 }, scoped);
    const options = await this.documents.options(scoped);
    const mime = format === 'PDF' ? 'application/pdf' : PROCUREMENT_XLSX_MIME;
    const documentTypeId = v.uuid(input.documentTypeId);
    const categoryId = v.uuid(input.categoryId);
    requireRule(
      options.data.documentTypes.some(
        (type) =>
          type.id === documentTypeId &&
          type.domain === 'PROCUREMENT' &&
          type.allowedMimeTypes.includes(mime) &&
          !type.requiresExpiry,
      ) &&
        options.data.categories.some((category) => category.id === categoryId),
      'DOCUMENTS_UNAVAILABLE',
      'نوع سند خرید و دسته‌بندی سازگار با خروجی لازم است.',
    );
    let branding: unknown = null;
    if (format === 'PDF') {
      const issuers = await this.legal.issueTargets(actor, 'prompt');
      requireRule(
        !issuers.data.requiresExplicitIssuer &&
          issuers.data.targets.length === 1,
        'ISSUER_REQUIRED',
        'برای PDF شرکت مشخص انتخاب کنید؛ زمینه همه شرکت‌ها مجاز نیست.',
      );
      branding = (await this.legal.branding(issuers.data.targets[0]!.id, actor))
        .data;
    }
    const idempotencyKey = v.text(key, 'Idempotency-Key', 160);
    const requestHash = createHash('sha256')
      .update(
        JSON.stringify({
          kind,
          format,
          branchId,
          documentTypeId,
          categoryId,
          requestId,
          orderId,
          query,
          branding,
        }),
      )
      .digest('hex');
    const where = {
      actorUserId_idempotencyKey: { actorUserId: actor.userId, idempotencyKey },
    };
    const existing = await this.database.client.procurementExportJob.findUnique(
      { where },
    );
    if (existing) {
      requireRule(
        existing.requestHash === requestHash,
        'IDEMPOTENCY_CONFLICT',
        'کلید خروجی قبلاً برای ورودی دیگری استفاده شده است.',
      );
      return dto(existing);
    }
    try {
      return dto(
        await this.database.client.procurementExportJob.create({
          data: {
            actorUserId: actor.userId,
            branchId,
            requestId,
            idempotencyKey,
            requestHash,
            kind,
            format,
            payloadJson: json({
              sessionId: actor.sessionId,
              query,
              orderId,
              documentTypeId,
              categoryId,
              branding,
            }),
          },
        }),
      );
    } catch (error) {
      if (
        error instanceof Prisma.PrismaClientKnownRequestError &&
        error.code === 'P2002'
      ) {
        const replay =
          await this.database.client.procurementExportJob.findUniqueOrThrow({
            where,
          });
        requireRule(
          replay.requestHash === requestHash,
          'IDEMPOTENCY_CONFLICT',
          'کلید خروجی برای ورودی دیگری استفاده شده است.',
        );
        return dto(replay);
      }
      throw error;
    }
  }
  async list(query: Record<string, unknown>, actor: AuthenticatedActor) {
    this.authorize(actor);
    v.object(query, ['page']);
    const page = v.integer(Number(query.page ?? 1), 'page', 100000);
    const jobs = await this.database.client.procurementExportJob.findMany({
      where: { actorUserId: actor.userId, branchId: { in: actor.branchIds } },
      orderBy: [{ createdAt: 'desc' }, { id: 'desc' }],
      take: 51,
      skip: (page - 1) * 50,
    });
    return {
      items: jobs.slice(0, 50).map(dto),
      page,
      pageSize: 50,
      hasMore: jobs.length > 50,
    };
  }
  async detail(id: string, actor: AuthenticatedActor) {
    this.authorize(actor);
    const job = await this.database.client.procurementExportJob.findFirst({
      where: {
        id: v.uuid(id),
        actorUserId: actor.userId,
        branchId: { in: actor.branchIds },
      },
    });
    if (!job) throw new NotFoundException('خروجی پیدا نشد.');
    return dto(job);
  }
  async tick() {
    if (this.running) return;
    this.running = true;
    try {
      const job = await this.database.client.procurementExportJob.findFirst({
        where: {
          OR: [
            { status: 'QUEUED' },
            { status: 'RUNNING', leaseUntil: { lt: new Date() } },
          ],
        },
        orderBy: [{ createdAt: 'asc' }, { id: 'asc' }],
      });
      if (!job) return;
      const claim = await this.database.client.procurementExportJob.updateMany({
        where: { id: job.id, version: job.version },
        data: {
          status: 'RUNNING',
          version: { increment: 1 },
          attempts: { increment: 1 },
          leaseUntil: new Date(Date.now() + 600000),
        },
      });
      if (claim.count !== 1) return;
      try {
        requireRule(
          job.attempts < 3,
          'EXPORT_RETRY_EXHAUSTED',
          'تلاش‌های بازیابی خروجی پایان یافته است.',
        );
        const result = await this.perform(job);
        await this.database.client.procurementExportJob.updateMany({
          where: { id: job.id, version: job.version + 1 },
          data: {
            status: 'COMPLETED',
            resultJson: json(result),
            leaseUntil: null,
            errorCode: null,
          },
        });
      } catch (error) {
        const errorCode =
          error instanceof ProcurementRuleError
            ? error.code
            : error instanceof ForbiddenException
              ? 'FORBIDDEN'
              : 'EXPORT_OR_DOCUMENTS_UNAVAILABLE';
        await this.database.client.procurementExportJob.updateMany({
          where: { id: job.id, version: job.version + 1 },
          data: { status: 'FAILED', leaseUntil: null, errorCode },
        });
      }
    } catch {
      /* Database unavailable: durable queued rows remain recoverable, no secret logging. */
    } finally {
      this.running = false;
    }
  }
  private async perform(job: Job) {
    const payload = v.object(job.payloadJson);
    const current = await this.iam.actorForSession(
      job.actorUserId,
      String(payload.sessionId),
    );
    requireRule(current, 'EXPORT_SESSION_EXPIRED', 'نشست خروجی معتبر نیست.');
    this.authorize(current, job.branchId);
    const actor = { ...current, branchIds: [job.branchId] };
    const query = v.object(payload.query);
    if (job.requestId) await this.procurement.detail(job.requestId, actor);
    else await this.procurement.list({ page: 1 }, actor);
    // Recover upload-after-crash by the exact Documents source, not a fuzzy filename.
    const archived = await this.documents.list(
      {
        sourceModule: 'PROCUREMENT',
        sourceEntityType: 'ProcurementExportJob',
        sourceEntityId: job.id,
        branchId: job.branchId,
        page: 1,
        pageSize: 10,
      },
      actor,
    );
    requireRule(
      archived.meta.total <= 1,
      'EXPORT_ARCHIVE_CONFLICT',
      'بیش از یک سند برای این کار خروجی پیدا شد.',
    );
    if (archived.data[0]) {
      const saved = await this.documents.detail(archived.data[0].id, actor, {});
      const version = saved.data.versions[0];
      requireRule(
        version,
        'DOCUMENTS_UNAVAILABLE',
        'نسخه فایل بایگانی موجود نیست.',
      );
      return {
        documentId: saved.data.id,
        versionId: version.id,
        scanStatus: version.scanStatus,
        branding: payload.branding,
      };
    }
    const table: ProcurementExportTable = {
      title: job.kind === 'ORDER' ? 'سفارش خرید' : 'گزارش خرید و تأمین',
      headings: [],
      rows: [],
      notes: [
        `زمان درخواست خروجی: ${new Intl.DateTimeFormat('fa-IR', { dateStyle: 'medium', timeStyle: 'short', timeZone: 'Asia/Tehran' }).format(job.createdAt)} (تهران)`,
        'مبالغ هر ارز مستقل‌اند؛ پرداخت و مانده مالی در این گزارش محاسبه نمی‌شود.',
      ],
    };
    if (job.kind === 'REQUESTS') {
      table.headings = [
        'شماره',
        'عنوان',
        'وضعیت',
        'نسخه',
        'واحد',
        'دسته',
        'مبلغ تخمینی',
        'ارز',
      ];
      for (let page = 1; page <= 2000; page++) {
        const result = await this.procurement.list({ ...query, page }, actor);
        table.rows.push(
          ...result.items.map((row) => [
            row.number,
            row.draft.title,
            requestStatusLabels[row.status] ?? row.status,
            String(row.version),
            row.draft.unitId ?? '',
            row.draft.category,
            row.draft.estimatedAmount ?? '',
            row.draft.currencyCode ?? '',
          ]),
        );
        if (!result.hasMore) break;
        requireRule(
          page < 2000,
          'EXPORT_LIMIT_EXCEEDED',
          'خروجی را با فیلتر محدودتر درخواست کنید.',
        );
      }
    } else if (job.kind === 'REPORT') {
      table.headings = ['گروه', 'ارز', 'لغوشده', 'تعداد سفارش', 'مبلغ'];
      for (let page = 1; page <= 2000; page++) {
        const report = await this.procurement.report({ ...query, page }, actor);
        table.rows.push(
          ...report.groups.items.map((row) => [
            row.label ?? 'تعیین نشده',
            row.currencyCode,
            row.cancelled ? 'بله' : 'خیر',
            String(row.count),
            row.amount,
          ]),
        );
        if (page === 1) {
          const performance = report.performance;
          if (performance)
            table.notes.push(
              `سفارش‌های صادرشده یا بسته‌شده: ${performance.orders}؛ دیرکرددار: ${performance.lateOrders}؛ دارای مغایرت: ${performance.discrepancyOrders}؛ تحویل کامل: ${performance.completedOrders}؛ تحویل به‌موقع: ${performance.onTimeOrders}`,
              `میانگین زمان تأیید (ثانیه): ${performance.approvalSeconds ?? 'داده کافی نیست'}؛ میانگین زمان تأمین (ثانیه): ${performance.supplySeconds ?? 'داده کافی نیست'}`,
            );
          table.notes.push(
            `وضعیت درخواست‌ها: ${report.counts.map((row) => `${requestStatusLabels[row.status] ?? row.status}: ${row.count}`).join('؛ ')}`,
          );
        }
        if (!report.groups.hasMore) break;
        requireRule(
          page < 2000,
          'EXPORT_LIMIT_EXCEEDED',
          'خروجی را محدودتر کنید.',
        );
      }
    } else {
      const order = await this.database.client.procurementOrder.findFirst({
        where: { id: String(payload.orderId), requestId: job.requestId! },
      });
      requireRule(
        order && ['ISSUED', 'CLOSED'].includes(order.status),
        'FINAL_APPROVAL_REQUIRED',
        'فقط نسخه صادرشده سفارش قابل تولید است.',
      );
      const version =
        await this.database.client.procurementOrderVersion.findUniqueOrThrow({
          where: {
            orderId_version: { orderId: order.id, version: order.version },
          },
        });
      const lines = await this.database.client.procurementOrderItem.findMany({
        where: { orderVersionId: version.id },
        take: 101,
      });
      requireRule(
        lines.length <= 100,
        'EXPORT_LIMIT_EXCEEDED',
        'تعداد اقلام سفارش نامعتبر است.',
      );
      table.notes.push(
        `شماره ${order.number} — نسخه ${order.version} — ارز ${order.currencyCode} — مبلغ ${order.totalAmount.toString()}`,
      );
      table.headings = [
        'شرح',
        'مقدار',
        'قیمت واحد',
        'تخفیف',
        'مالیات',
        'هزینه جانبی',
        'جمع',
      ];
      table.rows = lines.map((line) => [
        String(v.object(line.data).description ?? ''),
        line.quantity.toString(),
        line.unitPrice.toString(),
        line.discountAmount.toString(),
        line.taxAmount.toString(),
        line.extraCostAmount.toString(),
        line.totalAmount.toString(),
      ]);
    }
    const branding = payload.branding ? v.object(payload.branding) : null;
    const buffer =
      job.format === 'PDF'
        ? await renderProcurementPdf(table, String(branding?.persianName ?? ''))
        : renderProcurementXlsx(table);
    requireRule(
      buffer.length <= 20 * 1024 * 1024,
      'EXPORT_LIMIT_EXCEEDED',
      'فایل خروجی از سقف بایگانی بزرگ‌تر است.',
    );
    const file = await this.documents.upload(
      {
        title: `خروجی خرید ${job.id}`,
        documentTypeId: String(payload.documentTypeId),
        categoryId: String(payload.categoryId),
        branchId: job.branchId,
        ownerUserId: actor.userId,
        sourceModule: 'PROCUREMENT',
        sourceEntityType: 'ProcurementExportJob',
        sourceEntityId: job.id,
        sourceDisplayLabel: table.title,
        versionNote: `Procurement v1; job=${job.id}; issuerVersion=${String(branding?.version ?? '')}`,
      },
      {
        buffer,
        size: buffer.length,
        originalname: `procurement-${job.id}.${job.format.toLowerCase()}`,
        mimetype:
          job.format === 'PDF' ? 'application/pdf' : PROCUREMENT_XLSX_MIME,
      },
      actor,
      {},
    );
    const version = file.data.versions[0];
    requireRule(
      version,
      'DOCUMENTS_UNAVAILABLE',
      'نسخه فایل تولیدشده موجود نیست.',
    );
    return {
      documentId: file.data.id,
      versionId: version.id,
      scanStatus: version.scanStatus,
      branding,
    };
  }
}
