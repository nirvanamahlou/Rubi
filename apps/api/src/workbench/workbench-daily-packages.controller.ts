import {
  Body,
  Controller,
  Get,
  Header,
  Inject,
  Param,
  ParseUUIDPipe,
  Post,
  Query,
  Req,
  StreamableFile,
  UploadedFile,
  UseGuards,
  UseInterceptors,
} from '@nestjs/common';
import { FileInterceptor } from '@nestjs/platform-express';
import { ApiConsumes, ApiCookieAuth, ApiTags } from '@nestjs/swagger';
import { Type } from 'class-transformer';
import {
  IsInt,
  IsOptional,
  IsString,
  IsUUID,
  Length,
  Matches,
  Max,
  Min,
} from 'class-validator';
import { AuthGuard } from '../iam/auth.guard';
import type { AuthenticatedRequest } from '../iam/iam.types';
import { DocumentsDailyPackagesService } from '../documents/documents-daily-packages.service';
import type { UploadedDocumentFile } from '../documents/documents.service';

export class DailyPackageQueryDto {
  @IsUUID() branchId!: string;
  @IsOptional() @Matches(/^\d{4}-\d{2}-\d{2}$/) date?: string;
  @IsOptional() @Type(() => Number) @IsInt() @Min(1) @Max(100000) page?: number;
}
export class PublishDailyPackageDto {
  @IsUUID() branchId!: string;
  @IsString() @Length(1, 200) title!: string;
}
const metadata = (req: AuthenticatedRequest) => ({
  ...(req.ip ? { ipAddress: req.ip } : {}),
  userAgent: String(req.headers['user-agent'] ?? ''),
});

@ApiTags('Workbench')
@ApiCookieAuth('nora_access')
@UseGuards(AuthGuard)
@Controller('workbench/daily-packages')
export class WorkbenchDailyPackagesController {
  constructor(
    @Inject(DocumentsDailyPackagesService)
    private readonly packages: DocumentsDailyPackagesService,
  ) {}

  @Get('options')
  @Header('Cache-Control', 'private, no-store')
  options(@Req() req: AuthenticatedRequest) {
    return this.packages.options(req.actor);
  }

  @Get()
  @Header('Cache-Control', 'private, no-store')
  list(@Query() query: DailyPackageQueryDto, @Req() req: AuthenticatedRequest) {
    return this.packages.list(query, req.actor);
  }

  @Post()
  @ApiConsumes('multipart/form-data')
  @UseInterceptors(
    FileInterceptor('file', {
      limits: { files: 1, fileSize: 25 * 1024 * 1024 },
    }),
  )
  publish(
    @Body() dto: PublishDailyPackageDto,
    @UploadedFile() file: UploadedDocumentFile | undefined,
    @Req() req: AuthenticatedRequest,
  ) {
    return this.packages.publish(dto, file, req.actor, metadata(req));
  }

  @Get(':id/file')
  @Header('Cache-Control', 'private, no-store')
  @Header('X-Content-Type-Options', 'nosniff')
  @Header('Cross-Origin-Resource-Policy', 'same-origin')
  async file(
    @Param('id', ParseUUIDPipe) id: string,
    @Req() req: AuthenticatedRequest,
  ) {
    const result = await this.packages.file(id, req.actor, metadata(req));
    return new StreamableFile(result.stream, {
      type: result.mimeType,
      length: result.sizeBytes,
      disposition: `inline; filename*=UTF-8''${encodeURIComponent(result.fileName)}`,
    });
  }
}
