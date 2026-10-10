import { Body, Controller, Get, Header, Inject, Param, ParseUUIDPipe,
  Post, Query, Req, UseGuards } from '@nestjs/common';
import type { PackageTourDraftSaveV1, PackageTourPublishV1 } from '@nora/contracts';
import { AuthGuard } from '../iam/auth.guard';
import { RequirePermissions } from '../iam/iam.decorators';
import type { AuthenticatedRequest } from '../iam/iam.types';
import { PermissionGuard } from '../iam/permission.guard';
import { PackageTourPricingService } from './package-tour-pricing.service';

@Controller('sales/pricing/tour-drafts')
@UseGuards(AuthGuard, PermissionGuard)
export class PackageTourPricingController {
  constructor(@Inject(PackageTourPricingService)
    private readonly drafts: PackageTourPricingService) {}

  @Get()
  @Header('Cache-Control', 'private, no-store')
  @RequirePermissions('package_pricing.read')
  get(@Query('tourDepartureId', ParseUUIDPipe) tourId: string,
    @Query('batchId', ParseUUIDPipe) batchId: string,
    @Req() req: AuthenticatedRequest) {
    return this.drafts.get(tourId, batchId, req.actor);
  }

  @Post()
  @RequirePermissions('package_pricing.period.manage')
  save(@Body() input: PackageTourDraftSaveV1, @Req() req: AuthenticatedRequest) {
    return this.drafts.save(input, req.actor);
  }

  @Post(':draftId/publish')
  @RequirePermissions('package_pricing.publish')
  publish(@Param('draftId', ParseUUIDPipe) draftId: string,
    @Body() input: PackageTourPublishV1, @Req() req: AuthenticatedRequest) {
    return this.drafts.publish(draftId, input, req.actor);
  }

  @Get('publications')
  @Header('Cache-Control', 'private, no-store')
  @RequirePermissions('package_pricing.read')
  publications(@Query('tourDepartureId', ParseUUIDPipe) tourId: string,
    @Query('batchId', ParseUUIDPipe) batchId: string,
    @Req() req: AuthenticatedRequest) {
    return this.drafts.publications(tourId, batchId, req.actor);
  }
}
