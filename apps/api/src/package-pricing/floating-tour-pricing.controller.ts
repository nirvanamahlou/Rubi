import {
  BadRequestException,
  Body,
  Controller,
  Get,
  Header,
  Inject,
  Param,
  Query,
  ParseUUIDPipe,
  Post,
  Req,
  StreamableFile,
  UploadedFile,
  UseGuards,
  UseInterceptors,
} from '@nestjs/common';
import { FileInterceptor } from '@nestjs/platform-express';
import { AuthGuard } from '../iam/auth.guard';
import { PermissionGuard } from '../iam/permission.guard';
import { RequirePermissions } from '../iam/iam.decorators';
import type { AuthenticatedRequest } from '../iam/iam.types';
import { FloatingTourPricingService } from './floating-tour-pricing.service';
const upload = FileInterceptor('file', {
  limits: { fileSize: 5 * 1024 * 1024, files: 1, fields: 4 },
  fileFilter: (_req, file, done) =>
    done(null, /\.xlsx$/i.test(file.originalname)),
});
@Controller('sales/pricing/floating-tours')
@UseGuards(AuthGuard, PermissionGuard)
export class FloatingTourPricingController {
  constructor(
    @Inject(FloatingTourPricingService)
    private readonly pricing: FloatingTourPricingService,
  ) {}
  @Get()
  @Header('Cache-Control', 'private, no-store')
  @RequirePermissions('package_pricing.read')
  list(@Req() req: AuthenticatedRequest) {
    return this.pricing.list(req.actor);
  }
  @Get('website-candidates')
  @Header('Cache-Control', 'private, no-store')
  @RequirePermissions('ticket_catalog.manage')
  websiteCandidates(@Req() req: AuthenticatedRequest) {
    return this.pricing.websiteCandidates(req.actor);
  }
  @Get(':id')
  @Header('Cache-Control', 'private, no-store')
  @RequirePermissions('package_pricing.read')
  get(
    @Param('id', ParseUUIDPipe) id: string,
    @Req() req: AuthenticatedRequest,
  ) {
    return this.pricing.get(id, req.actor);
  }
  @Get(':id/template')
  @Header('Cache-Control', 'private, no-store')
  @RequirePermissions('package_pricing.read')
  async template(
    @Param('id', ParseUUIDPipe) id: string,
    @Req() req: AuthenticatedRequest,
    @Query('destinationCount') destinationCount?: string,
  ) {
    return new StreamableFile(
      await this.pricing.template(id, req.actor, destinationCount),
      {
        type: 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet',
        disposition: 'attachment; filename="floating-tour-price.xlsx"',
      },
    );
  }
  private options(body: { options?: string }, file?: { buffer: Buffer }) {
    if (!file?.buffer)
      throw new BadRequestException('فایل XLSX معتبر انتخاب کنید.');
    try {
      return JSON.parse(body.options ?? '');
    } catch {
      throw new BadRequestException('تنظیمات بازه معتبر نیست.');
    }
  }
  @Post(':id/preview')
  @UseInterceptors(upload)
  @RequirePermissions('package_pricing.period.manage')
  preview(
    @Param('id', ParseUUIDPipe) id: string,
    @UploadedFile() file: { buffer: Buffer } | undefined,
    @Body() body: { options?: string },
    @Req() req: AuthenticatedRequest,
  ) {
    return this.pricing.preview(
      id,
      file?.buffer ?? Buffer.alloc(0),
      this.options(body, file),
      req.actor,
    );
  }
  @Post(':id/commit')
  @UseInterceptors(upload)
  @RequirePermissions('package_pricing.period.manage')
  commit(
    @Param('id', ParseUUIDPipe) id: string,
    @UploadedFile() file: { buffer: Buffer } | undefined,
    @Body()
    body: { options?: string; expectedVersion?: string; digest?: string },
    @Req() req: AuthenticatedRequest,
  ) {
    return this.pricing.commit(
      id,
      file?.buffer ?? Buffer.alloc(0),
      this.options(body, file),
      Number(body.expectedVersion),
      body.digest ?? '',
      req.actor,
    );
  }
}
