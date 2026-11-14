import {
  BadRequestException,
  ConflictException,
  ForbiddenException,
  Inject,
  Injectable,
  NotFoundException,
} from '@nestjs/common';
import { Prisma } from '@nora/database';
import type {
  AuthenticatedActor,
  SalesContractCreateRequest,
  SalesPaymentCreateRequest,
} from '@nora/contracts';
import { DatabaseService } from '../database/database.service';
import { TicketPublicService } from '../ticket-catalog/ticket-public.service';
import { TourPublicService } from '../ticket-catalog/tour-public.service';
import { PackageTourPricingService } from '../package-pricing/package-tour-pricing.service';
import { SalesService } from '../sales/sales.service';
import { SalesOutputService } from '../sales/sales-output.service';
import { MasterDataService } from '../master-data/master-data.service';
import { TravelWorkflowService } from '../reservations/travel-workflow.service';
import { FinanceDeliveryService } from '../finance/document-delivery/finance-delivery.module';
import { ReservationTicketDocumentsService } from '../reservations/reservation-ticket-documents';
import { isFloatingSalesContract } from '@nora/contracts';
import { passengerAgeCategory } from '../sales/sales.domain';
import { websiteFlightQuotes } from './ticket-quote';
import {
  assertWebsiteDraft,
  externalOrderId,
  siteBinding,
  stableFingerprint,
} from './site-commerce.policy';

@Injectable()
export class SiteCommerceService {
  constructor(
    @Inject(DatabaseService) private readonly db: DatabaseService,
    @Inject(TicketPublicService) private readonly tickets: TicketPublicService,
    @Inject(TourPublicService) private readonly tours: TourPublicService,
    @Inject(PackageTourPricingService)
    private readonly packages: PackageTourPricingService,
    @Inject(SalesService) private readonly sales: SalesService,
    @Inject(SalesOutputService) private readonly output: SalesOutputService,
    @Inject(MasterDataService) private readonly references: MasterDataService,
    @Inject(TravelWorkflowService)
    private readonly travel: TravelWorkflowService,
    @Inject(FinanceDeliveryService)
    private readonly delivery: FinanceDeliveryService,
    @Inject(ReservationTicketDocumentsService)
    private readonly ticketDocuments: ReservationTicketDocumentsService,
  ) {}

  private scoped(site: string, actor: AuthenticatedActor) {
    const binding = siteBinding(site, actor);
    return { ...actor, branchIds: [binding.branchId] };
  }

  async publication(
    site: string,
    kind: string,
    resourceId: string,
    actor: AuthenticatedActor,
  ) {
    if (!actor.permissions.includes('ticket_catalog.manage'))
      throw new ForbiddenException();
    return {
      data: await this.db.client.websitePublication.findFirst({
        where: {
          siteCode: site,
          kind,
          resourceId,
          branchId: { in: actor.branchIds },
        },
      }),
    };
  }

  async publish(
    site: string,
    kind: string,
    resourceId: string,
    input: { enabled: boolean; version: number },
    actor: AuthenticatedActor,
  ) {
    if (
      !['ticket', 'tour'].includes(kind) ||
      !['nss'].includes(site) ||
      typeof input?.enabled !== 'boolean' ||
      !Number.isInteger(input.version)
    )
      throw new BadRequestException('انتشار سایت معتبر نیست.');
    if (!actor.permissions.includes('ticket_catalog.manage'))
      throw new ForbiddenException();
    const resource =
      kind === 'ticket'
        ? await this.tickets.websiteOffer(resourceId, actor.branchIds)
        : await this.tours.pricingDeparture(resourceId, actor.branchIds);
    const key = {
      siteCode: site,
      kind,
      resourceId,
      branchId: resource.branchId,
    };
    const row = await this.db.client.websitePublication.findUnique({
      where: { siteCode_branchId_kind_resourceId: key },
    });
    if ((row?.version ?? 0) !== input.version)
      throw new ConflictException('وضعیت انتشار تغییر کرده است.');
    if (!row)
      return {
        data: await this.db.client.websitePublication.create({
          data: { ...key, enabled: input.enabled },
        }),
      };
    const changed = await this.db.client.websitePublication.updateMany({
      where: { id: row.id, version: input.version },
      data: { enabled: input.enabled, version: { increment: 1 } },
    });
    if (!changed.count)
      throw new ConflictException('وضعیت انتشار تغییر کرده است.');
    return {
      data: await this.db.client.websitePublication.findUniqueOrThrow({
        where: { id: row.id },
      }),
    };
  }

