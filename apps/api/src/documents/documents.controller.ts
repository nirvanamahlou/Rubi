import {
  Body,
  Controller,
  Delete,
  Get,
  Header,
  Headers,
  HttpCode,
  Inject,
  Param,
  Patch,
  Post,
  Query,
  Req,
  StreamableFile,
  UploadedFile,
  UseGuards,
  UseInterceptors,
} from '@nestjs/common';
import { FileInterceptor } from '@nestjs/platform-express';
import { ApiBody, ApiConsumes, ApiCookieAuth, ApiTags } from '@nestjs/swagger';
import type {
  DocumentCaseOptionsQueryV1,
  DocumentListQueryV1,
} from '@rubi/contracts';

import { AuthGuard } from '../iam/auth.guard';
import { RequirePermissions } from '../iam/iam.decorators';
import type { AuthenticatedRequest } from '../iam/iam.types';
import { PermissionGuard } from '../iam/permission.guard';
// Runtime imports are required for Nest validation metadata.
// eslint-disable-next-line @typescript-eslint/consistent-type-imports
import {
  DocumentArchiveActionDto,
  DocumentBulkActionDto,
  DocumentCaseOptionsQueryDto,
  DocumentDeleteDto,
  DocumentListQueryDto,
  DocumentUpdateDto,
  DocumentUploadDto,
} from './documents.dto';
import {
  type DocumentRequestMetadata,
  DocumentsService,
  type UploadedDocumentFile,
} from './documents.service';
import { MAX_DOCUMENT_SIZE_BYTES } from './documents.validation';

function requestMetadata(
  request: AuthenticatedRequest,
  sensitiveReason?: string,
): DocumentRequestMetadata {
  const userAgent = request.headers['user-agent'];
  let decodedSensitiveReason = sensitiveReason;
  if (sensitiveReason) {
    try {
      decodedSensitiveReason = decodeURIComponent(sensitiveReason);
    } catch {
      decodedSensitiveReason = sensitiveReason;
    }
  }
  return {
    ...(request.ip ? { ipAddress: request.ip } : {}),
    ...(userAgent
      ? { userAgent: Array.isArray(userAgent) ? userAgent[0] : userAgent }
      : {}),
    ...(decodedSensitiveReason
      ? { sensitiveReason: decodedSensitiveReason }
      : {}),
  };
}

@ApiTags('Documents')
@ApiCookieAuth('rubi_access')
@UseGuards(AuthGuard, PermissionGuard)
@Controller('documents')
export class DocumentsController {
  constructor(
    @Inject(DocumentsService) private readonly service: DocumentsService,
  ) {}

  @Get()
  @Header('Cache-Control', 'private, no-store')
  @Header('Vary', 'Cookie')
  @RequirePermissions('documents.list')
  list(
    @Query() query: DocumentListQueryDto,
    @Req() request: AuthenticatedRequest,
  ) {
    return this.service.list(query as DocumentListQueryV1, request.actor);
  }

  @Get('options')
  @Header('Cache-Control', 'private, no-store')
  @Header('Vary', 'Cookie')
  @RequirePermissions('documents.list')
  options(@Req() request: AuthenticatedRequest) {
    return this.service.options(request.actor);
  }

  @Get('case-options')
  @Header('Cache-Control', 'private, no-store')
  @Header('Vary', 'Cookie')
  @RequirePermissions('documents.list')
  caseOptions(
    @Query() query: DocumentCaseOptionsQueryDto,
    @Req() request: AuthenticatedRequest,
  ) {
    return this.service.caseOptions(
      query as DocumentCaseOptionsQueryV1,
      request.actor,
    );
  }

  @Post('upload')
  @ApiConsumes('multipart/form-data')
  @ApiBody({
    schema: {
      type: 'object',
      required: [
        'file',
        'title',
        'documentTypeId',
        'categoryId',
        'branchId',
        'ownerUserId',
      ],
      oneOf: [
        { required: ['sourceRelationId'] },
        {
          required: [
            'sourceModule',
            'sourceEntityType',
            'sourceEntityId',
            'sourceDisplayLabel',
          ],
        },
      ],
      properties: {
        file: { type: 'string', format: 'binary' },
        title: { type: 'string' },
        documentTypeId: { type: 'string', format: 'uuid' },
        categoryId: { type: 'string', format: 'uuid' },
        branchId: { type: 'string', format: 'uuid' },
        ownerUserId: { type: 'string', format: 'uuid' },
        sourceRelationId: {
          type: 'string',
          format: 'uuid',
          description: 'شناسه داخلی پرونده انتخاب‌شده از case-options',
        },
        sourceModule: { type: 'string', description: 'Legacy fallback' },
        sourceEntityType: { type: 'string', description: 'Legacy fallback' },
        sourceEntityId: { type: 'string', description: 'Legacy fallback' },
        sourceDisplayLabel: {
          type: 'string',
          description: 'Legacy fallback',
        },
      },
    },
  })
  @UseInterceptors(
    FileInterceptor('file', {
      limits: { files: 1, fileSize: MAX_DOCUMENT_SIZE_BYTES },
    }),
  )
  @RequirePermissions('documents.upload')
  upload(
    @Body() dto: DocumentUploadDto,
    @UploadedFile() file: UploadedDocumentFile | undefined,
    @Req() request: AuthenticatedRequest,
  ) {
    return this.service.upload(
      dto,
      file,
      request.actor,
      requestMetadata(request),
    );
  }

