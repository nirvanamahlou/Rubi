import {
  VerifiedGatewayReceiptPublic,
  type VerifiedGatewayProof,
} from '../finance/payments/verified-gateway-receipt.public';
import {
  verifyCheckoutFailure,
  type CheckoutFailureProof,
} from './checkout-bank-failure';
import {
  BadRequestException,
  ConflictException,
  Inject,
  Injectable,
  NotFoundException,
} from '@nestjs/common';
import { Prisma } from '@nora/database';
import type {
  AuthenticatedActor,
  SalesContractCreateRequest,
  PackagePublishedSaleV1,
} from '@nora/contracts';
import {
  matchingPublishedRooms,
  publishedSaleTotals,
  packageRoomIdentity,
} from '@nora/contracts';
import * as Joi from 'joi';
import { DatabaseService } from '../database/database.service';
import { TicketPublicService } from '../ticket-catalog/ticket-public.service';
import { TourPublicService } from '../ticket-catalog/tour-public.service';
import { CheckoutTicketCapacity } from '../ticket-catalog/checkout-ticket-capacity';
import {
  checkoutQuoteFingerprint,
  CHECKOUT_HOLD_MS,
} from '../ticket-catalog/checkout-hold-policy';
import { liveCapacityHolds } from '../ticket-catalog/live-capacity-holds';
import { PackageTourPricingService } from '../package-pricing/package-tour-pricing.service';
import { SalesService } from '../sales/sales.service';
import { passengerAgeCategory } from '../sales/sales.domain';
import { ageCounts } from '../ticket-catalog/ticket-age-fares';
import { websiteFlightQuotes } from './ticket-quote';
import {
  externalOrderId,
  siteBinding,
  stableFingerprint,
} from './site-commerce.policy';

type Room = {
  publicationId: string;
  roomCode: string;
  passengerIndexes: number[];
};
export type CheckoutHoldInput = {
  productIds: string[];
  birthDates: string[];
  customerExternalId: string;
  requesterName: string;
  requesterPhone: string;
  rooms?: Room[];
  expiresNotAfter?: string;
};
const schema = Joi.object({
  productIds: Joi.array()
    .items(Joi.string().guid().required())
    .min(1)
    .max(2)
    .unique()
    .required(),
  birthDates: Joi.array()
    .items(Joi.string().pattern(/^\d{4}-\d{2}-\d{2}$/))
    .min(1)
    .max(30)
    .required(),
  customerExternalId: Joi.string()
    .pattern(/^[A-Za-z0-9_.:-]{1,100}$/)
    .required(),
  requesterName: Joi.string().trim().min(1).max(160).required(),
  requesterPhone: Joi.string()
    .pattern(/^[+0-9 -]{5,40}$/)
    .required(),
  rooms: Joi.array()
    .items(
      Joi.object({
        publicationId: Joi.string().max(100).required(),
        roomCode: Joi.string().max(2000).required(),
        passengerIndexes: Joi.array()
          .items(Joi.number().integer().min(0).max(29))
          .min(1)
          .max(30)
          .unique()
          .required(),
      }).unknown(false),
    )
    .max(20),
  expiresNotAfter: Joi.string().isoDate(),
}).unknown(false);
const asJson = (value: unknown) =>
  JSON.parse(JSON.stringify(value)) as Prisma.InputJsonValue;
