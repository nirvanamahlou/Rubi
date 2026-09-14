import {
  Body,
  Controller,
  Headers,
  Inject,
  Param,
  ParseUUIDPipe,
  Post,
  Req,
  UseGuards,
} from '@nestjs/common';
import { IsString, Length, Matches } from 'class-validator';
import { AuthGuard } from '../iam/auth.guard';
import { PermissionGuard } from '../iam/permission.guard';
import { RequirePermissions } from '../iam/iam.decorators';
import type { AuthenticatedRequest } from '../iam/iam.types';
import { CustomerAffairsSmsService } from './customer-affairs-sms.service';
export class TicketSmsDto {
  @IsString() @Matches(/^(?:09\d{9}|\+989\d{9})$/) mobile!: string;
  @IsString() @Length(2, 1000) message!: string;
}
@Controller('customer-affairs/tickets/:id/sms')
@UseGuards(AuthGuard, PermissionGuard)
export class CustomerAffairsSmsController {
  constructor(
    @Inject(CustomerAffairsSmsService)
    private readonly sms: CustomerAffairsSmsService,
  ) {}
  @Post()
  @RequirePermissions('customer_affairs.ticket.update')
  send(
    @Param('id', ParseUUIDPipe) id: string,
    @Body() input: TicketSmsDto,
    @Headers('idempotency-key') key: string | undefined,
    @Req() req: AuthenticatedRequest,
  ) {
    return this.sms.send(id, input, key, req.actor);
  }
}
