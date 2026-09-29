import {
  Controller,
  Get,
  Header,
  Headers,
  Inject,
  Param,
  ParseUUIDPipe,
  Req,
  UseGuards,
} from '@nestjs/common';
import { ApiCookieAuth, ApiTags } from '@nestjs/swagger';

import { AuthGuard } from '../iam/auth.guard';
import { RequirePermissions } from '../iam/iam.decorators';
import type { AuthenticatedRequest } from '../iam/iam.types';
import { PermissionGuard } from '../iam/permission.guard';
import { B2bCrmConnectionsService } from './b2b-crm-connections.service';

@ApiTags('B2B Agencies')
@ApiCookieAuth('nora_access')
@UseGuards(AuthGuard, PermissionGuard)
@Controller('b2b/agencies/:organizationId/crm-connections')
export class B2bCrmConnectionsController {
  constructor(
    @Inject(B2bCrmConnectionsService)
    private readonly service: B2bCrmConnectionsService,
  ) {}

  @Get()
  @RequirePermissions('b2b.agency.read')
  @Header('Cache-Control', 'private, no-store')
  @Header('Vary', 'Cookie, X-Branch-Id')
  get(
    @Param('organizationId', new ParseUUIDPipe()) organizationId: string,
    @Headers('x-branch-id') branchId: string | undefined,
    @Req() request: AuthenticatedRequest,
  ) {
    return this.service.get(organizationId, request.actor, branchId);
  }
}
