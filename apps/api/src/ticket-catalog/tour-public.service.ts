import { createHash } from 'node:crypto';
import {
  BadRequestException,
  ConflictException,
  ForbiddenException,
  Inject,
  Injectable,
  NotFoundException,
} from '@nestjs/common';
import type {
  AuthenticatedActor,
  TicketOfferV1,
  TourDepartureV1,
  TourPackageV1,
  TourPackageInputV1,
  SalesContractCreateRequest,
} from '@rubi/contracts';
import type { Prisma } from '@rubi/database';
import { DatabaseService } from '../database/database.service';
import { MasterTravelDirectory } from '../master-data/master-travel-directory';
import { validateTourDeparture, validateTourPackage } from './tour-policy';

const included = {
  package: true,
  outboundOffer: {
    include: { capacityAllocations: { where: { status: 'ACTIVE' } } },
  },
  returnOffer: {
    include: { capacityAllocations: { where: { status: 'ACTIVE' } } },
  },
} as const;
type PackageRow = Prisma.TourPackageGetPayload<object>;
type DepartureRow = Prisma.TourDepartureGetPayload<{
  include: typeof included;
}>;
type OfferRow = DepartureRow['outboundOffer'];

function packageView(row: PackageRow): TourPackageV1 {
  return {
    ...(row.definition as unknown as TourPackageInputV1),
    id: row.id,
    version: row.version,
    branchId: row.branchId,
    createdAt: row.createdAt.toISOString(),
  };
}
function offerView(row: OfferRow): TicketOfferV1 {
  return {
    id: row.id,
    version: row.version,
    branchId: row.branchId,
    originId: row.originId,
    destinationId: row.destinationId,
    departureAt: row.departureAt.toISOString(),
    arrivalAt: row.arrivalAt.toISOString(),
    carrierName: row.carrierName,
    serviceNumber: row.serviceNumber,
    cabinClassCode: row.cabinClassCode as TicketOfferV1['cabinClassCode'],
    totalCapacity: row.totalCapacity,
    remainingCapacity:
      row.status === 'ACTIVE' && row.departureAt > new Date()
        ? Math.max(
            0,
            row.totalCapacity -
              row.capacityAllocations.reduce(
                (sum, item) => sum + item.quantity,
                0,
              ),
          )
        : 0,
    status: row.status as TicketOfferV1['status'],
  };
}
function departureView(row: DepartureRow): TourDepartureV1 {
  const outbound = offerView(row.outboundOffer);
  const returning = row.returnOffer ? offerView(row.returnOffer) : undefined;
  return {
    id: row.id,
    version: row.version,
    branchId: row.branchId,
    packageId: row.packageId,
    packageVersion: row.packageVersion,
    package: packageView(row.package),
    startsOn: row.startsOn.toISOString().slice(0, 10),
    endsOn: row.endsOn.toISOString().slice(0, 10),
    outboundOfferId: outbound.id,
    ...(returning ? { returnOfferId: returning.id, returning } : {}),
    outbound,
    remainingCapacity: Math.min(
      outbound.remainingCapacity,
      returning?.remainingCapacity ?? outbound.remainingCapacity,
    ),
  };
}
function fingerprint(branchId: string, input: unknown) {
  return createHash('sha256')
    .update(JSON.stringify({ branchId, input }))
    .digest('hex');
}

@Injectable()
export class TourPublicService {
  constructor(
    @Inject(DatabaseService) private readonly database: DatabaseService,
    @Inject(MasterTravelDirectory)
    private readonly references: MasterTravelDirectory,
  ) {}

  private authorize(
    actor: AuthenticatedActor,
    manage = false,
    branchId?: string,
  ) {
    if (
      !actor.permissions.includes(
        manage ? 'ticket_catalog.manage' : 'ticket_catalog.read',
      ) ||
      (branchId && !actor.branchIds.includes(branchId))
    )
      throw new ForbiddenException(
        'مجوز دسترسی به تور در این شعبه وجود ندارد.',
      );
  }
  private command(
    actor: AuthenticatedActor,
    branchId?: string,
    key?: string,
  ): asserts branchId is string {
    this.authorize(actor, true, branchId);
    if (!branchId || !key?.trim() || key.length > 160)
      throw new BadRequestException('شعبه و شناسه درخواست لازم است.');
  }

