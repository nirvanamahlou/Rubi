import {
  Controller,
  Get,
  Header,
  Headers,
  Inject,
  Param,
  ParseUUIDPipe,
  Query,
  Req,
  UseGuards,
} from '@nestjs/common';
import type { OrganizationActivityQuery } from '@rubi/contracts';
import { AuthGuard } from '../iam/auth.guard';
import { PermissionGuard } from '../iam/permission.guard';
import { RequirePermissions } from '../iam/iam.decorators';
import type { AuthenticatedRequest } from '../iam/iam.types';
import { B2bActivityService } from './b2b-activity.service';

@Controller('b2b/agencies/:organizationId/activity')
@UseGuards(AuthGuard, PermissionGuard)
export class B2bActivityController {
  constructor(
    @Inject(B2bActivityService) private readonly service: B2bActivityService,
  ) {}
  @Get()
  @RequirePermissions('b2b.agency.read')
  @Header('Cache-Control', 'private, no-store')
  @Header('Vary', 'Cookie, X-Branch-Id')
  list(
    @Param('organizationId', new ParseUUIDPipe()) org: string,
    @Headers('x-branch-id') branch: string,
    @Req() req: AuthenticatedRequest,
    @Query() query: OrganizationActivityQuery,
  ) {
    return this.service.list(org, branch, req.actor, query);
  }
}
