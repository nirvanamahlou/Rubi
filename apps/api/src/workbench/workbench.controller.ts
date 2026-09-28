import {
  Body,
  Controller,
  Delete,
  Get,
  Header,
  Inject,
  Param,
  ParseUUIDPipe,
  Patch,
  Post,
  Query,
  Req,
  StreamableFile,
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
import type { AuthenticatedRequest } from '../iam/iam.types';
import { AuthGuard } from '../iam/auth.guard';
import { IamService } from '../iam/iam.service';
// Runtime imports are required for Nest validation metadata.
// eslint-disable-next-line @typescript-eslint/consistent-type-imports
import {
  WorkbenchCalendarDto,
  WorkbenchFolderDto,
  WorkbenchNoteDto,
  WorkbenchProfilePhotoDto,
  WorkbenchProfileDto,
} from './workbench.dto';
import { WorkbenchService } from './workbench.service';
import { WorkbenchPerformanceService } from './workbench-performance.service';

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

@ApiTags('Workbench')
@ApiCookieAuth('nora_access')
@UseGuards(AuthGuard)
@Controller('workbench')
export class WorkbenchController {
  constructor(
    @Inject(WorkbenchService) private readonly service: WorkbenchService,
    @Inject(IamService) private readonly iam: IamService,
    @Inject(WorkbenchPerformanceService)
    private readonly performanceService: WorkbenchPerformanceService,
  ) {}

  @Get('performance')
  @Header('Cache-Control', 'private, no-store')
  performance(@Req() req: AuthenticatedRequest, @Query('days') days?: string) {
    return this.performanceService.get(req.actor, days);
  }

  @Get('notes')
  @Header('Cache-Control', 'private, no-store')
  notes(@Req() req: AuthenticatedRequest) {
    return this.service.notes(req.actor);
  }
  @Post('note-folders')
  folder(@Body() dto: WorkbenchFolderDto, @Req() req: AuthenticatedRequest) {
    return this.service.createFolder(dto.name, req.actor);
  }
  @Post('notes')
  createNote(@Body() dto: WorkbenchNoteDto, @Req() req: AuthenticatedRequest) {
    return this.service.createNote(dto, req.actor);
  }
  @Patch('notes/:id')
  updateNote(
    @Param('id', ParseUUIDPipe) id: string,
    @Body() dto: WorkbenchNoteDto,
    @Req() req: AuthenticatedRequest,
  ) {
    return this.service.updateNote(id, dto, req.actor);
  }
  @Delete('notes/:id')
  async deleteNote(
    @Param('id', ParseUUIDPipe) id: string,
    @Req() req: AuthenticatedRequest,
  ) {
    await this.service.deleteNote(id, req.actor);
  }

  @Get('profile')
  @Header('Cache-Control', 'private, no-store')
  profile(@Req() req: AuthenticatedRequest) {
    return this.service.profile(req.actor);
  }
  @Patch('profile')
  updateProfile(
    @Body() dto: WorkbenchProfileDto,
    @Req() req: AuthenticatedRequest,
  ) {
    return this.service.updateProfile(dto, req.actor);
  }

  @Post('profile/photo')
  @ApiConsumes('multipart/form-data')
  @ApiBody({
    schema: {
      type: 'object',
      required: ['file', 'branchId', 'title'],
      properties: {
        file: { type: 'string', format: 'binary' },
        branchId: { type: 'string', format: 'uuid' },
        title: { type: 'string', maxLength: 240 },
      },
    },
  })
  @UseInterceptors(
    FileInterceptor('file', {
      limits: { files: 1, fileSize: 5 * 1024 * 1024 },
    }),
  )
  uploadProfilePhoto(
    @Body() dto: WorkbenchProfilePhotoDto,
    @UploadedFile()
    file: UploadedDocumentFile | undefined,
    @Req() req: AuthenticatedRequest,
  ) {
    return this.service.uploadProfilePhoto(
      dto,
      file,
      req.actor,
      requestMetadata(req),
    );
  }

  @Get('profile/photo')
  @Header('Cache-Control', 'private, no-store')
  @Header('Vary', 'Cookie')
  @Header('X-Content-Type-Options', 'nosniff')
  @Header('Cross-Origin-Resource-Policy', 'same-origin')
  async profilePhoto(@Req() req: AuthenticatedRequest) {
    const result = await this.service.profilePhoto(
      req.actor,
      requestMetadata(req),
    );
    return new StreamableFile(result.stream, {
      type: result.mimeType,
      length: result.sizeBytes,
      disposition: `inline; filename*=UTF-8''${encodeURIComponent(result.fileName)}`,
    });
  }

  @Get('calendar')
  @Header('Cache-Control', 'private, no-store')
  calendar(@Req() req: AuthenticatedRequest) {
    return this.service.calendar(req.actor);
  }
  @Post('calendar')
  createEvent(
    @Body() dto: WorkbenchCalendarDto,
    @Req() req: AuthenticatedRequest,
  ) {
    return this.service.createEvent(dto, req.actor);
  }
  @Patch('calendar/:id')
  updateEvent(
    @Param('id', ParseUUIDPipe) id: string,
    @Body() dto: WorkbenchCalendarDto,
    @Req() req: AuthenticatedRequest,
  ) {
    return this.service.updateEvent(id, dto, req.actor);
  }
  @Delete('calendar/:id')
  async deleteEvent(
    @Param('id', ParseUUIDPipe) id: string,
    @Req() req: AuthenticatedRequest,
  ) {
    await this.service.deleteEvent(id, req.actor);
  }

  @Get('activity')
  @Header('Cache-Control', 'private, no-store')
  activity(@Req() req: AuthenticatedRequest) {
    return this.iam.listSelfActivity(req.actor);
  }
}
