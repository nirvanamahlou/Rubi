import {
  Controller,
  Post,
  Get,
  Param,
  ParseUUIDPipe,
  Req,
  Headers,
  UseGuards,
  Inject,
  ForbiddenException,
} from '@nestjs/common';
import { canViewRoute } from '@nora/contracts';
import { AuthGuard } from '../iam/auth.guard';
import type { AuthenticatedRequest } from '../iam/iam.types';
import { MasterSalesDirectory } from '../master-data/master-sales-directory';
import { CustomerService } from '../customers/customer.service';
@Controller('sales/agency-customers')
@UseGuards(AuthGuard)
export class SalesAgencyCustomerController {
  constructor(
    @Inject(MasterSalesDirectory)
    private readonly directory: MasterSalesDirectory,
    @Inject(CustomerService) private readonly customers: CustomerService,
  ) {}
  @Get(':organizationId/contact')
  async contact(
    @Param('organizationId', ParseUUIDPipe) organizationId: string,
    @Req() request: AuthenticatedRequest,
    @Headers('x-branch-id') branchId?: string,
  ) {
    this.assertAccess(request, branchId);
    return this.directory.agencyBuyerContact(
      organizationId,
      request.actor,
      branchId,
    );
  }

  private assertAccess(request: AuthenticatedRequest, branchId?: string) {
    if (
      !request.actor.permissions.includes('sales.contracts.create') ||
      !canViewRoute(request.actor.permissions, '/sales/contracts/new') ||
      !request.actor.branchIds.length ||
      (branchId && !request.actor.branchIds.includes(branchId))
    )
      throw new ForbiddenException();
  }
  @Post(':organizationId')
  async resolve(
    @Param('organizationId', ParseUUIDPipe) organizationId: string,
    @Req() request: AuthenticatedRequest,
    @Headers('x-branch-id') branchId?: string,
    @Headers('x-request-id') traceId?: string,
  ) {
    this.assertAccess(request, branchId);
    const { data } = await this.directory.detail(
      'organizations',
      organizationId,
    );
    return this.customers.resolveSalesOrganization(
      { id: data.id, name: data.name },
      request.actor,
      branchId,
      traceId,
    );
  }
}
