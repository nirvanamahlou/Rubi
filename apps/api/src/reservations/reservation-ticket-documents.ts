import {
  allocatedServiceRows,
  flightServiceRows,
  filterServiceRows,
} from './service-report';
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
    @Inject(TicketPublicService) _catalog: TicketPublicService,
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
      select: {
        id: true,
        customerId: true,
        number: true,
        source: true,
        issuedAt: true,
        intake: {
          select: {
            snapshot: true,
            workflowRevisions: {
              orderBy: { version: 'desc' },
              take: 1,
              select: { state: true },
            },
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
    const cityIds = [
      ...new Set(rows.flatMap((r) => [r.originCityId, r.destinationCityId])),
    ];
    // Bounded parallel public lookups avoid one database round trip per city
    // being added serially to the report's response time.
    for (let offset = 0; offset < cityIds.length; offset += 8) {
      await Promise.all(
        cityIds.slice(offset, offset + 8).map(async (id) => {
          try {
            names.set(
              id,
              (await this.directory?.cityReference(id))?.name ??
                'نام شهر ثبت نشده',
            );
          } catch {
            names.set(id, 'نام شهر ثبت نشده');
          }
        }),
      );
    }
    for (const row of rows) {
      row.origin = names.get(row.originCityId)!;
      row.destination = names.get(row.destinationCityId)!;
    }
    return { data: filterIssuedRows(rows, query) };
  }
  async serviceReport(
    query: Record<string, unknown>,
    actor: AuthenticatedActor,
  ) {
    if (!actor.permissions.includes('reservations.read'))
      throw new ForbiddenException();
    const range = reportRange(query);
    if (
      query.dateBasis &&
      !['ISSUED', 'TRAVEL'].includes(String(query.dateBasis))
    )
      throw new BadRequestException('فیلتر نامعتبر است.');
    if (
      query.serviceKind &&
      ![
        'all',
        'FLIGHT',
        'HOTEL',
        'TRANSFER',
        'INSURANCE',
        'VISA',
        'TOUR',
        'TRAIN',
        'BUS',
        'CIP',
        'OTHER',
      ].includes(String(query.serviceKind))
    )
      throw new BadRequestException('فیلتر نامعتبر است.');
    const intakes = await this.db.client.reservationIntake.findMany({
      where: { branchId: { in: [...actor.branchIds] } },
      orderBy: [{ contractId: 'asc' }, { contractVersion: 'desc' }],
      take: 10001,
      select: {
        id: true,
        contractId: true,
        snapshot: true,
        ticketDocuments: true,
        workflowRevisions: {
          orderBy: { version: 'desc' },
          take: 1,
          select: { state: true },
        },
      },
    });
    if (intakes.length > 10000)
      throw new BadRequestException(
        'بازه را کوچک‌تر کنید؛ گزارش بیش از ۱۰۰۰۰ بلیط دارد.',
      );
    const seenContracts = new Set<string>();
    const rows = intakes.flatMap((i) => {
      const snapshot = i.snapshot as unknown as SalesReservationRequestV1;
      const cancelled =
        (
          i.workflowRevisions[0]?.state as
            { supplierStatus?: string } | undefined
        )?.supplierStatus === 'CANCELLED';
      const latest = !seenContracts.has(i.contractId);
      seenContracts.add(i.contractId);
      return [
        ...flightServiceRows(
          i.ticketDocuments.flatMap((d) => issuedRows(d, snapshot, cancelled)),
        ),
        ...(latest ? allocatedServiceRows(i.id, snapshot, cancelled) : []),
      ];
    });
    if (rows.length > 20000)
      throw new BadRequestException(
        'بازه را کوچک‌تر کنید؛ گزارش بیش از ۲۰۰۰۰ قطعه پرواز دارد.',
      );
    const ids = [
      ...new Set(
        rows
          .flatMap((r) => [r.originCityId, r.destinationCityId])
          .filter(Boolean),
      ),
    ];
    const names = new Map<string, string>();
    for (let offset = 0; offset < ids.length; offset += 8)
      await Promise.all(
        ids.slice(offset, offset + 8).map(async (id) => {
          try {
            names.set(
              id,
              (await this.directory?.cityReference(id))?.name ??
                'نام شهر ثبت نشده',
            );
          } catch {
            names.set(id, 'نام شهر ثبت نشده');
          }
        }),
      );
    for (const row of rows) {
      row.origin = names.get(row.originCityId) ?? '';
      row.destination = names.get(row.destinationCityId) ?? '';
    }
    const dated = filterServiceRows(
      rows,
      { ...query, serviceKind: 'all', hotelId: 'all' },
      range,
    );
    const options = {
      origins: [
        ...new Map(
          rows
            .filter((r) => r.serviceKind === 'FLIGHT' && r.originCityId)
            .map((r) => [r.originCityId, r.origin]),
        ),
      ].map(([id, name]) => ({ id, name })),
      destinations: [
        ...new Map(
          rows
            .filter((r) => r.serviceKind === 'FLIGHT' && r.destinationCityId)
            .map((r) => [r.destinationCityId, r.destination]),
        ),
      ].map(([id, name]) => ({ id, name })),
      hotels: [
        ...new Map(
          rows.filter((r) => r.hotelId).map((r) => [r.hotelId, r.hotelName]),
        ),
      ].map(([id, name]) => ({ id, name })),
    };
    const selected = filterServiceRows(dated, query, range);
    return { data: filterIssuedRows(selected, query), options };
  }
  async choices(id: string, actor: AuthenticatedActor) {
    if (!actor.permissions.includes('reservations.read'))
      throw new ForbiddenException();
    const intake = await this.workflow.detail(id, actor.branchIds, true);
    if (intake.workflow.supplierStatus === 'CANCELLED')
      throw new BadRequestException('درخواست ابطال شده است.');
    const flights = salesContractFlights(
      intake.snapshot.serviceSelections,
      intake.snapshot.ticketSelections ?? [],
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
            automatic: true,
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
    input: { customerId?: unknown; number?: unknown; expectedNumber?: unknown },
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
    if (input.number !== undefined && typeof input.number !== 'string')
      throw new BadRequestException(
        'شماره بلیط را با ۶ رقم انگلیسی وارد کنید.',
      );
    const supplied =
      typeof input.number === 'string' ? input.number.trim() : '';
    if (supplied && !/^[0-9]{6}$/.test(supplied))
      throw new BadRequestException(
        'شماره بلیط را با ۶ رقم انگلیسی وارد کنید.',
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
        if (supplied && supplied !== old.number) {
          if (input.expectedNumber !== old.number)
            throw new ConflictException(
              'شماره بلیط تغییر کرده است؛ آخرین نسخه را دریافت کنید.',
            );
          if (
            await tx.reservationTicketDocument.findUnique({
              where: { number: supplied },
            })
          )
            throw new ConflictException(
              'این شماره بلیط قبلاً استفاده شده است.',
            );
          await tx.reservationTicketDocument.update({
            where: { id: old.id },
            data: {
              number: supplied,
              source: 'MANUAL',
              actorUserId: actor.userId,
            },
          });
          await tx.auditEvent.create({
            data: {
              actorUserId: actor.userId,
              action: 'reservations.ticket_number.corrected',
              entityType: 'ReservationTicketDocument',
              entityId: old.id,
              outcome: 'SUCCESS',
              metadata: { previousNumber: old.number, number: supplied },
            },
          });
        }
        return {
          customerId: old.customerId,
          number: supplied || old.number,
          source: supplied && supplied !== old.number ? 'MANUAL' : old.source,
          issuedAt: old.issuedAt.toISOString(),
        };
      }
      let number = supplied;
      if (input.expectedNumber)
        throw new ConflictException(
          'شماره بلیط تغییر کرده است؛ آخرین نسخه را دریافت کنید.',
        );
      if (!supplied) {
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
          source: supplied ? 'MANUAL' : 'AUTO',
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
