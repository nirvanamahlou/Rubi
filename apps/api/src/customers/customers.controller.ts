import {
  Body,
  Controller,
  Get,
  Headers,
  Inject,
  Param,
  Patch,
  Post,
  Query,
  Req,
  UseGuards,
} from '@nestjs/common';
import { ApiCookieAuth, ApiTags } from '@nestjs/swagger';
import type { CustomerListQuery } from '@rubi/contracts';

import { AuthGuard } from '../iam/auth.guard';
import { RequirePermissions } from '../iam/iam.decorators';
import type { AuthenticatedRequest } from '../iam/iam.types';
import { PermissionGuard } from '../iam/permission.guard';
// Runtime imports are required for Nest emitDecoratorMetadata and ValidationPipe.
// eslint-disable-next-line @typescript-eslint/consistent-type-imports
import {
  CustomerAddressDto,
  CustomerCompanionDto,
  CustomerConsentDto,
  CustomerContactDto,
  CustomerListQueryDto,
  CustomerMutationDto,
  CustomerStatusDto,
  DuplicateCandidateDto,
  DuplicateReviewDto,
} from './customer.dto';
import { CustomerService } from './customer.service';

@ApiTags('Customers')
@ApiCookieAuth('rubi_access')
@UseGuards(AuthGuard, PermissionGuard)
@Controller('customers')
export class CustomersController {
  constructor(
    @Inject(CustomerService) private readonly service: CustomerService,
  ) {}

  @Get()
  @RequirePermissions('customers.read')
  list(
    @Query() query: CustomerListQueryDto,
    @Req() request: AuthenticatedRequest,
  ) {
    return this.service.list(query as CustomerListQuery, request.actor);
  }

  @Post()
  @RequirePermissions('customers.create')
  create(
    @Body() dto: CustomerMutationDto,
    @Req() request: AuthenticatedRequest,
    @Headers('x-branch-id') branchId?: string,
    @Headers('x-request-id') traceId?: string,
  ) {
    return this.service.create(dto, request.actor, branchId, traceId);
  }

  @Post('duplicate-candidates')
  @RequirePermissions('customers.read')
  duplicates(
    @Body() dto: DuplicateCandidateDto,
    @Req() request: AuthenticatedRequest,
    @Headers('x-branch-id') branchId?: string,
    @Headers('x-request-id') traceId?: string,
  ) {
    return this.service.detectDuplicates(
      dto.sourceCustomerId,
      request.actor,
      branchId,
      traceId,
    );
  }

  @Post('duplicate-candidates/:candidateId/review')
  @RequirePermissions('customers.merge')
  reviewDuplicate(
    @Param('candidateId') candidateId: string,
    @Body() dto: DuplicateReviewDto,
    @Req() request: AuthenticatedRequest,
    @Headers('x-branch-id') branchId?: string,
    @Headers('x-request-id') traceId?: string,
  ) {
    return this.service.reviewDuplicate(
      candidateId,
      dto,
      request.actor,
      branchId,
      traceId,
    );
  }

  @Get(':id')
  @RequirePermissions('customers.read')
  detail(
    @Param('id') id: string,
    @Req() request: AuthenticatedRequest,
    @Headers('x-request-id') traceId?: string,
    @Headers('x-sensitive-read-reason') sensitiveReadReason?: string,
  ) {
    return this.service.detail(id, request.actor, traceId, sensitiveReadReason);
  }

  @Patch(':id')
  @RequirePermissions('customers.update')
  update(
    @Param('id') id: string,
    @Body() dto: CustomerMutationDto,
    @Req() request: AuthenticatedRequest,
    @Headers('x-branch-id') branchId?: string,
    @Headers('x-request-id') traceId?: string,
  ) {
    return this.service.update(id, dto, request.actor, branchId, traceId);
  }

  @Patch(':id/status')
  @RequirePermissions('customers.update')
  status(
    @Param('id') id: string,
    @Body() dto: CustomerStatusDto,
    @Req() request: AuthenticatedRequest,
    @Headers('x-branch-id') branchId?: string,
    @Headers('x-request-id') traceId?: string,
  ) {
    return this.service.status(id, dto, request.actor, branchId, traceId);
  }

  @Get(':id/contacts')
  @RequirePermissions('customers.read')
  async contacts(
    @Param('id') id: string,
    @Req() request: AuthenticatedRequest,
    @Headers('x-request-id') traceId?: string,
  ) {
    const { data } = await this.service.detail(id, request.actor, traceId);
    return { data: data.contacts, version: data.version };
  }

  @Post(':id/contacts')
  @RequirePermissions('customers.update')
  addContact(
    @Param('id') id: string,
    @Body() dto: CustomerContactDto,
    @Req() request: AuthenticatedRequest,
    @Headers('x-branch-id') branchId?: string,
    @Headers('x-request-id') traceId?: string,
  ) {
    return this.service.addContact(id, dto, request.actor, branchId, traceId);
  }

  @Get(':id/addresses')
  @RequirePermissions('customers.read')
  async addresses(
    @Param('id') id: string,
    @Req() request: AuthenticatedRequest,
  ) {
    const { data } = await this.service.maskedDetail(id, request.actor);
    return { data: data.addresses, version: data.version };
  }

  @Post(':id/addresses')
  @RequirePermissions('customers.update')
  addAddress(
    @Param('id') id: string,
    @Body() dto: CustomerAddressDto,
    @Req() request: AuthenticatedRequest,
    @Headers('x-branch-id') branchId?: string,
    @Headers('x-request-id') traceId?: string,
  ) {
    return this.service.addAddress(id, dto, request.actor, branchId, traceId);
  }

  @Get(':id/companions')
  @RequirePermissions('customers.read')
  async companions(
    @Param('id') id: string,
    @Req() request: AuthenticatedRequest,
  ) {
    const { data } = await this.service.maskedDetail(id, request.actor);
    return { data: data.companions, version: data.version };
  }

  @Post(':id/companions')
  @RequirePermissions('customers.update')
  addCompanion(
    @Param('id') id: string,
    @Body() dto: CustomerCompanionDto,
    @Req() request: AuthenticatedRequest,
    @Headers('x-branch-id') branchId?: string,
    @Headers('x-request-id') traceId?: string,
  ) {
    return this.service.addCompanion(id, dto, request.actor, branchId, traceId);
  }

  @Post(':id/consents')
  @RequirePermissions('customers.consent.manage')
  addConsent(
    @Param('id') id: string,
    @Body() dto: CustomerConsentDto,
    @Req() request: AuthenticatedRequest,
    @Headers('x-branch-id') branchId?: string,
    @Headers('x-request-id') traceId?: string,
  ) {
    return this.service.addConsent(id, dto, request.actor, branchId, traceId);
  }
}
