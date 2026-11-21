import { MasterDataLogoService } from '../master-data/master-data-logo.service';
import sharp from 'sharp';
import { WebsiteCheckoutHoldsService } from './website-checkout-holds.service';
import { commerceSites, isDeliverySite } from './commerce-sites';
import { createHmac } from 'node:crypto';
import {
  VerifiedGatewayReceiptPublic,
  type VerifiedGatewayProof,
} from '../finance/payments/verified-gateway-receipt.public';
import { ageCounts } from '../ticket-catalog/ticket-age-fares';
import { passengerRate } from '../package-pricing/passenger-rates';
import {
  previewRateKinds,
  websitePresentation,
} from './publication-presentation';
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
import {
  passengerAgeCategory,
  validateSalesContract,
} from '../sales/sales.domain';
import { assertFloatingFlightAirports } from '../sales/floating-flight-airports';
import { websiteFlightQuotes } from './ticket-quote';
import {
  floatingBookingIdentity,
  floatingNativeDraft,
  floatingWebsiteRooms,
  validateFloatingBooking,
  type FloatingWebsiteBooking,
} from './floating-tour-booking';
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
    @Optional()
    @Inject(VerifiedGatewayReceiptPublic)
    private readonly gatewayReceipts?: VerifiedGatewayReceiptPublic,
    @Optional()
    @Inject(WebsiteCheckoutHoldsService)
    private readonly checkoutHolds?: WebsiteCheckoutHoldsService,
    @Optional()
    @Inject(MasterDataLogoService)
    private readonly logos?: MasterDataLogoService,
  ) {}

  private scoped(site: string, actor: AuthenticatedActor) {
    const binding = siteBinding(site, actor);
    return { ...actor, branchIds: [binding.branchId] };
  }

  async publishHotelProfile(
    site: string,
    id: string,
    actor: AuthenticatedActor,
  ) {
    if (site !== 'jahan-bastan') throw new BadRequestException();
    this.publicationBranch(site, actor);
    if (!actor.permissions.includes('master_data.read'))
      throw new ForbiddenException();
    const { data } = await this.references.detail('hotels', id);
    const fields = data.attributes;
    if (!String(fields.identificationCode ?? '').trim())
      throw new BadRequestException('کد شناسایی هتل را وارد کنید.');
    const config = commerceSites[site];
    const secret = process.env[config.signingKey];
    if (!secret || secret.length < 32)
      throw new BadRequestException('اتصال سایت پیکربندی نشده است.');
    const allowed = [
      'identificationCode',
      'cityName',
      'countryName',
      'starRating',
      'address',
      'regionName',
      'facilityNames',
      'mealServiceNames',
      'roomTypeNames',
      'englishName',
      'chainName',
      'checkInTime',
      'checkOutTime',
      'website',
      'description',
      'hotelRules',
      'sourceRefundRules',
      'sourceMainImage',
      'sourceGalleryImages',
    ];
    return this.sendProfile(config.origin, secret, '/hotel-profile', {
      site,
      kind: 'hotel-profile',
      name: data.name,
      ...Object.fromEntries(allowed.map((key) => [key, fields[key] ?? null])),
    });
  }

  async publishGeography(
    site: string,
    kind: string,
    id: string,
    actor: AuthenticatedActor,
  ) {
    if (site !== 'jahan-bastan' || (kind !== 'countries' && kind !== 'cities'))
      throw new BadRequestException();
    this.publicationBranch(site, actor, undefined, 'master_data.update');
    const { data } = await this.references.detail(kind, id);
    if (!actor.permissions.includes('master_data.read'))
      throw new ForbiddenException();
    const config = commerceSites[site];
    const secret = process.env[config.signingKey];
    if (!secret || secret.length < 32)
      throw new BadRequestException('اتصال سایت پیکربندی نشده است.');
    let flag: string | undefined;
    if (kind === 'countries' && data.attributes.logoFileReference) {
      if (!this.logos)
        throw new BadRequestException('سرویس تصویر پرچم در دسترس نیست.');
      const { stream } = await this.logos.preview(kind, id, actor, {});
      const chunks: Buffer[] = [];
      let size = 0;
      for await (const chunk of stream) {
        const buffer = Buffer.from(chunk);
        size += buffer.length;
        if (size > 5_000_000)
          throw new BadRequestException('حجم پرچم بیش از حد مجاز است.');
        chunks.push(buffer);
      }
      flag = (
        await sharp(Buffer.concat(chunks), { limitInputPixels: 16_000_000 })
          .resize({
            width: 400,
            height: 400,
            fit: 'inside',
            withoutEnlargement: true,
          })
          .webp()
          .toBuffer()
      ).toString('base64');
    }
    return this.sendProfile(config.origin, secret, '/geography-profile', {
      site,
      kind,
      id,
      name: data.name,
      flag,
      countryName: data.attributes.countryName || undefined,
    });
  }

  private async sendProfile(
    origin: string,
    secret: string,
    path: string,
    payload: Record<string, unknown>,
  ) {
    const body = JSON.stringify(payload);
    const stamp = String(Math.floor(Date.now() / 1000));
    const signature = createHmac('sha256', secret)
      .update(stamp + '.' + body)
      .digest('hex');
    const response = await fetch(origin + '/api/v1/erp' + path, {
      method: 'POST',
      redirect: 'error',
      signal: AbortSignal.timeout(50000),
      headers: {
        'content-type': 'application/json',
        'x-erp-timestamp': stamp,
        'x-erp-signature': signature,
      },
      body,
    });
    const receipt = (await response.json().catch(() => null)) as {
      slug?: unknown;
      identificationCode?: unknown;
      detail?: unknown;
    } | null;
    if (
      !response.ok ||
      typeof receipt?.slug !== 'string' ||
      (payload.kind === 'hotel-profile' &&
        receipt.identificationCode !== payload.identificationCode)
    )
      throw new BadRequestException(
        typeof receipt?.detail === 'string'
          ? receipt.detail
          : 'ثبت در جهان باستان تأیید نشد.',
      );
    const slug = encodeURIComponent(receipt.slug);
    return {
      url:
        origin +
        (payload.kind === 'hotel-profile'
          ? '/hotels/' + slug + '/'
          : payload.kind === 'cities'
            ? '/destinations/' + slug + '/'
            : '/destinations/?country=' +
              encodeURIComponent(String(payload.name))),
    };
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
    permission:
      'ticket_catalog.manage' | 'master_data.update' = 'ticket_catalog.manage',
  ) {
    if (!actor.permissions.includes(permission)) throw new ForbiddenException();
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
    const delivery = await this.db.client.websiteCatalogDelivery.findFirst({
      where: { siteCode: site, branchId },
      select: {
        lastError: true,
        deliveredAt: true,
        deliveredRevision: true,
        revision: true,
      },
    });
    const deliveryStatus = !delivery
      ? 'unconfigured'
      : delivery.lastError
        ? 'error'
        : delivery.deliveredAt &&
            delivery.deliveredRevision === delivery.revision
          ? 'accepted'
          : 'pending';
    return {
      deliveryStatus,
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
    const incoming =
      input.presentation === undefined
        ? undefined
        : websitePresentation(input.presentation);
    const currentPresentation = row?.presentation
      ? websitePresentation(row.presentation)
      : undefined;
    const previewOnly =
      incoming?.previewOnly ?? currentPresentation?.previewOnly ?? false;
    const previewHotelRate =
      incoming?.previewHotelRate !== undefined
        ? incoming.previewHotelRate
        : currentPresentation?.previewHotelRate;
    const presentation = incoming && {
      ...incoming,
      ...(previewOnly ? { previewOnly: true } : {}),
      ...(previewOnly && previewHotelRate ? { previewHotelRate } : {}),
    };
    if (!previewOnly && incoming?.previewHotelRate)
      throw new BadRequestException('تنظیمات نمایش سایت معتبر نیست.');
    if ((presentation && kind === 'ticket') || (previewOnly && kind !== 'tour'))
      throw new BadRequestException('تنظیمات نمایش سایت معتبر نیست.');
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
      const departure = await this.tours.pricingDeparture(resourceId, [
        branchId,
      ]);
      if (
        previewOnly &&
        previewHotelRate &&
        (previewHotelRate.checkIn < departure.startsOn ||
          previewHotelRate.checkOut > departure.endsOn)
      )
        throw new BadRequestException('تنظیمات نمایش سایت معتبر نیست.');
      if (
        input.enabled &&
        !previewOnly &&
        !(
          await this.packages.websitePublicationCandidates({
            ...actor,
            branchIds: [branchId],
          })
        ).data.includes(resourceId)
      )
        throw new BadRequestException('قیمت منتشرشده پکیج الزامی است.');
    }
    if (!row)
      return {
        data: await this.db.client.websitePublication.create({
          data: {
            ...key,
            ...(presentation ? { presentation } : {}),
            enabled: input.enabled,
            salesStopped: previewOnly || (input.salesStopped ?? false),
          },
        }),
      };
    const changed = await this.db.client.websitePublication.updateMany({
      where: { id: row.id, version: input.version },
      data: {
        enabled: input.enabled,
        ...(presentation ? { presentation } : {}),
        salesStopped: previewOnly || (input.salesStopped ?? row.salesStopped),
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
      baggageAllowanceKg:
        (offer.cabinClassCode === 'BUSINESS'
          ? offer.businessBaggageKg
          : offer.economyBaggageKg) ?? null,
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
    floatingOnly = false,
  ) {
    const scoped = this.scoped(site, actor);
    const rows = await this.db.client.websitePublication.findMany({
      where: {
        siteCode: site,
        branchId: scoped.branchIds[0]!,
        ...(floatingOnly
          ? { kind: 'floating-tour' }
          : !includeFloating
            ? { kind: { in: ['ticket', 'tour'] } }
            : {}),
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
        const presentation = row.presentation
          ? websitePresentation(row.presentation)
          : undefined;
        const previewOnly =
          row.kind === 'tour' && presentation?.previewOnly === true;
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
              : await (async () => {
                  const tour = await this.websiteTour(row.resourceId, scoped);
                  const pricing = previewOnly
                    ? { data: [], passengerRates: [] }
                    : await this.packages.saleCatalog(
                        row.resourceId,
                        scoped,
                        scoped.branchIds[0],
                        true,
                      );
                  return {
                    tour,
                    rooms: pricing.data,
                    passengerRates: pricing.passengerRates ?? [],
                  };
                })();

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
        const floatingTour =
          'floatingTour' in product ? product.floatingTour : undefined;
        const floatingRooms = floatingTour?.dated.some(
          (price) => price.flightSchedule,
        )
          ? await floatingWebsiteRooms(
              floatingTour,
              await this.packages.buyRates(),
              this.references,
            )
          : [];
        const hotels =
          floatingTour && floatingRooms.length
            ? await this.references.publishedHotelProfiles(
                floatingRooms.flatMap((room) =>
                  room.stays.map((stay) => stay.hotelId),
                ),
              )
            : 'tour' in product && product.tour && product.rooms
              ? await this.references.publishedHotelProfiles([
                  ...product.tour.package.hotelIds,
                  ...product.rooms.flatMap((room) => [
                    room.hotelId,
                    ...(room.stays ?? []).map((stay) => stay.hotelId),
                  ]),
                ])
              : undefined;
        if (presentation && 'tour' in product && product.tour) {
          const previewRate = presentation.previewHotelRate;
          if (previewOnly && previewRate?.breakdown) {
            const tour = product.tour;
            const breakdown = previewRate.breakdown;
            if (
              previewRate.checkIn >= tour.startsOn &&
              previewRate.checkOut <= tour.endsOn
            ) {
              product.passengerRates = tour.package.hotelIds.flatMap(
                (hotelId) =>
                  previewRateKinds.flatMap((kind) => {
                    const rate = passengerRate(
                      {
                        kind,
                        hotelId,
                        roomTypeName: '',
                        checkIn: previewRate.checkIn,
                        checkOut: previewRate.checkOut,
                      },
                      [{ currencyCode: 'IRR', amount: breakdown.hotel[kind] }],
                      [
                        {
                          currencyCode: 'IRR',
                          amount:
                            kind === 'childWithBed'
                              ? breakdown.childFlightIrr
                              : breakdown.adultFlightIrr,
                        },
                      ],
                    );
                    return rate ? [rate] : [];
                  }),
              );
            }
          }
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
        const capacityStopped =
          'flight' in product &&
          !!product.flight &&
          product.flight.remainingCapacity <= 0;
        data.push({
          id: row.id,
          kind: row.kind,
          resourceId: row.resourceId,
          ...(row.kind === 'floating-tour' ? { periodKey: row.periodKey } : {}),
          enabled: true,
          // Stock exhaustion is a reversible projection, never a manual publication edit.
          salesStopped: previewOnly || row.salesStopped || capacityStopped,
          ...(previewOnly ? { previewOnly: true } : {}),
          ...(capacityStopped ? { capacityStopped: true } : {}),
          version: row.version,
          ...product,
          ...(floatingTour ? { floatingRooms } : {}),
          ...(hotels ? { hotels } : {}),
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
    const checkout = await this.checkoutHolds?.validateDraft(
      site,
      externalId,
      input,
      scoped,
    );
    if (!recovered && !checkout)
      await this.assertPublished(site, input, scoped);
    const ticketTargetId = input.services.some(
      (s) => s.metadata?.tourDepartureId,
    )
      ? undefined
      : (checkout?.targetId ??
        (await this.ticketTarget(site, scoped.branchIds[0]!)));
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
      undefined,
      checkout?.frozenPackageSales,
    );
    // Native Sales create is durable/idempotent; a timeout before this link is safe to retry.
    await this.db.client.websiteOrder.upsert({
      where: { siteCode_branchId_externalId: key },
      create: { ...key, fingerprint, contractId: created.data.id },
      update: {},
    });
    return this.status(site, externalId, actor);
  }

  private async quoteFloating(
    site: string,
    scoped: AuthenticatedActor,
    input: FloatingWebsiteBooking,
  ) {
    const publication = await this.db.client.websitePublication.findFirst({
      where: {
        id: input.publicationId,
        siteCode: site,
        branchId: scoped.branchIds[0]!,
        kind: 'floating-tour',
        enabled: true,
        salesStopped: false,
      },
    });
    if (!publication)
      throw new ConflictException('این محصول برای سایت منتشر نشده است.');
    const product = await this.floatingProduct(
      publication.resourceId,
      scoped.branchIds,
      publication.periodKey,
    );
    const choices = await floatingWebsiteRooms(
      product,
      await this.packages.buyRates(),
      this.references,
    );
    const draft = floatingNativeDraft(input, product.package, choices);
    try {
      validateSalesContract(draft, true);
    } catch (error) {
      if (error instanceof Error) throw new BadRequestException(error.message);
      throw error;
    }
    await assertFloatingFlightAirports(draft.services, this.references);
    return draft;
  }

  async previewFloating(
    site: string,
    input: FloatingWebsiteBooking,
    actor: AuthenticatedActor,
  ) {
    const scoped = this.scoped(site, actor);
    validateFloatingBooking(input);
    return { data: await this.quoteFloating(site, scoped, input) };
  }

  async holdFloating(
    site: string,
    externalId: string,
    body: {
      booking: FloatingWebsiteBooking;
      customerExternalId: string;
      expiresNotAfter: string;
    },
    actor: AuthenticatedActor,
  ) {
    const scoped = this.scoped(site, actor);
    validateFloatingBooking(body?.booking);
    if (!this.checkoutHolds)
      throw new ConflictException('درخواست رزرو خرید معتبر نیست.');
    return this.checkoutHolds.prepareFloating(
      site,
      externalId,
      floatingBookingIdentity(body.booking),
      body.customerExternalId,
      body.expiresNotAfter,
      () => this.quoteFloating(site, scoped, body.booking),
      actor,
    );
  }

  async draftFloating(
    site: string,
    externalId: string,
    input: FloatingWebsiteBooking,
    actor: AuthenticatedActor,
  ) {
    const scoped = this.scoped(site, actor);
    externalOrderId(externalId);
    validateFloatingBooking(input);
    const fingerprint = stableFingerprint({ floating: input });
    const key = { siteCode: site, branchId: scoped.branchIds[0]!, externalId };
    const where = { siteCode_branchId_externalId: key };
    const clash = () =>
      new ConflictException('شناسه سفارش با اطلاعات متفاوت استفاده شده است.');
    const previous = await this.db.client.websiteOrder.findUnique({ where });
    if (previous) {
      if (previous.fingerprint !== fingerprint) throw clash();
      return this.status(site, externalId, actor);
    }
    const createKey = `site:${site}:${externalId}`;
    const recovered = await this.sales.createdByKey(createKey, scoped);
    let contractId: string;
    if (recovered) {
      if (
        !recovered.data.servicesDetail?.some(
          (service) =>
            service.metadata?.websiteFloatingFingerprint === fingerprint,
        )
      )
        throw clash();
      contractId = recovered.data.id;
    } else {
      const hold = await this.db.client.websiteCheckoutSession.findUnique({
        where,
      });
      const quote = hold?.quoteSnapshot as
        { floatingDraft?: SalesContractCreateRequest } | undefined;
      const draft = quote?.floatingDraft;
      if (
        !hold ||
        hold.status !== 'VERIFIED' ||
        !hold.resolutionFingerprint ||
        hold.fingerprint !== floatingBookingIdentity(input) ||
        !draft
      )
        throw new ConflictException('ابتدا تأیید بانک لازم است.');
      const metadata = {
        ...draft.services[0]!.metadata,
        sourceSite: site,
        externalOrderId: externalId,
        websiteFloatingFingerprint: fingerprint,
      };
      const created = await this.sales.create(
        {
          ...draft,
          customerId: input.customerId,
          passengers: draft.passengers.map((person, index) => ({
            ...person,
            customerId: input.passengers[index]!.customerId,
            displayNameSnapshot: input.passengers[index]!.displayNameSnapshot,
          })),
          services: [
            { ...draft.services[0]!, metadata },
            ...draft.services.slice(1),
          ],
        },
        scoped,
        key.branchId,
        createKey,
      );
      contractId = created.data.id;
    }
    const saved = await this.db.client.websiteOrder.upsert({
      where,
      create: { ...key, fingerprint, contractId },
      update: {},
    });
    if (saved.fingerprint !== fingerprint) throw clash();
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
    const facts = await this.sales.financeCustomerDocumentDeliveryFacts(
      row.contractId,
      scoped.branchIds,
    );
    return {
      version: 1,
      data: {
        paymentStatus:
          !facts.cancelled && facts.hasConfirmedPayment && facts.fullySettled
            ? 'paid'
            : 'unpaid',
        hasConfirmedPayment: facts.hasConfirmedPayment,
        fullySettled: facts.fullySettled,
        externalId,
        contractId: contract.id,
        contractNumber: contract.contractNumber,
        status: contract.status,
        contractVersion: contract.version,
        balances: contract.balances,
        ticketSelections: contract.ticketSelections,
        ...(contract.servicesDetail?.some(
          (service) => service.metadata?.websiteFloatingFingerprint,
        )
          ? { floatingFlights: salesContractFlights(contract.servicesDetail) }
          : {}),
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
    gatewayReceipt?: VerifiedGatewayProof,
  ) {
    const { row, scoped } = await this.order(site, externalId, actor);
    if (gatewayReceipt && !this.gatewayReceipts)
      throw new ForbiddenException('اتصال تسویه درگاه تنظیم نشده است.');
    const gateway = gatewayReceipt
      ? await this.gatewayReceipts!.resolve(
          site,
          externalId,
          gatewayReceipt,
          scoped,
        )
      : undefined;
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
    if (
      gateway &&
      (payments.length !== 1 ||
        payments[0]!.method !== 'ONLINE_GATEWAY' ||
        payments[0]!.paymentReference !== gateway.reference ||
        payments[0]!.currencyCode !== gateway.currencyCode ||
        !new Prisma.Decimal(payments[0]!.amount).eq(gateway.amount) ||
        (payments[0]!.destinationAccountId &&
          payments[0]!.destinationAccountId !== gateway.accountId))
    )
      throw new ConflictException(
        'تأیید بانکی با مبلغ و حساب رسید مطابقت ندارد.',
      );
    const fingerprint = stableFingerprint(payments);
    if (row.paymentFingerprint && row.paymentFingerprint !== fingerprint)
      throw new ConflictException('رسید این سفارش تغییر کرده است.');
    const { data: before } = await this.sales.detail(row.contractId, scoped);
    const floating = before.servicesDetail?.some(
      (service) =>
        typeof service.metadata?.websiteFloatingFingerprint === 'string',
    );
    if (floating) {
      const hold = await this.db.client.websiteCheckoutSession.findUnique({
        where: {
          siteCode_branchId_externalId: {
            siteCode: site,
            branchId: scoped.branchIds[0]!,
            externalId,
          },
        },
      });
      if (
        !gateway ||
        hold?.status !== 'BOUND' ||
        hold.contractId !== row.contractId ||
        hold.resolutionFingerprint !== stableFingerprint(gatewayReceipt)
      )
        throw new ConflictException('ابتدا تأیید بانک لازم است.');
    }
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
      if (!floating && !tourIds.length) {
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
    if (gateway) {
      const { data: receiptContract } = await this.sales.detail(
        row.contractId,
        scoped,
      );
      const matches = receiptContract.payments.filter(
        (p) =>
          p.method === 'ONLINE_GATEWAY' &&
          p.paymentReference === gateway.reference &&
          p.currencyCode === gateway.currencyCode &&
          new Prisma.Decimal(p.amount).eq(gateway.amount),
      );
      if (matches.length !== 1)
        throw new ConflictException('رسید بانکی یکتای قرارداد پیدا نشد.');
      await this.gatewayReceipts!.confirm(
        row.contractId,
        matches[0]!,
        gateway,
        scoped,
        (event) => this.sales.applyFinancePaymentConfirmed(event),
      );
      await this.releaseSettledWebsiteDocuments(row, scoped);
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

  private async releaseSettledWebsiteDocuments(
    row: { contractId: string; paymentFingerprint: string | null },
    scoped: AuthenticatedActor,
  ) {
    const current = await this.delivery.readCustomerContract(row.contractId);
    // Never override an explicit finance decision (including a revoked approval).
    if (current.approved || current.version !== 0) return current;
    const facts = await this.sales.financeCustomerDocumentDeliveryFacts(
      row.contractId,
      scoped.branchIds,
    );
    if (facts.cancelled || !facts.hasConfirmedPayment || !facts.fullySettled)
      return current;
    try {
      return await this.delivery.updateCustomerContract(
        {
          expectedVersion: current.version,
          approved: true,
          basis: 'FULL_SETTLEMENT',
          reason:
            'تحویل خودکار خرید سایت پس از تأیید پرداخت و تسویه کامل در سامانه مرکزی',
        },
        facts,
        scoped,
        async (tx) => {
          const fresh = await this.sales.financeCustomerDocumentDeliveryFacts(
            row.contractId,
            scoped.branchIds,
            tx,
          );
          if (
            fresh.cancelled ||
            !fresh.hasConfirmedPayment ||
            !fresh.fullySettled
          )
            throw new ConflictException(
              'تسویه کامل تأییدشده برای تحویل مدارک لازم است.',
            );
          return fresh;
        },
      );
    } catch (error) {
      if (!(error instanceof ConflictException)) throw error;
      // A simultaneous finance decision wins; do not overwrite or retry it.
      return this.delivery.readCustomerContract(row.contractId);
    }
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
    const authorization =
      contract.status !== 'CANCELLED' &&
      intake.workflow.supplierStatus !== 'CANCELLED'
        ? await this.releaseSettledWebsiteDocuments(row, scoped)
        : await this.delivery.readCustomerContract(row.contractId);
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
