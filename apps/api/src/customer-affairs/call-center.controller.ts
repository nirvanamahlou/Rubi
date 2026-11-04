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
  Post,
  Query,
  Req,
  UseGuards,
} from '@nestjs/common';
import { ApiCookieAuth, ApiTags } from '@nestjs/swagger';
import { AuthGuard } from '../iam/auth.guard';
import { PermissionGuard } from '../iam/permission.guard';
import { RequirePermissions } from '../iam/iam.decorators';
import type { AuthenticatedRequest } from '../iam/iam.types';
// DTO runtime imports supply Nest validation metadata.
// eslint-disable-next-line @typescript-eslint/consistent-type-imports
import {
  CallCenterCallDto,
  CallCenterListDto,
  CallCenterNoteDto,
} from './call-center.dto';
import { CallCenterService } from './call-center.service';

@ApiTags('Customer Affairs Call Center')
@ApiCookieAuth('nora_access')
@UseGuards(AuthGuard, CallCenterActorGuard, PermissionGuard)
@Controller('customer-affairs/call-center')
export class CallCenterController {
  constructor(
    @Inject(CallCenterService) private readonly service: CallCenterService,
  ) {}
  @Get()
  @Header('Cache-Control', 'private, no-store')
  @RequirePermissions('customer_affairs.call_center.read')
  list(
    @Req() req: AuthenticatedRequest,
    @Headers('x-branch-id') branch: string | undefined,
    @Query() query: CallCenterListDto,
  ) {
    return this.service.list(req.actor, branch, query);
  }
  @Post('calls')
  @Header('Cache-Control', 'private, no-store')
  @RequirePermissions('customer_affairs.call_center.calls.create')
  create(
    @Req() req: AuthenticatedRequest,
    @Headers('x-branch-id') branch: string | undefined,
    @Body() input: CallCenterCallDto,
  ) {
    return this.service.create(input, req.actor, branch);
  }
  @Get('destination-options')
  @Header('Cache-Control', 'private, no-store')
  @RequirePermissions('customer_affairs.call_center.calls.create')
  destinationOptions(
    @Req() req: AuthenticatedRequest,
    @Headers('x-branch-id') branch: string | undefined,
  ) {
    return this.service.destinationOptions(req.actor, branch);
  }
  @Get('calls/:id')
  @Header('Cache-Control', 'private, no-store')
  @RequirePermissions('customer_affairs.call_center.read')
  getCall(
    @Req() req: AuthenticatedRequest,
    @Headers('x-branch-id') branch: string | undefined,
    @Param('id', ParseUUIDPipe) id: string,
  ) {
    return this.service.getCall(id, req.actor, branch);
  }
  @Post('contacts/:id/notes')
  @Header('Cache-Control', 'private, no-store')
  @RequirePermissions('customer_affairs.call_center.notes.create')
  note(
    @Req() req: AuthenticatedRequest,
    @Headers('x-branch-id') branch: string | undefined,
    @Param('id', ParseUUIDPipe) id: string,
    @Body() input: CallCenterNoteDto,
  ) {
    return this.service.note(id, input, req.actor, branch);
  }
}