  @Post('bulk')
  @RequirePermissions('documents.list')
  bulk(
    @Body() dto: DocumentBulkActionDto,
    @Req() request: AuthenticatedRequest,
  ) {
    return this.service.bulk(dto, request.actor, requestMetadata(request));
  }

  @Patch(':id')
  @RequirePermissions('documents.metadata.update')
  update(
    @Param('id') id: string,
    @Body() dto: DocumentUpdateDto,
    @Req() request: AuthenticatedRequest,
  ) {
    return this.service.update(
      id,
      dto,
      request.actor,
      requestMetadata(request),
    );
  }

  @Post(':id/archive')
  @RequirePermissions('documents.delete')
  archive(
    @Param('id') id: string,
    @Body() dto: DocumentArchiveActionDto,
    @Req() request: AuthenticatedRequest,
  ) {
    return this.service.archive(
      id,
      dto,
      request.actor,
      requestMetadata(request),
    );
  }

  @Post(':id/restore')
  @RequirePermissions('documents.restore')
  restore(
    @Param('id') id: string,
    @Body() dto: DocumentArchiveActionDto,
    @Req() request: AuthenticatedRequest,
  ) {
    return this.service.restore(
      id,
      dto,
      request.actor,
      requestMetadata(request),
    );
  }

  @Delete(':id')
  @HttpCode(204)
  @RequirePermissions('documents.delete')
  async permanentlyDelete(
    @Param('id') id: string,
    @Body() dto: DocumentDeleteDto,
    @Req() request: AuthenticatedRequest,
  ) {
    await this.service.permanentlyDelete(id, dto, request.actor);
  }

  @Get(':id/audit')
  @Header('Cache-Control', 'private, no-store')
  @Header('Vary', 'Cookie')
  @RequirePermissions('documents.audit.read')
  audit(@Param('id') id: string, @Req() request: AuthenticatedRequest) {
    return this.service.audit(id, request.actor);
  }

  @Get(':id/download')
  @Header('Cache-Control', 'private, no-store')
  @Header('Vary', 'Cookie')
  @RequirePermissions(
    'documents.metadata.read',
    'documents.file.read',
    'documents.download',
  )
  async download(
    @Param('id') id: string,
    @Req() request: AuthenticatedRequest,
    @Headers('x-sensitive-read-reason') sensitiveReason?: string,
  ) {
    const result = await this.service.download(
      id,
      request.actor,
      requestMetadata(request, sensitiveReason),
    );
    return new StreamableFile(result.stream, {
      type: result.mimeType,
      length: result.sizeBytes,
      disposition: `attachment; filename*=UTF-8''${encodeURIComponent(result.fileName)}`,
    });
  }

  @Get(':id/preview')
  @Header('Cache-Control', 'private, no-store')
  @Header('Vary', 'Cookie')
  @Header('X-Content-Type-Options', 'nosniff')
  @RequirePermissions('documents.metadata.read', 'documents.file.read')
  async preview(
    @Param('id') id: string,
    @Req() request: AuthenticatedRequest,
    @Headers('x-sensitive-read-reason') sensitiveReason?: string,
  ) {
    const result = await this.service.preview(
      id,
      request.actor,
      requestMetadata(request, sensitiveReason),
    );
    return new StreamableFile(result.stream, {
      type: result.mimeType,
      length: result.sizeBytes,
      disposition: `inline; filename*=UTF-8''${encodeURIComponent(result.fileName)}`,
    });
  }

  @Get(':id')
  @Header('Cache-Control', 'private, no-store')
  @Header('Vary', 'Cookie')
  @RequirePermissions('documents.metadata.read')
  detail(
    @Param('id') id: string,
    @Req() request: AuthenticatedRequest,
    @Headers('x-sensitive-read-reason') sensitiveReason?: string,
  ) {
    return this.service.detail(
      id,
      request.actor,
      requestMetadata(request, sensitiveReason),
    );
  }
}
