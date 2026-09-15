import {
  Body,
  Controller,
  Get,
  Header,
  Headers,
  Inject,
  Param,
  ParseIntPipe,
  ParseUUIDPipe,
  Patch,
  Post,
  Query,
  Req,
  UseGuards,
} from '@nestjs/common';
import type {
  PackageListQueryV1,
  PackageBannerTemplateCreateInputV1,
  PackagePriceVersionCreateInputV1,
  PackagePricingRuleInputV1,
  PackagePublishInputV1,
  PackageQuoteCreateInputV1,
  PackageRenderCreateInputV1,
} from '@nora/contracts';

import { AuthGuard } from '../iam/auth.guard';
import { RequirePermissions } from '../iam/iam.decorators';
import type { AuthenticatedRequest } from '../iam/iam.types';
import { PermissionGuard } from '../iam/permission.guard';
import { PackagePricingService } from './package-pricing.service';

@Controller('sales/pricing')
@UseGuards(AuthGuard, PermissionGuard)
export class PackagePricingController {
  constructor(
    @Inject(PackagePricingService)
    private readonly pricing: PackagePricingService,
  ) {}

  @Get('tour-departures')
  @Header('Cache-Control', 'private, no-store')
  @RequirePermissions('package_pricing.read')
  pricingTours(@Req() req: AuthenticatedRequest) {
    return this.pricing.pricingTourDepartures(req.actor);
  }

  @Get('tour-costs/:id')
  @Header('Cache-Control', 'private, no-store')
  @RequirePermissions('package_pricing.cost.read')
  tourCosts(
    @Param('id', ParseUUIDPipe) id: string,
    @Req() req: AuthenticatedRequest,
  ) {
    return this.pricing.tourCostGrid(id, req.actor);
  }

  @Get('packages')
  @Header('Cache-Control', 'private, no-store')
  @RequirePermissions('package_pricing.read')
  list(@Query() query: PackageListQueryV1, @Req() req: AuthenticatedRequest) {
    return this.pricing.list(query, req.actor);
  }

  @Get('packages/:id')
  @Header('Cache-Control', 'private, no-store')
  @RequirePermissions('package_pricing.read')
  detail(
    @Param('id', ParseUUIDPipe) id: string,
    @Req() req: AuthenticatedRequest,
  ) {
    return this.pricing.detail(id, req.actor);
  }

  @Post('packages')
  @RequirePermissions('package_pricing.create')
  create(
    @Body() input: unknown,
    @Req() req: AuthenticatedRequest,
    @Headers('x-branch-id') branchId?: string,
    @Headers('idempotency-key') key?: string,
    @Headers('x-request-id') traceId?: string,
  ) {
    return this.pricing.create(input, req.actor, branchId, key, traceId);
  }

  @Patch('packages/:id/archive')
  @RequirePermissions('package_pricing.archive')
  archive(
    @Param('id', ParseUUIDPipe) id: string,
    @Body() input: { expectedVersion: number; reason: string },
    @Req() req: AuthenticatedRequest,
  ) {
    return this.pricing.archive(
      id,
      input.expectedVersion,
      req.actor,
      input.reason,
    );
  }

  @Patch('packages/:id/stop')
  @RequirePermissions('package_pricing.stop')
  stop(
    @Param('id', ParseUUIDPipe) id: string,
    @Body() input: { expectedVersion: number; reason: string },
    @Req() req: AuthenticatedRequest,
    @Headers('x-request-id') traceId?: string,
  ) {
    return this.pricing.stop(
      id,
      input.expectedVersion,
      req.actor,
      input.reason,
      traceId,
    );
  }

  @Get('banner-templates')
  @RequirePermissions('package_pricing.read')
  templates(
    @Req() req: AuthenticatedRequest,
    @Query('branchId') branchId?: string,
  ) {
    return this.pricing.listTemplates(req.actor, branchId);
  }

  @Post('banner-templates')
  @RequirePermissions('package_pricing.template.manage')
  createTemplate(
    @Body() input: PackageBannerTemplateCreateInputV1,
    @Req() req: AuthenticatedRequest,
  ) {
    return this.pricing.createTemplate(input, req.actor);
  }

  @Post('packages/:id/periods/:periodId/rules')
  @RequirePermissions('package_pricing.rule.manage')
  rules(
    @Param('id', ParseUUIDPipe) id: string,
    @Param('periodId', ParseUUIDPipe) periodId: string,
    @Body()
    input: {
      expectedVersion: number;
      reason: string;
      rules: readonly PackagePricingRuleInputV1[];
    },
    @Req() req: AuthenticatedRequest,
    @Headers('x-request-id') traceId?: string,
  ) {
    return this.pricing.replaceRules(
      id,
      periodId,
      input.rules,
      input.expectedVersion,
      req.actor,
      input.reason,
      traceId,
    );
  }

  @Post('packages/:id/departures/:departureId/price-versions')
  @RequirePermissions(
    'package_pricing.period.manage',
    'package_pricing.rule.manage',
  )
  createPriceVersion(
    @Param('id', ParseUUIDPipe) id: string,
    @Param('departureId', ParseUUIDPipe) departureId: string,
    @Body() input: PackagePriceVersionCreateInputV1,
    @Req() req: AuthenticatedRequest,
    @Headers('x-request-id') traceId?: string,
  ) {
    return this.pricing.createPriceVersion(
      id,
      departureId,
      input,
      req.actor,
      traceId,
    );
  }

  @Post(
    'packages/:id/departures/:departureId/price-versions/:priceVersionId/publish',
  )
  @RequirePermissions('package_pricing.publish')
  publish(
    @Param('id', ParseUUIDPipe) id: string,
    @Param('departureId', ParseUUIDPipe) departureId: string,
    @Param('priceVersionId', ParseUUIDPipe) priceVersionId: string,
    @Body() input: PackagePublishInputV1,
    @Req() req: AuthenticatedRequest,
    @Headers('x-request-id') traceId?: string,
  ) {
    return this.pricing.publish(
      id,
      departureId,
      priceVersionId,
      input,
      req.actor,
      traceId,
    );
  }

  @Post('quotes')
  @RequirePermissions('package_pricing.quote.create')
  quote(
    @Body() input: PackageQuoteCreateInputV1,
    @Req() req: AuthenticatedRequest,
    @Headers('idempotency-key') key?: string,
  ) {
    return this.pricing.createQuote(input, req.actor, key);
  }

  @Post('render-requests')
  @RequirePermissions('package_pricing.render')
  render(
    @Body() input: PackageRenderCreateInputV1,
    @Req() req: AuthenticatedRequest,
    @Headers('idempotency-key') key?: string,
  ) {
    return this.pricing.createRender(input, req.actor, key);
  }

  @Get('packages/:id/audit')
  @RequirePermissions('package_pricing.audit.read')
  audit(
    @Param('id', ParseUUIDPipe) id: string,
    @Query('page', new ParseIntPipe({ optional: true })) page: number = 1,
    @Req() req: AuthenticatedRequest,
  ) {
    return this.pricing.audit(id, req.actor, page);
  }
}
