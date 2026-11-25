import {
  BadRequestException,
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
import type {
  PackageTourDraftSaveV1,
  PackageTourPublishV1,
} from '@nora/contracts';
import { AuthGuard } from '../iam/auth.guard';
import { RequirePermissions } from '../iam/iam.decorators';
import type { AuthenticatedRequest } from '../iam/iam.types';
import { PermissionGuard } from '../iam/permission.guard';
import { PackageTourPricingService } from './package-tour-pricing.service';
import { CharterExcelPricingService } from './charter-excel-pricing.service';

const excelUpload = FileInterceptor('file', {
  limits: { fileSize: 5 * 1024 * 1024, files: 1, fields: 2 },
  fileFilter: (_req, file, done) =>
    done(null, /\.xlsx$/i.test(file.originalname)),
});

function charterFile(file?: { buffer: Buffer }, selections?: string) {
  if (!file?.buffer?.length)
    throw new BadRequestException('فایل XLSX معتبر انتخاب کنید.');
  try {
    return { bytes: file.buffer, selections: JSON.parse(selections ?? '{}') };
  } catch {
    throw new BadRequestException('انتخاب هتل‌های اکسل معتبر نیست.');
  }
}

@Controller('sales/pricing/tour-drafts')
@UseGuards(AuthGuard, PermissionGuard)
export class PackageTourPricingController {
  constructor(
    @Inject(PackageTourPricingService)
    private readonly drafts: PackageTourPricingService,
    @Inject(CharterExcelPricingService)
    private readonly charterExcel: CharterExcelPricingService,
  ) {}

  @Get(':tourId/charter-excel')
  @Header('Cache-Control', 'private, no-store')
  @RequirePermissions('package_pricing.read')
  charterPrices(
    @Param('tourId', ParseUUIDPipe) tourId: string,
    @Req() req: AuthenticatedRequest,
  ) {
    return this.charterExcel.read(tourId, req.actor);
  }

  @Get(':tourId/charter-excel/template')
  @Header('Cache-Control', 'private, no-store')
  @RequirePermissions('package_pricing.read')
  async charterTemplate(
    @Param('tourId', ParseUUIDPipe) tourId: string,
    @Req() req: AuthenticatedRequest,
  ) {
    return new StreamableFile(
      await this.charterExcel.template(tourId, req.actor),
      {
        type: 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet',
        disposition: 'attachment; filename="charter-tour-price.xlsx"',
      },
    );
  }

  @Post(':tourId/charter-excel/preview')
  @UseInterceptors(excelUpload)
  @RequirePermissions('package_pricing.period.manage')
  charterPreview(
    @Param('tourId', ParseUUIDPipe) tourId: string,
    @UploadedFile() file: { buffer: Buffer } | undefined,
    @Body() body: { selections?: string },
    @Req() req: AuthenticatedRequest,
  ) {
    const { bytes, selections } = charterFile(file, body.selections);
    return this.charterExcel.preview(tourId, bytes, selections, req.actor);
  }

  @Post(':tourId/charter-excel/publish')
  @UseInterceptors(excelUpload)
  @RequirePermissions('package_pricing.period.manage')
  charterPublish(
    @Param('tourId', ParseUUIDPipe) tourId: string,
    @UploadedFile() file: { buffer: Buffer } | undefined,
    @Body() body: { selections?: string; digest?: string },
    @Req() req: AuthenticatedRequest,
  ) {
    const { bytes, selections } = charterFile(file, body.selections);
    return this.charterExcel.commit(
      tourId,
      bytes,
      selections,
      body.digest ?? '',
      req.actor,
    );
  }

  @Get('buy-rates')
  @Header('Cache-Control', 'private, no-store')
  @RequirePermissions('package_pricing.read')
  buyRates() {
    return this.drafts.buyRates();
  }

  @Get('website-publication-candidates')
  @Header('Cache-Control', 'private, no-store')
  @RequirePermissions('ticket_catalog.manage')
  websitePublicationCandidates(@Req() req: AuthenticatedRequest) {
    return this.drafts.websitePublicationCandidates(req.actor);
  }

  @Get('sale-catalog')
  @Header('Cache-Control', 'private, no-store')
  @RequirePermissions('sales.contracts.create')
  saleCatalog(
    @Query('tourDepartureId', ParseUUIDPipe) tourId: string,
    @Req() req: AuthenticatedRequest,
  ) {
    return this.drafts.saleCatalog(tourId, req.actor);
  }

  @Get()
  @Header('Cache-Control', 'private, no-store')
  @RequirePermissions('package_pricing.read')
  get(
    @Query('tourDepartureId', ParseUUIDPipe) tourId: string,
    @Query('batchId', ParseUUIDPipe) batchId: string,
    @Req() req: AuthenticatedRequest,
  ) {
    return this.drafts.get(tourId, batchId, req.actor);
  }

  @Post()
  @RequirePermissions('package_pricing.period.manage')
  save(
    @Body() input: PackageTourDraftSaveV1,
    @Req() req: AuthenticatedRequest,
  ) {
    return this.drafts.save(input, req.actor);
  }

  @Post(':draftId/publish')
  @RequirePermissions('package_pricing.read')
  publish(
    @Param('draftId', ParseUUIDPipe) draftId: string,
    @Body() input: PackageTourPublishV1,
    @Req() req: AuthenticatedRequest,
  ) {
    return this.drafts.publish(draftId, input, req.actor);
  }

  @Get('publications')
  @Header('Cache-Control', 'private, no-store')
  @RequirePermissions('package_pricing.read')
  publications(
    @Query('tourDepartureId', ParseUUIDPipe) tourId: string,
    @Query('batchId', ParseUUIDPipe) batchId: string,
    @Req() req: AuthenticatedRequest,
  ) {
    return this.drafts.publications(tourId, batchId, req.actor);
  }
}
