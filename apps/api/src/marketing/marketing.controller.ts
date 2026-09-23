import { Controller, Get, Header, Inject, UseGuards } from '@nestjs/common';
import { ApiCookieAuth, ApiTags } from '@nestjs/swagger';

import { AuthGuard } from '../iam/auth.guard';
import { RequirePermissions } from '../iam/iam.decorators';
import { PermissionGuard } from '../iam/permission.guard';
import { MarketingProcessService } from './marketing-process.service';

@ApiTags('Marketing')
@ApiCookieAuth('nora_access')
@UseGuards(AuthGuard, PermissionGuard)
@Controller('marketing')
export class MarketingController {
  constructor(
    @Inject(MarketingProcessService)
    private readonly processService: MarketingProcessService,
  ) {}

  @Get('process')
  @Header('Cache-Control', 'private, no-store')
  @Header('Vary', 'Cookie')
  @RequirePermissions('marketing.read', 'marketing.process.read')
  process() {
    return { data: this.processService.process() };
  }
}
