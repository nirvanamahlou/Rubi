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

import { AuthGuard } from '../iam/auth.guard';
import { RequirePermissions } from '../iam/iam.decorators';
import { PermissionGuard } from '../iam/permission.guard';
import type { AuthenticatedRequest } from '../iam/iam.types';
// Runtime imports are required for Nest emitDecoratorMetadata and ValidationPipe.
// eslint-disable-next-line @typescript-eslint/consistent-type-imports
import {
  CurrencyRateDecisionDto,
  CurrencyRateListDto,
  CurrencyRateQuoteDto,
} from './currency-rate.dto';
import { CurrencyRateService } from './currency-rate.service';

@ApiTags('Master Data Currency Rates')
@ApiCookieAuth('rubi_access')
@UseGuards(AuthGuard, PermissionGuard)
@Controller('master-data/currency-rates')
export class CurrencyRateController {
  constructor(
    @Inject(CurrencyRateService) private readonly service: CurrencyRateService,
  ) {}

  @Post('quotes')
  @RequirePermissions('master_data.create', 'master_data.currency_rate.create')
  createQuote(
    @Body() dto: CurrencyRateQuoteDto,
    @Req() request: AuthenticatedRequest,
    @Headers('x-branch-id') branchId?: string,
  ) {
    return this.service.createQuote(dto, request.actor, branchId);
  }

  @Get()
  @RequirePermissions('master_data.read')
  history(@Query() query: CurrencyRateListDto) {
    return this.service.history(query);
  }

  @Get('current')
  @RequirePermissions('master_data.read')
  current(
    @Query('fromCurrencyId') from: string,
    @Query('toCurrencyId') to: string,
    @Query('rateType') rateType: 'BUY' | 'SELL' | 'REFERENCE' = 'REFERENCE',
  ) {
    return this.service.current(from, to, rateType);
  }

  @Patch(':id/approve')
  @RequirePermissions('master_data.currency_rate.approve')
  approve(
    @Param('id') id: string,
    @Body() dto: CurrencyRateDecisionDto,
    @Req() request: AuthenticatedRequest,
    @Headers('x-branch-id') branchId?: string,
  ) {
    return this.service.decide(
      id,
      dto.expectedVersion,
      dto.reason,
      'approve',
      request.actor,
      branchId,
    );
  }

  @Patch(':id/reject')
  @RequirePermissions('master_data.currency_rate.approve')
  reject(
    @Param('id') id: string,
    @Body() dto: CurrencyRateDecisionDto,
    @Req() request: AuthenticatedRequest,
    @Headers('x-branch-id') branchId?: string,
  ) {
    return this.service.decide(
      id,
      dto.expectedVersion,
      dto.reason,
      'reject',
      request.actor,
      branchId,
    );
  }
}

@ApiTags('Master Data Audit')
@ApiCookieAuth('rubi_access')
@UseGuards(AuthGuard, PermissionGuard)
@Controller('master-data/audit')
export class MasterDataAuditController {
  constructor(
    @Inject(CurrencyRateService) private readonly service: CurrencyRateService,
  ) {}

  @Get(':resource/:entityId')
  @RequirePermissions('master_data.audit.read')
  history(
    @Param('resource') resource: string,
    @Param('entityId') entityId: string,
    @Query('page') page?: string,
  ) {
    return this.service.audit(
      resource,
      entityId,
      Math.max(1, Number(page) || 1),
    );
  }
}
