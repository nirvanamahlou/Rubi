import { issuedColumns, issuedValues } from './issued-ticket-report';
import { buildIssuedTicketWorkbook } from './issued-ticket-workbook';
import { ReservationTicketDocumentsService } from './reservation-ticket-documents';
import {
  SalesReservationTableModule,
  SalesReservationTableService,
} from '../sales/sales-reservation-table.module';
import { Optional } from '@nestjs/common';
import { ReservationOperationInterceptor } from './reservation-operation.interceptor';
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
import { TicketRuntimeModule } from '../ticket-catalog/ticket-runtime.module';
import { MasterDataModule } from '../master-data/master-data.module';
import { MasterTravelDirectory } from '../master-data/master-travel-directory';
import { TravelWorkflowService } from './travel-workflow.service';
import {
  FinanceDeliveryModule,
  FinanceDeliveryService,
} from '../finance/document-delivery/finance-delivery.module';
import type {
  FinanceSupplierPaymentCommandV1,
  ReservationServicePurchaseInputV1,
  ReservationPurchaseBatchInputV1,
  TravelWorkflowCommandV1,
  TravelWorkflowStateV1,
} from '@nora/contracts';
import {
  Body,
  Controller,
  Headers,
  Param,
  Post,
  ForbiddenException,
  BadRequestException,
  NotFoundException,
  Get,
  Header,
  StreamableFile,
  Inject,
  Module,
  Patch,
  Req,
  Query,
  UseGuards,
  UseInterceptors,
} from '@nestjs/common';
import type { ReservationArrangementUpdateV1 } from '@nora/contracts';
import { IamModule } from '../iam/iam.module';
import { AuthGuard } from '../iam/auth.guard';
import type { AuthenticatedRequest } from '../iam/iam.types';
import { ReservationsPublicService } from './reservations-public.service';
import { ReservationHotelPurchaseService } from './reservation-hotel-purchase.service';
import type { ReservationHotelPurchaseInputV1 } from '@nora/contracts';
import { ReservationServicePurchaseService } from './reservation-service-purchase.service';
import {
  ReservationManifestBatchController,
  ReservationManifestController,
  ReservationManifestService,
} from './reservation-manifest';

