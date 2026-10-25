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
// eslint-disable-next-line @typescript-eslint/consistent-type-imports
import {
  CallCenterSearchDto,
  CallCenterHistoryDto,
} from './call-center-search.dto';
import { CallCenterReadService } from './call-center-read.service';
@Controller('customer-affairs/call-center')
@UseGuards(AuthGuard, PermissionGuard)
@RequirePermissions('customer_affairs.call_center.read')
export class CallCenterReadController {
  constructor(
    @Inject(CallCenterReadService)
    private readonly service: CallCenterReadService,
  ) {}
  @Get('branches')
  @Header('Cache-Control', 'private, no-store')
  branches(@Req() req: AuthenticatedRequest) {
    return this.service.branches(req.actor);
  }
  @Get('teams')
  @Header('Cache-Control', 'private, no-store')
  teams(
    @Req() req: AuthenticatedRequest,
    @Headers('x-branch-id') branch: string | undefined,
  ) {
    return this.service.teams(req.actor, branch);
  }
  @Get('kpis')
  @Header('Cache-Control', 'private, no-store')
  kpis(
    @Req() req: AuthenticatedRequest,
    @Headers('x-branch-id') branch: string | undefined,
  ) {
    return this.service.kpis(req.actor, branch);
  }
  @Post('search')
  @Header('Cache-Control', 'private, no-store')
  search(
    @Req() req: AuthenticatedRequest,
    @Headers('x-branch-id') branch: string | undefined,
    @Body() query: CallCenterSearchDto,
  ) {
    return this.service.search(req.actor, branch, query);
  }
  @Post('without-outcome')
  @Header('Cache-Control', 'private, no-store')
  withoutOutcome(
    @Req() req: AuthenticatedRequest,
    @Headers('x-branch-id') branch: string | undefined,
    @Body() query: CallCenterSearchDto,
  ) {
    return this.service.withoutOutcome(req.actor, branch, query);
  }
  @Post('today-calls')
  @Header('Cache-Control', 'private, no-store')
  todayCalls(
    @Req() req: AuthenticatedRequest,
    @Headers('x-branch-id') branch: string | undefined,
    @Body() query: CallCenterSearchDto,
  ) {
    return this.service.withoutOutcome(req.actor, branch, query, 'today');
  }
  @Post('week-calls')
  @Header('Cache-Control', 'private, no-store')
  weekCalls(
    @Req() req: AuthenticatedRequest,
    @Headers('x-branch-id') branch: string | undefined,
    @Body() query: CallCenterSearchDto,
  ) {
    return this.service.withoutOutcome(req.actor, branch, query, 'week');
  }
  @Post('missed-callbacks')
  @Header('Cache-Control', 'private, no-store')
  missedCallbacks(
    @Req() req: AuthenticatedRequest,
    @Headers('x-branch-id') branch: string | undefined,
    @Body() query: CallCenterSearchDto,
  ) {
    return this.service.missedCallbacks(req.actor, branch, query);
  }
  @Post('report')
  @Header('Cache-Control', 'private, no-store')
  report(
    @Req() req: AuthenticatedRequest,
    @Headers('x-branch-id') branch: string | undefined,
    @Body() query: CallCenterSearchDto,
  ) {
    return this.service.report(req.actor, branch, query);
  }
  @Get('contacts/:id/calls')
  @Header('Cache-Control', 'private, no-store')
  calls(
    @Req() req: AuthenticatedRequest,
    @Headers('x-branch-id') branch: string | undefined,
    @Param('id', ParseUUIDPipe) id: string,
    @Query() query: CallCenterHistoryDto,
  ) {
    return this.service.history(req.actor, branch, id, 'calls', query);
  }
  @Get('contacts/:id/notes')
  @Header('Cache-Control', 'private, no-store')
  notes(
    @Req() req: AuthenticatedRequest,
    @Headers('x-branch-id') branch: string | undefined,
    @Param('id', ParseUUIDPipe) id: string,
    @Query() query: CallCenterHistoryDto,
  ) {
    return this.service.history(req.actor, branch, id, 'notes', query);
  }
}
