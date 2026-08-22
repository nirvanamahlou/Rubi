import {
  Body,
  Controller,
  Get,
  Inject,
  Param,
  Patch,
  Post,
  Req,
  UseGuards,
} from '@nestjs/common';
import { ApiBody, ApiCookieAuth, ApiTags } from '@nestjs/swagger';

import { AuthGuard } from './auth.guard';
import { requestMetadata } from './auth.controller';
import { CreateUserDto } from './dto/create-user.dto';
import { UpdateUserAccessDto } from './dto/update-user-access.dto';
import { UpdateUserStatusDto } from './dto/update-user-status.dto';
import { RequirePermissions } from './iam.decorators';
import { IamService } from './iam.service';
import { PermissionGuard } from './permission.guard';
import type { AuthenticatedRequest } from './iam.types';

@ApiTags('IAM / Users')
@ApiCookieAuth('rubi_access')
@UseGuards(AuthGuard, PermissionGuard)
@Controller('iam/users')
export class UsersController {
  constructor(@Inject(IamService) private readonly iam: IamService) {}
  @Get() @RequirePermissions('iam.users.read') list() {
    return this.iam.listUsers();
  }
  @Post()
  @ApiBody({ type: CreateUserDto })
  @RequirePermissions('iam.users.manage')
  create(@Body() dto: CreateUserDto, @Req() req: AuthenticatedRequest) {
    return this.iam.createUser(dto, req.actor, requestMetadata(req));
  }
  @Patch(':id/access')
  @ApiBody({ type: UpdateUserAccessDto })
  @RequirePermissions('iam.users.manage')
  access(
    @Param('id') id: string,
    @Body() dto: UpdateUserAccessDto,
    @Req() req: AuthenticatedRequest,
  ) {
    return this.iam.updateUserAccess(id, dto, req.actor, requestMetadata(req));
  }
  @Patch(':id/status')
  @ApiBody({ type: UpdateUserStatusDto })
  @RequirePermissions('iam.users.manage')
  status(
    @Param('id') id: string,
    @Body() dto: UpdateUserStatusDto,
    @Req() req: AuthenticatedRequest,
  ) {
    return this.iam.updateUserStatus(
      id,
      dto.status,
      req.actor,
      requestMetadata(req),
    );
  }
}
