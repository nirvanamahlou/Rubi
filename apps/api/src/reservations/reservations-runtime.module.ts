import { ParseUUIDPipe } from '@nestjs/common';
import { SalesOperationalAmendmentModule } from '../sales/sales-operational-amendment.module';
import { CustomersModule } from '../customers/customers.module';
import { CustomerService } from '../customers/customer.service';
import { IamService } from '../iam/iam.service';
import { DocumentsModule } from '../documents/documents.module';
import { PermissionGuard } from '../iam/permission.guard';
import {
  ReservationPassengerFilesController,
  ReservationPassengerFilesService,
} from './reservation-passenger-files';
import { HotelRatesModule } from './hotel-rates.module';
import { NotificationsModule } from '../notifications/notifications.module';
import { LegalEntitiesModule } from '../legal-entities/legal-entities.module';
import { MasterDataModule } from '../master-data/master-data.module';
import { TravelWorkflowService } from './travel-workflow.service';
import {
  FinanceDeliveryModule,
  FinanceDeliveryService,
} from '../finance/document-delivery/finance-delivery.module';
import type {
  FinanceSupplierPaymentCommandV1,
  ReservationServicePurchaseInputV1,
  TravelWorkflowCommandV1,
} from '@rubi/contracts';
import {
  Body,
  Controller,
  Headers,
  Param,
  Post,
  ForbiddenException,
  NotFoundException,
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
import { ReservationServicePurchaseService } from './reservation-service-purchase.service';
import {
  ReservationManifestBatchController,
  ReservationManifestController,
  ReservationManifestService,
} from './reservation-manifest';

@Controller('reservations/requests')
@UseGuards(AuthGuard)
export class ReservationRequestsController {
  constructor(
    @Inject(ReservationsPublicService)
    private readonly service: ReservationsPublicService,
    @Inject(ReservationHotelPurchaseService)
    private readonly hotelPurchase: ReservationHotelPurchaseService,
    @Inject(ReservationServicePurchaseService)
    private readonly servicePurchase: ReservationServicePurchaseService,
    @Inject(TravelWorkflowService)
    private readonly workflow: TravelWorkflowService,
    @Inject(FinanceDeliveryService)
    private readonly delivery: FinanceDeliveryService,
    @Inject(CustomerService) private readonly customers: CustomerService,
    @Inject(IamService) private readonly iam: IamService,
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
          supplierPurchases: await this.delivery.supplierPurchaseGate(row.id),
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
  @Get(':id/workflow/history')
  @Header('Cache-Control', 'private, no-store')
  async workflowHistory(
    @Param('id') id: string,
    @Req() req: AuthenticatedRequest,
  ) {
    if (!req.actor.permissions.includes('reservations.read'))
      throw new ForbiddenException();
    return { data: await this.workflow.history(id, req.actor.branchIds) };
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
  @Post(':id/service-purchases')
  @Header('Cache-Control', 'private, no-store')
  recordServicePurchase(
    @Param('id') id: string,
    @Body() input: ReservationServicePurchaseInputV1,
    @Req() req: AuthenticatedRequest,
    @Headers('idempotency-key') key?: string,
  ) {
    return this.servicePurchase.record(id, input, req.actor, key);
  }
  @Patch(':id/service-purchases/:purchaseId/payment')
  @Header('Cache-Control', 'private, no-store')
  async updateSupplierPayment(
    @Param('id') id: string,
    @Param('purchaseId', ParseUUIDPipe) purchaseId: string,
    @Body() input: FinanceSupplierPaymentCommandV1,
    @Req() req: AuthenticatedRequest,
  ) {
    if (!req.actor.permissions.includes('finance.financial_release.approve'))
      throw new ForbiddenException();
    await this.workflow.detail(id, req.actor.branchIds);
    return {
      data: await this.delivery.updateSupplierPayment(
        id,
        purchaseId,
        input,
        req.actor.userId,
      ),
    };
  }
  @Get(':id/purchase-context')
  @Header('Cache-Control', 'private, no-store')
  async purchaseContext(
    @Param('id', ParseUUIDPipe) id: string,
    @Req() req: AuthenticatedRequest,
  ) {
    if (!req.actor.permissions.includes('reservations.read'))
      throw new ForbiddenException();
    return {
      data: await this.service.purchaseContext(id, req.actor.branchIds),
    };
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
    const rows = await this.service.list(req.actor.branchIds, {
      page,
      contractNumber,
    });
    const names = new Map<string, string>();
    if (rows.length && req.actor.permissions.includes('iam.users.read')) {
      const wanted = new Set(rows.map((row) => row.salesOwnerUserId));
      for (const user of await this.iam.listUsers()) {
        if (wanted.has(user.id)) names.set(user.id, user.displayName);
      }
    }
    const parties = new Map<string, string>();
    if (req.actor.permissions.includes('customers.read')) {
      for (const customerId of new Set(
        rows.map((row) => row.snapshot.customerId),
      )) {
        try {
          const { data } = await this.customers.detail(customerId, req.actor);
          parties.set(customerId, data.displayName);
        } catch (error) {
          if (!(
            error instanceof ForbiddenException ||
            error instanceof NotFoundException
          ))
            throw error;
        }
      }
    }
    return {
      version: 1,
      data: rows.map(({ salesOwnerUserId, ...row }) => ({
        ...row,
        sellerName: salesOwnerUserId
          ? (names.get(salesOwnerUserId) ?? null)
          : null,
        contractPartyName: parties.get(row.snapshot.customerId) ?? null,
      })),
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
    SalesOperationalAmendmentModule,
    IamModule,
    CustomersModule,
    DocumentsModule,
    HotelRatesModule,
    NotificationsModule,
    FinanceDeliveryModule,
    LegalEntitiesModule,
    MasterDataModule,
  ],
  controllers: [
    ReservationRequestsController,
    ReservationPassengerFilesController,
    ReservationManifestController,
    ReservationManifestBatchController,
  ],
  providers: [
    AuthGuard,
    PermissionGuard,
    ReservationPassengerFilesService,
    TravelWorkflowService,
    ReservationsPublicService,
    ReservationHotelPurchaseService,
    ReservationServicePurchaseService,
    ReservationManifestService,
  ],
  exports: [
    ReservationsPublicService,
    TravelWorkflowService,
    FinanceDeliveryModule,
  ],
})
export class ReservationsRuntimeModule {}
