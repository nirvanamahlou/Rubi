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
import { IamService } from '../iam/iam.service';
import type { AuthenticatedRequest } from '../iam/iam.types';
import { SiteConnectionService } from './site-connection.service';

@Controller('integrations/v1/sites/:systemId')
@UseGuards(AuthGuard, PermissionGuard)
export class SiteConnectionController {
  constructor(
    @Inject(SiteConnectionService)
    private readonly service: SiteConnectionService,
    @Inject(IamService) private readonly iam: IamService,
  ) {}
  @Get('connection')
  @Header('Cache-Control', 'private, no-store')
  status(
    @Req() request: AuthenticatedRequest,
    @Query('branchId') branch: string,
    @Param('systemId') systemId: string,
  ) {
    return this.service.status(request.actor, branch, systemId);
  }
  @Post('connection')
  @Header('Cache-Control', 'private, no-store')
  async save(
    @Req() request: AuthenticatedRequest,
    @Query('branchId') branch: string,
    @Param('systemId') systemId: string,
    @Body() input: unknown,
  ) {
    if (request.headers['x-nora-site-connection'] !== '1')
      throw new BadRequestException('درخواست ثبت اتصال معتبر نیست.');
    const result = await this.service.save(
      request.actor,
      branch,
      systemId,
      input,
    );
    await this.iam.recordSelfActivity(
      request.actor,
      'integrations.site.configure',
      'external_connection',
      `${branch}:${systemId}`,
    );
    return result;
  }
  @Post('test')
  @Header('Cache-Control', 'private, no-store')
  test(
    @Req() request: AuthenticatedRequest,
    @Query('branchId') branch: string,
    @Param('systemId') systemId: string,
  ) {
    if (request.headers['x-nora-site-connection'] !== '1')
      throw new BadRequestException('درخواست آزمون اتصال معتبر نیست.');
    return this.service.test(request.actor, branch, systemId);
  }
}
