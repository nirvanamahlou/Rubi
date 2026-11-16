import { commerceSites, isDeliverySite } from './commerce-sites';
import { ageCounts } from '../ticket-catalog/ticket-age-fares';
import { websitePresentation } from './publication-presentation';
import { DocumentsService } from '../documents/documents.service';
import {
  attachAirlineLogos,
  websiteAirlineLogo,
  carrierKey,
} from './airline-logos';
import {
  BadRequestException,
  ConflictException,
  ForbiddenException,
  Inject,
  Injectable,
  NotFoundException,
  Optional,
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
import { FloatingTourPricingService } from '../package-pricing/floating-tour-pricing.service';
import { SalesService } from '../sales/sales.service';
import { SalesOutputService } from '../sales/sales-output.service';
import { MasterDataService } from '../master-data/master-data.service';
import { TravelWorkflowService } from '../reservations/travel-workflow.service';
import { FinanceDeliveryService } from '../finance/document-delivery/finance-delivery.module';
import { ReservationTicketDocumentsService } from '../reservations/reservation-ticket-documents';
import { salesContractFlights, isFloatingSalesContract } from '@nora/contracts';
import { passengerAgeCategory } from '../sales/sales.domain';
import { websiteFlightQuotes } from './ticket-quote';
import {
  actorSite,
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
    @Optional()
    @Inject(DocumentsService)
    private readonly documents?: DocumentsService,
    @Inject(FloatingTourPricingService)
    private readonly floating?: FloatingTourPricingService,
  ) {}

  private scoped(site: string, actor: AuthenticatedActor) {
    const binding = siteBinding(site, actor);
    return { ...actor, branchIds: [binding.branchId] };
  }

  private async ticketTarget(site: string, branchId: string) {
    const binding = await this.db.client.websiteCatalogDelivery.findUnique({
      where: { siteCode: site },
    });
    if (binding?.branchId !== branchId || !binding.salePriceTargetId)
      throw new BadRequestException(
        'ابتدا درصد مقصد «نیایش سیر سحر» را در مدیریت قیمت بلیط ثبت کنید.',
      );
    return binding.salePriceTargetId;
  }

  /** Read-only normalized branding for an already linked website contract. */
  async ticketAirlineLogo(
    contractId: string,
    carrierName: string,
    actor: AuthenticatedActor,
  ) {
    const site = actorSite(actor);
    if (!isDeliverySite(site)) throw new ForbiddenException();
    const scoped = this.scoped(site, actor);
    if (
      !this.documents ||
      typeof carrierName !== 'string' ||
      carrierName.length > 200 ||
      !carrierKey(carrierName)
    )
      throw new NotFoundException();
    const link = await this.db.client.websiteOrder.findFirst({
      where: { siteCode: site, branchId: scoped.branchIds[0]!, contractId },
      select: { id: true },
    });
    if (!link) throw new NotFoundException();
    const { data: contract } = await this.sales.detail(contractId, scoped);
    if (
      contract.status === 'CANCELLED' ||
      !salesContractFlights(
        contract.servicesDetail,
        contract.ticketSelections,
      ).some(
        (flight) =>
          carrierKey(flight.carrierNameSnapshot) === carrierKey(carrierName),
      )
    )
      throw new NotFoundException();
    const assets = await attachAirlineLogos([{ carrierName }], (name) =>
      websiteAirlineLogo(name, scoped, this.references, this.documents!),
    );
    if (assets.length !== 1) throw new NotFoundException();
    return Buffer.from(assets[0]!.dataBase64, 'base64');
  }

  private publicationBranch(
    site: string,
    actor: AuthenticatedActor,
    requested?: string,
  ) {
    if (!actor.permissions.includes('ticket_catalog.manage'))
      throw new ForbiddenException();
    if (!['nss', 'jahan-bastan', 'ghestiroo', 'jahan-academy'].includes(site))
      throw new BadRequestException('انتشار سایت معتبر نیست.');
    let bindings: Record<string, { branchId?: string }> = {};
    try {
      bindings = JSON.parse(process.env.SITE_COMMERCE_BINDINGS ?? '{}');
    } catch {
      throw new ForbiddenException();
    }
    const bound = bindings?.[site]?.branchId;
    const branchId = requested ?? bound;
    if (
      !branchId ||
      !actor.branchIds.includes(branchId) ||
      (bound && bound !== branchId) ||
      (isDeliverySite(site) && !bound)
    )
      throw new ForbiddenException('این شعبه به سایت انتخاب‌شده دسترسی ندارد.');
    return branchId;
  }

  async publication(
    site: string,
    kind: string,
    resourceId: string,
    actor: AuthenticatedActor,
    branch?: string,
    requestedPeriod = '',
  ) {
    const branchId = this.publicationBranch(site, actor, branch);
    if (!['ticket', 'tour', 'floating-tour'].includes(kind))
      throw new BadRequestException();
    const periodKey = this.publicationPeriod(kind, requestedPeriod);
    return {
      data: await this.db.client.websitePublication.findFirst({
        where: { siteCode: site, kind, resourceId, branchId, periodKey },
      }),
    };
  }

  async publish(
    site: string,
    kind: string,
    resourceId: string,
    input: {
      enabled: boolean;
      salesStopped?: boolean;
      version: number;
      branchId?: string;
      presentation?: unknown;
      periodKey?: string;
    },
    actor: AuthenticatedActor,
  ) {
    if (
      !['ticket', 'tour', 'floating-tour'].includes(kind) ||
      !['nss', 'jahan-bastan', 'ghestiroo', 'jahan-academy'].includes(site) ||
      typeof input?.enabled !== 'boolean' ||
      !Number.isInteger(input.version) ||
      (input.salesStopped !== undefined &&
        typeof input.salesStopped !== 'boolean')
    )
      throw new BadRequestException('انتشار سایت معتبر نیست.');
    if (!actor.permissions.includes('ticket_catalog.manage'))
      throw new ForbiddenException();
    const branchId = this.publicationBranch(site, actor, input.branchId);
    const periodKey = this.publicationPeriod(kind, input.periodKey ?? '');
    if (kind === 'ticket') {
      await this.tickets.documentSupply(resourceId, [branchId]);
      if (input.enabled)
        await this.tickets.websiteOffer(
          resourceId,
          [branchId],
          isDeliverySite(site)
            ? await this.ticketTarget(site, branchId)
            : undefined,
        );
    } else if (kind === 'floating-tour') {
      await this.floatingProduct(
        resourceId,
        [branchId],
        periodKey,
        input.enabled,
      );
    } else {
      await this.tours.pricingDeparture(resourceId, [branchId]);
      if (
        input.enabled &&
        !(
          await this.packages.websitePublicationCandidates({
            ...actor,
            branchIds: [branchId],
          })
        ).data.includes(resourceId)
      )
        throw new BadRequestException('قیمت منتشرشده پکیج الزامی است.');
    }
    const presentation =
      input.presentation === undefined
        ? undefined
        : websitePresentation(input.presentation);
    if (presentation && kind === 'ticket')
      throw new BadRequestException('تنظیمات نمایش سایت معتبر نیست.');
    const key = {
      siteCode: site,
      kind,
      resourceId,
      branchId,
      periodKey,
    };
    const row = await this.db.client.websitePublication.findUnique({
      where: { siteCode_branchId_kind_resourceId_periodKey: key },
    });
    if ((row?.version ?? 0) !== input.version)
      throw new ConflictException('وضعیت انتشار تغییر کرده است.');
    if (!row)
      return {
        data: await this.db.client.websitePublication.create({
          data: {
            ...key,
            ...(presentation ? { presentation } : {}),
            enabled: input.enabled,
            salesStopped: input.salesStopped ?? false,
          },
        }),
      };
    const changed = await this.db.client.websitePublication.updateMany({
      where: { id: row.id, version: input.version },
      data: {
        enabled: input.enabled,
        ...(presentation ? { presentation } : {}),
        salesStopped: input.salesStopped ?? row.salesStopped,
        version: { increment: 1 },
      },
    });
    if (!changed.count)
      throw new ConflictException('وضعیت انتشار تغییر کرده است.');
    return {
      data: await this.db.client.websitePublication.findUniqueOrThrow({
        where: { id: row.id },
      }),
    };
  }

  private async flight(
    offerId: string,
    branchIds: readonly string[],
    targetId?: string,
  ) {
    const offer = await this.tickets.websiteOffer(offerId, branchIds, targetId);
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

  async nextCatalogCapacityChange(branchId: string) {
    return this.tickets.websiteNextCapacityChange([branchId]);
  }

  async cancelledOrders(site: string, actor: AuthenticatedActor) {
    const scoped = this.scoped(site, actor);
    const links = await this.db.client.websiteOrder.findMany({
      where: { siteCode: site, branchId: scoped.branchIds[0]! },
      select: { externalId: true, contractId: true },
      orderBy: { id: 'asc' },
      take: 10001,
    });
    if (links.length > 10000) throw new BadRequestException();
    const cancelled = new Set(
      (
        await this.sales.cancelledWebsiteContracts(
          links.map((link) => link.contractId),
          scoped,
        )
      ).map((row) => row.id),
    );
    return links.filter((link) => cancelled.has(link.contractId));
  }

  async catalog(
    site: string,
    actor: AuthenticatedActor,
    includeFloating = false,
  ) {
    const scoped = this.scoped(site, actor);
    const rows = await this.db.client.websitePublication.findMany({
      where: {
        siteCode: site,
        branchId: scoped.branchIds[0]!,
        ...(!includeFloating ? { kind: { in: ['ticket', 'tour'] } } : {}),
      },
      orderBy: { id: 'asc' },
      take: 501,
    });
    if (rows.length > 500)
      throw new BadRequestException(
        'برای کاتالوگ بزرگ‌تر صفحه‌بندی تنظیم شود.',
      );
    const data = [];
    for (const row of rows) {
      // Legacy sites must explicitly opt into the additive floating-tour product contract.
      if (row.kind === 'floating-tour' && !includeFloating) continue;
      if (!row.enabled) {
        data.push({
          id: row.id,
          kind: row.kind,
          resourceId: row.resourceId,
          ...(row.kind === 'floating-tour' ? { periodKey: row.periodKey } : {}),
          enabled: false,
          version: row.version,
        });
        continue;
      }
      try {
        const product =
          row.kind === 'ticket'
            ? {
                flight: await this.flight(
                  row.resourceId,
                  scoped.branchIds,
                  await this.ticketTarget(site, scoped.branchIds[0]!),
                ),
              }
            : row.kind === 'floating-tour'
              ? {
                  floatingTour: await this.floatingProduct(
                    row.resourceId,
                    scoped.branchIds,
                    row.periodKey,
                  ),
                }
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
          product.tour &&
          (product.tour.isActive === false || product.tour.isDeleted === true)
        ) {
          data.push({
            id: row.id,
            kind: row.kind,
            resourceId: row.resourceId,
            ...(row.kind === 'floating-tour'
              ? { periodKey: row.periodKey }
              : {}),
            enabled: false,
            version: row.version,
          });
          continue;
        }
        const presentation = row.presentation
          ? websitePresentation(row.presentation)
          : undefined;
        if (presentation && 'tour' in product && product.tour) {
          product.tour.package = {
            ...product.tour.package,
            ...(presentation.title ? { name: presentation.title } : {}),
            details: {
              ...product.tour.package.details,
              version: 1,
              ...(presentation.description
                ? { description: presentation.description }
                : {}),
            },
          };
        }
        if (presentation && 'floatingTour' in product && product.floatingTour) {
          product.floatingTour.package = {
            ...product.floatingTour.package,
            ...(presentation.title ? { name: presentation.title } : {}),
            details: {
              ...product.floatingTour.package.details,
              version: 1,
              ...(presentation.description
                ? { description: presentation.description }
                : {}),
            },
          };
        }
        data.push({
          id: row.id,
          kind: row.kind,
          resourceId: row.resourceId,
          ...(row.kind === 'floating-tour' ? { periodKey: row.periodKey } : {}),
          enabled: true,
          salesStopped: row.salesStopped,
          version: row.version,
          ...product,
          ...(presentation ? { presentation } : {}),
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
          ...(row.kind === 'floating-tour' ? { periodKey: row.periodKey } : {}),
          enabled: false,
          version: row.version,
        });
      }
    }
    const cancelledOrders = await this.cancelledOrders(site, scoped);
    if (!this.documents || !isDeliverySite(site))
      return { version: 1, data, cancelledOrders };
    const flights: { carrierName: string; carrierLogoUrl?: string }[] = [];
    for (const product of data) {
      if ('flight' in product && product.flight) flights.push(product.flight);
      if ('tour' in product && product.tour) {
        flights.push(product.tour.outbound);
        if (product.tour.returning) flights.push(product.tour.returning);
      }
    }
    // Reserve room for base64/URL overhead inside the existing four-MiB signed delivery.
    const available = Math.floor(
      Math.max(
        0,
        4 * 1024 * 1024 -
          Buffer.byteLength(
            JSON.stringify({ version: 1, data, cancelledOrders }),
          ) -
          128 * 1024,
      ) * 0.7,
    );
    const airlineLogos = await attachAirlineLogos(
      flights,
      (name) =>
        websiteAirlineLogo(name, scoped, this.references, this.documents!),
      available,
      commerceSites[site].origin,
    );
    return { version: 1, data, airlineLogos, cancelledOrders };
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

  private floatingProduct(
    id: string,
    branchIds: string[],
    periodKey: string,
    requirePrices = true,
  ) {
    if (!this.floating) throw new Error('Floating tour pricing is unavailable');
    return this.floating.websiteProduct(
      id,
      branchIds,
      periodKey,
      requirePrices,
    );
  }

  private publicationPeriod(kind: string, key: string) {
    if (
      typeof key !== 'string' ||
      key.length > 100 ||
      (kind !== 'floating-tour' && key !== '') ||
      (kind === 'floating-tour' &&
        !/^(dated:\d{4}-\d{2}-\d{2}:\d{1,3}|monthly:(PERSIAN|GREGORIAN):\d{1,2}(?:-\d{1,2}){0,11}:\d{1,3})$/.test(
          key,
        ))
    )
      throw new BadRequestException('انتشار سایت معتبر نیست.');
    return key;
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
          siteCode_branchId_kind_resourceId_periodKey: {
            periodKey: '',
            siteCode: site,
            branchId: actor.branchIds[0]!,
            ...resource,
          },
        },
      });
      if (!published?.enabled || published.salesStopped)
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
          this.ticketTarget(site, actor.branchIds[0]!).then((target) =>
            this.tickets.websiteOffer(s.offerId, actor.branchIds, target),
          ),
        ),
      );
      const seats = input.passengers.filter(
        (p) => passengerAgeCategory(p.birthDate, input.departureDate) !== 'INF',
      ).length;
      const quotes = websiteFlightQuotes(
        offers[0]!,
        offers[1],
        seats,
        ageCounts(
          input.passengers.map((p) =>
            passengerAgeCategory(p.birthDate, input.departureDate),
          ),
        ),
      );
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
    body: {
      productIds: string[];
      birthDates?: string[];
      passengerCounts?: { adults: number; children: number; infants: number };
    },
    actor: AuthenticatedActor,
  ) {
    const scoped = this.scoped(site, actor);
    const dates = Array.isArray(body?.birthDates) ? body.birthDates : null;
    const preview = body?.passengerCounts;
    const validDates =
      dates &&
      dates.length >= 1 &&
      dates.length <= 30 &&
      dates.every(
        (d) => typeof d === 'string' && /^\d{4}-\d{2}-\d{2}$/.test(d),
      );
    const validPreview =
      preview &&
      typeof preview === 'object' &&
      !Array.isArray(preview) &&
      Object.keys(preview).length === 3 &&
      (['adults', 'children', 'infants'] as const).every(
        (key) => Number.isSafeInteger(preview[key]) && preview[key] >= 0,
      ) &&
      preview.adults + preview.children >= 1 &&
      preview.adults + preview.children + preview.infants <= 30;
    if (
      !body ||
      !Array.isArray(body.productIds) ||
      body.productIds.length < 1 ||
      body.productIds.length > 2 ||
      body.productIds.some(
        (id) => typeof id !== 'string' || !id || id.length > 80,
      ) ||
      new Set(body.productIds).size !== body.productIds.length ||
      (body.birthDates !== undefined && body.passengerCounts !== undefined) ||
      !(validDates || validPreview)
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
          salesStopped: false,
        },
      });
      if (!product)
        throw new ForbiddenException('محصول برای سایت منتشر نشده است.');
      offers.push(
        await this.tickets.websiteOffer(
          product.resourceId,
          scoped.branchIds,
          await this.ticketTarget(site, scoped.branchIds[0]!),
        ),
      );
    }
    const counts = dates
      ? ageCounts(
          dates.map((d) =>
            passengerAgeCategory(d, offers[0]!.departureAt.slice(0, 10)),
          ),
        )
      : preview!;
    return {
      data: websiteFlightQuotes(
        offers[0]!,
        offers[1],
        counts.adults + counts.children,
        counts,
        true,
      ),
    };
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
    const ticketTargetId = input.services.some(
      (s) => s.metadata?.tourDepartureId,
    )
      ? undefined
      : await this.ticketTarget(site, scoped.branchIds[0]!);
    const created = await this.sales.create(
      {
        ...input,
        services: input.services.map((s) => ({
          ...s,
          metadata: {
            ...s.metadata,
            catalogSalePriceTargetId: ticketTargetId ?? null,
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
    if (['DRAFT', 'PENDING_CONFIRMATION'].includes(current.status)) {
      const tourIds = [
        ...new Set(
          current.servicesDetail
            .map((s) => s.metadata?.tourDepartureId)
            .filter((id): id is string => typeof id === 'string'),
        ),
      ];
      if (!tourIds.length) {
        const targetId = await this.ticketTarget(site, scoped.branchIds[0]!);
        if (
          current.servicesDetail.some(
            (s) =>
              s.kind === 'FLIGHT' &&
              s.metadata?.catalogSalePriceTargetId !== targetId,
          )
        )
          throw new ConflictException('نرخ مرجع پرواز تغییر کرده است.');
      }
      const resources = tourIds.length
        ? tourIds.map((resourceId) => ({ kind: 'tour', resourceId }))
        : current.ticketSelections.map((s) => ({
            kind: 'ticket',
            resourceId: s.offerId,
          }));
      for (const resource of resources) {
        const publication = await this.db.client.websitePublication.findUnique({
          where: {
            siteCode_branchId_kind_resourceId_periodKey: {
              periodKey: '',
              siteCode: site,
              branchId: scoped.branchIds[0]!,
              ...resource,
            },
          },
        });
        if (!publication?.enabled || publication.salesStopped)
          throw new ConflictException('این محصول برای سایت منتشر نشده است.');
      }
      // Native confirmation locks both offers and re-reads ERP allocations, holds and target fares.
      await this.sales.confirm(
        row.contractId,
        current.version,
        'پرداخت تأییدشده سایت',
        scoped,
        `site:${site}:${externalId}:confirm`,
      );
    }
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
