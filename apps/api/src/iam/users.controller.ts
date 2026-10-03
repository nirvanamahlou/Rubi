import {
  Body,
  Controller,
  Get,
  ForbiddenException,
  Inject,
  HttpCode,
  ParseUUIDPipe,
  Param,
  Patch,
  Post,
  Req,
  UseGuards,
} from '@nestjs/common';
import { ApiBody, ApiCookieAuth, ApiTags } from '@nestjs/swagger';

import { AuthGuard } from './auth.guard';
import { requestMetadata } from './auth.controller';
import { ResetUserPasswordDto } from './dto/reset-user-password.dto';
import { CreateUserDto } from './dto/create-user.dto';
import { UpdateUserAccessDto } from './dto/update-user-access.dto';
import { UpdateUserStatusDto } from './dto/update-user-status.dto';
import { RequirePermissions } from './iam.decorators';
import { IamService } from './iam.service';
import { PermissionGuard } from './permission.guard';
import type { AuthenticatedRequest } from './iam.types';

@ApiTags('IAM / Users')
@ApiCookieAuth('nora_access')
@UseGuards(AuthGuard, PermissionGuard)
@Controller('iam/users')
export class UsersController {
  constructor(@Inject(IamService) private readonly iam: IamService) {}
  @Get() @RequirePermissions('iam.users.read') list() {
    return this.iam.listUsers();
  }
  @Get('access-options')
  @RequirePermissions('iam.users.read')
  options(@Req() req: AuthenticatedRequest) {
    return this.iam.listUserAccessOptions(req.actor);
  }
  @Post()
  @ApiBody({ type: CreateUserDto })
  @RequirePermissions('iam.users.manage')
  create(@Body() dto: CreateUserDto, @Req() req: AuthenticatedRequest) {
    return this.iam.createUser(dto, req.actor, requestMetadata(req));
  }
  @Patch(':id/password')
  @HttpCode(200)
  @ApiBody({ type: ResetUserPasswordDto })
  @RequirePermissions('iam.users.manage')
  async password(
    @Param('id', new ParseUUIDPipe()) id: string,
    @Body() dto: ResetUserPasswordDto,
    @Req() req: AuthenticatedRequest,
  ) {
    if (req.headers['x-nora-password-change'] !== '1')
      throw new ForbiddenException('درخواست تغییر رمز معتبر نیست.');
    await this.iam.resetUserPassword(
      id,
      dto.newPassword,
      req.actor,
      requestMetadata(req),
    );
    return { success: true };
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
