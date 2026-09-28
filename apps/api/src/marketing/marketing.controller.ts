import {
  BadRequestException,
  ConflictException,
  Body,
  Controller,
  Get,
  Header,
  Inject,
  Param,
  Post,
  Query,
  Req,
  Res,
  StreamableFile,
  UploadedFile,
  UseGuards,
  UseInterceptors,
} from '@nestjs/common';
import { FileInterceptor } from '@nestjs/platform-express';
import { ApiBody, ApiConsumes, ApiCookieAuth, ApiTags } from '@nestjs/swagger';
import {
  DocumentsService,
  type UploadedDocumentFile,
  type DocumentRequestMetadata,
} from '../documents/documents.service';
import { MAX_DOCUMENT_SIZE_BYTES } from '../documents/documents.validation';
import type { AuthenticatedRequest } from '../iam/iam.types';
// Runtime class import is required for Nest validation metadata.
// eslint-disable-next-line @typescript-eslint/consistent-type-imports
import { MarketingContentAssetUploadDto } from './marketing-content.dto';

import { AuthGuard } from '../iam/auth.guard';
import { RequirePermissions } from '../iam/iam.decorators';
import { PermissionGuard } from '../iam/permission.guard';
import { MarketingProcessService } from './marketing-process.service';

@ApiTags('Marketing')
@ApiCookieAuth('nora_access')
@UseGuards(AuthGuard, PermissionGuard)
@Controller('marketing')
export class MarketingController {
  constructor(
    @Inject(MarketingProcessService)
    private readonly processService: MarketingProcessService,
    @Inject(DocumentsService)
    private readonly documents: DocumentsService,
  ) {}

  @Get('process')
  @Header('Cache-Control', 'private, no-store')
  @Header('Vary', 'Cookie')
  @RequirePermissions('marketing.read', 'marketing.process.read')
  process() {
    return { data: this.processService.process() };
  }

  @Get('content/assets')
  @Header('Cache-Control', 'private, no-store')
  @RequirePermissions('marketing.read')
  listAssets(
    @Req() request: AuthenticatedRequest,
    @Query('page') page?: string,
  ) {
    return this.documents.listMarketingContentAssets(
      request.actor,
      page ? Number(page) : 1,
    );
  }

  @Get('content/assets/options')
  @Header('Cache-Control', 'private, no-store')
  @RequirePermissions('marketing.content.manage')
  async assetOptions(@Req() request: AuthenticatedRequest) {
    return {
      data: await this.documents.marketingContentAssetOptions(request.actor),
    };
  }

  @Post('content/assets')
  @ApiConsumes('multipart/form-data')
  @ApiBody({
    schema: {
      type: 'object',
      required: ['file', 'branchId', 'title', 'kind'],
      properties: {
        file: { type: 'string', format: 'binary' },
        branchId: { type: 'string', format: 'uuid' },
        title: { type: 'string' },
        description: { type: 'string' },
        kind: { type: 'string' },
      },
    },
  })
  @UseInterceptors(
    FileInterceptor('file', {
      limits: { files: 1, fileSize: MAX_DOCUMENT_SIZE_BYTES },
    }),
  )
  @RequirePermissions('marketing.content.manage')
  async uploadAsset(
    @Body() body: MarketingContentAssetUploadDto,
    @UploadedFile() file: UploadedDocumentFile | undefined,
    @Req() request: AuthenticatedRequest,
    @Res({ passthrough: true }) response: { status: (code: number) => void },
  ) {
    const extra = Object.keys(body).filter(
      (key) => !['branchId', 'title', 'description', 'kind'].includes(key),
    );
    if (extra.length)
      throw new BadRequestException('فیلدهای اضافی فایل مارکتینگ مجاز نیست.');
    const asset = await this.documents.uploadMarketingContentAsset(
      body,
      file,
      request.actor,
      this.metadata(request),
    );
    if (asset.scanStatus === 'CLEAN') response.status(201);
    else if (
      asset.scanStatus === 'PENDING_SCAN' ||
      asset.scanStatus === 'AWAITING_ANTIVIRUS_ADAPTER'
    )
      response.status(202);
    else
      throw new ConflictException({
        code: 'MARKETING_ASSET_SCAN_BLOCKED',
        message:
          'فایل در اسناد ثبت شد، اما بررسی امنیتی آن را مسدود کرد؛ فایل قابل دریافت نیست.',
        data: asset,
      });
    return { data: asset };
  }

  @Get('content/assets/:id')
  @Header('Cache-Control', 'private, no-store')
  @RequirePermissions('marketing.read')
  async asset(@Param('id') id: string, @Req() request: AuthenticatedRequest) {
    return {
      data: await this.documents.readMarketingContentAsset(id, request.actor),
    };
  }

  @Get('content/assets/:id/download')
  @Header('Cache-Control', 'private, no-store')
  @Header('X-Content-Type-Options', 'nosniff')
  @Header('Cross-Origin-Resource-Policy', 'same-origin')
  @RequirePermissions('marketing.read')
  async downloadAsset(
    @Param('id') id: string,
    @Req() request: AuthenticatedRequest,
  ) {
    const result = await this.documents.downloadMarketingContentAsset(
      id,
      request.actor,
      this.metadata(request),
    );
    return new StreamableFile(result.stream, {
      type: result.mimeType,
      length: result.sizeBytes,
      disposition: `attachment; filename*=UTF-8''${encodeURIComponent(result.fileName)}`,
    });
  }

  private metadata(request: AuthenticatedRequest): DocumentRequestMetadata {
    const userAgent = request.headers['user-agent'];
    return {
      ...(request.ip ? { ipAddress: request.ip } : {}),
      ...(userAgent
        ? { userAgent: Array.isArray(userAgent) ? userAgent[0] : userAgent }
        : {}),
    };
  }
}