  private async flight(offerId: string, branchIds: readonly string[]) {
    const offer = await this.tickets.websiteOffer(offerId, branchIds);
    const [origin, destination, originAirport, destinationAirport] =
      await Promise.all([
        this.references.detail('cities', offer.originId),
        this.references.detail('cities', offer.destinationId),
        offer.originAirportId
          ? this.references.detail('airports', offer.originAirportId)
          : null,
        offer.destinationAirportId
          ? this.references.detail('airports', offer.destinationAirportId)
          : null,
      ]);
    const countries = await Promise.all(
      [origin.data, destination.data].map((city) =>
        typeof city.attributes.countryId === 'string'
          ? this.references.detail('countries', city.attributes.countryId)
          : null,
      ),
    );
    const countryCodes = countries.map(
      (country) => country?.data.code?.toUpperCase() ?? '',
    );
    if (countryCodes.some((code) => !code))
      throw new BadRequestException(
        'کشور مبدأ و مقصد را در اطلاعات پایه کامل کنید.',
      );
    return {
      ...offer,
      international: countryCodes.some(
        (code) => code !== '' && !['IR', 'IRN', 'IRAN'].includes(code),
      ),
      originName: origin.data.name,
      destinationName: destination.data.name,
      originAirport: originAirport
        ? {
            name: originAirport.data.name,
            iataCode: originAirport.data.attributes.iataCode,
          }
        : null,
      destinationAirport: destinationAirport
        ? {
            name: destinationAirport.data.name,
            iataCode: destinationAirport.data.attributes.iataCode,
          }
        : null,
    };
  }

  async catalog(site: string, actor: AuthenticatedActor) {
    const scoped = this.scoped(site, actor);
    const rows = await this.db.client.websitePublication.findMany({
      where: { siteCode: site, branchId: scoped.branchIds[0]! },
      orderBy: { id: 'asc' },
      take: 501,
    });
    if (rows.length > 500)
      throw new BadRequestException(
        'برای کاتالوگ بزرگ‌تر صفحه‌بندی تنظیم شود.',
      );
    const data = [];
    for (const row of rows) {
      if (!row.enabled) {
        data.push({
          id: row.id,
          kind: row.kind,
          resourceId: row.resourceId,
          enabled: false,
          version: row.version,
        });
        continue;
      }
      try {
        const product =
          row.kind === 'ticket'
            ? { flight: await this.flight(row.resourceId, scoped.branchIds) }
            : {
                tour: await this.websiteTour(row.resourceId, scoped),
                rooms: (
                  await this.packages.saleCatalog(
                    row.resourceId,
                    scoped,
                    scoped.branchIds[0],
                  )
                ).data,
              };
        if (
          'tour' in product &&
          (product.tour.isActive === false || product.tour.isDeleted === true)
        ) {
          data.push({
            id: row.id,
            kind: row.kind,
            resourceId: row.resourceId,
            enabled: false,
            version: row.version,
          });
          continue;
        }
        data.push({
          id: row.id,
          kind: row.kind,
          resourceId: row.resourceId,
          enabled: true,
          version: row.version,
          ...product,
        });
      } catch (error) {
        // Preserve explicit tombstones, but never hide infrastructure failure as deletion.
        if (!(
          error instanceof BadRequestException ||
          error instanceof NotFoundException
        ))
          throw error;
        data.push({
          id: row.id,
          kind: row.kind,
          resourceId: row.resourceId,
          enabled: false,
          version: row.version,
        });
      }
    }
    return { version: 1, data };
  }

  private async websiteTour(id: string, actor: AuthenticatedActor) {
    const tour = await this.tours.pricingDeparture(id, actor.branchIds);
    return {
      ...tour,
      outbound: await this.flight(tour.outbound.id, actor.branchIds),
      ...(tour.returning
        ? { returning: await this.flight(tour.returning.id, actor.branchIds) }
        : {}),
    };
  }

