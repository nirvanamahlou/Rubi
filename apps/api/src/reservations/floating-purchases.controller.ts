import {
  BadRequestException,
  Body,
  Controller,
  ForbiddenException,
  Get,
  Header,
  Headers,
  Inject,
  Param,
  ParseUUIDPipe,
  Post,
  Query,
  Req,
  UseGuards,
} from '@nestjs/common';
import {
  canViewRoute,
  FLOATING_PURCHASE_OWN,
  FLOATING_PURCHASE_ALL,
  type ReservationServicePurchaseInputV1,
  type FloatingPurchaseRequestV1,
} from '@nora/contracts';
import { AuthGuard } from '../iam/auth.guard';
import type { AuthenticatedRequest } from '../iam/iam.types';
import { ReservationsPublicService } from './reservations-public.service';
import { ReservationServicePurchaseService } from './reservation-service-purchase.service';
import { MasterTravelDirectory } from '../master-data/master-travel-directory';
import type { PurchaseQueryInput } from './reservation-purchase-query';
@Controller('floating-purchases')
@UseGuards(AuthGuard)
export class FloatingPurchasesController {
  constructor(
    @Inject(ReservationsPublicService)
    private readonly reservations: ReservationsPublicService,
    @Inject(ReservationServicePurchaseService)
    private readonly purchases: ReservationServicePurchaseService,
    @Inject(MasterTravelDirectory)
    private readonly directory: MasterTravelDirectory,
  ) {}
  private route(kind: string) {
    if (!['HOTEL', 'FLIGHT'].includes(kind))
      throw new BadRequestException('نوع خرید شناور معتبر نیست.');
    return `/ticket-purchases/floating-${kind === 'HOTEL' ? 'hotels' : 'flights'}`;
  }
  private access(req: AuthenticatedRequest, kind: string) {
    if (
      !req.actor.permissions.some((p) =>
        [FLOATING_PURCHASE_OWN, FLOATING_PURCHASE_ALL].includes(p),
      ) ||
      !canViewRoute(req.actor.permissions, this.route(kind))
    )
      throw new ForbiddenException();
  }
  @Get()
  @Header('Cache-Control', 'private, no-store')
  async list(
    @Req() req: AuthenticatedRequest,
    @Query() query: PurchaseQueryInput,
  ) {
    const kind = query.kind ?? 'HOTEL';
    this.access(req, kind);
    const scope = req.actor.permissions.includes(FLOATING_PURCHASE_ALL)
      ? {}
      : { ownerUserId: req.actor.userId };
    const result = await this.reservations.purchaseInbox(
      req.actor.branchIds,
      { ...query, kind },
      undefined,
      scope,
    );
    return {
      version: 1,
      ...result,
      data: result.data.map((request): FloatingPurchaseRequestV1 => {
        const keys = new Set(
          result.meta.services
            .filter((row) => row.id === request.id)
            .map((row) => row.clientKey),
        );
        return {
          id: request.id,
          salesOwnerUserId: request.salesOwnerUserId,
          purchaseVersion: request.purchaseVersion,
          snapshot: {
            contractNumber: request.snapshot.contractNumber,
            serviceSelections: request.snapshot.serviceSelections
              .filter(
                (s) =>
                  keys.has(s.clientKey) &&
                  (s.kind === 'HOTEL' || s.kind === 'FLIGHT'),
              )
              .map((s) => ({
                clientKey: s.clientKey,
                kind: s.kind as 'HOTEL' | 'FLIGHT',
                titleSnapshot: s.titleSnapshot,
              })),
            ...(request.snapshot.hotelSelection &&
            keys.has(request.snapshot.hotelSelection.serviceClientKey)
              ? {
                  hotelSelection: {
                    serviceClientKey:
                      request.snapshot.hotelSelection.serviceClientKey,
                    hotelNameSnapshot:
                      request.snapshot.hotelSelection.hotelNameSnapshot,
                  },
                }
              : {}),
            ticketSelections: request.snapshot.ticketSelections
              ?.filter((t) => keys.has(t.serviceClientKey))
              .map((t) => ({
                serviceClientKey: t.serviceClientKey,
                carrierNameSnapshot: t.carrierNameSnapshot,
              })),
          },
          servicePurchases: request.servicePurchases
            ?.filter((p) => keys.has(p.serviceClientKey))
            .map((p) => ({
              serviceClientKey: p.serviceClientKey,
              supplierOrganizationId: p.supplierOrganizationId,
              supplierName: p.supplierName,
              amount: p.amount,
              currencyCode: p.currencyCode,
            })),
          hotelPurchases:
            kind === 'HOTEL'
              ? request.hotelPurchases?.map((p) => ({
                  amount: p.amount,
                  currencyCode: p.currencyCode,
                }))
              : undefined,
        };
      }),
      meta: {
        ...result.meta,
        canRecord: req.actor.permissions.includes(FLOATING_PURCHASE_OWN),
      },
    };
  }
  private async context(id: string, req: AuthenticatedRequest, kind: string) {
    this.access(req, kind);
    const intake = await this.reservations.purchaseContext(
      id,
      req.actor.branchIds,
    );
    if (
      (!req.actor.permissions.includes(FLOATING_PURCHASE_ALL) &&
        intake.salesOwnerUserId !== req.actor.userId) ||
      !intake.floatingContract
    )
      throw new ForbiddenException();
    return intake;
  }
  @Get(':id/options')
  @Header('Cache-Control', 'private, no-store')
  async options(
    @Param('id', ParseUUIDPipe) id: string,
    @Req() req: AuthenticatedRequest,
    @Query('kind') kind = 'HOTEL',
    @Query('resource') resource = 'brokers',
    @Query('search') search = '',
    @Query('page') page = '1',
  ) {
    await this.context(id, req, kind);
    const n = Number(page);
    if (
      !['brokers', 'currencies'].includes(resource) ||
      typeof search !== 'string' ||
      search.length > 100 ||
      !Number.isSafeInteger(n) ||
      n < 1 ||
      n > 1000
    )
      throw new BadRequestException('فیلتر کارتابل خرید معتبر نیست.');
    return this.directory.hotelRateChoices(
      resource as 'brokers' | 'currencies',
      search,
      n,
    );
  }
  @Post(':id')
  record(
    @Param('id', ParseUUIDPipe) id: string,
    @Req() req: AuthenticatedRequest,
    @Body() input: ReservationServicePurchaseInputV1,
    @Headers('idempotency-key') key?: string,
  ) {
    // Producer rechecks ownership, branch, selected service and floating status before writing.
    return this.purchases.record(id, input, req.actor, key, true);
  }
}
