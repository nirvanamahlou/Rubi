import {
  Body,
  Controller,
  Get,
  Headers,
  Inject,
  Param,
  Post,
  Put,
  Req,
  UseGuards,
} from '@nestjs/common';
import { ApiCookieAuth, ApiTags } from '@nestjs/swagger';

import { AuthGuard } from '../iam/auth.guard';
import { RequirePermissions } from '../iam/iam.decorators';
import type { AuthenticatedRequest } from '../iam/iam.types';
import { PermissionGuard } from '../iam/permission.guard';
// Runtime imports are required for Nest emitDecoratorMetadata and ValidationPipe.
// eslint-disable-next-line @typescript-eslint/consistent-type-imports
import {
  CreateAgencyAgreedRateDto,
  CreateAgencyAgreementDto,
  UpsertAgencyCreditPolicyDto,
  UpsertAgencyProfileDto,
} from './b2b.dto';
import { B2bService } from './b2b.service';

@ApiTags('B2B Agencies')
@ApiCookieAuth('rubi_access')
@UseGuards(AuthGuard, PermissionGuard)
@Controller('b2b/agencies')
export class B2bController {
  constructor(@Inject(B2bService) private readonly service: B2bService) {}

  @Get(':organizationId')
  @RequirePermissions(
    'b2b.agency.read',
    'b2b.agreement.read',
    'b2b.credit.read',
    'b2b.rate.read',
  )
  workspace(
    @Param('organizationId') organizationId: string,
    @Req() request: AuthenticatedRequest,
    @Headers('x-branch-id') branchId?: string,
  ) {
    return this.service.agencyWorkspace(
      organizationId,
      request.actor,
      branchId,
    );
  }

  @Put(':organizationId/profile')
  @RequirePermissions('b2b.agency.manage')
  profile(
    @Param('organizationId') organizationId: string,
    @Body() dto: UpsertAgencyProfileDto,
    @Req() request: AuthenticatedRequest,
  ) {
    return this.service.upsertProfile(organizationId, dto, request.actor);
  }

  @Post(':organizationId/agreements')
  @RequirePermissions('b2b.agreement.manage')
  agreement(
    @Param('organizationId') organizationId: string,
    @Body() dto: CreateAgencyAgreementDto,
    @Req() request: AuthenticatedRequest,
  ) {
    return this.service.createAgreement(organizationId, dto, request.actor);
  }

  @Put(':organizationId/credit-policy')
  @RequirePermissions('b2b.credit.manage')
  creditPolicy(
    @Param('organizationId') organizationId: string,
    @Body() dto: UpsertAgencyCreditPolicyDto,
    @Req() request: AuthenticatedRequest,
  ) {
    return this.service.upsertCreditPolicy(organizationId, dto, request.actor);
  }

  @Post(':organizationId/agreed-rates')
  @RequirePermissions('b2b.rate.manage')
  agreedRate(
    @Param('organizationId') organizationId: string,
    @Body() dto: CreateAgencyAgreedRateDto,
    @Req() request: AuthenticatedRequest,
  ) {
    return this.service.createRate(organizationId, dto, request.actor);
  }
}
