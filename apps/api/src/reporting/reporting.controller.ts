import {
  Body,
  Controller,
  Delete,
  Get,
  Header,
  Inject,
  Param,
  Post,
  Query,
  Req,
  Res,
  UseGuards,
} from '@nestjs/common';
import { ApiBody, ApiCookieAuth, ApiTags } from '@nestjs/swagger';

import { AuthGuard } from '../iam/auth.guard';
import type { AuthenticatedRequest } from '../iam/iam.types';
import type {
  ReportQueryV1,
  ReportingExportRequestV1,
} from './reporting.contracts';
import {
  ExportCreateDto,
  SaveReportDto,
  ShareSavedReportDto,
} from './reporting.dto';
import { ReportingService } from './reporting.service';
import type { Response } from 'express';

@ApiTags('Reporting')
@ApiCookieAuth('rubi_access')
@UseGuards(AuthGuard)
@Controller('reports')
export class ReportingController {
  constructor(
    @Inject(ReportingService) private readonly service: ReportingService,
  ) {}

  @Get('catalog')
  @Header('Cache-Control', 'private, no-store')
  catalog(@Req() request: AuthenticatedRequest) {
    return this.service.catalog(request.actor);
  }

  @Get('saved')
  saved(@Req() request: AuthenticatedRequest) {
    return this.service.savedReports(request.actor);
  }

  @Get('workspace-counts')
  @Header('Cache-Control', 'private, no-store')
  workspaceCounts(@Req() request: AuthenticatedRequest) {
    return this.service.workspaceCounts(request.actor);
  }

  @Post('saved')
  @ApiBody({ type: SaveReportDto })
  save(@Body() body: SaveReportDto, @Req() request: AuthenticatedRequest) {
    return this.service.saveReport(body, request.actor);
  }

  @Get(':code/share-recipients')
  @Header('Cache-Control', 'private, no-store')
  shareRecipients(
    @Param('code') code: string,
    @Req() request: AuthenticatedRequest,
  ) {
    return this.service.sharingRecipients(code, request.actor);
  }

  @Get('saved/:id/shares')
  @Header('Cache-Control', 'private, no-store')
  savedShares(@Param('id') id: string, @Req() request: AuthenticatedRequest) {
    return this.service.savedReportShares(id, request.actor);
  }

  @Post('saved/:id/shares')
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
  removeSaved(@Param('id') id: string, @Req() request: AuthenticatedRequest) {
    return this.service.deleteSavedReport(id, request.actor);
  }

  @Get('runs')
  runs(@Req() request: AuthenticatedRequest) {
    return this.service.runs(request.actor);
  }

  @Get('exports')
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
  retryExport(@Param('id') id: string, @Req() request: AuthenticatedRequest) {
    return this.service.retryExport(id, request.actor);
  }

  @Get('exports/:id/download')
  async download(
    @Param('id') id: string,
    @Req() request: AuthenticatedRequest,
    @Res() response: Response,
  ) {
    const file = await this.service.downloadExport(id, request.actor);
    response.setHeader('Content-Type', file.contentType);
    response.setHeader(
      'Content-Disposition',
      `attachment; filename*=UTF-8''${encodeURIComponent(file.fileName)}`,
    );
    response.setHeader('Content-Length', String(file.buffer.length));
    response.send(file.buffer);
  }

  @Get(':code/metadata')
  @Header('Cache-Control', 'private, no-store')
  metadata(@Param('code') code: string, @Req() request: AuthenticatedRequest) {
    return this.service.metadata(code, request.actor);
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

  @Post(':code/exports')
  @ApiBody({ type: ExportCreateDto })
  createExport(
    @Param('code') code: string,
    @Body() body: ExportCreateDto,
    @Req() request: AuthenticatedRequest,
  ) {
    return this.service.createExport(code, body, request.actor);
  }

  @Post(':code/export')
  export(
    @Param('code') code: string,
    @Body() body: Omit<ReportingExportRequestV1, 'reportCode'>,
    @Req() request: AuthenticatedRequest,
  ) {
    return this.service.export({ ...body, reportCode: code }, request.actor);
  }
}
