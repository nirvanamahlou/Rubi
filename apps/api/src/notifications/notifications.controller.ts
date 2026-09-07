import {
  Controller,
  Get,
  Header,
  Inject,
  Param,
  ParseUUIDPipe,
  Patch,
  Query,
  Req,
  UseGuards,
} from '@nestjs/common';
import { ApiCookieAuth, ApiTags } from '@nestjs/swagger';

import { AuthGuard } from '../iam/auth.guard';
import type { AuthenticatedRequest } from '../iam/iam.types';
import { NotificationsService } from './notifications.service';

@ApiTags('Notifications')
@ApiCookieAuth('rubi_access')
@UseGuards(AuthGuard)
@Controller('notifications')
export class NotificationsController {
  constructor(
    @Inject(NotificationsService)
    private readonly service: NotificationsService,
  ) {}

  @Get()
  @Header('Cache-Control', 'private, no-store')
  @Header('Vary', 'Cookie')
  list(@Req() request: AuthenticatedRequest, @Query('limit') limit?: string) {
    return this.service.list(request.actor.userId, limit);
  }

  @Patch('read-all')
  @Header('Cache-Control', 'private, no-store')
  @Header('Vary', 'Cookie')
  markAllRead(@Req() request: AuthenticatedRequest) {
    return this.service.markAllRead(request.actor.userId);
  }

  @Patch(':id/read')
  @Header('Cache-Control', 'private, no-store')
  @Header('Vary', 'Cookie')
  markRead(
    @Param('id', new ParseUUIDPipe()) id: string,
    @Req() request: AuthenticatedRequest,
  ) {
    return this.service.markRead(id, request.actor.userId);
  }
}
