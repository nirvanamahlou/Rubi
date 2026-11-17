import { Controller, Get, Header, Inject, Param, Req, UseGuards } from '@nestjs/common';
import { DatabaseService } from '../database/database.service';
import { AuthGuard } from '../iam/auth.guard';
import type { AuthenticatedRequest } from '../iam/iam.types';
import { CheckoutTicketCapacity } from './checkout-ticket-capacity';
@Controller('ticket-catalog/offers')
@UseGuards(AuthGuard)
export class CheckoutCapacityController {
 constructor(@Inject(DatabaseService)private readonly db:DatabaseService,@Inject(CheckoutTicketCapacity)private readonly capacity:CheckoutTicketCapacity){}
 @Get(':offerId/capacity-holds') @Header('Cache-Control','private, no-store')
 async roster(@Param('offerId')offerId:string,@Req()request:AuthenticatedRequest){return {data:await this.capacity.roster(this.db.client,offerId,request.actor)};}
}