  private async assertPublished(
    site: string,
    input: SalesContractCreateRequest,
    actor: AuthenticatedActor,
  ) {
    const tourIds = [
      ...new Set(
        input.services
          .map((s) => s.metadata?.tourDepartureId)
          .filter((v): v is string => typeof v === 'string'),
      ),
    ];
    const resources = tourIds.length
      ? tourIds.map((resourceId) => ({ kind: 'tour', resourceId }))
      : (input.ticketSelections ?? []).map((s) => ({
          kind: 'ticket',
          resourceId: s.offerId,
        }));
    if (!resources.length || tourIds.length > 1)
      throw new BadRequestException('محصول ERP را انتخاب کنید.');
    for (const resource of resources) {
      const published = await this.db.client.websitePublication.findUnique({
        where: {
          siteCode_branchId_kind_resourceId: {
            siteCode: site,
            branchId: actor.branchIds[0]!,
            ...resource,
          },
        },
      });
      if (!published?.enabled)
        throw new ForbiddenException('این محصول برای سایت منتشر نشده است.');
    }
    if (tourIds.length) {
      if (
        input.services.filter((s) => s.metadata?.packagePublishedSale)
          .length !== 1
      )
        throw new BadRequestException('قیمت منتشرشده پکیج الزامی است.');
      await this.packages.validateContractSale(
        input,
        actor,
        actor.branchIds[0],
      );
    } else {
      if (
        input.services.some((s) => s.kind !== 'FLIGHT') ||
        input.hotelSelection
      )
        throw new BadRequestException('خدمت انتخابی معتبر نیست.');
      // A native ticket quote is checked again atomically by Ticket Catalog at confirm.
      // Only catalog values, not an agreement/discount supplied by a browser, are accepted.
      const totals = new Map<string, Prisma.Decimal>();
      const selections = [...(input.ticketSelections ?? [])].sort((a, b) =>
        a.direction === b.direction ? 0 : a.direction === 'OUTBOUND' ? -1 : 1,
      );
      if (
        !selections.length ||
        selections.length > 2 ||
        selections[0]!.direction !== 'OUTBOUND'
      )
        throw new BadRequestException('پرواز رفت را انتخاب کنید.');
      const offers = await Promise.all(
        selections.map((s) =>
          this.tickets.websiteOffer(s.offerId, actor.branchIds),
        ),
      );
      const seats = input.passengers.filter(
        (p) => passengerAgeCategory(p.birthDate, input.departureDate) !== 'INF',
      ).length;
      const quotes = websiteFlightQuotes(offers[0]!, offers[1], seats);
      for (const [index, selection] of selections.entries()) {
        const offer = offers[index]!,
          price = quotes[index]!;
        if (
          input.passengers.some(
            (p) => !p.serviceClientKeys.includes(selection.serviceClientKey),
          )
        )
          throw new BadRequestException('مسافران هر دو مسیر باید یکسان باشند.');
        const amount = new Prisma.Decimal(price.amount);
        if (
          !selection.quotedPrice ||
          selection.quotedPrice.currencyCode !== price.currencyCode ||
          !amount.eq(selection.quotedPrice.amount)
        )
          throw new ConflictException('نرخ مرجع پرواز تغییر کرده است.');
        totals.set(
          price.currencyCode,
          (totals.get(price.currencyCode) ?? new Prisma.Decimal(0)).add(amount),
        );
        if (
          selection.originId !== offer.originId ||
          selection.destinationId !== offer.destinationId ||
          selection.departureAt !== offer.departureAt ||
          selection.arrivalAt !== offer.arrivalAt ||
          selection.carrierNameSnapshot !== offer.carrierName ||
          selection.serviceNumberSnapshot !== offer.serviceNumber ||
          selection.cabinClassCode !== offer.cabinClassCode
        )
          throw new ConflictException('اطلاعات پرواز تغییر کرده است.');
      }
      const actual = new Map<string, Prisma.Decimal>();
      for (const p of input.priceComponents)
        actual.set(
          p.currencyCode,
          (actual.get(p.currencyCode) ?? new Prisma.Decimal(0)).add(p.amount),
        );
      if (
        totals.size !== actual.size ||
        [...totals].some(([code, value]) => !value.eq(actual.get(code) ?? -1))
      )
        throw new ConflictException('قیمت سایت باید برابر نرخ ERP باشد.');
    }
  }

