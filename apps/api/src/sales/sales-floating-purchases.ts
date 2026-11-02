import {
  Body,
  Controller,
  Get,
  Header,
  Headers,
  Inject,
  Injectable,
  Param,
  ParseUUIDPipe,
  Post,
  Query,
  Req,
  UseGuards,
  ForbiddenException,
  NotFoundException,
  BadRequestException,
} from '@nestjs/common';
import {
  hasSalesContractSelfService,
  canSelfServeSalesContract,
  isFloatingSalesContract,
  type AuthenticatedActor,
  type ReservationPurchaseBatchInputV1,
  type ReservationServicePurchaseInputV1,
} from '@nora/contracts';
import { SalesService } from './sales.service';
import { ReservationsPublicService } from '../reservations/reservations-public.service';
import { TravelWorkflowService } from '../reservations/travel-workflow.service';
import { ReservationServicePurchaseService } from '../reservations/reservation-service-purchase.service';
import { MasterSalesDirectory } from '../master-data/master-sales-directory';
import { MasterTravelDirectory } from '../master-data/master-travel-directory';
import { PurchaseFxService } from '../finance/purchase-fx/purchase-fx.service';
import { AuthGuard } from '../iam/auth.guard';
import type { AuthenticatedRequest } from '../iam/iam.types';
@Injectable()
export class SalesFloatingPurchases {
  constructor(
    @Inject(SalesService) private readonly sales: SalesService,
    @Inject(ReservationsPublicService)
    private readonly reservations: ReservationsPublicService,
    @Inject(TravelWorkflowService)
    private readonly workflow: TravelWorkflowService,
    @Inject(ReservationServicePurchaseService)
    private readonly purchases: ReservationServicePurchaseService,
    @Inject(MasterTravelDirectory)
    private readonly directory: MasterTravelDirectory,
    @Inject(PurchaseFxService) private readonly fx: PurchaseFxService,
    @Inject(MasterSalesDirectory)
    private readonly agencies: MasterSalesDirectory,
  ) {}
  async context(id: string, actor: AuthenticatedActor, write = false) {
    if (!hasSalesContractSelfService(actor.permissions))
      throw new ForbiddenException();
    const { data: contract } = await this.sales.detail(id, actor);
    if (
      !actor.branchIds.includes(contract.branchId) ||
      contract.status === 'CANCELLED' ||
      (!canSelfServeSalesContract(actor, contract) &&
        !actor.permissions.includes(
          write ? 'sales.payments.create' : 'sales.payments.read',
        ) &&
        (write || !actor.permissions.includes('sales.payments.create')))
    )
      throw new ForbiddenException();
    const source = await this.reservations.contractPurchaseContext(
      id,
      contract.branchId,
    );
    if (!source) throw new NotFoundException('درخواست در دسترس نیست.');
    const current = await this.reservations.purchaseContext(source.id, [
      contract.branchId,
    ]);
    if (
      current.contractId !== id ||
      !isFloatingSalesContract(current.snapshot.serviceSelections)
    )
      throw new ForbiddenException();
    const workflow = await this.workflow.detail(current.id, [
      contract.branchId,
    ]);
    return { ...current, workflow: workflow.workflow };
  }
  async reference(
    id: string,
    resource: string,
    page: string,
    search: string,
    actor: AuthenticatedActor,
  ) {
    await this.context(id, actor);
    const n = Number(page);
    if (!Number.isSafeInteger(n) || n < 1 || n > 10000)
      throw new BadRequestException();
    if (resource === 'voucher-brokers')
      return this.agencies.agencyPurchaseOptions(search, n);
    if (resource === 'voucher-currencies')
      return this.directory.voucherCurrencies(n);
    throw new NotFoundException();
  }
  async quote(id: string, currency: string, actor: AuthenticatedActor) {
    await this.context(id, actor);
    return { data: await this.fx.quote(currency) };
  }
  async record(
    id: string,
    input: ReservationServicePurchaseInputV1,
    actor: AuthenticatedActor,
    key?: string,
  ) {
    const context = await this.context(id, actor, true);
    return this.purchases.record(context.id, input, actor, key, id);
  }
  async batch(
    id: string,
    input: ReservationPurchaseBatchInputV1,
    actor: AuthenticatedActor,
    key?: string,
  ) {
    const context = await this.context(id, actor, true);
    return this.purchases.recordBatch(context.id, input, actor, key, id);
  }
}
@UseGuards(AuthGuard)
@Controller('sales/contracts/:id/purchases')
export class SalesFloatingPurchasesController {
  constructor(
    @Inject(SalesFloatingPurchases)
    private readonly service: SalesFloatingPurchases,
  ) {}
  @Header('Cache-Control', 'private, no-store')
  @Get('purchase-context')
  async context(
    @Param('id', ParseUUIDPipe) id: string,
    @Req() req: AuthenticatedRequest,
  ) {
    return { data: await this.service.context(id, req.actor) };
  }
  @Header('Cache-Control', 'private, no-store')
  @Get('workflow')
  async workflow(
    @Param('id', ParseUUIDPipe) id: string,
    @Req() req: AuthenticatedRequest,
  ) {
    return { data: await this.service.context(id, req.actor) };
  }
  @Header('Cache-Control', 'private, no-store')
  @Get('fx')
  quote(
    @Param('id', ParseUUIDPipe) id: string,
    @Query('currency') currency: string,
    @Req() req: AuthenticatedRequest,
  ) {
    return this.service.quote(id, currency, req.actor);
  }
  @Header('Cache-Control', 'private, no-store')
  @Get(':resource')
  references(
    @Param('id', ParseUUIDPipe) id: string,
    @Param('resource') resource: string,
    @Query('page') page = '1',
    @Query('search') search = '',
    @Req() req: AuthenticatedRequest,
  ) {
    return this.service.reference(id, resource, page, search, req.actor);
  }
  @Header('Cache-Control', 'private, no-store')
  @Post('service-purchases')
  record(
    @Param('id', ParseUUIDPipe) id: string,
    @Body() input: ReservationServicePurchaseInputV1,
    @Req() req: AuthenticatedRequest,
    @Headers('idempotency-key') key?: string,
  ) {
    return this.service.record(id, input, req.actor, key);
  }
  @Header('Cache-Control', 'private, no-store')
  @Post('purchase-batches')
  batch(
    @Param('id', ParseUUIDPipe) id: string,
    @Body() input: ReservationPurchaseBatchInputV1,
    @Req() req: AuthenticatedRequest,
    @Headers('idempotency-key') key?: string,
  ) {
    return this.service.batch(id, input, req.actor, key);
  }
}