function age(birth: string, when: string) {
  const day = when.slice(0, 10);
  if (
    !Number.isFinite(Date.parse(birth)) ||
    new Date(birth).toISOString().slice(0, 10) !== birth ||
    birth > day
  )
    throw new BadRequestException('تاریخ تولد معتبر نیست.');
  return (
    Number(day.slice(0, 4)) -
    Number(birth.slice(0, 4)) -
    (day.slice(5) < birth.slice(5) ? 1 : 0)
  );
}
@Injectable()
export class WebsiteCheckoutHoldsService {
  constructor(
    @Inject(DatabaseService) private readonly db: DatabaseService,
    @Inject(TicketPublicService) private readonly tickets: TicketPublicService,
    @Inject(TourPublicService) private readonly tours: TourPublicService,
    @Inject(PackageTourPricingService)
    private readonly packages: PackageTourPricingService,
    @Inject(CheckoutTicketCapacity)
    private readonly capacity: CheckoutTicketCapacity,
    @Inject(SalesService) private readonly sales: SalesService,
    @Inject(VerifiedGatewayReceiptPublic)
    private readonly bankProofs: VerifiedGatewayReceiptPublic,
  ) {}
  private scope(site: string, actor: AuthenticatedActor) {
    const binding = siteBinding(site, actor);
    return { ...actor, branchIds: [binding.branchId] };
  }
  private view(row: {
    id: string;
    status: string;
    expiresAt: Date;
    quoteSnapshot: Prisma.JsonValue;
  }) {
    return {
      version: 1,
      data: {
        id: row.id,
        status: row.status,
        expiresAt: row.expiresAt.toISOString(),
        remainingSeconds: Math.max(
          0,
          Math.ceil((row.expiresAt.getTime() - Date.now()) / 1000),
        ),
        ...this.publicSnapshot(row.quoteSnapshot),
        paymentPending: ['PAYMENT_PENDING', 'VERIFIED', 'BOUND'].includes(
          row.status,
        ),
      },
    };
  }
  private publicSnapshot(value: Prisma.JsonValue) {
    const s = value as unknown as Record<string, unknown>;
    return Object.fromEntries(
      ['offerIds', 'counts', 'seatCount', 'quotes', 'priceComponents']
        .filter((k) => k in s)
        .map((k) => [k, s[k]]),
    );
  }
  async prepare(
    site: string,
    externalId: string,
    input: CheckoutHoldInput,
    actor: AuthenticatedActor,
  ) {
    const scoped = this.scope(site, actor),
      branchId = scoped.branchIds[0]!;
    externalOrderId(externalId);
    if (schema.validate(input, { convert: false }).error)
      throw new BadRequestException('درخواست رزرو خرید معتبر نیست.');
    const fingerprint = stableFingerprint(input),
      key = { siteCode: site, branchId, externalId };
    return this.db.client.$transaction(
      async (tx) => {
        await tx.$queryRaw(
          Prisma.sql`SELECT pg_advisory_xact_lock(hashtextextended(${site + ':' + branchId + ':' + input.customerExternalId},0))`,
        );
        const previous = await tx.websiteCheckoutSession.findUnique({
          where: { siteCode_branchId_externalId: key },
        });
        if (previous) {
          if (previous.fingerprint !== fingerprint)
            throw new ConflictException('ترکیب درخواست خرید تغییر کرده است.');
          if (
            previous.status === 'RELEASED' ||
            (previous.status === 'PREPARED' && previous.expiresAt <= new Date())
          )
            throw new ConflictException(
              'مهلت رزرو تمام شده؛ دوباره استعلام کنید.',
            );
          return this.view(previous);
        }
        const publications = await tx.websitePublication.findMany({
          where: {
            id: { in: input.productIds },
            siteCode: site,
            branchId,
            enabled: true,
            salesStopped: false,
          },
        });
        if (publications.length !== input.productIds.length)
          throw new NotFoundException('سفر منتشرشده پیدا نشد.');
        const ordered = input.productIds.map((id) =>
          publications.find((p) => p.id === id)!,
        );
        const touring = ordered[0]!.kind === 'tour';
        if (
          ordered.some((p) => p.kind !== (touring ? 'tour' : 'ticket')) ||
          (touring && ordered.length !== 1)
        )
          throw new BadRequestException('ترکیب سفر معتبر نیست.');
        if (touring) await this.capacity.lockTour(tx, ordered[0]!.resourceId);
        const tour = touring
          ? await this.tours.pricingDeparture(
              ordered[0]!.resourceId,
              scoped.branchIds,
            )
          : undefined;
        if (tour && (tour.isActive === false || tour.isDeleted))
          throw new ConflictException('فروش این تور متوقف شده است.');
        const ids = tour
          ? [tour.outbound.id, ...(tour.returning ? [tour.returning.id] : [])]
          : ordered.map((p) => p.resourceId);
        const first = await this.capacity.departure(tx, ids[0]!, branchId);
        if (!first) throw new NotFoundException('پرواز فعال پیدا نشد.');
        const departure = first.departureAt.toISOString().slice(0, 10);
        input.birthDates.forEach((b) => age(b, departure));
        const counts = ageCounts(
            input.birthDates.map((b) => passengerAgeCategory(b, departure)),
          ),
          seatCount = counts.adults + counts.children;
        const duplicate = await tx.websiteCheckoutSession.findFirst({
          where: {
            siteCode: site,
            branchId,
            customerExternalId: input.customerExternalId,
            holds: { some: { offerId: { in: ids }, ...liveCapacityHolds() } },
          },
          select: { id: true },
        });
        if (duplicate)
          throw new ConflictException(
            'برای این پرواز یک خرید باز دارید؛ نتیجه همان خرید را بررسی کنید.',
          );
        const now = new Date(),
          expiresAt = new Date(
            Math.min(
              now.getTime() + CHECKOUT_HOLD_MS,
              input.expiresNotAfter
                ? Date.parse(input.expiresNotAfter)
                : Infinity,
            ),
          );
        if (expiresAt <= now)
          throw new ConflictException('مهلت فاکتور تمام شده است.');
        const row = await tx.websiteCheckoutSession.create({
          data: {
            ...key,
            createdByUserId: actor.userId,
            customerExternalId: input.customerExternalId,
            fingerprint,
            requesterName: input.requesterName,
            requesterPhone: input.requesterPhone,
            expiresAt,
            quoteSnapshot: {},
          },
        });
        const target = tour
          ? undefined
          : await tx.websiteCatalogDelivery.findUnique({
              where: { siteCode: site },
              select: { branchId: true, salePriceTargetId: true },
            });
        if (
          !tour &&
          (!target?.salePriceTargetId || target.branchId !== branchId)
        )
          throw new ConflictException('نرخ مقصد سایت تنظیم نشده است.');
        const snapshot = await this.capacity.prepare(
          tx,
          row,
          ids,
          counts,
          async () => {
            const offers: Awaited<
              ReturnType<TicketPublicService['websiteOffer']>
            >[] = [];
            for (const id of ids)
              offers.push(
                await this.tickets.websiteOffer(
                  id,
                  [branchId],
                  tour ? undefined : target!.salePriceTargetId!,
                  tx,
                ),
              );
            const quotes = tour
              ? []
              : websiteFlightQuotes(
                  offers[0]!,
                  offers[1],
                  seatCount,
                  counts,
                  true,
                );
            let priceComponents: { amount: string; currencyCode: string }[];
            const frozenPackageSales: PackagePublishedSaleV1[] = [];
            if (tour) {
              const catalog = await this.packages.saleCatalog(
                  tour.id,
                  scoped,
                  branchId,
                ),
                selected: PackagePublishedSaleV1[] = [];
              const used: number[] = [];
              for (const room of input.rooms ?? []) {
                const candidate = catalog.data.find(
                    (p) =>
                      p.publicationId === room.publicationId &&
                      p.roomCode === room.roomCode,
                  ),
                  identity = candidate
                    ? packageRoomIdentity(candidate.roomCode)
                    : null;
                if (
                  !candidate ||
                  !identity ||
                  room.passengerIndexes.some(
                    (i) => i >= input.birthDates.length || used.includes(i),
                  )
                )
                  throw new ConflictException('ترکیب اتاق معتبر نیست.');
                const ages = room.passengerIndexes.map((i) =>
                    age(input.birthDates[i]!, candidate.checkIn),
                  ),
                  childAges = ages.filter((n) => n < 12);
                if (
                  !matchingPublishedRooms([candidate], {
                    hotelId: candidate.hotelId,
                    roomTypeId: identity.roomTypeId,
                    checkIn: candidate.checkIn,
                    checkOut: candidate.checkOut,
                    adults: ages.length - childAges.length,
                    childAges,
                  }).length
                )
                  throw new ConflictException('رده سنی اتاق تغییر کرده است.');
                used.push(...room.passengerIndexes);
                selected.push(candidate);
              }
              if (!selected.length || used.length !== input.birthDates.length)
                throw new ConflictException('تخصیص اتاق کامل نیست.');
              frozenPackageSales.push(...selected);
              priceComponents = publishedSaleTotals(selected);
            } else {
              const sums = new Map<string, Prisma.Decimal>();
              for (const q of quotes)
                sums.set(
                  q.currencyCode,
                  (sums.get(q.currencyCode) ?? new Prisma.Decimal(0)).add(
                    q.amount,
                  ),
                );
              priceComponents = [...sums].map(([currencyCode, amount]) => ({
                currencyCode,
                amount: amount.toString(),
              }));
            }
            if (
              site === 'nss' &&
              (priceComponents.some((p) => p.currencyCode !== 'IRR') ||
                priceComponents
                  .reduce((n, p) => n.add(p.amount), new Prisma.Decimal(0))
                  .lte(0))
            )
              throw new ConflictException(
                'پرداخت آنلاین این سفر به نرخ نهایی ریالی نیاز دارد.',
              );
            const fingerprints = Object.fromEntries(
              ids.map((id, i) => [
                id,
                tour
                  ? stableFingerprint([tour.id, ids, counts, priceComponents])
                  : checkoutQuoteFingerprint({
                      ...quotes[i]!,
                      salePriceTargetId: target!.salePriceTargetId!,
                      passengerCounts: counts,
                    }),
              ]),
            );
            return {
              snapshot: {
                offerIds: ids,
                counts,
                seatCount,
                quotes,
                priceComponents,
                offers,
                frozenPackageSales,
                birthDates: input.birthDates,
                targetId: target?.salePriceTargetId ?? null,
                tourId: tour?.id ?? null,
                fingerprints,
              },
              fingerprints,
            };
          },
        );
        return this.view(
          await tx.websiteCheckoutSession.update({
            where: { id: row.id },
            data: { quoteSnapshot: asJson(snapshot) },
          }),
        );
      },
      { timeout: 15000 },
    );
  }
  /** Server-only witness: no caller can select a lease or inject frozen package rows. */
  async validateDraft(
    site: string,
    externalId: string,
    input: SalesContractCreateRequest,
    actor: AuthenticatedActor,
  ) {
    const scoped = this.scope(site, actor);
    const row = await this.db.client.websiteCheckoutSession.findUnique({
      where: {
        siteCode_branchId_externalId: {
          siteCode: site,
          branchId: scoped.branchIds[0]!,
          externalId,
        },
      },
    });
    if (!row) {
      if (site === 'nss')
        throw new ConflictException('ابتدا تأیید قطعی بانک لازم است.');
      return undefined;
    }
    if (!['VERIFIED', 'BOUND'].includes(row.status))
      throw new ConflictException('ابتدا تأیید قطعی بانک لازم است.');
    const snapshot = row.quoteSnapshot as unknown as {
      offerIds: string[];
      offers: Awaited<ReturnType<TicketPublicService['websiteOffer']>>[];
      birthDates: string[];
      quotes: { amount: string; currencyCode: string }[];
      priceComponents: { amount: string; currencyCode: string }[];
      frozenPackageSales: PackagePublishedSaleV1[];
      tourId: string | null;
      targetId: string | null;
    };
    const selections = input.ticketSelections ?? [];
    const normalize = (
      parts: readonly { amount: string; currencyCode: string }[],
    ) => {
      const map = new Map<string, Prisma.Decimal>();
      for (const p of parts)
        map.set(
          p.currencyCode,
          (map.get(p.currencyCode) ?? new Prisma.Decimal(0)).add(p.amount),
        );
      return [...map]
        .sort(([a], [b]) => a.localeCompare(b))
        .map(([code, n]) => [code, n.toString()]);
    };
    if (
      input.buyerContact?.name.trim() !== row.requesterName.trim() ||
      input.buyerContact?.phone.replace(/[ +()-]/g, '') !==
        row.requesterPhone.replace(/[ +()-]/g, '') ||
      stableFingerprint(input.passengers.map((p) => p.birthDate)) !==
        stableFingerprint(snapshot.birthDates) ||
      stableFingerprint(normalize(input.priceComponents)) !==
        stableFingerprint(normalize(snapshot.priceComponents)) ||
      selections.length !== snapshot.offerIds.length
    )
      throw new ConflictException(
        'اطلاعات قرارداد با خرید پرداخت‌شده مطابقت ندارد.',
      );
    const tours = [
      ...new Set(
        input.services
          .map((s) => s.metadata?.tourDepartureId)
          .filter((v) => typeof v === 'string'),
      ),
    ];
    if (
      snapshot.tourId
        ? tours.length !== 1 || tours[0] !== snapshot.tourId
        : tours.length > 0 ||
          input.hotelSelection ||
          input.services.some((s) => s.kind !== 'FLIGHT') ||
          input.services.length !== selections.length
    )
      throw new ConflictException('خدمات با رزرو پرداخت‌شده مطابقت ندارد.');
    for (const [index, offer] of snapshot.offers.entries()) {
      const selection = selections.find((s) => s.offerId === offer.id);
      const quote = snapshot.quotes[index];
      if (
        !selection ||
        selection.direction !== (index === 0 ? 'OUTBOUND' : 'RETURN') ||
        selection.originId !== offer.originId ||
        selection.destinationId !== offer.destinationId ||
        selection.departureAt !== offer.departureAt ||
        selection.arrivalAt !== offer.arrivalAt ||
        selection.cabinClassCode !== offer.cabinClassCode ||
        selection.carrierNameSnapshot !== offer.carrierName ||
        selection.serviceNumberSnapshot !== offer.serviceNumber ||
        input.passengers.some(
          (p) => !p.serviceClientKeys.includes(selection.serviceClientKey),
        ) ||
        (quote &&
          (!selection.quotedPrice ||
            quote.currencyCode !== selection.quotedPrice.currencyCode ||
            !new Prisma.Decimal(quote.amount).eq(selection.quotedPrice.amount)))
      )
        throw new ConflictException('پرواز با رزرو پرداخت‌شده مطابقت ندارد.');
    }
    return {
      frozenPackageSales: snapshot.frozenPackageSales,
      targetId: snapshot.targetId,
    };
  }
  private async locked<T>(
    site: string,
    externalId: string,
    actor: AuthenticatedActor,
    apply: (
      tx: Prisma.TransactionClient,
      row: Prisma.WebsiteCheckoutSessionGetPayload<Record<string, never>>,
      scoped: AuthenticatedActor,
    ) => Promise<T>,
  ) {
    const scoped = this.scope(site, actor);
    externalOrderId(externalId);
    return this.db.client.$transaction(
      async (tx) => {
        const row = await tx.websiteCheckoutSession.findUnique({
          where: {
            siteCode_branchId_externalId: {
              siteCode: site,
              branchId: scoped.branchIds[0]!,
              externalId,
            },
          },
        });
        if (!row) throw new NotFoundException('رزرو خرید پیدا نشد.');
        await tx.$queryRaw(
          Prisma.sql`SELECT "id" FROM "website_checkout_sessions" WHERE "id" = ${row.id}::uuid FOR UPDATE`,
        );
        return apply(
          tx,
          await tx.websiteCheckoutSession.findUniqueOrThrow({
            where: { id: row.id },
          }),
          scoped,
        );
      },
      { timeout: 15000 },
    );
  }
  async status(site: string, externalId: string, actor: AuthenticatedActor) {
    return this.locked(site, externalId, actor, async (_tx, row) =>
      this.view(row),
    );
  }
  async pin(
    site: string,
    externalId: string,
    attemptKey: string,
    actor: AuthenticatedActor,
  ) {
    return this.locked(site, externalId, actor, async (tx, row) => {
      if (
        row.status !== 'PREPARED' &&
        !(
          row.status === 'PAYMENT_PENDING' &&
          row.paymentAttemptKey === attemptKey
        )
      )
        throw new ConflictException('وضعیت رزرو اجازه پرداخت تازه نمی‌دهد.');
      await this.capacity.pin(tx, row.id, row.branchId, attemptKey);
      return this.view(
        await tx.websiteCheckoutSession.update({
          where: { id: row.id },
          data: { status: 'PAYMENT_PENDING', paymentAttemptKey: attemptKey },
        }),
      );
    });
  }
  async resolve(
    site: string,
    externalId: string,
    input: {
      attemptKey: string;
      outcome: 'VERIFIED' | 'FAILED';
      gatewayReceipt?: VerifiedGatewayProof;
      failureProof?: CheckoutFailureProof;
    },
    actor: AuthenticatedActor,
  ) {
    return this.locked(site, externalId, actor, async (tx, row, scoped) => {
      if (!input || input.attemptKey !== row.paymentAttemptKey)
        throw new ConflictException('تلاش پرداخت با رزرو مطابقت ندارد.');
      if (input.outcome === 'VERIFIED') {
        if (
          !input.gatewayReceipt ||
          !['PAYMENT_PENDING', 'VERIFIED', 'BOUND'].includes(row.status)
        )
          throw new ConflictException('وضعیت تأیید رزرو معتبر نیست.');
        const proof = await this.bankProofs.resolve(
          site,
          externalId,
          input.gatewayReceipt,
          scoped,
        );
        const snapshot = row.quoteSnapshot as unknown as {
          priceComponents: { amount: string; currencyCode: string }[];
        };
        if (
          snapshot.priceComponents.some((p) => p.currencyCode !== 'IRR') ||
          !snapshot.priceComponents
            .reduce((n, p) => n.add(p.amount), new Prisma.Decimal(0))
            .eq(proof.amount)
        )
          throw new ConflictException('مبلغ بانک با رزرو مطابقت ندارد.');
        const fingerprint = stableFingerprint(input.gatewayReceipt);
        if (
          row.resolutionFingerprint &&
          row.resolutionFingerprint !== fingerprint
        )
          throw new ConflictException(
            'نتیجه بانک قبلاً با داده متفاوت ثبت شده است.',
          );
        return this.view(
          await tx.websiteCheckoutSession.update({
            where: { id: row.id },
            data: {
              status: row.status === 'BOUND' ? 'BOUND' : 'VERIFIED',
              resolutionFingerprint: fingerprint,
            },
          }),
        );
      }
      if (
        input.outcome !== 'FAILED' ||
        !input.failureProof ||
        !['PAYMENT_PENDING', 'RELEASED'].includes(row.status)
      )
        throw new ConflictException('نتیجه قطعی بانک لازم است.');
      verifyCheckoutFailure(
        site,
        externalId,
        input.attemptKey,
        input.failureProof,
        scoped,
      );
      await this.capacity.releaseFailed(
        tx,
        row.id,
        row.branchId,
        input.attemptKey,
      );
      return this.view(
        await tx.websiteCheckoutSession.update({
          where: { id: row.id },
          data: {
            status: 'RELEASED',
            resolutionFingerprint: stableFingerprint(input.failureProof),
          },
        }),
      );
    });
  }
  async bind(site: string, externalId: string, actor: AuthenticatedActor) {
    return this.locked(site, externalId, actor, async (tx, row, scoped) => {
      if (!['VERIFIED', 'BOUND'].includes(row.status))
        throw new ConflictException('ابتدا تأیید بانک لازم است.');
      const order = await tx.websiteOrder.findUnique({
        where: {
          siteCode_branchId_externalId: {
            siteCode: site,
            branchId: row.branchId,
            externalId,
          },
        },
      });
      if (!order || (row.contractId && row.contractId !== order.contractId))
        throw new ConflictException('قرارداد این خرید پیدا نشد.');
      const { data: contract } = await this.sales.detail(
        order.contractId,
        scoped,
      );
      const snapshot = row.quoteSnapshot as unknown as {
        offerIds: string[];
        counts: { adults: number; children: number; infants: number };
        priceComponents: { amount: string; currencyCode: string }[];
      };
      const ids = contract.ticketSelections.map((s) => s.offerId).sort();
      const categories = ageCounts(
        contract.passengersDetail.map((p) => p.ageCategory),
      );
      const totals = (
        values: readonly { amount: string; currencyCode: string }[],
      ) => {
        const map = new Map<string, Prisma.Decimal>();
        for (const p of values)
          map.set(
            p.currencyCode,
            (map.get(p.currencyCode) ?? new Prisma.Decimal(0)).add(p.amount),
          );
        return [...map]
          .sort(([a], [b]) => a.localeCompare(b))
          .map(([currencyCode, amount]) => ({
            currencyCode,
            amount: amount.toString(),
          }));
      };
      if (
        contract.buyerContact?.name.trim() !== row.requesterName.trim() ||
        contract.buyerContact?.phone.replace(/[ +()-]/g, '') !==
          row.requesterPhone.replace(/[ +()-]/g, '') ||
        contract.status === 'CANCELLED' ||
        JSON.stringify(ids) !== JSON.stringify([...snapshot.offerIds].sort()) ||
        stableFingerprint(categories) !== stableFingerprint(snapshot.counts) ||
        stableFingerprint(totals(contract.priceComponents)) !==
          stableFingerprint(totals(snapshot.priceComponents))
      )
        throw new ConflictException('قرارداد با رزرو پرداخت مطابقت ندارد.');
      await this.capacity.bind(tx, row.id, row.branchId, contract.id);
      return this.view(
        await tx.websiteCheckoutSession.update({
          where: { id: row.id },
          data: { status: 'BOUND', contractId: contract.id },
        }),
      );
    });
  }
}
