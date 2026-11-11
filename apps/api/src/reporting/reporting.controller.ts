import {
  Body,
  Controller,
  Delete,
  Get,
  Header,
  HttpCode,
  Inject,
  Param,
  ParseUUIDPipe,
  Post,
  Query,
  Req,
  StreamableFile,
  UseGuards,
} from '@nestjs/common';
import { ApiBody, ApiCookieAuth, ApiTags } from '@nestjs/swagger';

import { AuthGuard } from '../iam/auth.guard';
import { RequireAccessControls } from '../iam/iam.decorators';
import { PermissionGuard } from '../iam/permission.guard';
import type { AuthenticatedRequest } from '../iam/iam.types';
import type {
  ReportQueryV1,
  ReportingExportRequestV1,
} from './reporting.contracts';
import {
  ExportCreateDto,
  ReportQueryDto,
  SaveReportDto,
  ShareSavedReportDto,
} from './reporting.dto';
import { ReportingExportQueue } from './reporting-export-queue.service';
import { ReportingService } from './reporting.service';

@ApiTags('Reporting')
@ApiCookieAuth('rubi_access')
@UseGuards(AuthGuard, PermissionGuard)
@Controller('reports')
export class ReportingController {
  constructor(
    @Inject(ReportingService) private readonly service: ReportingService,
    @Inject(ReportingExportQueue) private readonly queue: ReportingExportQueue,
  ) {}

  @Get('catalog')
  @RequireAccessControls('reports.view.catalog')
  @Header('Cache-Control', 'private, no-store')
  catalog(@Req() request: AuthenticatedRequest) {
    return this.service.catalog(request.actor);
  }

  @Get('saved')
  @RequireAccessControls('reports.view.saved')
  saved(@Req() request: AuthenticatedRequest) {
    return this.service.savedReports(request.actor);
  }

  @Get('workspace-counts')
  @Header('Cache-Control', 'private, no-store')
  workspaceCounts(@Req() request: AuthenticatedRequest) {
    return this.service.workspaceCounts(request.actor);
  }

  @Post('saved')
  @RequireAccessControls('reports.view.saved')
  @ApiBody({ type: SaveReportDto })
  save(@Body() body: SaveReportDto, @Req() request: AuthenticatedRequest) {
    return this.service.saveReport(body, request.actor);
  }

  @Get(':code/share-recipients')
  @RequireAccessControls('reports.view.shared')
  @Header('Cache-Control', 'private, no-store')
  shareRecipients(
    @Param('code') code: string,
    @Req() request: AuthenticatedRequest,
  ) {
    return this.service.sharingRecipients(code, request.actor);
  }

  @Get('saved/:id/shares')
  @RequireAccessControls('reports.view.shared')
  @Header('Cache-Control', 'private, no-store')
  savedShares(@Param('id') id: string, @Req() request: AuthenticatedRequest) {
    return this.service.savedReportShares(id, request.actor);
  }

  @Post('saved/:id/shares')
  @RequireAccessControls('reports.view.shared')
  @ApiBody({ type: ShareSavedReportDto })
  shareSaved(
    @Param('id') id: string,
    @Body() body: ShareSavedReportDto,
    @Req() request: AuthenticatedRequest,
  ) {
    return this.service.shareSavedReport(
      id,
      body.recipientUserIds,
      request.actor,
    );
  }

  @Delete('saved/:id')
  @RequireAccessControls('reports.view.saved')
  removeSaved(@Param('id') id: string, @Req() request: AuthenticatedRequest) {
    return this.service.deleteSavedReport(id, request.actor);
  }

  @Get('runs')
  @RequireAccessControls('reports.view.recent')
  runs(@Req() request: AuthenticatedRequest) {
    return this.service.runs(request.actor);
  }

  @Get('exports')
  @RequireAccessControls('reports.view.downloads')
  exports(@Req() request: AuthenticatedRequest) {
    return this.service.exports(request.actor);
  }

