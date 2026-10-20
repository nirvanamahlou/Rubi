import {
  Controller,
  Get,
  Header,
  Inject,
  Param,
  ParseUUIDPipe,
  Query,
  Req,
  UseGuards,
} from '@nestjs/common';
import { AuthGuard } from '../iam/auth.guard';
import type { AuthenticatedRequest } from '../iam/iam.types';
// eslint-disable-next-line @typescript-eslint/consistent-type-imports
import { MasterDataListQueryDto } from './master-data.dto';
import { MasterSelectionDirectory } from './master-selection.directory';
@Controller('master-data/selections')
@UseGuards(AuthGuard)
export class MasterSelectionController {
  constructor(
    @Inject(MasterSelectionDirectory)
    private readonly directory: MasterSelectionDirectory,
  ) {}
  @Get(':workflow/:resource')
  @Header('Cache-Control', 'private, no-store')
  @Header('Vary', 'Cookie')
  list(
    @Param('workflow') workflow: string,
    @Param('resource') resource: string,
    @Query() query: MasterDataListQueryDto,
    @Req() request: AuthenticatedRequest,
  ) {
    return this.directory.list(request.actor, workflow, resource, query);
  }
  @Get(':workflow/:resource/:id')
  @Header('Cache-Control', 'private, no-store')
  @Header('Vary', 'Cookie')
  detail(
    @Param('workflow') workflow: string,
    @Param('resource') resource: string,
    @Param('id', ParseUUIDPipe) id: string,
    @Req() request: AuthenticatedRequest,
  ) {
    return this.directory.detail(request.actor, workflow, resource, id);
  }
}
