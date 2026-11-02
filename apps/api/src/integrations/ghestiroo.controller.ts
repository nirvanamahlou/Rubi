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
  UseInterceptors,
  UploadedFile,
} from '@nestjs/common';
import { FileInterceptor } from '@nestjs/platform-express';
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
  @Get('presence')
  @Header('Cache-Control', 'private, no-store')
  presence(
    @Req() r: AuthenticatedRequest,
    @Query('branchId') branch: string,
    @Query('systemId') system: string,
  ) {
    return this.service.presence(r.actor, branch, system);
  }
  @Post('workspace')
  @Header('Cache-Control', 'private, no-store')
  @UseInterceptors(
    FileInterceptor('file', {
      limits: {
        fileSize: 4 * 1024 * 1024,
        files: 1,
        fields: 1,
        fieldSize: 8 * 1024 * 1024,
      },
    }),
  )
  async workspace(
    @Req() r: AuthenticatedRequest,
    @Query('branchId') branch: string,
    @Body() body: { payload?: string },
    @UploadedFile() file?: { buffer: Buffer; originalname: string },
  ) {
    if (
      r.headers['x-nora-workspace'] !== '1' ||
      typeof body.payload !== 'string'
    )
      throw new BadRequestException();
    let payload: Record<string, unknown>;
    try {
      payload = JSON.parse(body.payload) as Record<string, unknown>;
      if (!payload || typeof payload !== 'object' || Array.isArray(payload))
        throw Error();
    } catch {
      throw new BadRequestException();
    }
    if (file) {
      if (payload.action !== 'preview') throw new BadRequestException();
      payload = {
        ...payload,
        filename: file.originalname,
        content: file.buffer.toString('base64'),
      };
    }
    const [person] = await this.iam.describeMessagingParticipants([
      r.actor.userId,
    ]);
    const result = await this.service.run(
      r.actor,
      branch,
      'workspace',
      '',
      payload,
      person?.displayName ?? '',
    );
    await this.iam.recordSelfActivity(
      r.actor,
      'integrations.ghestiroo.workspace',
      'external_catalogue',
      `${branch}:${String(payload.action)}:${String(payload.kind ?? '')}`,
    );
    return result;
  }
  @Post('dashboard')
  @Header('Cache-Control', 'private, no-store')
  dashboard(
    @Req() r: AuthenticatedRequest,
    @Query('branchId') branch: string,
    @Query('systemId') system: string,
    @Body() body: unknown,
  ) {
    return this.service.dashboard(r.actor, branch, system, body);
  }
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
    const [person] = await this.iam.describeMessagingParticipants([
      r.actor.userId,
    ]);
    const result = await this.service.run(
      r.actor,
      branch,
      'admin-grants',
      '',
      undefined,
      person?.displayName ?? '',
    );
    await this.iam.recordSelfActivity(
      r.actor,
      'integrations.ghestiroo.admin-grant',
      'external_connection',
      branch,
    );
    return result;
  }
}
