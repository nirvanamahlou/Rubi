import {
  Body,
  Controller,
  Get,
  Headers,
  Inject,
  Param,
  Patch,
  Post,
  Req,
  UseGuards,
} from '@nestjs/common';
import { ApiCookieAuth, ApiTags } from '@nestjs/swagger';

import { AuthGuard } from '../iam/auth.guard';
import { RequirePermissions } from '../iam/iam.decorators';
import type { AuthenticatedRequest } from '../iam/iam.types';
import { PermissionGuard } from '../iam/permission.guard';
// Runtime import is required for Nest emitDecoratorMetadata and ValidationPipe.
// eslint-disable-next-line @typescript-eslint/consistent-type-imports
import { MasterOrganizationAddressDto } from './master-data.dto';
import { MasterOrganizationDirectory } from './master-organization-directory';

@ApiTags('Master Data Organization Addresses')
@ApiCookieAuth('rubi_access')
@UseGuards(AuthGuard, PermissionGuard)
@Controller('master-data/organizations')
export class OrganizationAddressController {
  constructor(
    @Inject(MasterOrganizationDirectory)
    private readonly directory: MasterOrganizationDirectory,
  ) {}

  @Get(':organizationId/addresses')
  @RequirePermissions('master_data.read')
  async list(@Param('organizationId') organizationId: string) {
    return { data: await this.directory.addresses(organizationId) };
  }

  @Post(':organizationId/addresses')
  @RequirePermissions('master_data.update')
  async create(
    @Param('organizationId') organizationId: string,
    @Body() dto: MasterOrganizationAddressDto,
    @Req() request: AuthenticatedRequest,
    @Headers('x-branch-id') branchId?: string,
  ) {
    return {
      data: await this.directory.createAddress(
        organizationId,
        dto,
        request.actor,
        branchId,
      ),
    };
  }

  @Patch(':organizationId/addresses/:addressId')
  @RequirePermissions('master_data.update')
  async update(
    @Param('organizationId') organizationId: string,
    @Param('addressId') addressId: string,
    @Body() dto: MasterOrganizationAddressDto,
    @Req() request: AuthenticatedRequest,
    @Headers('x-branch-id') branchId?: string,
  ) {
    return {
      data: await this.directory.updateAddress(
        organizationId,
        addressId,
        dto,
        request.actor,
        branchId,
      ),
    };
  }
}
