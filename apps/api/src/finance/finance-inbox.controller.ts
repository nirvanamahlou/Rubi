import {
  Controller,
  Get,
  Header,
  Inject,
  Req,
  UseGuards,
} from '@nestjs/common';

import { AuthGuard } from '../iam/auth.guard';
import { RequirePermissions } from '../iam/iam.decorators';
import type { AuthenticatedRequest } from '../iam/iam.types';
import { PermissionGuard } from '../iam/permission.guard';
import { FinanceInboxService } from './finance-inbox.service';

@Controller('finance')
@UseGuards(AuthGuard, PermissionGuard)
export class FinanceInboxController {
  constructor(
    @Inject(FinanceInboxService)
    private readonly inbox: FinanceInboxService,
  ) {}

  @Get('inbox')
  @RequirePermissions('finance.read')
  @Header('Cache-Control', 'private, no-store')
  list(@Req() request: AuthenticatedRequest) {
    return this.inbox.list(request.actor);
  }
}
