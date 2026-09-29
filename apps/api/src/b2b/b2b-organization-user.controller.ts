import {
  Body,
  Controller,
  Get,
  Inject,
  Param,
  ParseUUIDPipe,
  Post,
  Put,
  Headers,
  Req,
  UseGuards,
} from '@nestjs/common';
import { AuthGuard } from '../iam/auth.guard';
import { PermissionGuard } from '../iam/permission.guard';
import { RequirePermissions } from '../iam/iam.decorators';
import { requestMetadata } from '../iam/auth.controller';
import type { AuthenticatedRequest } from '../iam/iam.types';
import { B2bOrganizationUserService } from './b2b-organization-user.service';
// Runtime DTO metadata is required by ValidationPipe.
// eslint-disable-next-line @typescript-eslint/consistent-type-imports
import {
  CreateB2bOrganizationUserDto,
  SaveB2bOrganizationUserDto,
} from './b2b-organization-user.dto';
@UseGuards(AuthGuard, PermissionGuard)
@Controller('b2b/agencies/:organizationId/users')
export class B2bOrganizationUserController {
  constructor(
    @Inject(B2bOrganizationUserService)
    private readonly service: B2bOrganizationUserService,
  ) {}
  @Get('history') @RequirePermissions('b2b.agency.read') history(
    @Param('organizationId', new ParseUUIDPipe()) org: string,
    @Headers('x-branch-id') branch: string,
    @Req() req: AuthenticatedRequest,
  ) {
    return this.service.history(org, branch, req.actor);
  }
  @Get() @RequirePermissions('b2b.agency.read') list(
    @Param('organizationId', new ParseUUIDPipe()) org: string,
    @Headers('x-branch-id') branch: string,
    @Req() req: AuthenticatedRequest,
  ) {
    return this.service.list(org, branch, req.actor);
  }
  @Post() @RequirePermissions('b2b.agency.manage') create(
    @Param('organizationId', new ParseUUIDPipe()) org: string,
    @Body() dto: CreateB2bOrganizationUserDto,
    @Req() req: AuthenticatedRequest,
  ) {
    return this.service.create(org, dto, req.actor, requestMetadata(req));
  }
  @Put(':id') @RequirePermissions('b2b.agency.manage') update(
    @Param('organizationId', new ParseUUIDPipe()) org: string,
    @Param('id', new ParseUUIDPipe()) id: string,
    @Body() dto: SaveB2bOrganizationUserDto,
    @Req() req: AuthenticatedRequest,
  ) {
    return this.service.update(org, id, dto, req.actor);
  }
}
@UseGuards(AuthGuard)
@Controller('b2b/portal')
export class B2bPortalController {
  constructor(
    @Inject(B2bOrganizationUserService)
    private readonly service: B2bOrganizationUserService,
  ) {}
  @Get('me') me(@Req() req: AuthenticatedRequest) {
    return this.service.identity(req.actor);
  }
  @Get('sections/:section') section(
    @Param('section') section: string,
    @Req() req: AuthenticatedRequest,
  ) {
    return this.service.section(section, req.actor);
  }
}