@Controller('reservations/requests')
@UseGuards(AuthGuard)
@UseInterceptors(ReservationOperationInterceptor)
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
    @Optional()
    @Inject(SalesReservationTableService)
    private readonly table?: SalesReservationTableService,
    @Optional()
    @Inject(ReservationTicketDocumentsService)
    private readonly ticketDocuments?: ReservationTicketDocumentsService,
    @Optional()
    @Inject(MasterTravelDirectory)
    private readonly directory?: MasterTravelDirectory,
  ) {}
  @Get('issued-tickets')
  @Header('Cache-Control', 'private, no-store')
  issuedTickets(
    @Query() query: Record<string, unknown>,
    @Req() req: AuthenticatedRequest,
  ) {
    if (!this.ticketDocuments) throw new NotFoundException();
    return this.ticketDocuments.report(query, req.actor!);
  }
  @Get('issued-tickets/export')
  @Header('Cache-Control', 'private, no-store')
  async issuedTicketsExport(
    @Query() query: Record<string, unknown>,
    @Req() req: AuthenticatedRequest,
  ) {
    if (!this.ticketDocuments) throw new NotFoundException();
    const { data } = await this.ticketDocuments.report(query, req.actor!);
    return new StreamableFile(
      buildIssuedTicketWorkbook(
        issuedValues(data),
        issuedColumns.map(([, label]) => label),
      ),
      {
        type: 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet',
        disposition: 'attachment; filename="issued-tickets.xlsx"',
      },
    );
  }
  @Get(':id/voucher-brokers')
  @Header('Cache-Control', 'private, no-store')
  async voucherBrokers(
    @Param('id', ParseUUIDPipe) id: string,
    @Req() req: AuthenticatedRequest,
    @Query('search') search = '',
    @Query('page') page = '1',
  ) {
    if (!req.actor.permissions.includes('reservations.read'))
      throw new ForbiddenException();
    await this.workflow.detail(id, req.actor.branchIds);
    const pageNumber = Number(page);
    if (
      !Number.isSafeInteger(pageNumber) ||
      pageNumber < 1 ||
      pageNumber > 1000
    )
      throw new BadRequestException('صفحه معتبر نیست.');
    return this.directory!.voucherBrokers(search.slice(0, 100), pageNumber);
  }

  @Get(':id/voucher-brokers/:brokerId/leaders')
  @Header('Cache-Control', 'private, no-store')
  async voucherLeaders(
    @Param('id', ParseUUIDPipe) id: string,
    @Param('brokerId', ParseUUIDPipe) brokerId: string,
    @Req() req: AuthenticatedRequest,
  ) {
    if (!req.actor.permissions.includes('reservations.read'))
      throw new ForbiddenException();
    await this.workflow.detail(id, req.actor.branchIds);
    return this.directory!.voucherLeaders(brokerId);
  }

  @Get(':id/voucher-brokers/:brokerId/leaders/:leaderId/contact')
  @Header('Cache-Control', 'private, no-store')
  async voucherLeaderContact(
    @Param('id', ParseUUIDPipe) id: string,
    @Param('brokerId', ParseUUIDPipe) brokerId: string,
    @Param('leaderId', ParseUUIDPipe) leaderId: string,
    @Req() req: AuthenticatedRequest,
  ) {
    if (!req.actor.permissions.includes('reservations.documents.manage'))
      throw new ForbiddenException();
    await this.workflow.detail(id, req.actor.branchIds);
    return this.directory!.voucherLeaderContact(brokerId, leaderId, req.actor);
  }

  @Post(':id/voucher-brokers/:brokerId/leaders')
  @Header('Cache-Control', 'private, no-store')
  async addVoucherLeader(
    @Param('id', ParseUUIDPipe) id: string,
    @Param('brokerId', ParseUUIDPipe) brokerId: string,
    @Body() input: { name?: unknown; phone?: unknown },
    @Req() req: AuthenticatedRequest,
  ) {
    if (!req.actor.permissions.includes('reservations.documents.manage'))
      throw new ForbiddenException();
    const intake = await this.workflow.detail(id, req.actor.branchIds);
    const name = typeof input?.name === 'string' ? input.name.trim() : '';
    const phone = typeof input?.phone === 'string' ? input.phone.trim() : '';
    if (!name || name.length > 160 || !/^\+?[0-9\s().-]{7,30}$/.test(phone))
      throw new BadRequestException('نام و شمارهٔ معتبر تورلیدر لازم است.');
    return this.directory!.addVoucherLeader(
      brokerId,
      intake.snapshot.hotelSelection?.cityId,
      name,
      phone,
      req.actor,
    );
  }

  @Get(':id/ticket-documents')
  @Header('Cache-Control', 'private, no-store')
  async ticketDocumentChoices(
    @Param('id', ParseUUIDPipe) id: string,
    @Req() req: AuthenticatedRequest,
  ) {
    return { data: await this.ticketDocuments!.choices(id, req.actor) };
  }
  @Patch(':id/ticket-documents')
  @Header('Cache-Control', 'private, no-store')
  async issueTicketDocument(
    @Param('id', ParseUUIDPipe) id: string,
    @Body() input: { customerId?: unknown; number?: unknown },
    @Req() req: AuthenticatedRequest,
  ) {
    return { data: await this.ticketDocuments!.issue(id, input, req.actor) };
  }
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

  @Get(':id/operation-summary')
  @Header('Cache-Control', 'private, no-store')
  async operationSummary(
    @Param('id', ParseUUIDPipe) id: string,
    @Req() req: AuthenticatedRequest,
  ) {
    if (!req.actor.permissions.includes('reservations.read'))
      throw new ForbiddenException();
    const intake = await this.workflow.detail(id, req.actor.branchIds);
    const [delivery, recorded, historical] = await Promise.all([
      this.delivery.read(id),
      this.iam.latestReservationOperation(id, intake.branchId, req.actor),
      this.service.lastRecordedOperation(id, req.actor.branchIds),
    ]);
    const latest = [recorded, historical]
      .filter((row) => row !== null)
      .sort((a, b) => b.occurredAt.getTime() - a.occurredAt.getTime())[0];
    const ids = [delivery.updatedByUserId, latest?.actorUserId].filter(
      (value): value is string => typeof value === 'string',
    );
    const names = await this.iam.reservationResponsibilityNames(
      ids,
      intake.branchId,
      req.actor,
    );
    return {
      data: {
        delivery: {
          approved: delivery.approved,
          updatedAt: delivery.updatedAt,
          actorName: delivery.updatedByUserId
            ? (names.get(delivery.updatedByUserId) ?? null)
            : null,
        },
        lastOperation: latest
          ? {
              occurredAt: latest.occurredAt.toISOString(),
              actorName: latest.actorUserId
                ? (names.get(latest.actorUserId) ?? null)
                : null,
            }
          : null,
      },
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
    if (
      ['VOUCHER_SETTINGS', 'SUPPLIER_FORM_SETTINGS'].includes(input.action) &&
      input.voucherSettings?.brokerId
    ) {
      await this.workflow.detail(id, req.actor.branchIds);
      const settings = input.voucherSettings;
      const brokerId = settings.brokerId!;
      const brokerName = await this.directory!.voucherBrokerName(brokerId);
      settings.text.broker = brokerName;
      if (settings.leaderId) {
        if (!req.actor.permissions.includes('reservations.documents.manage'))
          throw new ForbiddenException();
        const { data: leader } = await this.directory!.voucherLeaderContact(
          brokerId,
          settings.leaderId,
          req.actor,
        );
        settings.text.leaderName = leader.name;
        settings.text.leaderPhone = leader.phone || '';
        settings.flags.tourLeader = true;
      }
    }
    if (['CONFIRM_SUPPLIER', 'ISSUE_VOUCHER'].includes(input.action)) {
      const current = await this.workflow.detail(id, req.actor.branchIds);
      const settings = current.workflow.voucherSettings;
      if (!settings?.brokerId || !settings.leaderId)
        throw new BadRequestException(
          'کارگزار و تورلیدر را انتخاب و ذخیره کنید.',
        );
      await this.directory!.voucherBrokerName(settings.brokerId);
      await this.directory!.voucherLeaderContact(
        settings.brokerId,
        settings.leaderId,
        req.actor,
      );
    }
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
  @Post(':id/purchase-batches')
  @Header('Cache-Control', 'private, no-store')
  recordPurchaseBatch(
    @Param('id') id: string,
    @Body() input: ReservationPurchaseBatchInputV1,
    @Req() req: AuthenticatedRequest,
    @Headers('idempotency-key') key?: string,
  ) {
    return this.servicePurchase.recordBatch(id, input, req.actor, key);
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
        req.actor.branchIds,
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
    const summaries = this.table
      ? await this.table.read(
          rows.map((row) => row.contractId),
          req.actor,
        )
      : new Map();
    const actorNames = new Map<string, string>();
    const branchActors = new Map<string, Set<string>>();
    for (const row of rows) {
      const ids = branchActors.get(row.branchId) ?? new Set<string>();
      for (const flag of Object.values(
        (row.workflow as TravelWorkflowStateV1 | null)?.tableFlags ?? {},
      ))
        if (flag) ids.add(flag.updatedByUserId);
      branchActors.set(row.branchId, ids);
    }
    for (const [branchId, ids] of branchActors) {
      const values = [...ids];
      for (let i = 0; i < values.length; i += 3)
        for (const [id, name] of await this.iam.reservationResponsibilityNames(
          values.slice(i, i + 3),
          branchId,
          req.actor,
        ))
          actorNames.set(id, name);
    }
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
        tableSummary: summaries.get(row.contractId) ?? null,
        workflow: row.workflow
          ? {
              ...(row.workflow as TravelWorkflowStateV1),
              tableFlags: Object.fromEntries(
                Object.entries(
                  (row.workflow as TravelWorkflowStateV1).tableFlags ?? {},
                ).map(([key, flag]) => [
                  key,
                  {
                    ...flag,
                    actorName: actorNames.get(flag!.updatedByUserId) ?? null,
                  },
                ]),
              ),
            }
          : null,
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
    SalesReservationTableModule,
    IamModule,
    CustomersModule,
    DocumentsModule,
    HotelRatesModule,
    NotificationsModule,
    FinanceDeliveryModule,
    LegalEntitiesModule,
    MasterDataModule,
    TicketRuntimeModule,
  ],
  controllers: [
    ReservationRequestsController,
    ReservationPassengerFilesController,
    ReservationManifestController,
    ReservationManifestBatchController,
  ],
  providers: [
    ReservationTicketDocumentsService,
    AuthGuard,
    ReservationOperationInterceptor,
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
    HotelRatesModule,
  ],
})
export class ReservationsRuntimeModule {}
