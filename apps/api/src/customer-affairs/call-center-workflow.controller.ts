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
import { AuthGuard } from '../iam/auth.guard';
import { PermissionGuard } from '../iam/permission.guard';
import { RequirePermissions } from '../iam/iam.decorators';
import type { AuthenticatedRequest } from '../iam/iam.types';
import { CallCenterWorkflowService } from './call-center-workflow.service';
// Runtime DTO metadata is required by the validation pipe.
// eslint-disable-next-line @typescript-eslint/consistent-type-imports
import {
  CallCenterFollowUpDto,
  CallCenterRequestDto,
  CallCenterQueueDto,
  CallCenterRequestPageDto,
  CallCenterReferralDto,
  CallCenterLinkDto,
} from './call-center-workflow.dto';

@UseGuards(AuthGuard, CallCenterActorGuard, PermissionGuard)
@Controller('customer-affairs/call-center')
export class CallCenterWorkflowController {
  constructor(
    @Inject(CallCenterWorkflowService)
    private readonly service: CallCenterWorkflowService,
  ) {}
  @Post('requests/:id/referrals')
  @Header('Cache-Control', 'private, no-store')
  @RequirePermissions('customer_affairs.call_center.workflow.manage')
  refer(
    @Req() req: AuthenticatedRequest,
    @Param('id', ParseUUIDPipe) id: string,
    @Body() input: CallCenterReferralDto,
    @Headers('x-branch-id') branch?: string,
  ) {
    return this.service.refer(req.actor, branch, id, input);
  }
  @Post('calls/:id/request')
  @Header('Cache-Control', 'private, no-store')
  @RequirePermissions('customer_affairs.call_center.workflow.manage')
  link(
    @Req() req: AuthenticatedRequest,
    @Param('id', ParseUUIDPipe) id: string,
    @Body() input: CallCenterLinkDto,
    @Headers('x-branch-id') branch?: string,
  ) {
    return this.service.link(req.actor, branch, id, input);
  }
  @Get('queue')
  @Header('Cache-Control', 'private, no-store')
  @RequirePermissions('customer_affairs.call_center.read')
  queue(
    @Req() req: AuthenticatedRequest,
    @Query() query: CallCenterQueueDto,
    @Headers('x-branch-id') branch?: string,
  ) {
    return this.service.queue(req.actor, branch, query.view, query.page);
  }
  @Get('operators')
  @Header('Cache-Control', 'private, no-store')
  @RequirePermissions('customer_affairs.call_center.read')
  options(
    @Req() req: AuthenticatedRequest,
    @Headers('x-branch-id') branch?: string,
  ) {
    return this.service.options(req.actor, branch);
  }
  @Get('request-operators')
  @Header('Cache-Control', 'private, no-store')
  @RequirePermissions('customer_affairs.call_center.workflow.manage')
  requestOptions(
    @Req() req: AuthenticatedRequest,
    @Headers('x-branch-id') branch?: string,
  ) {
    return this.service.requestOptions(req.actor, branch);
  }
  @Get('contacts/:id/next-action')
  @Header('Cache-Control', 'private, no-store')
  @RequirePermissions('customer_affairs.call_center.read')
  nextAction(
    @Req() req: AuthenticatedRequest,
    @Param('id', ParseUUIDPipe) id: string,
    @Headers('x-branch-id') branch?: string,
  ) {
    return this.service.nextAction(req.actor, branch, id);
  }
  @Get('contacts/:id/requests')
  @Header('Cache-Control', 'private, no-store')
  @RequirePermissions('customer_affairs.call_center.read')
  list(
    @Req() req: AuthenticatedRequest,
    @Query() query: CallCenterRequestPageDto,
    @Param('id', ParseUUIDPipe) id: string,
    @Headers('x-branch-id') branch?: string,
  ) {
    return this.service.list(
      req.actor,
      branch,
      id,
      query.page,
      query.taskPage,
      query.requestId,
      query.openOnly === 'true',
    );
  }
  @Post('contacts/:id/requests')
  @Header('Cache-Control', 'private, no-store')
  @RequirePermissions('customer_affairs.call_center.workflow.manage')
  save(
    @Req() req: AuthenticatedRequest,
    @Param('id', ParseUUIDPipe) id: string,
    @Body() input: CallCenterRequestDto,
    @Headers('x-branch-id') branch?: string,
  ) {
    return this.service.saveRequest(req.actor, branch, id, input);
  }
  @Post('requests/:id/follow-ups')
  @Header('Cache-Control', 'private, no-store')
  @RequirePermissions('customer_affairs.call_center.workflow.manage')
  followUp(
    @Req() req: AuthenticatedRequest,
    @Param('id', ParseUUIDPipe) id: string,
    @Body() input: CallCenterFollowUpDto,
    @Headers('x-branch-id') branch?: string,
  ) {
    return this.service.followUp(req.actor, branch, id, input);
  }
}