  async flightQuote(
    site: string,
    body: { productIds: string[]; birthDates: string[] },
    actor: AuthenticatedActor,
  ) {
    const scoped = this.scoped(site, actor);
    if (
      !body ||
      !Array.isArray(body.productIds) ||
      body.productIds.length < 1 ||
      body.productIds.length > 2 ||
      !Array.isArray(body.birthDates) ||
      !body.birthDates.length ||
      body.birthDates.length > 30 ||
      body.birthDates.some(
        (d) => typeof d !== 'string' || !/^\d{4}-\d{2}-\d{2}$/.test(d),
      )
    )
      throw new BadRequestException('استعلام بلیت معتبر نیست.');
    const offers: Awaited<ReturnType<TicketPublicService['websiteOffer']>>[] =
      [];
    for (const id of body.productIds) {
      const product = await this.db.client.websitePublication.findFirst({
        where: {
          id,
          siteCode: site,
          branchId: scoped.branchIds[0]!,
          kind: 'ticket',
          enabled: true,
        },
      });
      if (!product)
        throw new ForbiddenException('محصول برای سایت منتشر نشده است.');
      offers.push(
        await this.tickets.websiteOffer(product.resourceId, scoped.branchIds),
      );
    }
    const seats = body.birthDates.filter(
      (d) =>
        passengerAgeCategory(d, offers[0]!.departureAt.slice(0, 10)) !== 'INF',
    ).length;
    return { data: websiteFlightQuotes(offers[0]!, offers[1], seats) };
  }

  async draft(
    site: string,
    externalId: string,
    input: SalesContractCreateRequest,
    actor: AuthenticatedActor,
  ) {
    const scoped = this.scoped(site, actor);
    externalOrderId(externalId);
    assertWebsiteDraft(input);
    const fingerprint = stableFingerprint(input);
    const key = { siteCode: site, branchId: scoped.branchIds[0]!, externalId };
    const previous = await this.db.client.websiteOrder.findUnique({
      where: { siteCode_branchId_externalId: key },
    });
    if (previous) {
      if (previous.fingerprint !== fingerprint)
        throw new ConflictException(
          'شناسه سفارش با اطلاعات متفاوت استفاده شده است.',
        );
      return this.status(site, externalId, actor);
    }
    const recovered = await this.sales.createdByKey(
      `site:${site}:${externalId}`,
      scoped,
    );
    if (!recovered) await this.assertPublished(site, input, scoped);
    const created = await this.sales.create(
      {
        ...input,
        services: input.services.map((s) => ({
          ...s,
          metadata: {
            ...s.metadata,
            sourceSite: site,
            externalOrderId: externalId,
          },
        })),
      },
      scoped,
      key.branchId,
      `site:${site}:${externalId}`,
    );
    // Native Sales create is durable/idempotent; a timeout before this link is safe to retry.
    await this.db.client.websiteOrder.upsert({
      where: { siteCode_branchId_externalId: key },
      create: { ...key, fingerprint, contractId: created.data.id },
      update: {},
    });
    return this.status(site, externalId, actor);
  }

  private async order(
    site: string,
    externalId: string,
    actor: AuthenticatedActor,
  ) {
    const scoped = this.scoped(site, actor);
    externalOrderId(externalId);
    const row = await this.db.client.websiteOrder.findUnique({
      where: {
        siteCode_branchId_externalId: {
          siteCode: site,
          branchId: scoped.branchIds[0]!,
          externalId,
        },
      },
    });
    if (!row) throw new NotFoundException('سفارش متصل یافت نشد.');
    return { row, scoped };
  }

  async status(site: string, externalId: string, actor: AuthenticatedActor) {
    const { row, scoped } = await this.order(site, externalId, actor);
    const { data: contract } = await this.sales.detail(row.contractId, scoped);
    return {
      version: 1,
      data: {
        externalId,
        contractId: contract.id,
        contractNumber: contract.contractNumber,
        status: contract.status,
        contractVersion: contract.version,
        balances: contract.balances,
        ticketSelections: contract.ticketSelections,
        hotelSelection: contract.hotelSelection,
        services: contract.servicesDetail,
      },
    };
  }

