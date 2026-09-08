import {
  BadRequestException,
  Body,
  Controller,
  Delete,
  Get,
  Headers,
  Inject,
  Param,
  ParseUUIDPipe,
  Post,
  Put,
  Query,
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
  UpdateAgencyAgreedRateDto,
  DeleteB2bRecordDto,
} from './b2b.dto';
import { B2bService } from './b2b.service';
import type { B2bCooperationRole } from '@rubi/contracts';
import { B2bAgreementWorkflowService } from './b2b-agreement-workflow.service';
// Runtime classes are required by ValidationPipe.
// eslint-disable-next-line @typescript-eslint/consistent-type-imports
import {
  SaveB2bAgreementDto,
  B2bAgreementActionDto,
} from './b2b-agreement-workflow.dto';

@ApiTags('B2B Agencies')
@ApiCookieAuth('rubi_access')
@UseGuards(AuthGuard, PermissionGuard)
@Controller('b2b/agencies')
export class B2bController {
  constructor(
    @Inject(B2bService) private readonly service: B2bService,
    @Inject(B2bAgreementWorkflowService)
    private readonly workflow: B2bAgreementWorkflowService,
  ) {}

  @Get(':organizationId/profile')
  @RequirePermissions('b2b.agency.read')
  profileDetails(
    @Param('organizationId', new ParseUUIDPipe()) organizationId: string,
    @Req() request: AuthenticatedRequest,
    @Headers('x-branch-id') branchId: string,
  ) {
    return this.service.profileDetails(organizationId, request.actor, branchId);
  }

  @Get(':organizationId/agreed-rates')
  @RequirePermissions('b2b.rate.read')
  rates(
    @Param('organizationId', new ParseUUIDPipe()) organizationId: string,
    @Req() request: AuthenticatedRequest,
    @Headers('x-branch-id') branchId: string,
  ) {
    return this.service.rates(organizationId, request.actor, branchId);
  }

  @Put(':organizationId/agreed-rates/:rateId')
  @RequirePermissions('b2b.rate.manage')
  updateRate(
    @Param('organizationId', new ParseUUIDPipe()) organizationId: string,
    @Param('rateId', new ParseUUIDPipe()) rateId: string,
    @Body() dto: UpdateAgencyAgreedRateDto,
    @Req() request: AuthenticatedRequest,
  ) {
    return this.service.updateRate(organizationId, rateId, dto, request.actor);
  }

  @Delete(':organizationId/agreed-rates/:rateId')
  @RequirePermissions('b2b.rate.manage')
  deleteRate(
    @Param('organizationId', new ParseUUIDPipe()) organizationId: string,
    @Param('rateId', new ParseUUIDPipe()) rateId: string,
    @Body() dto: DeleteB2bRecordDto,
    @Req() request: AuthenticatedRequest,
  ) {
    return this.service.deleteRate(organizationId, rateId, dto, request.actor);
  }

  @Get(':organizationId/agreements')
  @RequirePermissions('b2b.agreement.read', 'b2b.credit.read')
  agreements(
    @Param('organizationId', new ParseUUIDPipe()) organizationId: string,
    @Req() request: AuthenticatedRequest,
    @Headers('x-branch-id') branchId: string,
    @Query('role') role: B2bCooperationRole = 'AGENCY',
    @Query('page') page = '1',
    @Query('pageSize') pageSize = '20',
  ) {
    return this.workflow.list(
      organizationId,
      branchId,
      role,
      request.actor,
      Number(page),
      Number(pageSize),
    );
  }

  @Get(':organizationId/agreements/:agreementId')
  @RequirePermissions('b2b.agreement.read', 'b2b.credit.read')
  agreementCase(
    @Param('organizationId', new ParseUUIDPipe()) organizationId: string,
    @Param('agreementId', new ParseUUIDPipe()) agreementId: string,
    @Req() request: AuthenticatedRequest,
    @Headers('x-branch-id') branchId: string,
    @Query('role') role: B2bCooperationRole = 'AGENCY',
  ) {
    return this.workflow.get(
      organizationId,
      agreementId,
      branchId,
      role,
      request.actor,
    );
  }

