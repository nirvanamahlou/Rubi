import {
  BadRequestException,
  ConflictException,
  ForbiddenException,
  Inject,
  Injectable,
  Optional,
} from '@nestjs/common';
import { salesContractFlights, type AuthenticatedActor } from '@nora/contracts';
import { MasterTravelDirectory } from '../master-data/master-travel-directory';
import {
  reportRange,
  issuedRows,
  filterIssuedRows,
} from './issued-ticket-report';
import type { SalesReservationRequestV1 } from '@nora/contracts';
import { Prisma } from '@nora/database';
import { DatabaseService } from '../database/database.service';
import { TicketPublicService } from '../ticket-catalog/ticket-public.service';
import { TravelWorkflowService } from './travel-workflow.service';

@Injectable()
export class ReservationTicketDocumentsService {
  constructor(
    @Inject(DatabaseService) private readonly db: DatabaseService,
    @Inject(TravelWorkflowService)
    private readonly workflow: TravelWorkflowService,
    @Inject(TicketPublicService) private readonly catalog: TicketPublicService,
    @Optional()
    @Inject(MasterTravelDirectory)
    private readonly directory?: MasterTravelDirectory,
  ) {}
  async report(query: Record<string, unknown>, actor: AuthenticatedActor) {
    if (!actor.permissions.includes('reservations.read'))
      throw new ForbiddenException();
    const range = reportRange(query);
    const documents = await this.db.client.reservationTicketDocument.findMany({
      where: {
        issuedAt: range,
        intake: { branchId: { in: [...actor.branchIds] } },
      },
      include: {
        intake: {
          include: {
            workflowRevisions: { orderBy: { version: 'desc' }, take: 1 },
          },
        },
      },
      orderBy: [{ issuedAt: 'desc' }, { id: 'asc' }],
      take: 10001,
    });
    if (documents.length > 10000)
      throw new BadRequestException(
        'بازه را کوچک‌تر کنید؛ گزارش بیش از ۱۰۰۰۰ بلیط دارد.',
      );
    const rows = documents.flatMap((doc) =>
      issuedRows(
        doc,
        doc.intake.snapshot as unknown as SalesReservationRequestV1,
        (
          doc.intake.workflowRevisions[0]?.state as
            { supplierStatus?: string } | undefined
        )?.supplierStatus === 'CANCELLED',
      ),
    );
    if (rows.length > 20000)
      throw new BadRequestException(
        'بازه را کوچک‌تر کنید؛ گزارش بیش از ۲۰۰۰۰ قطعه پرواز دارد.',
      );
    const names = new Map<string, string>();
    for (const id of new Set(
      rows.flatMap((r) => [r.originCityId, r.destinationCityId]),
    )) {
      try {
        names.set(
          id,
          (await this.directory?.cityReference(id))?.name ?? 'نام شهر ثبت نشده',
        );
      } catch {
        names.set(id, 'نام شهر ثبت نشده');
      }
    }
    for (const row of rows) {
      row.origin = names.get(row.originCityId)!;
      row.destination = names.get(row.destinationCityId)!;
    }
    return { data: filterIssuedRows(rows, query) };
  }
  async choices(id: string, actor: AuthenticatedActor) {
    if (!actor.permissions.includes('reservations.read'))
      throw new ForbiddenException();
    const intake = await this.workflow.detail(id, actor.branchIds);
    if (intake.workflow.supplierStatus === 'CANCELLED')
      throw new BadRequestException('درخواست ابطال شده است.');
    const flights = salesContractFlights(
      intake.snapshot.serviceSelections,
      intake.snapshot.ticketSelections ?? [],
    );
    const supplies = new Map<string, string | null>();
    for (const flight of flights)
      if (flight.offerId && !supplies.has(flight.offerId))
        supplies.set(
          flight.offerId,
          await this.catalog.documentSupply(flight.offerId, actor.branchIds),
        );
    return (intake.snapshot.passengerAssignments ?? [])
      .filter((p) => intake.snapshot.passengerIds.includes(p.customerId))
      .flatMap((p) => {
        const assigned = flights.filter((f) =>
          p.serviceClientKeys.includes(f.serviceClientKey),
        );
        if (!assigned.length) return [];
        return [
          {
            customerId: p.customerId,
            automatic: assigned.every(
              (f) => !!f.offerId && supplies.get(f.offerId) === 'COMPANY',
            ),
            document:
              intake.ticketDocuments.find(
                (d) => d.customerId === p.customerId,
              ) ?? null,
          },
        ];
      });
  }
  async issue(
    id: string,
    input: { customerId?: unknown; number?: unknown },
    actor: AuthenticatedActor,
  ) {
    if (!actor.permissions.includes('reservations.documents.manage'))
      throw new ForbiddenException();
    if (!input || typeof input.customerId !== 'string')
      throw new BadRequestException('مسافر را انتخاب کنید.');
    const choice = (await this.choices(id, actor)).find(
      (p) => p.customerId === input.customerId,
    );
    if (!choice)
      throw new BadRequestException('پرواز به این مسافر تخصیص ندارد.');
    const supplied =
      typeof input.number === 'string' ? input.number.trim() : '';
    if (choice.document) {
      if (supplied && supplied !== choice.document.number)
        throw new ConflictException(
          'شماره قبلاً ثبت شده و قابل جایگزینی نیست.',
        );
      return choice.document;
    }
    if (choice.automatic && supplied)
      throw new BadRequestException('شماره بلیط چارتر ظرفیت شرکت خودکار است.');
    if (!choice.automatic && !/^[0-9]{6}$/.test(supplied))
      throw new BadRequestException(
        'شماره بلیط شناور را با ۶ رقم انگلیسی وارد کنید.',
      );
    return this.db.client.$transaction(async (tx) => {
      await tx.$queryRaw(
        Prisma.sql`SELECT 1 AS locked FROM pg_advisory_xact_lock(hashtextextended(${id},0))`,
      );
      await tx.$queryRaw(
        Prisma.sql`SELECT 1 AS locked FROM pg_advisory_xact_lock(hashtext('reservation-ticket-number'))`,
      );
      const intake = await tx.reservationIntake.findFirst({
        where: { id, branchId: { in: [...actor.branchIds] } },
        include: {
          workflowRevisions: { orderBy: { version: 'desc' }, take: 1 },
        },
      });
      const state = intake?.workflowRevisions[0]?.state as
        { supplierStatus?: string } | undefined;
      if (!intake || state?.supplierStatus === 'CANCELLED')
        throw new BadRequestException('درخواست موجود نیست یا ابطال شده است.');
      const old = await tx.reservationTicketDocument.findUnique({
        where: {
          intakeId_customerId: { intakeId: id, customerId: choice.customerId },
        },
      });
      if (old) {
        if (supplied && supplied !== old.number)
          throw new ConflictException('شماره قبلاً ثبت شده است.');
        return {
          customerId: old.customerId,
          number: old.number,
          source: old.source,
          issuedAt: old.issuedAt.toISOString(),
        };
      }
      let number = supplied;
      if (choice.automatic) {
        do {
          const [seq] = await tx.$queryRaw<Array<{ value: bigint }>>(
            Prisma.sql`SELECT nextval('reservation_ticket_number_seq') AS value`,
          );
          if (!seq || seq.value > 999999n)
            throw new ConflictException('ظرفیت شماره شش‌رقمی تکمیل شده است.');
          number = seq.value.toString();
        } while (
          await tx.reservationTicketDocument.findUnique({ where: { number } })
        );
      } else if (
        await tx.reservationTicketDocument.findUnique({ where: { number } })
      )
        throw new ConflictException('این شماره بلیط قبلاً استفاده شده است.');
      const doc = await tx.reservationTicketDocument.create({
        data: {
          intakeId: id,
          customerId: choice.customerId,
          number,
          source: choice.automatic ? 'AUTO' : 'MANUAL',
          actorUserId: actor.userId,
        },
      });
      return {
        customerId: doc.customerId,
        number: doc.number,
        source: doc.source,
        issuedAt: doc.issuedAt.toISOString(),
      };
    });
  }
}