  @Get('dashboard/projection')
  @Header('Cache-Control', 'private, no-store')
  dashboardProjection(
    @Query() query: Record<string, string | undefined>,
    @Req() request: AuthenticatedRequest,
  ) {
    return this.service.dashboardProjection(query, request.actor);
  }

  @Post('exports/:id/retry')
  @RequireAccessControls('reports.view.downloads')
  retryExport(@Param('id') id: string, @Req() request: AuthenticatedRequest) {
    return this.service.retryExport(id, request.actor);
  }

  @Get('exports/:id/download')
  @RequireAccessControls('reports.view.downloads')
  async download(
    @Param('id') id: string,
    @Req() request: AuthenticatedRequest,
  ) {
    const file = await this.service.downloadExport(id, request.actor);
    return new StreamableFile(file.stream, {
      type: file.contentType,
      disposition:
        "attachment; filename*=UTF-8''" + encodeURIComponent(file.fileName),
      length: file.sizeBytes,
    });
  }

  @Get(':code/metadata')
  @Header('Cache-Control', 'private, no-store')
  metadata(@Param('code') code: string, @Req() request: AuthenticatedRequest) {
    return this.service.metadata(code, request.actor);
  }

  @Get(':code/readiness')
  @Header('Cache-Control', 'private, no-store')
  readiness(@Param('code') code: string, @Req() request: AuthenticatedRequest) {
    return this.service.readiness(code, request.actor);
  }

  @Post(':code/query')
  query(
    @Param('code') code: string,
    @Body() body: ReportQueryV1,
    @Req() request: AuthenticatedRequest,
  ) {
    return this.service.query(code, body, request.actor);
  }

  @Post(':code/preview')
  @Header('Cache-Control', 'private, no-store')
  preview(
    @Param('code') code: string,
    @Body() body: ReportQueryV1,
    @Req() request: AuthenticatedRequest,
  ) {
    return this.service.preview(code, body, request.actor);
  }

  @Post(':code/preview-run')
  @Header('Cache-Control', 'private, no-store')
  @ApiBody({ type: ReportQueryDto })
  previewRun(
    @Param('code') code: string,
    @Body() body: ReportQueryDto,
    @Req() request: AuthenticatedRequest,
  ) {
    return this.service.previewRun(code, body, request.actor);
  }

  @Post(':code/export-jobs')
  @HttpCode(202)
  @Header('Cache-Control', 'private, no-store')
  @RequireAccessControls('reports.view.downloads')
  @ApiBody({ type: ExportCreateDto })
  queueExport(
    @Param('code') code: string,
    @Body() body: ExportCreateDto,
    @Req() request: AuthenticatedRequest,
  ) {
    return this.queue.enqueue(code, body, request.actor);
  }

  @Post('export-jobs/:id/retry')
  @HttpCode(202)
  @Header('Cache-Control', 'private, no-store')
  @RequireAccessControls('reports.view.downloads')
  retryQueuedExport(
    @Param('id', ParseUUIDPipe) id: string,
    @Req() request: AuthenticatedRequest,
  ) {
    return this.queue.retry(id, request.actor);
  }

  @Get('export-jobs/:id')
  @Header('Cache-Control', 'private, no-store')
  @RequireAccessControls('reports.view.downloads')
  exportStatus(
    @Param('id', ParseUUIDPipe) id: string,
    @Req() request: AuthenticatedRequest,
  ) {
    return this.queue.status(id, request.actor);
  }

  @Post(':code/exports')
  @RequireAccessControls('reports.view.downloads')
  @ApiBody({ type: ExportCreateDto })
  createExport(
    @Param('code') code: string,
    @Body() body: ExportCreateDto,
    @Req() request: AuthenticatedRequest,
  ) {
    return this.service.createExport(code, body, request.actor);
  }

  @Post(':code/export')
  @RequireAccessControls('reports.view.downloads')
  export(
    @Param('code') code: string,
    @Body() body: Omit<ReportingExportRequestV1, 'reportCode'>,
    @Req() request: AuthenticatedRequest,
  ) {
    return this.service.export({ ...body, reportCode: code }, request.actor);
  }
}
