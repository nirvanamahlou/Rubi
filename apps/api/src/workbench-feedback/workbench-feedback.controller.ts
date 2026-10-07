import {
  Body,
  Controller,
  DefaultValuePipe,
  Delete,
  Get,
  Header,
  Inject,
  Param,
  ParseIntPipe,
  ParseUUIDPipe,
  Post,
  Query,
  Req,
  UseGuards,
  UseInterceptors,
  UploadedFile,
} from '@nestjs/common';
import { FileInterceptor } from '@nestjs/platform-express';
import { ApiBody, ApiConsumes, ApiCookieAuth, ApiTags } from '@nestjs/swagger';

import type {
  DocumentRequestMetadata,
  UploadedDocumentFile,
} from '../documents/documents.service';
import { AuthGuard } from '../iam/auth.guard';
import type { AuthenticatedRequest } from '../iam/iam.types';
// Runtime import is required for Nest validation metadata.
// eslint-disable-next-line @typescript-eslint/consistent-type-imports
import {
  CreateWorkbenchFeedbackDto,
  UploadWorkbenchFeedbackAttachmentDto,
} from './workbench-feedback.dto';
import { WorkbenchFeedbackService } from './workbench-feedback.service';

function requestMetadata(
  request: AuthenticatedRequest,
): DocumentRequestMetadata {
  const userAgent = request.headers['user-agent'];
  return {
    ...(request.ip ? { ipAddress: request.ip } : {}),
    ...(userAgent
      ? { userAgent: Array.isArray(userAgent) ? userAgent[0] : userAgent }
      : {}),
  };
}

@ApiTags('Workbench feedback')
@ApiCookieAuth('nora_access')
@UseGuards(AuthGuard)
@Controller('workbench/feedback')
export class WorkbenchFeedbackController {
  constructor(
    @Inject(WorkbenchFeedbackService)
    private readonly service: WorkbenchFeedbackService,
  ) {}

  @Post()
  @Header('Cache-Control', 'private, no-store')
  create(
    @Body() input: CreateWorkbenchFeedbackDto,
    @Req() request: AuthenticatedRequest,
  ) {
    return this.service.create(input, request.actor);
  }

  @Post(':id/attachments')
  @ApiConsumes('multipart/form-data')
  @ApiBody({
    schema: {
      type: 'object',
      required: ['file', 'branchId', 'subject', 'anonymous'],
      properties: {
        file: { type: 'string', format: 'binary' },
        branchId: { type: 'string', format: 'uuid' },
        subject: { type: 'string', maxLength: 200 },
        anonymous: { type: 'boolean' },
      },
    },
  })
  @UseInterceptors(
    FileInterceptor('file', {
      limits: { files: 1, fileSize: 10 * 1024 * 1024 },
    }),
  )
  uploadAttachment(
    @Param('id', new ParseUUIDPipe()) id: string,
    @Body() input: UploadWorkbenchFeedbackAttachmentDto,
    @UploadedFile() file: UploadedDocumentFile | undefined,
    @Req() request: AuthenticatedRequest,
  ) {
    return this.service.uploadAttachment(
      { ...input, feedbackId: id },
      file,
      request.actor,
      requestMetadata(request),
    );
  }

  @Get(':id')
  @Header('Cache-Control', 'private, no-store')
  detail(
    @Param('id', new ParseUUIDPipe()) id: string,
    @Req() request: AuthenticatedRequest,
  ) {
    return this.service.detail(id, request.actor);
  }

  @Get('hr/inbox')
  @Header('Cache-Control', 'private, no-store')
  hrInbox(
    @Req() request: AuthenticatedRequest,
    @Query('page', new DefaultValuePipe(1), ParseIntPipe) page: number,
    @Query('pageSize', new DefaultValuePipe(20), ParseIntPipe) pageSize: number,
  ) {
    return this.service.hrInbox(request.actor, page, pageSize);
  }

  @Delete('hr/:id')
  @Header('Cache-Control', 'private, no-store')
  deleteHr(
    @Param('id', new ParseUUIDPipe()) id: string,
    @Req() request: AuthenticatedRequest,
  ) {
    return this.service.deleteHr(id, request.actor);
  }
}
