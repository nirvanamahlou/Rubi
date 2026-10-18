import {
  Body,
  Controller,
  Headers,
  Inject,
  Param,
  ParseUUIDPipe,
  Post,
  Req,
  UseGuards,
} from '@nestjs/common';
import { IsInt, Min } from 'class-validator';
import { AuthGuard } from '../iam/auth.guard';
import { PermissionGuard } from '../iam/permission.guard';
import { RequirePermissions } from '../iam/iam.decorators';
import type { AuthenticatedRequest } from '../iam/iam.types';
import { MasterOrganizationDirectory } from './master-organization-directory';

export class EnsurePartnerDossierDto {
  @IsInt() @Min(1) version!: number;
}
@Controller('master-data/partner-dossiers')
@UseGuards(AuthGuard, PermissionGuard)
export class PartnerDossierController {
  constructor(
    @Inject(MasterOrganizationDirectory)
    private readonly directory: MasterOrganizationDirectory,
  ) {}
  @Post(':resource/:id')
  @RequirePermissions('master_data.update', 'master_data.create')
  ensure(
    @Param('resource') resource: 'suppliers' | 'brokers',
    @Param('id', ParseUUIDPipe) id: string,
    @Body() body: EnsurePartnerDossierDto,
    @Headers('x-branch-id') branch: string,
    @Req() req: AuthenticatedRequest,
  ) {
    return this.directory.ensurePartnerDossier(
      resource,
      id,
      body.version,
      branch,
      req.actor,
    );
  }
}
