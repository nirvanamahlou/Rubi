import {
  BadRequestException,
  Controller,
  Get,
  Inject,
  Injectable,
  Param,
  ParseUUIDPipe,
  Post,
  Query,
  Req,
  StreamableFile,
  UploadedFile,
  UseGuards,
  UseInterceptors,
  Header,
} from '@nestjs/common';
import { FileInterceptor } from '@nestjs/platform-express';
import type { AuthenticatedActor } from '@nora/contracts';
import { AuthGuard } from '../iam/auth.guard';
import type { AuthenticatedRequest } from '../iam/iam.types';
import {
  DocumentsService,
  type UploadedDocumentFile,
  type DocumentRequestMetadata,
} from '../documents/documents.service';
import { SalesService } from './sales.service';

const receiptPermissions: AuthenticatedActor['permissions'] = [
  'documents.list',
  'documents.metadata.read',
  'documents.file.read',
  'documents.upload',
  'documents.download',
  'documents.sensitive.read',
  'documents.sensitive.download',
  'documents.finance.read',
];

@Injectable()
export class SalesPaymentReceiptsService {
  constructor(
    @Inject(SalesService) private readonly sales: SalesService,
    @Inject(DocumentsService) private readonly documents: DocumentsService,
  ) {}
  private async context(
    id: string,
    paymentId: string,
    actor: AuthenticatedActor,
  ) {
    const scope = await this.sales.paymentReceiptScope(id, actor, paymentId);
    // Request-local capabilities: source IDs and branch are fixed after Sales authorization.
    const scoped: AuthenticatedActor = {
      ...actor,
      branchIds: [scope.branchId],
      permissions: [...new Set([...actor.permissions, ...receiptPermissions])],
    };
    return {
      scope,
      actor: scoped,
      source: {
        sourceModule: 'sales',
        sourceEntityType: 'SalesContractPaymentEntry',
        sourceEntityId: paymentId,
      },
    };
  }
  async entries(id: string, actor: AuthenticatedActor) {
    return { data: (await this.sales.paymentReceiptScope(id, actor)).entries };
  }
  async options(id: string, paymentId: string, actor: AuthenticatedActor) {
    const c = await this.context(id, paymentId, actor);
    const result = await this.documents.options(c.actor);
    return {
      data: {
        ...result.data,
        branches: result.data.branches.filter((b) => b.id === c.scope.branchId),
        owners: result.data.owners.filter((o) => o.id === actor.userId),
        organizationBranches: [],
        documentTypes: result.data.documentTypes.filter(
          (t) =>
            t.code === 'RECEIPT' && t.domain === 'FINANCE' && !t.requiresExpiry,
        ),
        categories: result.data.categories.filter(
          (t) => t.code === 'PROCUREMENT_FINANCE',
        ),
      },
    };
  }
  async list(
    id: string,
    paymentId: string,
    actor: AuthenticatedActor,
    page = 1,
  ) {
    const c = await this.context(id, paymentId, actor);
    if (!Number.isInteger(page) || page < 1 || page > 10000)
      throw new BadRequestException('صفحه معتبر نیست.');
    return this.documents.list(
      {
        ...c.source,
        branchId: c.scope.branchId,
        page,
        pageSize: 100,
        sortBy: 'createdAt',
        sortDirection: 'desc',
      },
      c.actor,
    );
  }
  async upload(
    id: string,
    paymentId: string,
    file: UploadedDocumentFile | undefined,
    actor: AuthenticatedActor,
    metadata: DocumentRequestMetadata,
  ) {
    const c = await this.context(id, paymentId, actor);
    if (
      !file ||
      !['application/pdf', 'image/jpeg', 'image/png'].includes(file.mimetype)
    )
      throw new BadRequestException(
        'مدرک باید PDF، JPG یا PNG و در محدودهٔ حجم مجاز باشد.',
      );
    const { data: options } = await this.documents.options(c.actor);
    const type = options.documentTypes.find(
        (t) =>
          t.code === 'RECEIPT' && t.domain === 'FINANCE' && !t.requiresExpiry,
      ),
      category = options.categories.find(
        (t) => t.code === 'PROCUREMENT_FINANCE',
      );
    const owner =
      options.owners.find((o) => o.id === actor.userId) ??
      options.owners.find((o) => o.id === c.scope.ownerUserId);
    if (!type || !category || !owner)
      throw new BadRequestException(
        'دسترسی یا اطلاعات پایهٔ بارگذاری رسید مالی در این شعبه موجود نیست.',
      );
    return this.documents.upload(
      {
        title: 'مدرک پرداخت قرارداد ' + c.scope.contractNumber,
        documentTypeId: type.id,
        categoryId: category.id,
        branchId: c.scope.branchId,
        ownerUserId: owner.id,
        confidentiality: 'RESTRICTED',
        ...c.source,
        sourceDisplayLabel:
          'پرداخت ' + paymentId + ' / ' + c.scope.contractNumber,
      },
      file,
      c.actor,
      metadata,
    );
  }
  async download(
    id: string,
    paymentId: string,
    documentId: string,
    actor: AuthenticatedActor,
    metadata: DocumentRequestMetadata,
  ) {
    const c = await this.context(id, paymentId, actor);
    return this.documents.download(
      documentId,
      c.actor,
      {
        ...metadata,
        sensitiveReason: 'بررسی مدرک پرداخت قرارداد ' + c.scope.contractNumber,
      },
      c.source,
    );
  }
}
const metadata = (r: AuthenticatedRequest): DocumentRequestMetadata => ({
  ...(r.ip ? { ipAddress: r.ip } : {}),
  ...(r.headers['user-agent'] ? { userAgent: r.headers['user-agent'] } : {}),
});
@Controller('sales/contracts/:id')
@UseGuards(AuthGuard)
export class SalesPaymentReceiptsController {
  constructor(
    @Inject(SalesPaymentReceiptsService)
    private readonly service: SalesPaymentReceiptsService,
  ) {}
  @Get('receipt-payments')
  @Header('Cache-Control', 'private, no-store')
  entries(
    @Param('id', ParseUUIDPipe) id: string,
    @Req() r: AuthenticatedRequest,
  ) {
    return this.service.entries(id, r.actor);
  }
  @Get('payments/:paymentId/receipts/options')
  @Header('Cache-Control', 'private, no-store')
  options(
    @Param('id', ParseUUIDPipe) id: string,
    @Param('paymentId', ParseUUIDPipe) paymentId: string,
    @Req() r: AuthenticatedRequest,
  ) {
    return this.service.options(id, paymentId, r.actor);
  }
  @Get('payments/:paymentId/receipts')
  @Header('Cache-Control', 'private, no-store')
  list(
    @Param('id', ParseUUIDPipe) id: string,
    @Param('paymentId', ParseUUIDPipe) paymentId: string,
    @Req() r: AuthenticatedRequest,
    @Query('page') page?: string,
  ) {
    return this.service.list(
      id,
      paymentId,
      r.actor,
      page === undefined ? 1 : Number(page),
    );
  }
  @Post('payments/:paymentId/receipts')
  @Header('Cache-Control', 'private, no-store')
  @UseInterceptors(
    FileInterceptor('file', {
      limits: { files: 1, fileSize: 25 * 1024 * 1024, fields: 20 },
    }),
  )
  upload(
    @Param('id', ParseUUIDPipe) id: string,
    @Param('paymentId', ParseUUIDPipe) paymentId: string,
    @UploadedFile() file: UploadedDocumentFile | undefined,
    @Req() r: AuthenticatedRequest,
  ) {
    return this.service.upload(id, paymentId, file, r.actor, metadata(r));
  }
  @Get('payments/:paymentId/receipts/:documentId/download')
  @Header('Cache-Control', 'private, no-store')
  async download(
    @Param('id', ParseUUIDPipe) id: string,
    @Param('paymentId', ParseUUIDPipe) paymentId: string,
    @Param('documentId', ParseUUIDPipe) documentId: string,
    @Req() r: AuthenticatedRequest,
  ) {
    const result = await this.service.download(
      id,
      paymentId,
      documentId,
      r.actor,
      metadata(r),
    );
    return new StreamableFile(result.stream, {
      type: result.mimeType,
      length: result.sizeBytes,
      disposition: `attachment; filename*=UTF-8''${encodeURIComponent(result.fileName)}`,
    });
  }
}
