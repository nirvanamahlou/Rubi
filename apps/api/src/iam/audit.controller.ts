import { Controller, Get, Inject, UseGuards } from '@nestjs/common';
import { ApiCookieAuth, ApiTags } from '@nestjs/swagger';

import { AuthGuard } from './auth.guard';
import { RequirePermissions } from './iam.decorators';
import { IamService } from './iam.service';
import { PermissionGuard } from './permission.guard';

@ApiTags('IAM / Audit')
@ApiCookieAuth('rubi_access')
@UseGuards(AuthGuard, PermissionGuard)
@Controller('iam/audit-events')
export class AuditController {
  constructor(@Inject(IamService) private readonly iam: IamService) {}
  @Get() @RequirePermissions('iam.audit.read') list() {
    return this.iam.listAuditEvents();
  }
}
