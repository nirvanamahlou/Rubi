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
import { AuthGuard } from '../iam/auth.guard';
import type { AuthenticatedRequest } from '../iam/iam.types';
import { SiteCommerceWriteGuard } from '../site-commerce/site-commerce-write.guard';
import { WebsiteAgencyDirectory } from './website-agency-directory';

@UseGuards(AuthGuard, SiteCommerceWriteGuard)
@Controller('sales/site-commerce/v1/:site/agency-accounts')
export class WebsiteAgencyRegistrationController {
  constructor(
    @Inject(WebsiteAgencyDirectory)
    private readonly agencies: WebsiteAgencyDirectory,
  ) {}
  @Post(':externalId')
  @Header('Cache-Control', 'private, no-store')
  register(
    @Param('site') site: string,
    @Param('externalId') id: string,
    @Body() body: unknown,
    @Req() request: AuthenticatedRequest,
  ) {
    return this.agencies.register(site, id, body, request.actor);
  }
}

@UseGuards(AuthGuard)
@Controller('b2b/website-agency-accounts')
export class WebsiteAgencyStaffController {
  constructor(
    @Inject(WebsiteAgencyDirectory)
    private readonly agencies: WebsiteAgencyDirectory,
  ) {}
  @Get('review')
  @Header('Cache-Control', 'private, no-store')
  review(@Req() request: AuthenticatedRequest) {
    return this.agencies.list(request.actor);
  }
  @Get('organization/:organizationId')
  @Header('Cache-Control', 'private, no-store')
  list(
    @Param('organizationId', new ParseUUIDPipe()) organizationId: string,
    @Req() request: AuthenticatedRequest,
  ) {
    return this.agencies.list(request.actor, organizationId);
  }
  @Post(':id/approve')
  @Header('Cache-Control', 'private, no-store')
  approve(
    @Param('id', new ParseUUIDPipe()) id: string,
    @Req() request: AuthenticatedRequest,
  ) {
    return this.agencies.approve(id, request.actor);
  }
}
