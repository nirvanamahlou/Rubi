import {
  Body,
  Controller,
  Get,
  Headers,
  Inject,
  Module,
  Patch,
  Param,
  ParseUUIDPipe,
  Post,
  Query,
  Req,
  UseGuards,
} from '@nestjs/common';
import type {
  TicketOfferCreateV1,
  TicketOfferSearchV1,
  TicketStandaloneSalePriceUpdateV1,
} from '@nora/contracts';
import { IamModule } from '../iam/iam.module';
import { AuthGuard } from '../iam/auth.guard';
import type { AuthenticatedRequest } from '../iam/iam.types';
import { TicketPublicService } from './ticket-public.service';
import { MasterDataModule } from '../master-data/master-data.module';
import { TourPublicService } from './tour-public.service';
import { TourController } from './tour.controller';
import { DocumentsModule } from '../documents/documents.module';
import { ProcurementModule } from '../procurement/procurement.module';

@Controller('ticket-catalog/offers')
@UseGuards(AuthGuard)
class TicketOffersController {
  constructor(
    @Inject(TicketPublicService) private readonly service: TicketPublicService,
  ) {}
  @Get('managed-prices') managedPrices(@Req() req: AuthenticatedRequest) {
    return this.service.managedPrices(req.actor);
  }
  @Get() search(
    @Query() query: TicketOfferSearchV1,
    @Req() req: AuthenticatedRequest,
  ) {
    return this.service.search(query, req.actor);
  }
  @Post() publish(
    @Body() input: TicketOfferCreateV1,
    @Req() req: AuthenticatedRequest,
    @Headers('x-branch-id') branchId?: string,
    @Headers('idempotency-key') key?: string,
  ) {
    return this.service.publish(input, req.actor, branchId, key);
  }
  @Patch(':id/standalone-sale-price') updateStandaloneSalePrice(
    @Param('id', ParseUUIDPipe) offerId: string,
    @Body() input: TicketStandaloneSalePriceUpdateV1,
    @Req() req: AuthenticatedRequest,
    @Headers('idempotency-key') key?: string,
  ) {
    return this.service.updateStandaloneSalePrice(
      offerId,
      input,
      req.actor,
      key,
    );
  }
}

@Module({
  imports: [IamModule, MasterDataModule, DocumentsModule, ProcurementModule],
  controllers: [TicketOffersController, TourController],
  providers: [AuthGuard, TicketPublicService, TourPublicService],
  exports: [TicketPublicService, TourPublicService],
})
export class TicketRuntimeModule {}
