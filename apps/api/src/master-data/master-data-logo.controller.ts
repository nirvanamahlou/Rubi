import {
  Body,
  Controller,
  Delete,
  Headers,
  HttpCode,
  Inject,
  Param,
  Post,
  Req,
  UploadedFile,
  UseGuards,
  UseInterceptors,
} from '@nestjs/common';
import { FileInterceptor } from '@nestjs/platform-express';
import { ApiBody, ApiConsumes, ApiCookieAuth, ApiTags } from '@nestjs/swagger';

import type {
  DocumentRequestMetadata,
  UploadedDocumentFile,
} from '../documents/documents.service';
import { AuthGuard } from '../iam/auth.guard';
import { RequirePermissions } from '../iam/iam.decorators';
import type { AuthenticatedRequest } from '../iam/iam.types';
import { PermissionGuard } from '../iam/permission.guard';
// Runtime imports are required for Nest validation metadata.
// eslint-disable-next-line @typescript-eslint/consistent-type-imports
import {
  MasterDataLogoRemoveDto,
  MasterDataLogoUploadDto,
} from './master-data.dto';
import { MasterDataLogoService } from './master-data-logo.service';

function requestMetadata(
  request: AuthenticatedRequest,
): DocumentRequestMetadata {
  const userAgent = request.headers['user-agent'];
  return {
    ...(request.ip ? { ipAddress: request.ip } : {}),
    ...(userAgent
      ? { userAgent: Array.isArray(userAgent) ? userAgent[0] : userAgent }
      : {}),
  };
}

@ApiTags('Master Data')
@ApiCookieAuth('rubi_access')
@UseGuards(AuthGuard, PermissionGuard)
@Controller('master-data')
export class MasterDataLogoController {
  constructor(
    @Inject(MasterDataLogoService)
    private readonly logos: MasterDataLogoService,
  ) {}

  @Post(':resource/:id/logo')
  @ApiConsumes('multipart/form-data')
  @ApiBody({
    schema: {
      type: 'object',
      required: ['file', 'title', 'version'],
      properties: {
        file: { type: 'string', format: 'binary' },
        title: { type: 'string', maxLength: 240 },
        version: { type: 'integer', minimum: 1 },
      },
    },
  })
  @UseInterceptors(
    FileInterceptor('file', {
      limits: { files: 1, fileSize: 5 * 1024 * 1024 },
    }),
  )
  @RequirePermissions('master_data.update')
  replace(
    @Param('resource') resource: string,
    @Param('id') id: string,
    @Body() dto: MasterDataLogoUploadDto,
    @UploadedFile() file: UploadedDocumentFile | undefined,
    @Req() request: AuthenticatedRequest,
    @Headers('x-branch-id') branchId?: string,
  ) {
    return this.logos.replace(
      resource,
      id,
      dto,
      file,
      request.actor,
      requestMetadata(request),
      branchId,
    );
  }

  @Delete(':resource/:id/logo')
  @HttpCode(200)
  @RequirePermissions('master_data.update')
  remove(
    @Param('resource') resource: string,
    @Param('id') id: string,
    @Body() dto: MasterDataLogoRemoveDto,
    @Req() request: AuthenticatedRequest,
    @Headers('x-branch-id') branchId?: string,
  ) {
    return this.logos.remove(
      resource,
      id,
      dto.version,
      request.actor,
      requestMetadata(request),
      branchId,
    );
  }
}
