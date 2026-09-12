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
  UseGuards,
} from '@nestjs/common';
import { ApiCookieAuth, ApiTags } from '@nestjs/swagger';

import { AuthGuard } from '../iam/auth.guard';
import type { AuthenticatedRequest } from '../iam/iam.types';
import { MessagingService } from './messaging.service';

@ApiTags('Messaging')
@ApiCookieAuth('rubi_access')
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

  @Post('conversations/:id/forwards')
  forward(
    @Param('id') id: string,
    @Body() body: unknown,
    @Req() request: AuthenticatedRequest,
  ) {
    return this.service.forward(id, body, request.actor);
  }
}
