import type { VerifiedGatewayProof } from '../finance/payments/verified-gateway-receipt.public';
import {
  Body,
  BadRequestException,
  Controller,
  Get,
  Header,
  Inject,
  Param,
  ParseUUIDPipe,
  Post,
  Put,
  Query,
  Req,
  Res,
  StreamableFile,
  UseGuards,
} from '@nestjs/common';
import type { Response } from 'express';
import type {
  SalesContractCreateRequest,
  SalesPaymentCreateRequest,
} from '@nora/contracts';
import { AuthGuard } from '../iam/auth.guard';
import { IamService } from '../iam/iam.service';
import type { AuthenticatedRequest } from '../iam/iam.types';
import { CurrencyRateService } from '../master-data/currency-rate.service';
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
import type { FloatingWebsiteBooking } from './floating-tour-booking';
import type { DatedTourBooking } from './dated-tour-booking';
// eslint-disable-next-line @typescript-eslint/consistent-type-imports
import { PassengerPreflightDto } from './passenger-preflight.dto';

@Controller('sales/site-commerce/v1/:site')
@UseGuards(AuthGuard, SiteCommerceWriteGuard)
export class SiteCommerceController {
  constructor(
    @Inject(SiteCommerceService) private readonly service: SiteCommerceService,
    @Inject(CustomerService) private readonly customers: CustomerService,
    @Inject(IamService) private readonly iam: IamService,
    @Inject(CurrencyRateService)
    private readonly currencyRates: CurrencyRateService,
  ) {}
  @Get('publications/:kind/:resourceId')
  @Header('Cache-Control', 'private, no-store')
  publication(
    @Param('site') site: string,
    @Param('kind') kind: string,
    @Param('resourceId', ParseUUIDPipe) id: string,
    @Req() req: AuthenticatedRequest,
    @Query('branchId') branchId?: string,
    @Query('periodKey') periodKey?: string,
  ) {
    return this.service.publication(
      site,
      kind,
      id,
      req.actor,
      branchId,
      periodKey,
    );
  }
  @Post('publications/:kind/:resourceId')
  async publish(
    @Param('site') site: string,
    @Param('kind') kind: string,
    @Param('resourceId', ParseUUIDPipe) id: string,
    @Body()
    body: {
      enabled: boolean;
      salesStopped?: boolean;
      version: number;
      branchId?: string;
      presentation?: unknown;
      periodKey?: string;
      confirmPastDeparture?: boolean;
    },
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
  catalog(
    @Param('site') site: string,
    @Req() req: AuthenticatedRequest,
    @Query('floatingTours') floatingTours?: string,
  ) {
    return floatingTours === 'only'
      ? this.service.catalog(site, req.actor, true, true)
      : this.service.catalog(site, req.actor, floatingTours === 'true');
  }

  @Get('exchange-rates')
  @Header('Cache-Control', 'private, no-store')
  async exchangeRates(
    @Param('site') site: string,
    @Req() req: AuthenticatedRequest,
  ) {
    siteBinding(site, req.actor);
    return { data: await this.currencyRates.websiteSellRates() };
  }
  @Post('profiles/:resource/:id/withdraw')
  withdrawProfile(
    @Param('site') site: string,
    @Param('resource') resource: string,
    @Param('id', ParseUUIDPipe) id: string,
    @Req() req: AuthenticatedRequest,
  ) {
    return this.service.withdrawProfile(site, resource, id, req.actor);
  }

  @Post('hotel-profiles/:id')
  @Header('Cache-Control', 'private, no-store')
  publishHotel(
    @Param('site') site: string,
    @Param('id', ParseUUIDPipe) id: string,
    @Req() req: AuthenticatedRequest,
  ) {
    return this.service.publishHotelProfile(site, id, req.actor);
  }
  @Post('visa-profiles/:id')
  @Header('Cache-Control', 'private, no-store')
  publishVisa(
    @Param('site') site: string,
    @Param('id', ParseUUIDPipe) id: string,
    @Req() req: AuthenticatedRequest,
  ) {
    return this.service.publishVisaProfile(site, id, req.actor);
  }
  @Post('geography-profiles/:kind/:id')
  publishGeography(
    @Param('site') site: string,
    @Param('kind') kind: string,
    @Param('id', ParseUUIDPipe) id: string,
    @Req() req: AuthenticatedRequest,
  ) {
    return this.service.publishGeography(site, kind, id, req.actor);
  }
  @Post('flight-quote')
  @Header('Cache-Control', 'private, no-store')
  flightQuote(
    @Param('site') site: string,
    @Body()
    body: {
      productIds: string[];
      birthDates?: string[];
      passengerCounts?: { adults: number; children: number; infants: number };
    },
    @Req() req: AuthenticatedRequest,
  ) {
    return this.service.flightQuote(site, body, req.actor);
  }
  @Post('people/check')
  @Header('Cache-Control', 'private, no-store')
  async checkPeople(
    @Param('site') site: string,
    @Body() body: PassengerPreflightDto,
    @Req() req: AuthenticatedRequest,
  ) {
    const binding = siteBinding(site, req.actor);
    const duplicate = (person: CustomerMutationDto, at: number) =>
      body.passengers.some(
        (other, index) =>
          index !== at &&
          ((!!person.nationalId && person.nationalId === other.nationalId) ||
            (!!person.passportNumber &&
              person.passportNumber === other.passportNumber)),
      );
    const data = await Promise.all(
      body.passengers.map(async (person, index) => {
        try {
          const result = await this.customers.checkWebsitePassenger(
            person,
            { ...req.actor, branchIds: [binding.branchId] },
            binding.branchId,
          );
          return {
            index,
            ...(duplicate(person, index)
              ? { valid: false, code: 'DUPLICATE_PASSENGER' }
              : result),
          };
        } catch (error) {
          if (error instanceof BadRequestException)
            return { index, valid: false, code: 'INVALID_PASSENGER' };
          throw error;
        }
      }),
    );
    return { data };
  }

  @Post('people')
  person(
    @Param('site') site: string,
    @Body() body: CustomerMutationDto,
    @Req() req: AuthenticatedRequest,
  ) {
    return this.syncPerson(site, body, req, false);
  }

  @Post('people/saved')
  @Header('Cache-Control', 'private, no-store')
  savedPerson(
    @Param('site') site: string,
    @Body() body: CustomerMutationDto,
    @Req() req: AuthenticatedRequest,
  ) {
    return this.syncPerson(site, body, req, true);
  }

  private async syncPerson(
    site: string,
    body: CustomerMutationDto,
    req: AuthenticatedRequest,
    preserveExisting: boolean,
  ) {
    const binding = siteBinding(site, req.actor);
    const result = await this.customers.syncWebsitePassenger(
      body,
      { ...req.actor, branchIds: [binding.branchId] },
      binding.branchId,
      `site:${site}:passenger-sync`,
      ...(preserveExisting ? ([true] as const) : []),
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
  @Put('buyer-profile/:externalId')
  @Header('Cache-Control', 'private, no-store')
  async syncBuyerProfile(
    @Param('site') site: string,
    @Param('externalId') id: string,
    @Body() body: CustomerMutationDto,
    @Req() req: AuthenticatedRequest,
  ) {
    const { branchId } = siteBinding(site, req.actor);
    externalOrderId(id);
    if (body.kind !== 'person' || !body.firstName || !body.lastName)
      throw new BadRequestException();
    const result = await this.customers.syncWebsiteBuyerNames(
      {
        firstName: body.firstName,
        lastName: body.lastName,
        displayName: body.displayName,
      },
      { ...req.actor, branchIds: [branchId] },
      branchId,
      `site-buyer:${stableFingerprint({ site, branchId, id })}`,
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
  @Post('dated-tour-orders/:externalId')
  @Header('Cache-Control', 'private, no-store')
  datedTourDraft(
    @Param('site') site: string,
    @Param('externalId') id: string,
    @Body() body: DatedTourBooking,
    @Req() req: AuthenticatedRequest,
  ) {
    return this.service.draftDatedTour(site, id, body, req.actor);
  }
  @Post('floating-orders/:externalId')
  @Header('Cache-Control', 'private, no-store')
  floatingDraft(
    @Param('site') site: string,
    @Param('externalId') id: string,
    @Body() body: FloatingWebsiteBooking,
    @Req() req: AuthenticatedRequest,
  ) {
    return this.service.draftFloating(site, id, body, req.actor);
  }
  @Post('floating-preview')
  @Header('Cache-Control', 'private, no-store')
  floatingPreview(
    @Param('site') site: string,
    @Body() body: FloatingWebsiteBooking,
    @Req() req: AuthenticatedRequest,
  ) {
    return this.service.previewFloating(site, body, req.actor);
  }
  @Post('floating-holds/:externalId')
  @Header('Cache-Control', 'private, no-store')
  floatingHold(
    @Param('site') site: string,
    @Param('externalId') id: string,
    @Body() body: Parameters<SiteCommerceService['holdFloating']>[2],
    @Req() req: AuthenticatedRequest,
  ) {
    return this.service.holdFloating(site, id, body, req.actor);
  }
  @Post('orders/:externalId/paid')
  paid(
    @Param('site') site: string,
    @Param('externalId') id: string,
    @Body()
    body: {
      payments: SalesPaymentCreateRequest[];
      gatewayReceipt?: VerifiedGatewayProof;
    },
    @Req() req: AuthenticatedRequest,
  ) {
    return this.service.paid(
      site,
      id,
      body?.payments,
      req.actor,
      body?.gatewayReceipt,
    );
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
  @Get('orders/:externalId/tour-insurance')
  @Header('Cache-Control', 'private, no-store')
  tourInsurance(
    @Param('site') site: string,
    @Param('externalId') id: string,
    @Req() req: AuthenticatedRequest,
  ) {
    return this.service.websiteTourInsurance(site, id, req.actor);
  }
  @Post('orders/:externalId/tour-insurance')
  @Header('Cache-Control', 'private, no-store')
  issueTourInsurance(
    @Param('site') site: string,
    @Param('externalId') id: string,
    @Req() req: AuthenticatedRequest,
  ) {
    return this.service.websiteTourInsurance(site, id, req.actor, true);
  }
  @Get('orders/:externalId/tour-insurance/:policyId')
  @Header('Cache-Control', 'private, no-store')
  @Header('X-Content-Type-Options', 'nosniff')
  async tourInsurancePdf(
    @Param('site') site: string,
    @Param('externalId') id: string,
    @Param('policyId', ParseUUIDPipe) policyId: string,
    @Req() req: AuthenticatedRequest,
    @Res({ passthrough: true }) response: Response,
  ) {
    const pdf = await this.service.websiteTourInsurancePdf(
      site,
      id,
      policyId,
      req.actor,
    );
    response.setHeader(
      'Content-Disposition',
      `attachment; filename="${pdf.filename}"`,
    );
    return new StreamableFile(pdf.bytes, { type: pdf.type });
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
