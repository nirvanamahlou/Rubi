import { CallCenterActorGuard } from './call-center-actor.guard';
import {
  Body,
  Controller,
  Get,
  Header,
  Headers,
  Inject,
  Param,
  ParseUUIDPipe,
  Patch,
  Req,
  UseGuards,
} from '@nestjs/common';
import { AuthGuard } from '../iam/auth.guard';
import { PermissionGuard } from '../iam/permission.guard';
import { RequirePermissions } from '../iam/iam.decorators';
import type { AuthenticatedRequest } from '../iam/iam.types';
import { CallCenterOwnerService } from './call-center-owner.service';
// eslint-disable-next-line @typescript-eslint/consistent-type-imports
import { CallCenterOwnerDto } from './call-center-owner.dto';

@Controller('customer-affairs/call-center/contacts')
@UseGuards(AuthGuard, CallCenterActorGuard, PermissionGuard)
@RequirePermissions('customer_affairs.call_center.read')
export class CallCenterOwnerController {
  constructor(
    @Inject(CallCenterOwnerService)
    private readonly service: CallCenterOwnerService,
  ) {}
  @Get(':id/owner')
  @Header('Cache-Control', 'private, no-store')
  options(
    @Req() req: AuthenticatedRequest,
    @Headers('x-branch-id') branch: string | undefined,
    @Param('id', ParseUUIDPipe) id: string,
  ) {
    return this.service.options(req.actor, branch, id);
  }
  @Patch(':id/owner')
  @Header('Cache-Control', 'private, no-store')
  save(
    @Req() req: AuthenticatedRequest,
    @Headers('x-branch-id') branch: string | undefined,
    @Param('id', ParseUUIDPipe) id: string,
    @Body() input: CallCenterOwnerDto,
  ) {
    return this.service.save(req.actor, branch, id, input);
  }
  @Get(':id/owner-history')
  @Header('Cache-Control', 'private, no-store')
  history(
    @Req() req: AuthenticatedRequest,
    @Headers('x-branch-id') branch: string | undefined,
    @Param('id', ParseUUIDPipe) id: string,
  ) {
    return this.service.history(req.actor, branch, id);
  }
}
