import {
  BadRequestException,
  ConflictException,
  ForbiddenException,
  Inject,
  Injectable,
  NotFoundException,
} from '@nestjs/common';
import type {
  AuthenticatedActor,
  WorkbenchDailyPackagesResponseV1,
} from '@nora/contracts';
import { DocumentsRepository } from './documents.repository';
import { DocumentsDailyPackagesRepository } from './documents-daily-packages.repository';
import {
  DocumentsService,
  type DocumentRequestMetadata,
  type UploadedDocumentFile,
} from './documents.service';

const sourceModule = 'WORKBENCH';
const sourceEntityType = 'WorkbenchDailyPackage';

// These grants are used only after fixing the branch, source and confidentiality
// in this boundary. They never alter the account or its general archive access.
function packageActor(actor: AuthenticatedActor): AuthenticatedActor {
  return {
    ...actor,
    permissions: [
      ...new Set<AuthenticatedActor['permissions'][number]>([
        ...actor.permissions,
        'documents.brand.read',
        'documents.file.read',
        'documents.download',
      ]),
    ],
  };
}

export function dailyPackageDateRange(day?: string) {
  const value =
    day ??
    new Intl.DateTimeFormat('en-CA', {
      timeZone: 'Asia/Tehran',
      year: 'numeric',
      month: '2-digit',
      day: '2-digit',
    }).format(new Date());
  if (!/^\d{4}-\d{2}-\d{2}$/.test(value))
    throw new BadRequestException('تاریخ پکیج معتبر نیست.');
  const utc = new Date(`${value}T00:00:00.000Z`);
  if (Number.isNaN(utc.getTime()) || utc.toISOString().slice(0, 10) !== value)
    throw new BadRequestException('تاریخ پکیج معتبر نیست.');
  const start = new Date(`${value}T00:00:00.000+03:30`);
  return {
    from: start,
    to: new Date(start.getTime() + 86_400_000),
  };
}

@Injectable()
export class DocumentsDailyPackagesService {
  constructor(
    @Inject(DocumentsRepository)
    private readonly repository: DocumentsRepository,
    @Inject(DocumentsService) private readonly documents: DocumentsService,
    @Inject(DocumentsDailyPackagesRepository)
    private readonly dailyPackages: DocumentsDailyPackagesRepository,
  ) {}

  private assertBranch(branchId: string, actor: AuthenticatedActor) {
    if (!actor.branchIds.includes(branchId))
      throw new ForbiddenException('شعبه پکیج خارج از دسترسی شما است.');
  }

  async options(actor: AuthenticatedActor) {
    const values = await this.repository.options(actor.branchIds, ['BRAND']);
    return { data: values.branches };
  }

  async list(
    input: { branchId: string; date?: string; page?: number },
    actor: AuthenticatedActor,
  ): Promise<WorkbenchDailyPackagesResponseV1> {
    this.assertBranch(input.branchId, actor);
    const page = Math.max(1, input.page ?? 1),
      pageSize = 12;
    const result = await this.dailyPackages.list({
      branchId: input.branchId,
      ...dailyPackageDateRange(input.date),
      page,
      pageSize,
    });
    return {
      data: result.rows.map((row) => ({
        id: row.id,
        title: row.title,
        branchId: row.branchId,
        authorName: row.owner.displayName,
        createdAt: row.createdAt.toISOString(),
        scanStatus: row.currentVersion!.scanStatus,
      })),
      meta: {
        page,
        pageSize,
        total: result.total,
        totalPages: Math.max(1, Math.ceil(result.total / pageSize)),
      },
    };
  }

  async publish(
    input: { branchId: string; title: string },
    file: UploadedDocumentFile | undefined,
    actor: AuthenticatedActor,
    metadata: DocumentRequestMetadata,
  ) {
    this.assertBranch(input.branchId, actor);
    if (!input.title.trim())
      throw new BadRequestException('عنوان پکیج الزامی است.');
    if (!file || file.mimetype !== 'application/pdf')
      throw new BadRequestException('خروجی پکیج باید PDF باشد.');
    if (file.size < 1 || file.size > 25 * 1024 * 1024)
      throw new BadRequestException('حجم پکیج باید حداکثر ۲۵ مگابایت باشد.');
    const values = await this.repository.options([input.branchId], ['BRAND']);
    const type = values.documentTypes.find(
      (item) => item.code === 'BRAND_ASSET_TEMPLATE',
    );
    const category = values.categories.find(
      (item) => item.code === 'BRAND_ASSETS',
    );
    if (!type || !category)
      throw new ConflictException('نوع سند پکیج در آرشیو اسناد آماده نیست.');
    return this.documents.upload(
      {
        title: input.title.trim(),
        description: 'خروجی پک جنریتور برای پکیج‌های روز',
        documentTypeId: type.id,
        categoryId: category.id,
        branchId: input.branchId,
        ownerUserId: actor.userId,
        confidentiality: 'INTERNAL',
        sourceModule,
        sourceEntityType,
        sourceEntityId: input.branchId,
        sourceDisplayLabel: input.title.trim(),
      },
      file,
      packageActor(actor),
      metadata,
    );
  }

  async file(
    id: string,
    actor: AuthenticatedActor,
    metadata: DocumentRequestMetadata,
  ) {
    const row = await this.repository.findDetail(
      id,
      actor.branchIds,
      false,
      actor.userId,
    );
    if (
      !row ||
      row.sourceModule !== sourceModule ||
      row.sourceEntityType !== sourceEntityType ||
      row.sourceEntityId !== row.branchId ||
      !actor.branchIds.includes(row.branchId) ||
      row.confidentiality !== 'INTERNAL' ||
      row.documentType.code !== 'BRAND_ASSET_TEMPLATE' ||
      row.confidentialAccessCodeHash ||
      row.requiresStepUpVerification ||
      row.currentVersion?.detectedMimeType !== 'application/pdf'
    )
      throw new NotFoundException('پکیج پیدا نشد.');
    // Standard delivery retains the CLEAN scan, archive, step-up and audit gates.
    return this.documents.download(id, packageActor(actor), metadata, {
      sourceModule,
      sourceEntityType,
      sourceEntityId: row.branchId,
    });
  }
}
