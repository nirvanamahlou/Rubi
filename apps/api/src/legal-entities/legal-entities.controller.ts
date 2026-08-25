import {
  Body,
  Controller,
  Get,
  Inject,
  Param,
  Patch,
  Post,
  Query,
  Req,
  UseGuards,
} from '@nestjs/common';
import { ApiCookieAuth, ApiTags } from '@nestjs/swagger';

import { AuthGuard } from '../iam/auth.guard';
import { RequirePermissions } from '../iam/iam.decorators';
import { PermissionGuard } from '../iam/permission.guard';
import type { AuthenticatedRequest } from '../iam/iam.types';
// eslint-disable-next-line @typescript-eslint/consistent-type-imports
import {
  CreateDocumentIssueDto,
  IssueTargetQueryDto,
  LegalEntityStatusDto,
  ReissueDocumentDto,
  SwitchLegalEntityDto,
  UpdateLegalEntityDto,
} from './legal-entities.dto';
import { LegalEntitiesService } from './legal-entities.service';

@ApiTags('Legal Entities')
@ApiCookieAuth('rubi_access')
@UseGuards(AuthGuard, PermissionGuard)
@Controller('legal-entities')
export class LegalEntitiesController {
  constructor(
    @Inject(LegalEntitiesService)
    private readonly service: LegalEntitiesService,
  ) {}

  @Get()
  @RequirePermissions('legal-entity.read')
  list(@Req() request: AuthenticatedRequest) {
    return this.service.list(request.actor);
  }
  @Get('selectable')
  @RequirePermissions('legal-entity.read')
  selectable(@Req() request: AuthenticatedRequest) {
    return this.service.selectable(request.actor);
  }
  @Get('context')
  @RequirePermissions('legal-entity.read')
  current(@Req() request: AuthenticatedRequest) {
    return this.service.current(request.actor);
  }
  @Patch('context')
  @RequirePermissions('legal-entity.switch')
  switch(
    @Body() dto: SwitchLegalEntityDto,
    @Req() request: AuthenticatedRequest,
  ) {
    return this.service.switch(
      dto.selection,
      dto.expectedVersion,
      request.actor,
    );
  }
  @Get('issue-targets')
  @RequirePermissions('legal-entity.document.issue')
  issueTargets(
    @Query() query: IssueTargetQueryDto,
    @Req() request: AuthenticatedRequest,
  ) {
    return this.service.issueTargets(request.actor, query.strategy);
  }
  @Post('document-issues')
  @RequirePermissions('legal-entity.document.issue')
  recordIssue(
    @Body() dto: CreateDocumentIssueDto,
    @Req() request: AuthenticatedRequest,
  ) {
    return this.service.recordIssue(dto, request.actor);
  }
  @Post('document-reissues')
  @RequirePermissions('legal-entity.document.reissue')
  reissue(
    @Body() dto: ReissueDocumentDto,
    @Req() request: AuthenticatedRequest,
  ) {
    return this.service.reissue(dto, request.actor);
  }
  @Get(':id/branding')
  @RequirePermissions('legal-entity.read')
  branding(@Param('id') id: string, @Req() request: AuthenticatedRequest) {
    return this.service.branding(id, request.actor);
  }
  @Get(':id/audit')
  @RequirePermissions('legal-entity.audit.read')
  audit(@Param('id') id: string) {
    return this.service.audit(id);
  }
  @Get(':id')
  @RequirePermissions('legal-entity.read')
  find(@Param('id') id: string, @Req() request: AuthenticatedRequest) {
    return this.service.find(id, request.actor);
  }
  @Patch(':id')
  @RequirePermissions('legal-entity.manage')
  update(
    @Param('id') id: string,
    @Body() dto: UpdateLegalEntityDto,
    @Req() request: AuthenticatedRequest,
  ) {
    return this.service.update(id, dto, request.actor);
  }
  @Patch(':id/status')
  @RequirePermissions('legal-entity.manage')
  status(
    @Param('id') id: string,
    @Body() dto: LegalEntityStatusDto,
    @Req() request: AuthenticatedRequest,
  ) {
    return this.service.setStatus(
      id,
      dto.status,
      dto.expectedVersion,
      dto.confirm,
      request.actor,
    );
  }
}
