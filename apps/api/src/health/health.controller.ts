import { Controller, Get, Inject, Req } from '@nestjs/common';
import { ApiOkResponse, ApiOperation, ApiTags } from '@nestjs/swagger';
import type { HealthResponse } from '@rubi/contracts';
import type { Request } from 'express';

import { getRequestId } from '../common/request-id.middleware';
import { HealthService } from './health.service';

@ApiTags('health')
@Controller('health')
export class HealthController {
  constructor(
    @Inject(HealthService) private readonly healthService: HealthService,
  ) {}

  @Get()
  @ApiOperation({ summary: 'Report API liveness' })
  @ApiOkResponse({ description: 'The API process is healthy.' })
  getHealth(@Req() request: Request): HealthResponse {
    return {
      data: this.healthService.getHealth(),
      meta: { requestId: getRequestId(request) },
    };
  }
}
