import {
  Body,
  Controller,
  Get,
  Header,
  Inject,
  Param,
  ParseUUIDPipe,
  Post,
  Req,
  UseGuards,
} from '@nestjs/common';
import { ApiCookieAuth, ApiTags } from '@nestjs/swagger';

import { AuthGuard } from '../iam/auth.guard';
import type { AuthenticatedRequest } from '../iam/iam.types';
// Runtime import is required for Nest validation metadata.
// eslint-disable-next-line @typescript-eslint/consistent-type-imports
import { CreateWorkbenchFeedbackDto } from './workbench-feedback.dto';
import { WorkbenchFeedbackService } from './workbench-feedback.service';

@ApiTags('Workbench feedback')
@ApiCookieAuth('rubi_access')
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

  @Get(':id')
  @Header('Cache-Control', 'private, no-store')
  detail(
    @Param('id', new ParseUUIDPipe()) id: string,
    @Req() request: AuthenticatedRequest,
  ) {
    return this.service.detail(id, request.actor);
  }
}
