import {
  Body,
  Controller,
  Get,
  Header,
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
import { CallCenterTelephonyService } from './call-center-telephony.service';
// eslint-disable-next-line @typescript-eslint/consistent-type-imports
import { TelephonyActionDto, TelephonyLeaseDto } from './telephony.dto';
@Controller('customer-affairs/call-center/telephony')
@UseGuards(AuthGuard, PermissionGuard)
@RequirePermissions('customer_affairs.call_center.read')
export class CallCenterTelephonyController {
  constructor(
    @Inject(CallCenterTelephonyService)
    private readonly service: CallCenterTelephonyService,
  ) {}
  @Get()
  @Header('Cache-Control', 'private, no-store')
  snapshot(@Req() req: AuthenticatedRequest, @Query('page') page?: string) {
    return this.service.snapshot(req.actor, page ? Number(page) : 1);
  }
  @Get(':id/history')
  @Header('Cache-Control', 'private, no-store')
  history(
    @Req() req: AuthenticatedRequest,
    @Param('id', ParseUUIDPipe) id: string,
  ) {
    return this.service.history(req.actor, id);
  }
  @Get(':id')
  @Header('Cache-Control', 'private, no-store')
  read(
    @Req() req: AuthenticatedRequest,
    @Param('id', ParseUUIDPipe) id: string,
  ) {
    return this.service.read(req.actor, id);
  }
  @Post('lease')
  lease(@Req() req: AuthenticatedRequest, @Body() input: TelephonyLeaseDto) {
    return this.service.lease(req.actor, input.tabId, input.release);
  }
  @Post(':id/actions')
  action(
    @Req() req: AuthenticatedRequest,
    @Param('id', ParseUUIDPipe) id: string,
    @Body() input: TelephonyActionDto,
  ) {
    return this.service.action(req.actor, id, input);
  }
}
