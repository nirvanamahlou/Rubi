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
  Req,
  UseGuards,
} from '@nestjs/common';
import { AuthGuard } from '../iam/auth.guard';
import { PermissionGuard } from '../iam/permission.guard';
import { RequirePermissions } from '../iam/iam.decorators';
import type { AuthenticatedRequest } from '../iam/iam.types';
import { CallCenterCustomerService } from './call-center-customer.service';
// eslint-disable-next-line @typescript-eslint/consistent-type-imports
import { CallCenterCustomerLinkDto } from './call-center-customer.dto';
@Controller('customer-affairs/call-center')
@UseGuards(AuthGuard, CallCenterActorGuard, PermissionGuard)
export class CallCenterCustomerController {
  constructor(
    @Inject(CallCenterCustomerService)
    private readonly service: CallCenterCustomerService,
  ) {}
  @Get('contacts/:id/customer-candidates')
  @Header('Cache-Control', 'private, no-store')
  @RequirePermissions('customer_affairs.call_center.read', 'customers.read')
  candidates(
    @Req() req: AuthenticatedRequest,
    @Headers('x-branch-id') branch: string | undefined,
    @Param('id', ParseUUIDPipe) id: string,
  ) {
    return this.service.candidates(req.actor, branch, id);
  }
  @Post('requests/:id/customer')
  @Header('Cache-Control', 'private, no-store')
  @RequirePermissions(
    'customer_affairs.call_center.workflow.manage',
    'customers.read',
  )
  link(
    @Req() req: AuthenticatedRequest,
    @Headers('x-branch-id') branch: string | undefined,
    @Param('id', ParseUUIDPipe) id: string,
    @Body() input: CallCenterCustomerLinkDto,
  ) {
    return this.service.link(req.actor, branch, id, input);
  }
}