  @Post(':organizationId/agreements/drafts')
  @RequirePermissions('b2b.agreement.manage')
  createDraft(
    @Param('organizationId', new ParseUUIDPipe()) organizationId: string,
    @Body() dto: SaveB2bAgreementDto,
    @Req() request: AuthenticatedRequest,
  ) {
    return this.workflow.save(organizationId, undefined, dto, request.actor);
  }

  @Put(':organizationId/agreements/:agreementId')
  @RequirePermissions('b2b.agreement.manage')
  saveDraft(
    @Param('organizationId', new ParseUUIDPipe()) organizationId: string,
    @Param('agreementId', new ParseUUIDPipe()) agreementId: string,
    @Body() dto: SaveB2bAgreementDto,
    @Req() request: AuthenticatedRequest,
  ) {
    return this.workflow.save(organizationId, agreementId, dto, request.actor);
  }

  @Post(':organizationId/agreements/:agreementId/submit')
  @RequirePermissions('b2b.agreement.manage')
  submitDraft(
    @Param('organizationId', new ParseUUIDPipe()) organizationId: string,
    @Param('agreementId', new ParseUUIDPipe()) agreementId: string,
    @Body() dto: B2bAgreementActionDto,
    @Req() request: AuthenticatedRequest,
  ) {
    return this.workflow.action(
      organizationId,
      agreementId,
      dto,
      request.actor,
      'SUBMIT',
    );
  }

  @Post(':organizationId/agreements/:agreementId/review')
  @RequirePermissions('b2b.agreement.approve')
  reviewDraft(
    @Param('organizationId', new ParseUUIDPipe()) organizationId: string,
    @Param('agreementId', new ParseUUIDPipe()) agreementId: string,
    @Body() dto: B2bAgreementActionDto,
    @Req() request: AuthenticatedRequest,
  ) {
    if (!dto.decision) throw new BadRequestException('نتیجه بررسی الزامی است.');
    return this.workflow.action(
      organizationId,
      agreementId,
      dto,
      request.actor,
      dto.decision,
    );
  }

  @Get(':organizationId')
  @RequirePermissions(
    'b2b.agency.read',
    'b2b.agreement.read',
    'b2b.credit.read',
    'b2b.rate.read',
  )
  workspace(
    @Param('organizationId', new ParseUUIDPipe()) organizationId: string,
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
    @Param('organizationId', new ParseUUIDPipe()) organizationId: string,
    @Body() dto: UpsertAgencyProfileDto,
    @Req() request: AuthenticatedRequest,
  ) {
    return this.service.upsertProfile(organizationId, dto, request.actor);
  }

  @Post(':organizationId/agreements')
  @RequirePermissions('b2b.agreement.manage')
  agreement(
    @Param('organizationId', new ParseUUIDPipe()) organizationId: string,
    @Body() dto: CreateAgencyAgreementDto,
    @Req() request: AuthenticatedRequest,
  ) {
    return this.service.createAgreement(organizationId, dto, request.actor);
  }

  @Put(':organizationId/credit-policy')
  @RequirePermissions('b2b.credit.manage')
  creditPolicy(
    @Param('organizationId', new ParseUUIDPipe()) organizationId: string,
    @Body() dto: UpsertAgencyCreditPolicyDto,
    @Req() request: AuthenticatedRequest,
  ) {
    return this.service.upsertCreditPolicy(organizationId, dto, request.actor);
  }

  @Post(':organizationId/agreed-rates')
  @RequirePermissions('b2b.rate.manage')
  agreedRate(
    @Param('organizationId', new ParseUUIDPipe()) organizationId: string,
    @Body() dto: CreateAgencyAgreedRateDto,
    @Req() request: AuthenticatedRequest,
  ) {
    return this.service.createRate(organizationId, dto, request.actor);
  }
}
