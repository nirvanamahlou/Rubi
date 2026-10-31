import {
  Body,
  type CanActivate,
  Controller,
  type ExecutionContext,
  Get,
  Header,
  Inject,
  Injectable,
  Param,
  ParseUUIDPipe,
  Post,
  Req,
  UnauthorizedException,
  UseGuards,
} from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { timingSafeEqual } from 'node:crypto';
import type { Request } from 'express';
import { AuthGuard } from '../iam/auth.guard';
import { PermissionGuard } from '../iam/permission.guard';
import { RequirePermissions } from '../iam/iam.decorators';
import type { AuthenticatedRequest } from '../iam/iam.types';
// eslint-disable-next-line @typescript-eslint/consistent-type-imports
import {
  TelephonyConnectionDto,
  TelephonyReviewDto,
  TelephonyMappingDto,
  TelephonySyntheticDto,
} from '../customer-affairs/telephony.dto';
import { TelephonyIntegrationService } from './telephony.service';
@Controller('integrations/telephony')
@UseGuards(AuthGuard, PermissionGuard)
@RequirePermissions('customer_affairs.call_center.read')
export class TelephonyIntegrationController {
  constructor(
    @Inject(TelephonyIntegrationService)
    private readonly service: TelephonyIntegrationService,
  ) {}
  @Get()
  @Header('Cache-Control', 'private, no-store')
  settings(@Req() req: AuthenticatedRequest) {
    return this.service.settings(req.actor);
  }
  @Get('operations')
  @Header('Cache-Control', 'private, no-store')
  operations(@Req() req: AuthenticatedRequest) {
    return this.service.operations(req.actor);
  }
  @Get('health')
  @Header('Cache-Control', 'private, no-store')
  health(@Req() req: AuthenticatedRequest) {
    return this.service.health(req.actor);
  }
  @Post('connections')
  configure(
    @Req() req: AuthenticatedRequest,
    @Body() input: TelephonyConnectionDto,
  ) {
    return this.service.configure(req.actor, input);
  }
  @Post('mappings')
  mapping(
    @Req() req: AuthenticatedRequest,
    @Body() input: TelephonyMappingDto,
  ) {
    return this.service.mapping(req.actor, input);
  }
  @Post('replay/:id')
  replay(
    @Req() req: AuthenticatedRequest,
    @Param('id', ParseUUIDPipe) id: string,
  ) {
    return this.service.replay(req.actor, id);
  }
  @Post('review/:id')
  review(
    @Req() req: AuthenticatedRequest,
    @Param('id', ParseUUIDPipe) id: string,
    @Body() input: TelephonyReviewDto,
  ) {
    return this.service.routeReview(req.actor, id, input.userId, input.version);
  }
  @Post('synthetic')
  synthetic(
    @Req() req: AuthenticatedRequest,
    @Body() input: TelephonySyntheticDto,
  ) {
    return this.service.synthetic(
      req.actor,
      input.branchId,
      input.kind,
      input.rootId ?? null,
      input.externalEventId,
      input.anonymous,
    );
  }
}
@Injectable()
export class TelephonyWorkerGuard implements CanActivate {
  constructor(@Inject(ConfigService) private readonly config: ConfigService) {}
  canActivate(context: ExecutionContext) {
    const secret = this.config.get<string>('TELEPHONY_WORKER_SECRET');
    const header = context.switchToHttp().getRequest<Request>()
      .headers.authorization;
    const supplied = header?.startsWith('Bearer ') ? header.slice(7) : '';
    if (
      !secret ||
      secret.length < 32 ||
      Buffer.byteLength(supplied) !== Buffer.byteLength(secret) ||
      !timingSafeEqual(Buffer.from(secret), Buffer.from(supplied))
    )
      throw new UnauthorizedException();
    return true;
  }
}
/** Machine-only transport. It cannot ingest events or impersonate an ERP actor. */
@Controller('internal/telephony-worker')
@UseGuards(TelephonyWorkerGuard)
export class TelephonyWorkerController {
  constructor(
    @Inject(TelephonyIntegrationService)
    private readonly service: TelephonyIntegrationService,
  ) {}
  @Get('pending') @Header('Cache-Control', 'no-store') pending() {
    return this.service.pending();
  }
  @Post(':id/process') process(@Param('id', ParseUUIDPipe) id: string) {
    return this.service.process(id);
  }
}
