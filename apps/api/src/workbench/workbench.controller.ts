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
  Req,
  UseGuards,
} from '@nestjs/common';
import { ApiCookieAuth, ApiTags } from '@nestjs/swagger';
import type { AuthenticatedRequest } from '../iam/iam.types';
import { AuthGuard } from '../iam/auth.guard';
import { IamService } from '../iam/iam.service';
// Runtime imports are required for Nest validation metadata.
// eslint-disable-next-line @typescript-eslint/consistent-type-imports
import {
  WorkbenchCalendarDto,
  WorkbenchFolderDto,
  WorkbenchNoteDto,
  WorkbenchProfileDto,
} from './workbench.dto';
import { WorkbenchService } from './workbench.service';

@ApiTags('Workbench')
@ApiCookieAuth('rubi_access')
@UseGuards(AuthGuard)
@Controller('workbench')
export class WorkbenchController {
  constructor(
    @Inject(WorkbenchService) private readonly service: WorkbenchService,
    @Inject(IamService) private readonly iam: IamService,
  ) {}

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
