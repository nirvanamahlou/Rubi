import {
  Body,
  Controller,
  Get,
  Headers,
  Inject,
  Param,
  ParseUUIDPipe,
  Patch,
  Post,
  Query,
  Req,
  UseGuards,
} from '@nestjs/common';
import { AuthGuard } from '../iam/auth.guard';
import { RequirePermissions } from '../iam/iam.decorators';
import type { AuthenticatedRequest } from '../iam/iam.types';
import { PermissionGuard } from '../iam/permission.guard';
import { MasterHotelBaseRatesService } from './hotel-base-rates.service';

@Controller('master-data/hotel-rate-periods')
@UseGuards(AuthGuard, PermissionGuard)
export class MasterHotelBaseRatesController {
  constructor(
    @Inject(MasterHotelBaseRatesService)
    private readonly rates: MasterHotelBaseRatesService,
  ) {}

  @Get('options')
  @RequirePermissions('master_data.read')
  options(
    @Query('kind') kind: 'cities' | 'hotels',
    @Query('search') search = '',
    @Query('cityId') cityId?: string,
  ) {
    return this.rates.options(kind, search, cityId);
  }

  @Get()
  @RequirePermissions('master_data.read')
  list(
    @Req() request: AuthenticatedRequest,
    @Query('branchId') branchId?: string,
  ) {
    return this.rates.list(request.actor, branchId);
  }

  @Get(':id')
  @RequirePermissions('master_data.read')
  detail(
    @Param('id', new ParseUUIDPipe()) id: string,
    @Req() request: AuthenticatedRequest,
  ) {
    return this.rates.detail(id, request.actor);
  }

  @Post()
  @RequirePermissions('master_data.create')
  create(
    @Body() body: unknown,
    @Req() request: AuthenticatedRequest,
    @Headers('idempotency-key') key?: string,
  ) {
    return this.rates.create(body, request.actor, key);
  }

  @Patch(':id')
  @RequirePermissions('master_data.update')
  update(
    @Param('id', new ParseUUIDPipe()) id: string,
    @Body() body: unknown,
    @Req() request: AuthenticatedRequest,
    @Headers('idempotency-key') key?: string,
  ) {
    return this.rates.update(id, body, request.actor, key);
  }
}