  async packages(actor: AuthenticatedActor) {
    this.authorize(actor);
    const rows = await this.database.client.tourPackage.findMany({
      where: { branchId: { in: actor.branchIds } },
      orderBy: { createdAt: 'desc' },
      take: 200,
    });
    return { version: 1 as const, data: rows.map(packageView) };
  }
  /** Public Sales boundary. Stored offer IDs feed the existing atomic reservation ledger. */
  async assertSalesSelection(
    input: SalesContractCreateRequest,
    branchId: string,
  ) {
    const links = input.services.filter(
      (service) => service.metadata?.tourDepartureId !== undefined,
    );
    if (!links.length) return;
    if (links.length !== 1 || links[0]!.kind !== 'FLIGHT')
      throw new BadRequestException('مرجع نوبت تور نامعتبر است.');
    const meta = links[0]!.metadata!;
    if (
      typeof meta.tourDepartureId !== 'string' ||
      !/^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i.test(
        meta.tourDepartureId,
      )
    )
      throw new BadRequestException('شناسه نوبت تور معتبر نیست.');
    const row = await this.database.client.tourDeparture.findFirst({
      where: { id: meta.tourDepartureId, branchId },
      include: included,
    });
    if (!row)
      throw new BadRequestException('نوبت تور در شعبه قرارداد یافت نشد.');
    const tour = departureView(row);
    if (
      meta.tourDepartureVersion !== tour.version ||
      input.originId !== tour.package.originId ||
      input.destinationId !== tour.package.destinationId
    )
      throw new ConflictException(
        'مسیر یا نسخه تور تغییر کرده؛ تور را دوباره انتخاب کنید.',
      );
    const expected = [
      tour.outboundOfferId,
      ...(tour.returnOfferId ? [tour.returnOfferId] : []),
    ];
    const actual =
      input.ticketSelections?.map((ticket) => ticket.offerId) ?? [];
    if (
      actual.length !== expected.length ||
      expected.some((id) => !actual.includes(id))
    )
      throw new BadRequestException(
        'بلیت‌های قرارداد باید همان بلیت‌های نوبت تور باشند؛ برای فروش مستقل انتخاب تور را بردارید.',
      );
    if (
      tour.package.hotelIds.length &&
      (!input.hotelSelection ||
        !tour.package.hotelIds.includes(input.hotelSelection.hotelId))
    )
      throw new BadRequestException('هتل را از هتل‌های همین تور انتخاب کنید.');
    if (
      tour.package.insuranceId &&
      !input.services.some(
        (service) =>
          service.kind === 'INSURANCE' &&
          service.referenceId === tour.package.insuranceId,
      )
    )
      throw new BadRequestException('بیمه قرارداد با بیمه تور مطابقت ندارد.');
    if (
      tour.package.visa &&
      !input.services.some((service) => service.kind === 'VISA')
    )
      throw new BadRequestException('ویزای این تور را تکمیل کنید.');
    for (const [required, direction] of [
      [tour.package.transferOutbound, 'OUTBOUND'],
      [tour.package.transferReturn, 'RETURN'],
    ] as const) {
      if (
        required &&
        !input.services.some(
          (service) =>
            service.kind === 'TRANSFER' &&
            service.metadata?.direction === direction,
        )
      )
        throw new BadRequestException(
          'ترانسفر همراه تور از قرارداد حذف شده است.',
        );
    }
  }
  async departures(actor: AuthenticatedActor) {
    this.authorize(actor);
    const rows = await this.database.client.tourDeparture.findMany({
      where: {
        branchId: { in: actor.branchIds },
        endsOn: { gte: new Date(new Date().toISOString().slice(0, 10)) },
      },
      include: included,
      orderBy: { startsOn: 'asc' },
      take: 200,
    });
    return { version: 1 as const, data: rows.map(departureView) };
  }
  async createPackage(
    raw: unknown,
    actor: AuthenticatedActor,
    branchId?: string,
    key?: string,
  ) {
    this.command(actor, branchId, key);
    const input = validateTourPackage(raw);
    const hash = fingerprint(branchId, input);
    const where = {
      createdByUserId_createKey: {
        createdByUserId: actor.userId,
        createKey: key!,
      },
    };
    const previous = await this.database.client.tourPackage.findUnique({
      where,
    });
    if (previous) {
      if (previous.fingerprint !== hash)
        throw new ConflictException(
          'این درخواست قبلاً با اطلاعات دیگری ثبت شده است.',
        );
      return { data: packageView(previous) };
    }
    await this.references.assertTourReferences(input);
    const row = await this.database.client.tourPackage.upsert({
      where,
      update: {},
      create: {
        branchId,
        name: input.name,
        definition: input as unknown as Prisma.InputJsonValue,
        createdByUserId: actor.userId,
        createKey: key!,
        fingerprint: hash,
      },
    });
    if (row.fingerprint !== hash)
      throw new ConflictException(
        'شناسه درخواست تکراری با اطلاعات متفاوت است.',
      );
    return { data: packageView(row) };
  }
  async createDeparture(
    raw: unknown,
    actor: AuthenticatedActor,
    branchId?: string,
    key?: string,
  ) {
    this.command(actor, branchId, key);
    const input = validateTourDeparture(raw, new Date('1900-01-01T00:00:00Z'));
    const hash = fingerprint(branchId, input);
    const where = {
      createdByUserId_createKey: {
        createdByUserId: actor.userId,
        createKey: key!,
      },
    };
    const previous = await this.database.client.tourDeparture.findUnique({
      where,
      include: included,
    });
    if (previous) {
      if (previous.fingerprint !== hash)
        throw new ConflictException('شناسه درخواست قبلاً استفاده شده است.');
      return { data: departureView(previous) };
    }
    validateTourDeparture(input);
    const row = await this.database.client
      .$transaction(async (tx) => {
        const pack = await tx.tourPackage.findFirst({
          where: { id: input.packageId, branchId },
        });
        if (!pack) throw new NotFoundException('تور یافت نشد.');
        if (pack.version !== input.packageVersion)
          throw new ConflictException('نسخه تعریف تور تغییر کرده است.');
        const definition = packageView(pack);
        const outbound = await tx.ticketPublishedOffer.findFirst({
          where: { id: input.outboundOfferId, branchId, status: 'ACTIVE' },
        });
        const returning = input.returnOfferId
          ? await tx.ticketPublishedOffer.findFirst({
              where: { id: input.returnOfferId, branchId, status: 'ACTIVE' },
            })
          : null;
        const day = (date: Date) =>
          new Intl.DateTimeFormat('en-CA', {
            timeZone: 'Asia/Tehran',
            year: 'numeric',
            month: '2-digit',
            day: '2-digit',
          }).format(date);
        if (
          !outbound ||
          outbound.originId !== definition.originId ||
          outbound.destinationId !== definition.destinationId ||
          day(outbound.departureAt) !== input.startsOn ||
          outbound.departureAt <= new Date() ||
          day(outbound.arrivalAt) > input.endsOn
        )
          throw new BadRequestException(
            'بلیت رفت باید با مسیر و روز شروع تور مطابقت داشته باشد.',
          );
        if (
          input.returnOfferId &&
          (!returning ||
            returning.originId !== definition.destinationId ||
            returning.destinationId !== definition.originId ||
            day(returning.departureAt) !== input.endsOn ||
            returning.departureAt <= outbound.arrivalAt)
        )
          throw new BadRequestException(
            'بلیت برگشت باید از مقصد و در روز پایان تور باشد.',
          );
        return tx.tourDeparture.upsert({
          where,
          update: {},
          create: {
            ...input,
            startsOn: new Date(input.startsOn),
            endsOn: new Date(input.endsOn),
            branchId,
            createdByUserId: actor.userId,
            createKey: key!,
            fingerprint: hash,
          },
          include: included,
        });
      })
      .catch(async (error: unknown) => {
        if (
          error &&
          typeof error === 'object' &&
          'code' in error &&
          error.code === 'P2002'
        ) {
          const replay = await this.database.client.tourDeparture.findUnique({
            where,
            include: included,
          });
          if (replay) return replay;
        }
        throw error;
      });
    if (row.fingerprint !== hash)
      throw new ConflictException(
        'شناسه درخواست با اطلاعات متفاوت تکرار شده است.',
      );
    return { data: departureView(row) };
  }
}
