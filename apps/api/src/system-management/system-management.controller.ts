import {
  Body,
  Controller,
  Get,
  Inject,
  Param,
  Post,
  Query,
  Req,
  UseGuards,
} from '@nestjs/common';
import { ApiCookieAuth, ApiTags } from '@nestjs/swagger';
import type {
  SystemNumberingSchemeWriteV1,
  SystemNumberIssueInputV1,
  SystemSessionRevokeInputV1,
  SystemUserSessionsRevokeInputV1,
  SystemSettingWriteV1,
} from '@nora/contracts';

import { getRequestId } from '../common/request-id.middleware';
import { AuthGuard } from '../iam/auth.guard';
import { RequirePermissions } from '../iam/iam.decorators';
import type { AuthenticatedRequest } from '../iam/iam.types';
import { PermissionGuard } from '../iam/permission.guard';
import { SystemManagementService } from './system-management.service';

@ApiTags('System management')
@ApiCookieAuth('nora_access')
@UseGuards(AuthGuard, PermissionGuard)
@Controller('system-management/v1')
export class SystemManagementController {
  constructor(
    @Inject(SystemManagementService)
    private readonly system: SystemManagementService,
  ) {}

  @Get('overview')
  @RequirePermissions('system.read')
  overview() {
    return this.system.overview();
  }

  @Get('settings')
  @RequirePermissions('system.settings.read')
  settings() {
    return this.system.listSettings();
  }

  @Post('settings')
  @RequirePermissions('system.settings.manage')
  writeSetting(
    @Body() input: SystemSettingWriteV1,
    @Req() request: AuthenticatedRequest,
  ) {
    return this.system.writeSetting(
      input,
      request.actor,
      this.metadata(request),
    );
  }

  @Get('settings/resolve')
  @RequirePermissions('system.settings.read')
  resolveSetting(
    @Query('namespace') namespace: string,
    @Query('key') key: string,
    @Query('userId') userId?: string,
    @Query('branchId') branchId?: string,
    @Query('legalEntityId') legalEntityId?: string,
  ) {
    return this.system.resolveSetting({
      namespace,
      key,
      ...(userId ? { userId } : {}),
      ...(branchId ? { branchId } : {}),
      ...(legalEntityId ? { legalEntityId } : {}),
    });
  }

  @Get('numbering-schemes')
  @RequirePermissions('system.numbering.read')
  numberingSchemes() {
    return this.system.listNumberingSchemes();
  }

  @Get('sessions')
  @RequirePermissions('system.sessions.read')
  sessions(
    @Req() request: AuthenticatedRequest,
    @Query('userId') userId?: string,
  ) {
    return this.system.listSessions(request.actor, userId);
  }

  @Post('sessions/:id/revoke')
  @RequirePermissions('system.sessions.revoke')
  revokeSession(
    @Param('id') id: string,
    @Body() input: SystemSessionRevokeInputV1,
    @Req() request: AuthenticatedRequest,
  ) {
    return this.system.revokeSession(
      id,
      input,
      request.actor,
      this.metadata(request),
    );
  }

  @Post('sessions/users/:userId/revoke')
  @RequirePermissions('system.sessions.revoke')
  revokeUserSessions(
    @Param('userId') userId: string,
    @Body() input: SystemUserSessionsRevokeInputV1,
    @Req() request: AuthenticatedRequest,
  ) {
    return this.system.revokeUserSessions(
      userId,
      input,
      request.actor,
      this.metadata(request),
    );
  }

  @Post('numbering-schemes')
  @RequirePermissions('system.numbering.manage')
  writeNumberingScheme(
    @Body() input: SystemNumberingSchemeWriteV1,
    @Req() request: AuthenticatedRequest,
  ) {
    return this.system.writeNumberingScheme(
      input,
      request.actor,
      this.metadata(request),
    );
  }

  @Post('numbering-schemes/:id/preview')
  @RequirePermissions('system.numbering.read')
  previewNumber(
    @Param('id') id: string,
    @Body() input: Omit<SystemNumberIssueInputV1, 'idempotencyKey'>,
  ) {
    return this.system.previewNumber(id, input);
  }

  @Post('numbering-schemes/:id/issue')
  @RequirePermissions('system.numbering.manage')
  issueNumber(
    @Param('id') id: string,
    @Body() input: SystemNumberIssueInputV1,
    @Req() request: AuthenticatedRequest,
  ) {
    return this.system.issueNumber(
      id,
      input,
      request.actor,
      this.metadata(request),
    );
  }

  @Get('notification-channels')
  @RequirePermissions('system.notifications.read')
  notificationChannels() {
    return this.system.listNotificationChannels();
  }

  @Post('notification-channels')
  @RequirePermissions('system.notifications.manage')
  writeNotificationChannel(
    @Body()
    input: Parameters<SystemManagementService['writeNotificationChannel']>[0],
    @Req() request: AuthenticatedRequest,
  ) {
    return this.system.writeNotificationChannel(
      input,
      request.actor,
      this.metadata(request),
    );
  }

  @Get('templates')
  @RequirePermissions('system.templates.read')
  templates() {
    return this.system.listTemplates();
  }

  @Post('templates')
  @RequirePermissions('system.templates.manage')
  createTemplate(
    @Body() input: Parameters<SystemManagementService['createTemplate']>[0],
    @Req() request: AuthenticatedRequest,
  ) {
    return this.system.createTemplate(
      input,
      request.actor,
      this.metadata(request),
    );
  }

  @Get('feature-flags')
  @RequirePermissions('system.feature_flags.read')
  featureFlags() {
    return this.system.listFeatureFlags();
  }

  @Post('feature-flags')
  @RequirePermissions('system.feature_flags.manage')
  writeFeatureFlag(
    @Body() input: Parameters<SystemManagementService['writeFeatureFlag']>[0],
    @Req() request: AuthenticatedRequest,
  ) {
    return this.system.writeFeatureFlag(
      input,
      request.actor,
      this.metadata(request),
    );
  }

  @Get('backup-requests')
  @RequirePermissions('system.backup.read')
  backupRequests() {
    return this.system.listBackupRequests();
  }

  @Post('backup-requests')
  @RequirePermissions('system.backup.request')
  requestBackup(
    @Body() input: Parameters<SystemManagementService['requestBackup']>[0],
    @Req() request: AuthenticatedRequest,
  ) {
    return this.system.requestBackup(
      input,
      request.actor,
      this.metadata(request),
    );
  }

  @Get('health')
  @RequirePermissions('system.health.read')
  health() {
    return this.system.health();
  }

  @Get('audit')
  @RequirePermissions('system.audit.read')
  audit(
    @Query('includeSensitive') includeSensitive: string | undefined,
    @Query('reason') reason: string | undefined,
    @Req() request: AuthenticatedRequest,
  ) {
    return this.system.listAudit(
      request.actor,
      includeSensitive === 'true',
      reason,
      this.metadata(request),
    );
  }

  private metadata(request: AuthenticatedRequest) {
    return {
      requestId: getRequestId(request),
      ...(request.ip ? { ipAddress: request.ip } : {}),
    };
  }
}
