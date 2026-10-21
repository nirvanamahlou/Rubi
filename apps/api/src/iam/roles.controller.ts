import { RoleTemplateDto } from './dto/role-template.dto';
import {
  Body,
  Delete,
  Headers,
  Param,
  ParseUUIDPipe,
  Controller,
  Get,
  Inject,
  Post,
  Req,
  UseGuards,
} from '@nestjs/common';
import { ApiBody, ApiCookieAuth, ApiTags } from '@nestjs/swagger';

import { AuthGuard } from './auth.guard';
import { requestMetadata } from './auth.controller';
import { CreateRoleDto } from './dto/create-role.dto';
import { RequirePermissions } from './iam.decorators';
import { IamService } from './iam.service';
import { PermissionGuard } from './permission.guard';
import type { AuthenticatedRequest } from './iam.types';

@ApiTags('IAM / Roles and branches')
@ApiCookieAuth('nora_access')
@UseGuards(AuthGuard, PermissionGuard)
@Controller('iam/access-options')
export class RolesController {
  constructor(@Inject(IamService) private readonly iam: IamService) {}
  @Get('roles')
  @RequirePermissions('iam.users.manage')
  directory(@Req() req: AuthenticatedRequest) {
    return this.iam.listRoleDirectory(req.actor);
  }
  @Delete('roles/:id')
  @RequirePermissions('iam.users.manage')
  remove(
    @Param('id', new ParseUUIDPipe()) id: string,
    @Headers('if-match') revision: string,
    @Req() req: AuthenticatedRequest,
  ) {
    return this.iam.deleteRole(id, revision, req.actor);
  }
  @Get() @RequirePermissions('iam.roles.read') list() {
    return this.iam.listRolesAndBranches();
  }
  @Get('templates')
  @RequirePermissions('iam.users.manage')
  templates() {
    return this.iam.listRoleTemplates();
  }
  @Post('templates')
  @ApiBody({ type: RoleTemplateDto })
  @RequirePermissions('iam.users.manage')
  saveTemplate(
    @Body() dto: RoleTemplateDto,
    @Req() request: AuthenticatedRequest,
  ) {
    return this.iam.saveRoleTemplate(
      dto,
      request.actor,
      requestMetadata(request),
    );
  }
  @Post()
  @ApiBody({ type: CreateRoleDto })
  @RequirePermissions('iam.roles.manage')
  create(@Body() dto: CreateRoleDto, @Req() request: AuthenticatedRequest) {
    return this.iam.createRole(dto, request.actor, requestMetadata(request));
  }
}
