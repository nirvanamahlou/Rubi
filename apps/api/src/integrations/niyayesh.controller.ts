import {
  Controller,
  Body,
  BadRequestException,
  Get,
  Header,
  Inject,
  Query,
  Req,
  Post,
  Param,
  UploadedFile,
  UseInterceptors,
  UseGuards,
} from '@nestjs/common';
import { FileInterceptor } from '@nestjs/platform-express';
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
  @Get('presence')
  @Header('Cache-Control', 'private, no-store')
  presence(
    @Req() r: AuthenticatedRequest,
    @Query('branchId') branch: string,
    @Query('systemId') systemId: string,
  ) {
    return this.service.presence(r.actor, branch, systemId);
  }
  @Get('report')
  @Header('Cache-Control', 'private, no-store')
  report(
    @Req() r: AuthenticatedRequest,
    @Query('branchId') branch: string,
    @Query('from') from: string,
    @Query('to') to: string,
    @Query('systemId') systemId?: string,
  ) {
    return this.service.report(r.actor, branch, from, to, systemId);
  }
  @Get('catalogue/:resource')
  @Header('Cache-Control', 'private, no-store')
  editor(
    @Req() r: AuthenticatedRequest,
    @Param('resource') resource: string,
    @Query('branchId') branch: string,
    @Query('id') id?: string,
  ) {
    return this.service.editor(r.actor, branch, resource, id);
  }
  @Post('catalogue/:resource')
  @Header('Cache-Control', 'private, no-store')
  async saveCatalogue(
    @Req() r: AuthenticatedRequest,
    @Param('resource') resource: string,
    @Query('branchId') branch: string,
    @Body() input: unknown,
  ) {
    const data = await this.service.saveCatalogue(
      r.actor,
      branch,
      resource,
      input,
    );
    await this.iam.recordSelfActivity(
      r.actor,
      'integrations.niyayesh.catalogue.write',
      'external_catalogue',
      `${branch}:${resource}`,
    );
    return data;
  }
  @Get('dashboard')
  @Header('Cache-Control', 'private, no-store')
  dashboard(@Req() r: AuthenticatedRequest, @Query('branchId') branch: string) {
    return this.service.dashboard(r.actor, branch);
  }
  @Get('workbooks/hotels/export')
  @Header('Cache-Control', 'private, no-store')
  hotelExport(
    @Req() r: AuthenticatedRequest,
    @Query('branchId') branch: string,
    @Query('city') city: string,
  ) {
    return this.service.hotelExport(r.actor, branch, city);
  }
  @Get('workbooks/:kind/template')
  @Header('Cache-Control', 'private, no-store')
  template(
    @Req() r: AuthenticatedRequest,
    @Param('kind') kind: string,
    @Query('branchId') branch: string,
  ) {
    return this.service.workbook(r.actor, branch, kind);
  }
  @Post('workbooks/:kind')
  @Header('Cache-Control', 'private, no-store')
  @UseInterceptors(
    FileInterceptor('file', {
      limits: { fileSize: 4 * 1024 * 1024, files: 1, fields: 0 },
    }),
  )
  async workbook(
    @Req() r: AuthenticatedRequest,
    @Param('kind') kind: string,
    @Query('branchId') branch: string,
    @UploadedFile() file: { buffer: Buffer; originalname: string } | undefined,
    @Query('apply') apply: string,
    @Query('tourId') tourId?: string,
    @Query('proof') proof?: string,
    @Query('command') command?: string,
  ) {
    if (
      r.headers['x-nora-workbook'] !== '1' ||
      !file ||
      !['true', 'false'].includes(apply)
    )
      throw new BadRequestException('فایل و نوع عملیات لازم است.');
    const result = await this.service.workbook(
      r.actor,
      branch,
      kind,
      file,
      apply === 'true',
      tourId,
      proof,
      command,
    );
    await this.iam.recordSelfActivity(
      r.actor,
      apply === 'true'
        ? 'integrations.niyayesh.import'
        : 'integrations.niyayesh.preview',
      'external_workbook',
      `${branch}:${kind}:${command}`,
    );
    return result;
  }
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
    @Query('metric') metric?: string,
    @Query('reportMetric') reportMetric?: string,
    @Query('from') from?: string,
    @Query('to') to?: string,
    @Query('systemId') systemId?: string,
  ) {
    const data = await this.service.resources(
      r.actor,
      branch,
      resource,
      after,
      id,
      metric,
      reportMetric,
      from,
      to,
      systemId,
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
