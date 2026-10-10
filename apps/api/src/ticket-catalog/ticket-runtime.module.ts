import {
  Body,
  DefaultValuePipe,
  ParseBoolPipe,
  Controller,
  Delete,
  Get,
  Headers,
  Inject,
  Module,
  Param,
  Patch,
  Post,
  Query,
  Req,
  UseGuards,
} from '@nestjs/common';
import type {
  TicketOfferCreateV1,
  TicketSaleCommissionUpdateV1,
  TicketOfferSearchV1,
  TicketRoundTripSalePriceUpdateV1,
  TicketSalePriceTargetCreateV1,
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

@Controller('ticket-catalog/sale-price-targets')
@UseGuards(AuthGuard)
class TicketSalePriceTargetsController {
  constructor(
    @Inject(TicketPublicService) private readonly service: TicketPublicService,
  ) {}

  @Get()
  list(@Req() req: AuthenticatedRequest) {
    return this.service.salePriceTargets(req.actor);
  }

  @Delete(':id')
  remove(
    @Param('id') id: string,
    @Body() input: { expectedVersion: number },
    @Req() req: AuthenticatedRequest,
  ) {
    return this.service.removeSalePriceTarget(
      id,
      input?.expectedVersion,
      req.actor,
    );
  }

  @Post()
  create(
    @Body() input: TicketSalePriceTargetCreateV1,
    @Req() req: AuthenticatedRequest,
    @Headers('x-branch-id') branchId?: string,
  ) {
    return this.service.createSalePriceTarget(input, req.actor, branchId);
  }
}

@Controller('ticket-catalog/offers')
@UseGuards(AuthGuard)
class TicketOffersController {
  constructor(
    @Inject(TicketPublicService) private readonly service: TicketPublicService,
  ) {}
  @Get('manifest-templates') templates(
    @Query('search') search = '',
    @Query('page') page = '1',
    @Req() req: AuthenticatedRequest,
  ) {
    return this.service.manifestTemplateChoices(
      search,
      Number(page),
      req.actor,
    );
  }

  @Patch('sale-commissions')
  updateSaleCommission(
    @Body() input: TicketSaleCommissionUpdateV1,
    @Req() req: AuthenticatedRequest,
    @Headers('idempotency-key') key?: string,
  ) {
    return this.service.updateSaleCommission(input, req.actor, key);
  }
  @Get(':offerId/document-details') documentDetails(
    @Param('offerId') id: string,
    @Req() req: AuthenticatedRequest,
  ) {
    return this.service.documentDetails(id, req.actor);
  }
  @Get('management') managed(
    @Req() req: AuthenticatedRequest,
    @Query('page') page = '1',
    @Query('includePast', new DefaultValuePipe(false), ParseBoolPipe)
    includePast: boolean,
  ) {
    return this.service.managed(req.actor, Number(page), includePast);
  }
  @Patch(':outboundOfferId/round-trip-sale-price/:returnOfferId')
  updateRoundTripSalePrice(
    @Param('outboundOfferId') outboundOfferId: string,
    @Param('returnOfferId') returnOfferId: string,
    @Body() input: TicketRoundTripSalePriceUpdateV1,
    @Req() req: AuthenticatedRequest,
    @Headers('idempotency-key') key?: string,
  ) {
    return this.service.updateRoundTripSalePrice(
      outboundOfferId,
      returnOfferId,
      input,
      req.actor,
      key,
    );
  }
  @Get() search(
    @Query() query: TicketOfferSearchV1,
    @Req() req: AuthenticatedRequest,
  ) {
    return this.service.search(query, req.actor);
  }
  @Post(':offerId/capacity-holds') holdTemporary(
    @Param('offerId') offerId: string,
    @Body() input: { quantity: number; expiresAt: string },
    @Req() req: AuthenticatedRequest,
    @Headers('x-branch-id') branchId?: string,
    @Headers('idempotency-key') key?: string,
  ) {
    return this.service.holdTemporary(offerId, input, req.actor, branchId, key);
  }
  @Patch(':offerId/standalone-sale-price') updateStandaloneSalePrice(
    @Param('offerId') offerId: string,
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
  @Patch(':offerId/status') updateStatus(
    @Param('offerId') offerId: string,
    @Body()
    input: { expectedVersion: number; status: 'ACTIVE' | 'PAUSED' },
    @Req() req: AuthenticatedRequest,
  ) {
    return this.service.updateStatus(offerId, input, req.actor);
  }
  @Patch('batch') reviseBatch(
    @Body()
    input: {
      items: readonly {
        id: string;
        expectedVersion: number;
        offer: TicketOfferCreateV1;
      }[];
    },
    @Req() req: AuthenticatedRequest,
  ) {
    return this.service.reviseBatch(input, req.actor);
  }
  @Patch(':offerId') revise(
    @Param('offerId') offerId: string,
    @Body() input: { expectedVersion: number; offer: TicketOfferCreateV1 },
    @Req() req: AuthenticatedRequest,
  ) {
    return this.service.revise(offerId, input, req.actor);
  }
  @Delete('batch') archiveBatch(
    @Body()
    input: { items: readonly { id: string; expectedVersion: number }[] },
    @Req() req: AuthenticatedRequest,
  ) {
    return this.service.archiveBatch(input, req.actor);
  }
  @Delete(':offerId') archiveExpired(
    @Param('offerId') offerId: string,
    @Body() input: { expectedVersion: number },
    @Req() req: AuthenticatedRequest,
  ) {
    return this.service.archiveExpired(
      offerId,
      input?.expectedVersion,
      req.actor,
    );
  }
  @Post() publish(
    @Body() input: TicketOfferCreateV1,
    @Req() req: AuthenticatedRequest,
    @Headers('x-branch-id') branchId?: string,
    @Headers('idempotency-key') key?: string,
  ) {
    return this.service.publish(input, req.actor, branchId, key);
  }
}

@Module({
  imports: [IamModule, MasterDataModule, DocumentsModule, ProcurementModule],
  controllers: [
    TicketOffersController,
    TicketSalePriceTargetsController,
    TourController,
  ],
  providers: [AuthGuard, TicketPublicService, TourPublicService],
  exports: [TicketPublicService, TourPublicService],
})
export class TicketRuntimeModule {}
