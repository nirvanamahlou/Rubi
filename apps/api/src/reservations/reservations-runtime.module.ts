import { HotelRatesModule } from './hotel-rates.module';
import { NotificationsModule } from '../notifications/notifications.module';
import { LegalEntitiesModule } from '../legal-entities/legal-entities.module';
import { MasterDataModule } from '../master-data/master-data.module';
import { TravelWorkflowService } from './travel-workflow.service';
import {
  FinanceDeliveryModule,
  FinanceDeliveryService,
} from '../finance/document-delivery/finance-delivery.module';
import type { TravelWorkflowCommandV1 } from '@rubi/contracts';
import {
  Body,
  Controller,
  Headers,
  Param,
  Post,
  ForbiddenException,
  Get,
  Header,
  Inject,
  Module,
  Patch,
  Req,
  Query,
  UseGuards,
} from '@nestjs/common';
import type { ReservationArrangementUpdateV1 } from '@rubi/contracts';
import { IamModule } from '../iam/iam.module';
import { AuthGuard } from '../iam/auth.guard';
import type { AuthenticatedRequest } from '../iam/iam.types';
import { ReservationsPublicService } from './reservations-public.service';
import { ReservationHotelPurchaseService } from './reservation-hotel-purchase.service';
import type { ReservationHotelPurchaseInputV1 } from '@rubi/contracts';

@Controller('reservations/requests')
@UseGuards(AuthGuard)
export class ReservationRequestsController {
  constructor(
    @Inject(ReservationsPublicService)
    private readonly service: ReservationsPublicService,
    @Inject(ReservationHotelPurchaseService)
    private readonly hotelPurchase: ReservationHotelPurchaseService,
    @Inject(TravelWorkflowService)
    private readonly workflow: TravelWorkflowService,
    @Inject(FinanceDeliveryService)
    private readonly delivery: FinanceDeliveryService,
  ) {}
  @Get('delivery-queue')
  @Header('Cache-Control', 'private, no-store')
  async deliveryQueue(
    @Req() req: AuthenticatedRequest,
    @Query('contractNumber') contractNumber?: string,
  ) {
    if (!req.actor.permissions.includes('finance.financial_release.read'))
      throw new ForbiddenException();
    const rows = await this.service.list(req.actor.branchIds, {
      contractNumber,
    });
    return {
      data: await Promise.all(
        rows.map(async (row) => ({
          id: row.id,
          contractNumber: row.snapshot.contractNumber,
          delivery: await this.delivery.read(row.id),
        })),
      ),
    };
  }
  @Get(':id/workflow')
  @Header('Cache-Control', 'private, no-store')
  async workflowDetail(
    @Param('id') id: string,
    @Req() req: AuthenticatedRequest,
  ) {
    if (!req.actor.permissions.includes('reservations.read'))
      throw new ForbiddenException();
    return {
      data: await this.workflow.detail(id, req.actor.branchIds),
      delivery: await this.delivery.read(id),
    };
  }
  @Patch(':id/workflow')
  @Header('Cache-Control', 'private, no-store')
  async workflowUpdate(
    @Param('id') id: string,
    @Body() input: TravelWorkflowCommandV1,
    @Req() req: AuthenticatedRequest,
  ) {
    return { data: await this.workflow.update(id, input, req.actor) };
  }
  @Get(':id/delivery')
  @Header('Cache-Control', 'private, no-store')
  async deliveryDetail(
    @Param('id') id: string,
    @Req() req: AuthenticatedRequest,
  ) {
    if (!req.actor.permissions.includes('finance.financial_release.read'))
      throw new ForbiddenException();
    await this.workflow.detail(id, req.actor.branchIds);
    return { data: await this.delivery.read(id) };
  }
  @Patch(':id/delivery')
  @Header('Cache-Control', 'private, no-store')
  async deliveryUpdate(
    @Param('id') id: string,
    @Body()
    input: { expectedVersion: number; approved: boolean; reason: string },
    @Req() req: AuthenticatedRequest,
  ) {
    if (!req.actor.permissions.includes('finance.financial_release.approve'))
      throw new ForbiddenException();
    const intake = await this.workflow.detail(id, req.actor.branchIds);
    return {
      data: await this.delivery.update(
        id,
        input,
        req.actor.userId,
        intake.salesOwnerUserId,
        intake.contractId,
      ),
    };
  }
  @Post(':id/hotel-purchase')
  @Header('Cache-Control', 'private, no-store')
  record(
    @Param('id') id: string,
    @Body() input: ReservationHotelPurchaseInputV1,
    @Req() req: AuthenticatedRequest,
    @Headers('idempotency-key') key?: string,
  ) {
    return this.hotelPurchase.record(id, input, req.actor, key);
  }
  @Get()
  @Header('Cache-Control', 'private, no-store')
  async list(
    @Req() req: AuthenticatedRequest,
    @Query('page') page?: string,
    @Query('contractNumber') contractNumber?: string,
  ) {
    if (!req.actor.permissions.includes('reservations.read'))
      throw new ForbiddenException('مجوز مشاهده رزرواسیون وجود ندارد.');
    return {
      version: 1,
      data: await this.service.list(req.actor.branchIds, {
        page,
        contractNumber,
      }),
    };
  }

  @Patch(':id/arrangement')
  @Header('Cache-Control', 'private, no-store')
  async updateArrangement(
    @Param('id') id: string,
    @Body() input: ReservationArrangementUpdateV1,
    @Req() req: AuthenticatedRequest,
  ) {
    if (!req.actor.permissions.includes('reservations.arrangements.update'))
      throw new ForbiddenException('مجوز ویرایش چیدمان رزرواسیون وجود ندارد.');
    return {
      version: 1,
      data: await this.service.updateArrangement(
        id,
        input,
        req.actor.branchIds,
        req.actor.userId,
      ),
    };
  }
}
@Module({
  imports: [
    IamModule,
    HotelRatesModule,
    NotificationsModule,
    FinanceDeliveryModule,
    LegalEntitiesModule,
    MasterDataModule,
  ],
  controllers: [ReservationRequestsController],
  providers: [
    AuthGuard,
    TravelWorkflowService,
    ReservationsPublicService,
    ReservationHotelPurchaseService,
  ],
  exports: [
    ReservationsPublicService,
    TravelWorkflowService,
    FinanceDeliveryModule,
  ],
})
export class ReservationsRuntimeModule {}
