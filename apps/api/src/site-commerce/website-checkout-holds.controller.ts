import {
  Body,
  Controller,
  Get,
  Header,
  Inject,
  Param,
  Post,
  Req,
  UseGuards,
} from '@nestjs/common';
import type { AuthenticatedRequest } from '../iam/iam.types';
import { AuthGuard } from '../iam/auth.guard';
import { SiteCommerceWriteGuard } from './site-commerce-write.guard';
import {
  WebsiteCheckoutHoldsService,
  type CheckoutHoldInput,
} from './website-checkout-holds.service';
@Controller('sales/site-commerce/v1/:site/checkouts/:externalId')
@UseGuards(AuthGuard, SiteCommerceWriteGuard)
export class WebsiteCheckoutHoldsController {
  constructor(
    @Inject(WebsiteCheckoutHoldsService)
    private readonly service: WebsiteCheckoutHoldsService,
  ) {}
  @Get() @Header('Cache-Control', 'private, no-store') status(
    @Param('site') site: string,
    @Param('externalId') externalId: string,
    @Req() req: AuthenticatedRequest,
  ) {
    return this.service.status(site, externalId, req.actor);
  }
  @Post('hold') @Header('Cache-Control', 'private, no-store') prepare(
    @Param('site') site: string,
    @Param('externalId') externalId: string,
    @Body() body: CheckoutHoldInput,
    @Req() req: AuthenticatedRequest,
  ) {
    return this.service.prepare(site, externalId, body, req.actor);
  }
  @Post('payment-attempt') @Header('Cache-Control', 'private, no-store') pin(
    @Param('site') site: string,
    @Param('externalId') externalId: string,
    @Body() body: { attemptKey: string },
    @Req() req: AuthenticatedRequest,
  ) {
    return this.service.pin(site, externalId, body?.attemptKey, req.actor);
  }
  @Post('resolve') @Header('Cache-Control', 'private, no-store') resolve(
    @Param('site') site: string,
    @Param('externalId') externalId: string,
    @Body() body: Parameters<WebsiteCheckoutHoldsService['resolve']>[2],
    @Req() req: AuthenticatedRequest,
  ) {
    return this.service.resolve(site, externalId, body, req.actor);
  }
  @Post('bind-contract') @Header('Cache-Control', 'private, no-store') bind(
    @Param('site') site: string,
    @Param('externalId') externalId: string,
    @Req() req: AuthenticatedRequest,
  ) {
    return this.service.bind(site, externalId, req.actor);
  }
}
