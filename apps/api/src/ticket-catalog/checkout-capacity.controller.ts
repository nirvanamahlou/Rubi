import {
  Controller,
  Get,
  Header,
  Inject,
  Param,
  ParseUUIDPipe,
  Query,
  Req,
  UseGuards,
} from '@nestjs/common';
import { DatabaseService } from '../database/database.service';
import { AuthGuard } from '../iam/auth.guard';
import type { AuthenticatedRequest } from '../iam/iam.types';
import { CheckoutTicketCapacity } from './checkout-ticket-capacity';
@Controller('ticket-catalog/offers')
@UseGuards(AuthGuard)
export class CheckoutCapacityController {
  constructor(
    @Inject(DatabaseService) private readonly db: DatabaseService,
    @Inject(CheckoutTicketCapacity)
    private readonly capacity: CheckoutTicketCapacity,
  ) {}
  @Get(':offerId/capacity-holds')
  @Header('Cache-Control', 'private, no-store')
  async roster(
    @Param('offerId', ParseUUIDPipe) offerId: string,
    @Req() request: AuthenticatedRequest,
    @Query('cursor') cursor?: string,
  ) {
    return this.capacity.roster(this.db.client, offerId, request.actor, cursor);
  }
}
