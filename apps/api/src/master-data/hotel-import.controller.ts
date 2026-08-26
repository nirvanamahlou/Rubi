import {
  Body,
  Controller,
  Headers,
  Inject,
  Param,
  ParseUUIDPipe,
  Post,
  Req,
  UploadedFile,
  UseGuards,
  UseInterceptors,
} from '@nestjs/common';
import { FileInterceptor } from '@nestjs/platform-express';
import { ApiConsumes, ApiCookieAuth, ApiTags } from '@nestjs/swagger';

import { AuthGuard } from '../iam/auth.guard';
import { RequirePermissions } from '../iam/iam.decorators';
import { PermissionGuard } from '../iam/permission.guard';
import type { AuthenticatedRequest } from '../iam/iam.types';
// Runtime imports are required for Nest emitDecoratorMetadata and ValidationPipe.
import { // eslint-disable-line @typescript-eslint/consistent-type-imports
  HotelImportCommitDto,
  HotelImportPreviewDto,
} from './hotel-import.dto';
import { HOTEL_IMPORT_MIME } from './hotel-import.parser';
import { HotelImportService } from './hotel-import.service';

interface UploadedWorkbook {
  buffer: Buffer;
  originalname: string;
  mimetype: string;
  size: number;
}

@ApiTags('Master Data Hotel Import')
@ApiCookieAuth('rubi_access')
@UseGuards(AuthGuard, PermissionGuard)
@Controller('master-data/hotel-imports')
export class HotelImportController {
  constructor(
    @Inject(HotelImportService) private readonly service: HotelImportService,
  ) {}

  @Post('preview')
  @RequirePermissions('master_data.import')
  @ApiConsumes('multipart/form-data')
  @UseInterceptors(
    FileInterceptor('file', {
      limits: { fileSize: 5 * 1024 * 1024, files: 1, fields: 5 },
      fileFilter: (_request, file, callback) => {
        const accepted =
          file.mimetype === HOTEL_IMPORT_MIME &&
          /\.xlsx$/i.test(file.originalname);
        callback(
          accepted ? null : new Error('Only .xlsx is accepted.'),
          accepted,
        );
      },
    }),
  )
  preview(
    @UploadedFile() file: UploadedWorkbook,
    @Body() dto: HotelImportPreviewDto,
    @Req() request: AuthenticatedRequest,
    @Headers('x-branch-id') branchId?: string,
    @Headers('x-trace-id') traceId?: string,
  ) {
    return this.service.preview(file, dto, request.actor, branchId, traceId);
  }

  @Post(':sessionId/commit')
  @RequirePermissions('master_data.import')
  commit(
    @Param('sessionId', new ParseUUIDPipe({ version: '4' })) sessionId: string,
    @Body() dto: HotelImportCommitDto,
    @Req() request: AuthenticatedRequest,
    @Headers('x-branch-id') branchId?: string,
    @Headers('x-trace-id') traceId?: string,
  ) {
    return this.service.commit(
      sessionId,
      dto,
      request.actor,
      branchId,
      traceId,
    );
  }
}
