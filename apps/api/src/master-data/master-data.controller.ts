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
import type { MasterDataListQuery } from '@rubi/contracts';

import { AuthGuard } from '../iam/auth.guard';
import { RequirePermissions } from '../iam/iam.decorators';
import { PermissionGuard } from '../iam/permission.guard';
import type { AuthenticatedRequest } from '../iam/iam.types';
// eslint-disable-next-line @typescript-eslint/consistent-type-imports
import {
  MasterDataExportDto,
  MasterDataListQueryDto,
  MasterDataMutationDto,
  MasterDataStatusDto,
} from './master-data.dto';
import { assertGenericCurrencyRateMutationAllowed } from './currency-rate.policy';
import { MasterDataService } from './master-data.service';

@ApiTags('Master Data')
@ApiCookieAuth('rubi_access')
@UseGuards(AuthGuard, PermissionGuard)
@Controller('master-data')
export class MasterDataController {
  constructor(
    @Inject(MasterDataService) private readonly service: MasterDataService,
  ) {}

  @Post('exports')
  @RequirePermissions('master_data.export')
  requestExport(
    @Body() dto: MasterDataExportDto,
    @Req() request: AuthenticatedRequest,
    @Headers('x-branch-id') branchId?: string,
  ) {
    return this.service.requestExport(dto, request.actor, branchId);
  }

  @Get('exports/:id')
  @RequirePermissions('master_data.export')
  exportStatus(@Param('id') id: string, @Req() request: AuthenticatedRequest) {
    return this.service.exportStatus(id, request.actor);
  }

  @Get(':resource')
  @RequirePermissions('master_data.read')
  list(
    @Param('resource') resource: string,
    @Query() query: MasterDataListQueryDto,
  ) {
    return this.service.list(resource, query as MasterDataListQuery);
  }

  @Get(':resource/:id')
  @RequirePermissions('master_data.read')
  detail(@Param('resource') resource: string, @Param('id') id: string) {
    return this.service.detail(resource, id);
  }

  @Post(':resource')
  @RequirePermissions('master_data.create')
  create(
    @Param('resource') resource: string,
    @Body() dto: MasterDataMutationDto,
    @Req() request: AuthenticatedRequest,
    @Headers('x-branch-id') branchId?: string,
  ) {
    return this.service.create(resource, dto.values, request.actor, branchId);
  }

  @Patch(':resource/:id')
  @RequirePermissions('master_data.update')
  update(
    @Param('resource') resource: string,
    @Param('id') id: string,
    @Body() dto: MasterDataMutationDto,
    @Req() request: AuthenticatedRequest,
    @Headers('x-branch-id') branchId?: string,
  ) {
    assertGenericCurrencyRateMutationAllowed(resource);
    return this.service.update(
      resource,
      id,
      dto.values,
      dto.version,
      request.actor,
      branchId,
    );
  }

  @Patch(':resource/:id/status')
  @RequirePermissions('master_data.status.manage')
  status(
    @Param('resource') resource: string,
    @Param('id') id: string,
    @Body() dto: MasterDataStatusDto,
    @Req() request: AuthenticatedRequest,
    @Headers('x-branch-id') branchId?: string,
  ) {
    assertGenericCurrencyRateMutationAllowed(resource);
    return this.service.status(
      resource,
      id,
      dto.status,
      dto.version,
      request.actor,
      branchId,
    );
  }
}
