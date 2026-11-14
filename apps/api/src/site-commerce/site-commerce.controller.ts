import {
  Body,
  Controller,
  Get,
  Header,
  Inject,
  Param,
  ParseUUIDPipe,
  Post,
  Req,
  UseGuards,
} from '@nestjs/common';
import type {
  SalesContractCreateRequest,
  SalesPaymentCreateRequest,
} from '@nora/contracts';
import { AuthGuard } from '../iam/auth.guard';
import { IamService } from '../iam/iam.service';
import type { AuthenticatedRequest } from '../iam/iam.types';
// Nest needs the runtime DTO constructor for request validation.
// eslint-disable-next-line @typescript-eslint/consistent-type-imports
import { CustomerMutationDto } from '../customers/customer.dto';
import { CustomerService } from '../customers/customer.service';
import {
  externalOrderId,
  siteBinding,
  stableFingerprint,
} from './site-commerce.policy';
import { SiteCommerceService } from './site-commerce.service';
import { SiteCommerceWriteGuard } from './site-commerce-write.guard';

@Controller('sales/site-commerce/v1/:site')
@UseGuards(AuthGuard, SiteCommerceWriteGuard)
export class SiteCommerceController {
  constructor(
    @Inject(SiteCommerceService) private readonly service: SiteCommerceService,
    @Inject(CustomerService) private readonly customers: CustomerService,
    @Inject(IamService) private readonly iam: IamService,
  ) {}
  @Get('publications/:kind/:resourceId')
  @Header('Cache-Control', 'private, no-store')
  publication(
    @Param('site') site: string,
    @Param('kind') kind: string,
    @Param('resourceId', ParseUUIDPipe) id: string,
    @Req() req: AuthenticatedRequest,
  ) {
    return this.service.publication(site, kind, id, req.actor);
  }
  @Post('publications/:kind/:resourceId')
  async publish(
    @Param('site') site: string,
    @Param('kind') kind: string,
    @Param('resourceId', ParseUUIDPipe) id: string,
    @Body() body: { enabled: boolean; version: number },
    @Req() req: AuthenticatedRequest,
  ) {
    const result = await this.service.publish(site, kind, id, body, req.actor);
    await this.iam.recordSelfActivity(
      req.actor,
      body.enabled
        ? 'integrations.site.publication.enabled'
        : 'integrations.site.publication.disabled',
      'website_publication',
      result.data.id,
    );
    return result;
  }
  @Get('catalog')
  @Header('Cache-Control', 'private, no-store')
  catalog(@Param('site') site: string, @Req() req: AuthenticatedRequest) {
    return this.service.catalog(site, req.actor);
  }
  @Post('flight-quote')
  @Header('Cache-Control', 'private, no-store')
  flightQuote(
    @Param('site') site: string,
    @Body() body: { productIds: string[]; birthDates: string[] },
    @Req() req: AuthenticatedRequest,
  ) {
    return this.service.flightQuote(site, body, req.actor);
  }
  @Post('people')
  async person(
    @Param('site') site: string,
    @Body() body: CustomerMutationDto,
    @Req() req: AuthenticatedRequest,
  ) {
    const binding = siteBinding(site, req.actor);
    const scoped = this.customers.salesEntryActor({
      ...req.actor,
      branchIds: [binding.branchId],
    });
    if (body.nationalId) {
      const existing = await this.customers.registrationLookup(
        {
          nationalId: body.nationalId,
          firstName: body.firstName ?? '',
          lastName: body.lastName ?? '',
          ...(body.birthDate ? { birthDate: body.birthDate } : {}),
        },
        scoped,
      );
      if (existing.data)
        return {
          data: {
            id: existing.data.id,
            displayName: existing.data.displayName,
          },
        };
    }
    const result = await this.customers.createForSales(
      body,
      scoped,
      binding.branchId,
    );
    return {
      data: { id: result.data.id, displayName: result.data.displayName },
    };
  }
  @Post('buyers/:externalId')
  @Header('Cache-Control', 'private, no-store')
  async buyer(
    @Param('site') site: string,
    @Param('externalId') id: string,
    @Body() body: CustomerMutationDto,
    @Req() req: AuthenticatedRequest,
  ) {
    const binding = siteBinding(site, req.actor);
    externalOrderId(id);
    const scoped = { ...req.actor, branchIds: [binding.branchId] };
    const result = await this.customers.createForSales(
      { ...body, roles: ['customer'] },
      scoped,
      binding.branchId,
      undefined,
      `site-buyer:${stableFingerprint({ site, branchId: binding.branchId, id })}`,
    );
    return {
      data: { id: result.data.id, displayName: result.data.displayName },
    };
  }
  @Post('orders/:externalId')
  draft(
    @Param('site') site: string,
    @Param('externalId') id: string,
    @Body() body: SalesContractCreateRequest,
    @Req() req: AuthenticatedRequest,
  ) {
    return this.service.draft(site, id, body, req.actor);
  }
  @Get('orders/:externalId')
  @Header('Cache-Control', 'private, no-store')
  status(
    @Param('site') site: string,
    @Param('externalId') id: string,
    @Req() req: AuthenticatedRequest,
  ) {
    return this.service.status(site, id, req.actor);
  }
  @Post('orders/:externalId/paid')
  paid(
    @Param('site') site: string,
    @Param('externalId') id: string,
    @Body() body: { payments: SalesPaymentCreateRequest[] },
    @Req() req: AuthenticatedRequest,
  ) {
    return this.service.paid(site, id, body?.payments, req.actor);
  }
  @Get('orders/:externalId/contract')
  @Header('Cache-Control', 'private, no-store')
  output(
    @Param('site') site: string,
    @Param('externalId') id: string,
    @Req() req: AuthenticatedRequest,
  ) {
    return this.service.contractOutput(site, id, req.actor);
  }
  @Get('orders/:externalId/travel-documents')
  @Header('Cache-Control', 'private, no-store')
  documents(
    @Param('site') site: string,
    @Param('externalId') id: string,
    @Req() req: AuthenticatedRequest,
  ) {
    return this.service.travelDocuments(site, id, req.actor);
  }
  @Get('orders/:externalId/payment-accounts')
  @Header('Cache-Control', 'private, no-store')
  accounts(
    @Param('site') site: string,
    @Param('externalId') id: string,
    @Req() req: AuthenticatedRequest,
  ) {
    return this.service.paymentAccounts(site, id, req.actor);
  }
}
