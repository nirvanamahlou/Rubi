import {
  Body,
  Controller,
  Get,
  Header,
  Headers,
  Inject,
  Param,
  Post,
  Query,
  Req,
  UseGuards,
} from '@nestjs/common';
import { AuthGuard } from '../iam/auth.guard';
import type { AuthenticatedRequest } from '../iam/iam.types';
import { HrConnectionsService } from './hr-connections.service';

@Controller('hr/connections')
@UseGuards(AuthGuard)
export class HrConnectionsController {
  constructor(
    @Inject(HrConnectionsService)
    private readonly service: HrConnectionsService,
  ) {}
  @Get()
  @Header('Cache-Control', 'private, no-store')
  list(
    @Query() query: Record<string, unknown>,
    @Req() req: AuthenticatedRequest,
  ) {
    return this.service.list(query, req.actor);
  }
  @Post()
  @Header('Cache-Control', 'private, no-store')
  create(
    @Body() body: unknown,
    @Headers('idempotency-key') key: string | undefined,
    @Req() req: AuthenticatedRequest,
  ) {
    return this.service.create(body, key, req.actor);
  }
  @Post(':id/response')
  @Header('Cache-Control', 'private, no-store')
  respond(
    @Param('id') id: string,
    @Body() body: unknown,
    @Headers('idempotency-key') key: string | undefined,
    @Req() req: AuthenticatedRequest,
  ) {
    return this.service.decide(id, body, key, req.actor);
  }
}