  async paid(
    site: string,
    externalId: string,
    payments: SalesPaymentCreateRequest[],
    actor: AuthenticatedActor,
  ) {
    const { row, scoped } = await this.order(site, externalId, actor);
    if (
      !Array.isArray(payments) ||
      !payments.length ||
      payments.length > 10 ||
      payments.some(
        (p) =>
          !['ONLINE_GATEWAY', 'BANK_TRANSFER'].includes(p.method) ||
          !p.paymentReference,
      )
    )
      throw new BadRequestException('رسید تأییدشده سایت الزامی است.');
    const fingerprint = stableFingerprint(payments);
    if (row.paymentFingerprint && row.paymentFingerprint !== fingerprint)
      throw new ConflictException('رسید این سفارش تغییر کرده است.');
    const { data: before } = await this.sales.detail(row.contractId, scoped);
    const paid = new Map<string, Prisma.Decimal>();
    for (const p of payments)
      paid.set(
        p.currencyCode,
        (paid.get(p.currencyCode) ?? new Prisma.Decimal(0)).add(p.amount),
      );
    if (before.status === 'CANCELLED')
      throw new ConflictException('قرارداد لغو شده است.');
    if (
      before.balances.length !== paid.size ||
      before.balances.some(
        (b) => !new Prisma.Decimal(b.amount).eq(paid.get(b.currencyCode) ?? -1),
      )
    )
      throw new ConflictException('مبلغ رسید باید دقیقاً برابر قرارداد باشد.');
    // Lock payment identity before any side effect; identical retries resume native idempotent commands.
    if (!row.paymentFingerprint)
      await this.db.client.websiteOrder.updateMany({
        where: { id: row.id, paymentFingerprint: null },
        data: {
          paymentFingerprint: fingerprint,
          paymentCommands: payments.map((p, i) => ({
            ...p,
            version: before.version + i,
          })) as unknown as Prisma.InputJsonValue,
        },
      });
    const locked = await this.db.client.websiteOrder.findUniqueOrThrow({
      where: { id: row.id },
    });
    if (locked.paymentFingerprint !== fingerprint)
      throw new ConflictException('رسید هم‌زمان تغییر کرده است.');
    const commands =
      locked.paymentCommands as unknown as SalesPaymentCreateRequest[];
    for (const [index, payment] of commands.entries()) {
      await this.sales.addPayment(
        row.contractId,
        payment,
        scoped,
        `site:${site}:${externalId}:paid:${index}`,
      );
    }
    const { data: current } = await this.sales.detail(row.contractId, scoped);
    if (['DRAFT', 'PENDING_CONFIRMATION'].includes(current.status))
      await this.sales.confirm(
        row.contractId,
        current.version,
        'پرداخت تأییدشده سایت',
        scoped,
        `site:${site}:${externalId}:confirm`,
      );
    return this.status(site, externalId, actor);
  }

  async contractOutput(
    site: string,
    externalId: string,
    actor: AuthenticatedActor,
  ) {
    const { row, scoped } = await this.order(site, externalId, actor);
    return this.output.prepare(row.contractId, scoped);
  }

  async paymentAccounts(
    site: string,
    externalId: string,
    actor: AuthenticatedActor,
  ) {
    const { row, scoped } = await this.order(site, externalId, actor);
    return this.sales.paymentAccounts(row.contractId, scoped);
  }

  async travelDocuments(
    site: string,
    externalId: string,
    actor: AuthenticatedActor,
  ) {
    const { row, scoped } = await this.order(site, externalId, actor);
    const { data: contract } = await this.sales.detail(row.contractId, scoped);
    const intake = await this.travel.forContract(
      row.contractId,
      scoped.branchIds,
    );
    const authorization = await this.delivery.readCustomerContract(
      row.contractId,
    );
    if (
      !authorization.approved ||
      contract.status === 'CANCELLED' ||
      intake.workflow.supplierStatus === 'CANCELLED'
    )
      throw new ForbiddenException(
        'تحویل مدارک هنوز توسط مالی تأیید نشده است.',
      );
    if (isFloatingSalesContract(intake.snapshot.serviceSelections)) {
      const output = await this.travel.floatingDocumentOutput(intake, scoped);
      return {
        data: {
          ...output,
          ticketDocuments: await this.ticketDocuments.issueFloatingForDelivery(
            output,
            scoped,
          ),
        },
        delivery: authorization,
      };
    }
    return { data: intake, delivery: authorization };
  }
}
