import {
  BadRequestException,
  Body,
  Controller,
  Get,
  Header,
  Inject,
  Param,
  Post,
  Query,
  Req,
  UseGuards,
} from '@nestjs/common';
import { AuthGuard } from '../iam/auth.guard';
import { PermissionGuard } from '../iam/permission.guard';
import type { AuthenticatedRequest } from '../iam/iam.types';
import { GhestirooService } from './ghestiroo.service';
import { IamService } from '../iam/iam.service';

@Controller('integrations/v1/ghestiroo')
@UseGuards(AuthGuard, PermissionGuard)
export class GhestirooController {
  constructor(
    @Inject(GhestirooService) private readonly service: GhestirooService,
    @Inject(IamService) private readonly iam: IamService,
  ) {}
  @Get('connection')
  @Header('Cache-Control', 'private, no-store')
  status(@Req() r: AuthenticatedRequest, @Query('branchId') branch: string) {
    return this.service.status(r.actor, branch);
  }
  @Post('connection')
  @Header('Cache-Control', 'private, no-store')
  async save(
    @Req() r: AuthenticatedRequest,
    @Query('branchId') branch: string,
    @Body() value: unknown,
  ) {
    const result = await this.service.save(
      r.actor,
      branch,
      value,
      r.headers.origin,
    );
    await this.iam.recordSelfActivity(
      r.actor,
      'integrations.ghestiroo.configure',
      'external_connection',
      branch,
    );
    return result;
  }
  @Post('test')
  @Header('Cache-Control', 'private, no-store')
  test(@Req() r: AuthenticatedRequest, @Query('branchId') branch: string) {
    return this.service.run(r.actor, branch, 'capabilities');
  }
  @Get('resources/:resource')
  @Header('Cache-Control', 'private, no-store')
  resources(
    @Req() r: AuthenticatedRequest,
    @Query('branchId') branch: string,
    @Param('resource') resource: string,
    @Query('after') after?: string,
  ) {
    if (!['catalog', 'customers', 'requests', 'cases'].includes(resource))
      throw new BadRequestException();
    return this.service.run(r.actor, branch, resource, after);
  }
  @Post('admin-grants')
  @Header('Cache-Control', 'private, no-store')
  async grant(
    @Req() r: AuthenticatedRequest,
    @Query('branchId') branch: string,
  ) {
    const result = await this.service.run(r.actor, branch, 'admin-grants');
    await this.iam.recordSelfActivity(
      r.actor,
      'integrations.ghestiroo.admin-grant',
      'external_connection',
      branch,
    );
    return result;
  }
}
