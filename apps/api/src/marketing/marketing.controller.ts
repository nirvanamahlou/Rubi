import {
  Body,
  Controller,
  Delete,
  Get,
  Header,
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
import { ApiCookieAuth, ApiExtraModels, ApiTags } from '@nestjs/swagger';

import { AuthGuard } from '../iam/auth.guard';
import { RequirePermissions } from '../iam/iam.decorators';
import type { AuthenticatedRequest } from '../iam/iam.types';
import { PermissionGuard } from '../iam/permission.guard';
import { MarketingProcessService } from './marketing-process.service';
import {
  MarketingAssetListQueryDto,
  MarketingAssetDeleteDto,
  MarketingAssetMutationDto,
  MarketingCampaignMutationDto,
  MarketingPublicationDto,
} from './marketing-records.dto';
import { MarketingRecordsService } from './marketing-records.service';

@ApiTags('Marketing')
@ApiCookieAuth('nora_access')
@ApiExtraModels(
  MarketingAssetListQueryDto,
  MarketingAssetDeleteDto,
  MarketingAssetMutationDto,
  MarketingCampaignMutationDto,
  MarketingPublicationDto,
)
@UseGuards(AuthGuard, PermissionGuard)
@Controller('marketing')
export class MarketingController {
  constructor(
    @Inject(MarketingProcessService)
    private readonly processService: MarketingProcessService,
    @Inject(MarketingRecordsService)
    private readonly records: MarketingRecordsService,
  ) {}

  @Get('process')
  @Header('Cache-Control', 'private, no-store')
  @Header('Vary', 'Cookie')
  @RequirePermissions('marketing.read', 'marketing.process.read')
  process() {
    return { data: this.processService.process() };
  }

  @Get('campaigns')
  @Header('Cache-Control', 'private, no-store')
  @RequirePermissions('marketing.read')
  campaigns(@Req() req: AuthenticatedRequest) {
    return this.records.listCampaigns(req.actor);
  }

  @Get('campaigns/:id')
  @Header('Cache-Control', 'private, no-store')
  @RequirePermissions('marketing.read')
  campaign(
    @Param('id', ParseUUIDPipe) id: string,
    @Req() req: AuthenticatedRequest,
  ) {
    return this.records.campaign(id, req.actor);
  }

  @Post('campaigns')
  @RequirePermissions('marketing.campaign.create')
  createCampaign(
    @Body() input: MarketingCampaignMutationDto,
    @Req() req: AuthenticatedRequest,
    @Headers('x-branch-id') branchId?: string,
    @Headers('idempotency-key') key?: string,
    @Headers('x-request-id') traceId?: string,
  ) {
    return this.records.createCampaign(
      input,
      req.actor,
      branchId,
      key,
      traceId,
    );
  }

  @Patch('campaigns/:id')
  @RequirePermissions('marketing.campaign.update')
  updateCampaign(
    @Param('id', ParseUUIDPipe) id: string,
    @Body() input: MarketingCampaignMutationDto,
    @Req() req: AuthenticatedRequest,
    @Headers('idempotency-key') key?: string,
    @Headers('x-request-id') traceId?: string,
  ) {
    return this.records.updateCampaign(id, input, req.actor, key, traceId);
  }

  @Post('campaigns/:id/publication')
  @RequirePermissions('marketing.read')
  publishCampaign(
    @Param('id', ParseUUIDPipe) id: string,
    @Body() input: MarketingPublicationDto,
    @Req() req: AuthenticatedRequest,
    @Headers('idempotency-key') key?: string,
    @Headers('x-request-id') traceId?: string,
  ) {
    return this.records.publishCampaign(
      id,
      input.expectedVersion,
      input.scheduledFor,
      req.actor,
      key,
      traceId,
    );
  }

  @Get('assets')
  @Header('Cache-Control', 'private, no-store')
  @RequirePermissions('marketing.read')
  assets(
    @Query() query: MarketingAssetListQueryDto,
    @Req() req: AuthenticatedRequest,
  ) {
    return this.records.listAssets(query.kind, req.actor);
  }

  @Post('assets')
  @RequirePermissions('marketing.read')
  createAsset(
    @Body() input: MarketingAssetMutationDto,
    @Req() req: AuthenticatedRequest,
    @Headers('x-branch-id') branchId?: string,
    @Headers('idempotency-key') key?: string,
    @Headers('x-request-id') traceId?: string,
  ) {
    return this.records.saveAsset(
      null,
      input,
      req.actor,
      branchId,
      key,
      traceId,
    );
  }

  @Patch('assets/:id')
  @RequirePermissions('marketing.read')
  updateAsset(
    @Param('id', ParseUUIDPipe) id: string,
    @Body() input: MarketingAssetMutationDto,
    @Req() req: AuthenticatedRequest,
    @Headers('idempotency-key') key?: string,
    @Headers('x-request-id') traceId?: string,
  ) {
    return this.records.saveAsset(
      id,
      input,
      req.actor,
      undefined,
      key,
      traceId,
    );
  }

  @Delete('assets/:id')
  @RequirePermissions('marketing.read')
  deleteAsset(
    @Param('id', ParseUUIDPipe) id: string,
    @Body() input: MarketingAssetDeleteDto,
    @Req() req: AuthenticatedRequest,
    @Headers('idempotency-key') key?: string,
    @Headers('x-request-id') traceId?: string,
  ) {
    return this.records.deleteAsset(
      id,
      input.expectedVersion,
      req.actor,
      key,
      traceId,
    );
  }
}
