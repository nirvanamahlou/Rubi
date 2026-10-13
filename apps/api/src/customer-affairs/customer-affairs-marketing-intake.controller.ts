import {
  Body,
  Controller,
  Get,
  Header,
  Headers,
  Inject,
  Param,
  ParseUUIDPipe,
  Post,
  Query,
  Req,
  UseGuards,
} from '@nestjs/common';
import { ApiCookieAuth, ApiExtraModels, ApiTags } from '@nestjs/swagger';

import { AuthGuard } from '../iam/auth.guard';
import { RequirePermissions } from '../iam/iam.decorators';
import type { AuthenticatedRequest } from '../iam/iam.types';
import { PermissionGuard } from '../iam/permission.guard';
import { CustomerAffairsMarketingIntakeService } from './customer-affairs-marketing-intake.service';
import {
  MarketingIntakeDto,
  MarketingIntakeScoreDto,
  MarketingIntakeSourceQueryDto,
} from './customer-affairs.dto';

@ApiTags('Customer Affairs Marketing Intake')
@ApiCookieAuth('nora_access')
@ApiExtraModels(
  MarketingIntakeDto,
  MarketingIntakeScoreDto,
  MarketingIntakeSourceQueryDto,
)
@UseGuards(AuthGuard, PermissionGuard)
@Controller('customer-affairs/marketing-intakes')
export class CustomerAffairsMarketingIntakeController {
  constructor(
    @Inject(CustomerAffairsMarketingIntakeService)
    private readonly service: CustomerAffairsMarketingIntakeService,
  ) {}

  @Get()
  @Header('Cache-Control', 'private, no-store')
  @RequirePermissions('customer_affairs.lead.read', 'marketing.audience.read')
  list(@Req() req: AuthenticatedRequest) {
    return this.service.list(req.actor);
  }

  @Post()
  @RequirePermissions(
    'customer_affairs.lead.create',
    'marketing.audience.manage',
  )
  create(
    @Body() input: MarketingIntakeDto,
    @Req() req: AuthenticatedRequest,
    @Headers('x-branch-id') branchId?: string,
    @Headers('idempotency-key') key?: string,
    @Headers('x-request-id') traceId?: string,
  ) {
    return this.service.create(
      input as Parameters<CustomerAffairsMarketingIntakeService['create']>[0],
      req.actor,
      branchId,
      key,
      traceId,
    );
  }

  @Post(':id/score')
  @RequirePermissions(
    'customer_affairs.lead.update',
    'marketing.audience.manage',
  )
  score(
    @Param('id', ParseUUIDPipe) id: string,
    @Body() input: MarketingIntakeScoreDto,
    @Req() req: AuthenticatedRequest,
    @Headers('idempotency-key') key?: string,
    @Headers('x-request-id') traceId?: string,
  ) {
    return this.service.score(
      id,
      input.ruleIds,
      input.expectedVersion,
      req.actor,
      key,
      traceId,
    );
  }

  @Get('source-counts')
  @Header('Cache-Control', 'private, no-store')
  @RequirePermissions('customer_affairs.lead.read', 'marketing.audience.read')
  sourceCounts(
    @Query() query: MarketingIntakeSourceQueryDto,
    @Req() req: AuthenticatedRequest,
  ) {
    return this.service.sourceCounts(query.startsAt, query.endsAt, req.actor);
  }
}
