import {
  Controller,
  Get,
  Header,
  Inject,
  Query,
  Req,
  UseGuards,
} from '@nestjs/common';
import { AuthGuard } from '../iam/auth.guard';
import { PermissionGuard } from '../iam/permission.guard';
import type { AuthenticatedRequest } from '../iam/iam.types';
import { IamService } from '../iam/iam.service';
import { NiyayeshService } from './niyayesh.service';

@Controller('integrations/v1/niyayesh')
@UseGuards(AuthGuard, PermissionGuard)
export class NiyayeshController {
  constructor(
    @Inject(NiyayeshService) private readonly service: NiyayeshService,
    @Inject(IamService) private readonly iam: IamService,
  ) {}
  @Get('status')
  @Header('Cache-Control', 'private, no-store')
  status(@Req() r: AuthenticatedRequest, @Query('branchId') branch: string) {
    return this.service.status(r.actor, branch);
  }
  @Get('resources')
  @Header('Cache-Control', 'private, no-store')
  async resources(
    @Req() r: AuthenticatedRequest,
    @Query('branchId') branch: string,
    @Query('resource') resource: string,
    @Query('after') after?: string,
    @Query('id') id?: string,
  ) {
    const data = await this.service.resources(
      r.actor,
      branch,
      resource,
      after,
      id,
    );
    await this.iam.recordSelfActivity(
      r.actor,
      'integrations.niyayesh.read',
      'external_resource',
      `${branch}:${resource}:${id ?? `page-${after ?? '0'}`}`,
    );
    return data;
  }
}
