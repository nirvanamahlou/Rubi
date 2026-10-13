import {
  Body,
  Controller,
  Get,
  Inject,
  Param,
  ParseUUIDPipe,
  Post,
  Req,
  UseGuards,
} from '@nestjs/common';
import type { ProcurementApprovalPolicyCreateV1 } from '@nora/contracts';
import { AuthGuard } from '../iam/auth.guard';
import type { AuthenticatedRequest } from '../iam/iam.types';
import { PermissionGuard } from '../iam/permission.guard';
import { RequirePermissions } from '../iam/iam.decorators';
import { SettingsProcurementPolicyService } from './settings-procurement-policy.service';

@Controller('settings/procurement-approval-policies')
@UseGuards(AuthGuard, PermissionGuard)
@RequirePermissions('procurement.settings.manage')
export class SettingsProcurementPolicyController {
  constructor(
    @Inject(SettingsProcurementPolicyService)
    private readonly policies: SettingsProcurementPolicyService,
  ) {}

  @Get()
  list(@Req() request: AuthenticatedRequest) {
    return this.policies.list(request.actor);
  }

  @Post()
  create(
    @Body() input: ProcurementApprovalPolicyCreateV1,
    @Req() request: AuthenticatedRequest,
  ) {
    return this.policies.create(input, request.actor);
  }

  @Post(':id/deactivate')
  deactivate(
    @Param('id', ParseUUIDPipe) id: string,
    @Req() request: AuthenticatedRequest,
  ) {
    return this.policies.deactivate(id, request.actor);
  }
}
