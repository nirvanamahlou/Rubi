import {
  Body,
  Controller,
  Get,
  Header,
  Inject,
  Param,
  Post,
  Query,
  Req,
  UploadedFile,
  UseGuards,
  UseInterceptors,
} from '@nestjs/common';
import { FileInterceptor } from '@nestjs/platform-express';
import { ApiBody, ApiConsumes, ApiCookieAuth, ApiTags } from '@nestjs/swagger';

import type {
  DocumentRequestMetadata,
  UploadedDocumentFile,
} from '../documents/documents.service';
import { AuthGuard } from '../iam/auth.guard';
import type { AuthenticatedRequest } from '../iam/iam.types';
import { MessagingService } from './messaging.service';

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

@ApiTags('Messaging')
@ApiCookieAuth('nora_access')
@UseGuards(AuthGuard)
@Controller('messaging')
export class MessagingController {
  constructor(
    @Inject(MessagingService) private readonly service: MessagingService,
  ) {}

  @Get('contacts')
  @Header('Cache-Control', 'private, no-store')
  contacts(
    @Req() request: AuthenticatedRequest,
    @Query() query: Record<string, unknown>,
  ) {
    return this.service.contacts(request.actor, query);
  }

  @Get('conversations')
  @Header('Cache-Control', 'private, no-store')
  conversations(@Req() request: AuthenticatedRequest) {
    return this.service.conversations(request.actor);
  }

  @Post('conversations/direct')
  createDirect(@Body() body: unknown, @Req() request: AuthenticatedRequest) {
    return this.service.createDirect(body, request.actor);
  }

  @Post('conversations/groups')
  createGroup(@Body() body: unknown, @Req() request: AuthenticatedRequest) {
    return this.service.createGroup(body, request.actor);
  }

  @Get('conversations/:id/messages')
  @Header('Cache-Control', 'private, no-store')
  messages(
    @Param('id') id: string,
    @Query() query: Record<string, unknown>,
    @Req() request: AuthenticatedRequest,
  ) {
    return this.service.messages(id, query, request.actor);
  }

  @Post('conversations/:id/messages')
  send(
    @Param('id') id: string,
    @Body() body: unknown,
    @Req() request: AuthenticatedRequest,
  ) {
    return this.service.send(id, body, request.actor);
  }

  @Post('conversations/:id/attachments')
  @ApiConsumes('multipart/form-data')
  @ApiBody({
    schema: {
      type: 'object',
      required: ['file', 'clientRequestId'],
      properties: {
        file: { type: 'string', format: 'binary' },
        clientRequestId: { type: 'string', minLength: 16, maxLength: 80 },
      },
    },
  })
  @UseInterceptors(
    FileInterceptor('file', {
      limits: { files: 1, fileSize: 10 * 1024 * 1024 },
    }),
  )
  uploadAttachment(
    @Param('id') id: string,
    @Body() body: unknown,
    @UploadedFile() file: UploadedDocumentFile | undefined,
    @Req() request: AuthenticatedRequest,
  ) {
    return this.service.uploadAttachment(
      id,
      body,
      file,
      request.actor,
      requestMetadata(request),
    );
  }

  @Post('conversations/:id/forwards')
  forward(
    @Param('id') id: string,
    @Body() body: unknown,
    @Req() request: AuthenticatedRequest,
  ) {
    return this.service.forward(id, body, request.actor);
  }
}
