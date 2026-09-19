import {
  BadRequestException,
  Body,
  Controller,
  ForbiddenException,
  Get,
  Header,
  Headers,
  Inject,
  Injectable,
  Optional,
  Param,
  Post,
  Query,
  Req,
  Res,
  StreamableFile,
  UseGuards,
} from '@nestjs/common';
import { readFile } from 'node:fs/promises';
import { join } from 'node:path';
import { strFromU8, strToU8, unzipSync, zipSync } from 'fflate';
import type {
  AuthenticatedActor,
  CustomerDetail,
  ReservationIntakeV1,
  ReservationManifestTicketCardV1,
  ReservationManifestTicketExportInputV1,
} from '@nora/contracts';
import type { Response } from 'express';
import { DatabaseService } from '../database/database.service';
import { AuthGuard } from '../iam/auth.guard';
import type { AuthenticatedRequest } from '../iam/iam.types';
import { CustomerService } from '../customers/customer.service';
import { DocumentsService } from '../documents/documents.service';
import { FinanceDeliveryService } from '../finance/document-delivery/finance-delivery.module';
import { MasterTravelDirectory } from '../master-data/master-travel-directory';
import { TravelWorkflowService } from './travel-workflow.service';

export const MANIFEST_XLSX_MIME =
  'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet';

export interface IranAirtourManifestRow {
  firstName: string;
  lastName: string;
  gender: 'MR' | 'MS';
  passengerType: 'ADULT' | 'CHILD' | 'INFANT';
  birthDate: string;
  nationalId: string;
  nationality: string;
  passportNumber: string;
  passportIssuingCountry: string;
  birthCountry: string;
  passportExpiryDate: string;
  cabinClass: string;
}

export interface ReservationManifestBatchInput {
  fromDate: string;
  toDate: string;
  includePreviouslyExported?: boolean;
}

const isoDay = /^\d{4}-\d{2}-\d{2}$/;

function validIsoDay(value: unknown): value is string {
  if (typeof value !== 'string' || !isoDay.test(value)) return false;
  const instant = new Date(`${value}T00:00:00.000Z`);
  return (
    !Number.isNaN(instant.valueOf()) && instant.toISOString().startsWith(value)
  );
}

function tehranDay(value: string) {
  const parts = new Intl.DateTimeFormat('en-US', {
    timeZone: 'Asia/Tehran',
    year: 'numeric',
    month: '2-digit',
    day: '2-digit',
  }).formatToParts(new Date(value));
  const part = (type: Intl.DateTimeFormatPartTypes) =>
    parts.find((item) => item.type === type)?.value ?? '';
  return `${part('year')}-${part('month')}-${part('day')}`;
}

const xml = (value: string) =>
  Array.from(value)
    .filter((character) => {
      const code = character.codePointAt(0)!;
      return (
        code === 9 ||
        code === 10 ||
        code === 13 ||
        (code >= 32 && code <= 0xd7ff) ||
        (code >= 0xe000 && code <= 0xfffd) ||
        code >= 0x10000
      );
    })
    .join('')
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;')
    .replace(/'/g, '&apos;');

const cell = (column: string, row: number, value: string, style: number) =>
  `<x:c r="${column}${row}" s="${style}" t="inlineStr"><x:is><x:t xml:space="preserve">${xml(value)}</x:t></x:is></x:c>`;

export function buildIranAirtourManifest(
  template: Uint8Array,
  passengers: readonly IranAirtourManifestRow[],
) {
  if (!passengers.length)
    throw new BadRequestException('مسافری برای ساخت MANIFEST وجود ندارد.');
  if (passengers.length > 61)
    throw new BadRequestException('این قالب حداکثر ۶۱ مسافر را می‌پذیرد.');
  const files = unzipSync(template);
  const path = 'xl/worksheets/sheet1.xml';
  let sheet = strFromU8(files[path]!);
  passengers.forEach((passenger, index) => {
    const row = index + 2;
    const values = [
      passenger.firstName,
      passenger.lastName,
      passenger.gender,
      passenger.passengerType,
      passenger.birthDate.replaceAll('-', '/'),
      passenger.nationalId,
      passenger.nationality,
      passenger.passportNumber,
      passenger.passportIssuingCountry,
      passenger.birthCountry,
      passenger.passportExpiryDate.replaceAll('-', '/'),
      passenger.cabinClass,
    ];
    const columns = 'ABCDEFGHIJKL'.split('');
    const cells = values
      .map((value, column) =>
        cell(
          columns[column]!,
          row,
          value,
          column === 1
            ? 13
            : column === 11
              ? 17
              : column === 8 || column === 9
                ? 14
                : 12,
        ),
      )
      .join('');
    const rowPattern = new RegExp(
      `<x:row r="${row}"([^>]*)>[\\s\\S]*?<\\/x:row>`,
    );
    if (!rowPattern.test(sheet))
      throw new Error(`Template row ${row} is missing`);
    sheet = sheet.replace(rowPattern, `<x:row r="${row}"$1>${cells}</x:row>`);
  });
  files[path] = strToU8(sheet);
  return zipSync(files, { level: 6 });
}

const required = (
  passenger: CustomerDetail,
  field: keyof CustomerDetail,
  label: string,
) => {
  const value = passenger[field];
  if (typeof value !== 'string' || !value.trim())
    throw new BadRequestException(
      `${passenger.displayName}: ${label} در پرونده فروش ثبت نشده است.`,
    );
  return value.trim().toUpperCase();
};

@Injectable()
export class ReservationManifestService {
  constructor(
    @Inject(TravelWorkflowService)
    private readonly workflow: TravelWorkflowService,
    @Inject(CustomerService) private readonly customers: CustomerService,
    @Inject(MasterTravelDirectory)
    private readonly directory: MasterTravelDirectory,
    @Inject(FinanceDeliveryService)
    private readonly delivery: FinanceDeliveryService,
    @Inject(DatabaseService) private readonly database: DatabaseService,
    @Optional()
    @Inject(DocumentsService)
    private readonly documents?: DocumentsService,
  ) {}

  private validateRange(input: { fromDate: string; toDate: string }) {
    if (!validIsoDay(input.fromDate) || !validIsoDay(input.toDate))
      throw new BadRequestException('بازه تاریخ معتبر نیست.');
    if (input.fromDate > input.toDate)
      throw new BadRequestException('تاریخ شروع باید قبل از تاریخ پایان باشد.');
  }

  private async latestIntakes(actor: AuthenticatedActor) {
    const all = await this.database.client.reservationIntake.findMany({
      where: { branchId: { in: actor.branchIds } },
      orderBy: [{ contractVersion: 'desc' }, { receivedAt: 'desc' }],
    });
    const latest = new Map<string, (typeof all)[number]>();
    for (const intake of all)
      if (!latest.has(intake.contractId)) latest.set(intake.contractId, intake);
    return [...latest.values()];
  }

  private async ticketGroups(
    input: { fromDate: string; toDate: string },
    actor: AuthenticatedActor,
  ) {
    this.validateRange(input);
    const groups = new Map<
      string,
      {
        ticket: NonNullable<
          ReservationIntakeV1['snapshot']['ticketSelections']
        >[number];
        rows: Awaited<ReturnType<ReservationManifestService['latestIntakes']>>;
      }
    >();
    for (const row of await this.latestIntakes(actor)) {
      const snapshot =
        row.snapshot as unknown as ReservationIntakeV1['snapshot'];
      for (const ticket of snapshot.ticketSelections ?? []) {
        const day = tehranDay(ticket.departureAt);
        if (day < input.fromDate || day > input.toDate) continue;
        const group = groups.get(ticket.offerId) ?? { ticket, rows: [] };
        group.rows.push(row);
        groups.set(ticket.offerId, group);
      }
    }
    return [...groups.values()].sort((left, right) =>
      left.ticket.departureAt.localeCompare(right.ticket.departureAt),
    );
  }

  async listTickets(
    input: { fromDate: string; toDate: string },
    actor: AuthenticatedActor,
  ): Promise<ReservationManifestTicketCardV1[]> {
    if (!actor.permissions.includes('reservations.read'))
      throw new ForbiddenException('مجوز مشاهده بلیط‌های MANIFEST وجود ندارد.');
    const cards: ReservationManifestTicketCardV1[] = [];
    for (const group of await this.ticketGroups(input, actor)) {
      const ticket = group.ticket;
      const [origin, destination, template] = await Promise.all([
        this.directory.cityReference(ticket.originId),
        this.directory.cityReference(ticket.destinationId),
        this.directory.manifestTemplate(
          ticket.carrierNameSnapshot,
          ticket.destinationId,
          tehranDay(ticket.departureAt),
          ticket.serviceNumberSnapshot,
        ),
      ]);
      cards.push({
        offerId: ticket.offerId,
        direction: ticket.direction,
        carrierName: ticket.carrierNameSnapshot,
        serviceNumber: ticket.serviceNumberSnapshot,
        originName: origin.englishName || origin.name,
        destinationName: destination.englishName || destination.name,
        departureAt: ticket.departureAt,
        arrivalAt: ticket.arrivalAt,
        contractCount: group.rows.length,
        passengerCount: group.rows.reduce((sum, row) => {
          const snapshot =
            row.snapshot as unknown as ReservationIntakeV1['snapshot'];
          return sum + snapshot.passengerIds.length;
        }, 0),
        template: template
          ? {
              id: template.id,
              name: template.name,
              versionNumber: template.versionNumber,
            }
          : null,
        unavailableReason: template
          ? null
          : 'برای این ایرلاین و مقصد قالب فعال MANIFEST تعریف نشده است.',
      });
    }
    return cards;
  }

  private requirePermissions(actor: AuthenticatedActor) {
    for (const permission of [
      'reservations.read',
      'reservations.documents.manage',
      'customers.read',
      'customers.sensitive.read',
    ])
      if (!actor.permissions.includes(permission as never))
        throw new ForbiddenException('مجوز تهیه MANIFEST مسافران وجود ندارد.');
  }

  private async passengerRows(
    intake: Awaited<ReturnType<TravelWorkflowService['detail']>>,
    actor: AuthenticatedActor,
    traceId?: string,
    offerId?: string,
  ) {
    const flight = intake.snapshot.ticketSelections?.find((ticket) =>
      offerId ? ticket.offerId === offerId : ticket.direction === 'OUTBOUND',
    );
    if (!flight)
      throw new BadRequestException('پرواز رفت قرارداد ثبت نشده است.');
    const cabin = /BUSINESS|^B$/i.test(flight.cabinClassCode)
      ? 'B'
      : /FIRST|^F$/i.test(flight.cabinClassCode)
        ? 'F'
        : 'Y';
    const assignments = new Map(
      (intake.snapshot.passengerAssignments ?? []).map((item) => [
        item.customerId,
        item,
      ]),
    );
    const order = intake.workflow.roomOrder.length
      ? intake.workflow.roomOrder
      : intake.snapshot.passengerIds;
    const passengers: IranAirtourManifestRow[] = [];
    for (const customerId of order) {
      const customer = (
        await this.customers.detail(
          customerId,
          actor,
          traceId,
          'customer-verification',
        )
      ).data;
      const override = intake.workflow.ageOverrides[customerId];
      const age = override ?? assignments.get(customerId)?.ageCategory;
      passengers.push({
        firstName: required(customer, 'passportFirstName', 'نام لاتین پاسپورت'),
        lastName: required(
          customer,
          'passportLastName',
          'نام خانوادگی لاتین پاسپورت',
        ),
        gender: required(customer, 'gender', 'جنسیت') === 'M' ? 'MR' : 'MS',
        passengerType:
          age === 'INF' || age === 'INFANT'
            ? 'INFANT'
            : age === 'CHD' || age === 'CHILD'
              ? 'CHILD'
              : 'ADULT',
        birthDate: required(customer, 'birthDate', 'تاریخ تولد'),
        nationalId: customer.nationalId?.trim() ?? '',
        nationality: required(customer, 'nationalityCode', 'ملیت ISO3'),
        passportNumber: required(customer, 'passportNumber', 'شماره پاسپورت'),
        passportIssuingCountry: required(
          customer,
          'passportIssuingCountryCode',
          'کشور صادرکننده پاسپورت ISO3',
        ),
        birthCountry: required(
          customer,
          'birthCountryCode',
          'کشور محل تولد ISO3',
        ),
        passportExpiryDate: required(
          customer,
          'passportExpiryDate',
          'تاریخ انقضای پاسپورت',
        ),
        cabinClass: cabin,
      });
    }
    return passengers;
  }

  async exportTicket(
    offerId: string,
    input: ReservationManifestTicketExportInputV1,
    idempotencyKey: string | undefined,
    actor: AuthenticatedActor,
    traceId?: string,
  ) {
    this.requirePermissions(actor);
    this.validateRange(input);
    if (!idempotencyKey?.trim())
      throw new BadRequestException('شناسه یکتای درخواست الزامی است.');
    const group = (await this.ticketGroups(input, actor)).find(
      (candidate) => candidate.ticket.offerId === offerId,
    );
    if (!group)
      throw new BadRequestException('بلیط انتخاب‌شده در این بازه وجود ندارد.');
    const ticket = group.ticket;
    const template = await this.directory.manifestTemplate(
      ticket.carrierNameSnapshot,
      ticket.destinationId,
      tehranDay(ticket.departureAt),
      ticket.serviceNumberSnapshot,
    );
    if (!template)
      throw new BadRequestException(
        'برای این ایرلاین و مقصد قالب فعال MANIFEST تعریف نشده است.',
      );
    if (!this.documents)
      throw new BadRequestException('سرویس فایل قالب MANIFEST آماده نیست.');

    const persistedKey = 'ticket:' + offerId + ':' + idempotencyKey.trim();
    const existing =
      await this.database.client.reservationManifestExport.findUnique({
        where: {
          actorUserId_idempotencyKey: {
            actorUserId: actor.userId,
            idempotencyKey: persistedKey,
          },
        },
        include: { items: true },
      });
    if (
      existing &&
      (existing.fromDate.toISOString().slice(0, 10) !== input.fromDate ||
        existing.toDate.toISOString().slice(0, 10) !== input.toDate ||
        existing.includePreviouslyExported !==
          Boolean(input.includePreviouslyExported))
    )
      throw new BadRequestException(
        'این شناسه درخواست قبلاً برای تنظیمات دیگری استفاده شده است.',
      );

    let candidates = group.rows;
    if (existing) {
      const selectedIds = new Set(existing.items.map((item) => item.intakeId));
      candidates = candidates.filter((row) => selectedIds.has(row.id));
    } else if (!input.includePreviouslyExported && candidates.length) {
      const previous =
        await this.database.client.reservationManifestExportItem.findMany({
          where: {
            intakeId: { in: candidates.map((row) => row.id) },
            outboundDepartureAt: new Date(ticket.departureAt),
          },
          select: { intakeId: true },
          distinct: ['intakeId'],
        });
      const seen = new Set(previous.map((item) => item.intakeId));
      candidates = candidates.filter((row) => !seen.has(row.id));
    }

    const selected = [];
    let skippedFinanceCount = existing?.skippedFinanceCount ?? 0;
    for (const row of candidates) {
      if (!(await this.delivery.read(row.id)).approved) {
        skippedFinanceCount += 1;
        continue;
      }
      selected.push(row);
    }
    if (!selected.length)
      throw new BadRequestException(
        input.includePreviouslyExported
          ? 'برای این بلیط قرارداد قابل خروجی با تأیید مالی وجود ندارد.'
          : 'برای این بلیط قرارداد جدید قابل خروجی وجود ندارد.',
      );

    const rows: IranAirtourManifestRow[] = [];
    for (const row of selected) {
      const intake = await this.workflow.detail(row.id, actor.branchIds);
      rows.push(...(await this.passengerRows(intake, actor, traceId, offerId)));
    }
    const delivery = await this.documents.readManifestTemplateReference(
      template.fileReferenceId,
      actor,
    );
    const chunks: Buffer[] = [];
    for await (const chunk of delivery.stream)
      chunks.push(Buffer.isBuffer(chunk) ? chunk : Buffer.from(chunk));
    const bytes = buildIranAirtourManifest(Buffer.concat(chunks), rows);

    if (!existing) {
      await this.database.client.reservationManifestExport.create({
        data: {
          actorUserId: actor.userId,
          idempotencyKey: persistedKey,
          fromDate: new Date(input.fromDate + 'T00:00:00.000Z'),
          toDate: new Date(input.toDate + 'T00:00:00.000Z'),
          includePreviouslyExported: Boolean(input.includePreviouslyExported),
          contractCount: selected.length,
          passengerCount: rows.length,
          skippedFinanceCount,
          items: {
            create: selected.map((row) => ({
              intakeId: row.id,
              contractId: row.contractId,
              contractVersion: row.contractVersion,
              outboundDepartureAt: new Date(ticket.departureAt),
            })),
          },
        },
      });
    }
    return {
      bytes,
      contractCount: selected.length,
      passengerCount: rows.length,
      skippedFinanceCount,
      fileName: (
        ticket.carrierNameSnapshot +
        '-' +
        ticket.serviceNumberSnapshot +
        '-' +
        tehranDay(ticket.departureAt)
      )
        .replace(/[^A-Za-z0-9_-]/g, '_')
        .replace(/_+/g, '_'),
    };
  }

  private async isIranAirtourAntalya(
    snapshot: ReservationIntakeV1['snapshot'],
  ) {
    const flight = snapshot.ticketSelections?.find(
      (ticket) => ticket.direction === 'OUTBOUND',
    );
    if (
      !flight ||
      !/(IRAN\s*AIRTOUR|ایران\s*ایرتور)/i.test(flight.carrierNameSnapshot)
    )
      return false;
    const destination = await this.directory.cityReference(
      snapshot.hotelSelection?.cityId ?? flight.destinationId,
    );
    return /(ANTALYA|آنتالیا)/i.test(
      `${destination.name} ${destination.englishName}`,
    );
  }

  async exportRange(
    input: ReservationManifestBatchInput,
    idempotencyKey: string | undefined,
    actor: AuthenticatedActor,
    traceId?: string,
  ) {
    this.requirePermissions(actor);
    if (!idempotencyKey?.trim())
      throw new BadRequestException('شناسه یکتای درخواست الزامی است.');
    if (!validIsoDay(input.fromDate) || !validIsoDay(input.toDate))
      throw new BadRequestException('بازه تاریخ معتبر نیست.');
    if (input.fromDate > input.toDate)
      throw new BadRequestException('تاریخ شروع باید قبل از تاریخ پایان باشد.');

    const existing =
      await this.database.client.reservationManifestExport.findUnique({
        where: {
          actorUserId_idempotencyKey: {
            actorUserId: actor.userId,
            idempotencyKey: idempotencyKey.trim(),
          },
        },
        include: {
          items: {
            orderBy: [{ outboundDepartureAt: 'asc' }, { contractId: 'asc' }],
          },
        },
      });
    if (
      existing &&
      (existing.fromDate.toISOString().slice(0, 10) !== input.fromDate ||
        existing.toDate.toISOString().slice(0, 10) !== input.toDate ||
        existing.includePreviouslyExported !==
          Boolean(input.includePreviouslyExported))
    )
      throw new BadRequestException(
        'این شناسه درخواست قبلاً برای تنظیمات دیگری استفاده شده است.',
      );

    let selectedIds = existing?.items.map((item) => item.intakeId);
    let skippedFinanceCount = existing?.skippedFinanceCount ?? 0;
    let selectedMetadata:
      | {
          id: string;
          contractId: string;
          contractVersion: number;
          outboundDepartureAt: Date;
        }[]
      | undefined;

    if (!selectedIds) {
      const all = await this.database.client.reservationIntake.findMany({
        where: { branchId: { in: actor.branchIds } },
        orderBy: [{ contractVersion: 'desc' }, { receivedAt: 'desc' }],
      });
      const latest = new Map<string, (typeof all)[number]>();
      for (const intake of all)
        if (!latest.has(intake.contractId))
          latest.set(intake.contractId, intake);

      const dated: {
        row: (typeof all)[number];
        outboundDepartureAt: Date;
      }[] = [];
      for (const row of latest.values()) {
        const snapshot =
          row.snapshot as unknown as ReservationIntakeV1['snapshot'];
        const outbound = snapshot.ticketSelections?.find(
          (ticket) => ticket.direction === 'OUTBOUND',
        );
        if (!outbound) continue;
        const day = tehranDay(outbound.departureAt);
        if (day < input.fromDate || day > input.toDate) continue;
        if (!(await this.isIranAirtourAntalya(snapshot))) continue;
        dated.push({
          row,
          outboundDepartureAt: new Date(outbound.departureAt),
        });
      }
      dated.sort(
        (left, right) =>
          left.outboundDepartureAt.valueOf() -
            right.outboundDepartureAt.valueOf() ||
          (
            left.row.snapshot as unknown as ReservationIntakeV1['snapshot']
          ).contractNumber.localeCompare(
            (right.row.snapshot as unknown as ReservationIntakeV1['snapshot'])
              .contractNumber,
          ),
      );

      let filtered = dated;
      if (!input.includePreviouslyExported && dated.length) {
        const previous =
          await this.database.client.reservationManifestExportItem.findMany({
            where: { intakeId: { in: dated.map(({ row }) => row.id) } },
            select: { intakeId: true },
            distinct: ['intakeId'],
          });
        const seen = new Set(previous.map((item) => item.intakeId));
        filtered = dated.filter(({ row }) => !seen.has(row.id));
      }

      selectedMetadata = [];
      for (const candidate of filtered) {
        const authorization = await this.delivery.read(candidate.row.id);
        if (!authorization.approved) {
          skippedFinanceCount += 1;
          continue;
        }
        selectedMetadata.push({
          id: candidate.row.id,
          contractId: candidate.row.contractId,
          contractVersion: candidate.row.contractVersion,
          outboundDepartureAt: candidate.outboundDepartureAt,
        });
      }
      selectedIds = selectedMetadata.map((item) => item.id);
    }

    if (!selectedIds.length)
      throw new BadRequestException(
        input.includePreviouslyExported
          ? 'در این بازه قرارداد قابل خروجی با تأیید مالی وجود ندارد.'
          : 'در این بازه قرارداد جدید قابل خروجی وجود ندارد.',
      );

    const rows: IranAirtourManifestRow[] = [];
    for (const id of selectedIds) {
      const authorization = await this.delivery.read(id);
      if (!authorization.approved)
        throw new ForbiddenException(
          'دریافت MANIFEST تا تأیید تحویل مدارک توسط مالی مجاز نیست.',
        );
      const intake = await this.workflow.detail(id, actor.branchIds);
      rows.push(...(await this.passengerRows(intake, actor, traceId)));
    }
    const template = await readFile(
      join(__dirname, 'templates', 'iran-airtour-antalya-pax-list.xlsx'),
    );
    const bytes = buildIranAirtourManifest(template, rows);

    if (!existing) {
      await this.database.client.reservationManifestExport.create({
        data: {
          actorUserId: actor.userId,
          idempotencyKey: idempotencyKey.trim(),
          fromDate: new Date(`${input.fromDate}T00:00:00.000Z`),
          toDate: new Date(`${input.toDate}T00:00:00.000Z`),
          includePreviouslyExported: Boolean(input.includePreviouslyExported),
          contractCount: selectedIds.length,
          passengerCount: rows.length,
          skippedFinanceCount,
          items: {
            create: selectedMetadata!.map((item) => ({
              intakeId: item.id,
              contractId: item.contractId,
              contractVersion: item.contractVersion,
              outboundDepartureAt: item.outboundDepartureAt,
            })),
          },
        },
      });
    }
    return {
      bytes,
      contractCount: selectedIds.length,
      passengerCount: rows.length,
      skippedFinanceCount,
      fromDate: input.fromDate,
      toDate: input.toDate,
      includePreviouslyExported: Boolean(input.includePreviouslyExported),
    };
  }

  async export(id: string, actor: AuthenticatedActor, traceId?: string) {
    this.requirePermissions(actor);
    const intake = await this.workflow.detail(id, actor.branchIds);
    const authorization = await this.delivery.read(id);
    if (!authorization.approved)
      throw new ForbiddenException(
        'دریافت MANIFEST تا تأیید تحویل مدارک توسط مالی مجاز نیست.',
      );
    const destination = await this.directory.cityReference(
      intake.snapshot.hotelSelection?.cityId ??
        intake.snapshot.ticketSelections?.find(
          (ticket) => ticket.direction === 'OUTBOUND',
        )?.destinationId ??
        '',
    );
    if (
      !/(ANTALYA|آنتالیا)/i.test(
        `${destination.name} ${destination.englishName}`,
      )
    )
      throw new BadRequestException(
        'قالب ایران ایرتور فقط برای قراردادهای مقصد آنتالیا فعال است.',
      );
    const flight = intake.snapshot.ticketSelections?.find(
      (ticket) => ticket.direction === 'OUTBOUND',
    );
    if (
      !flight ||
      !/(IRAN\s*AIRTOUR|ایران\s*ایرتور)/i.test(flight.carrierNameSnapshot)
    )
      throw new BadRequestException(
        'پرواز رفت این قرارداد متعلق به ایران ایرتور نیست.',
      );
    const cabin = /BUSINESS|^B$/i.test(flight.cabinClassCode)
      ? 'B'
      : /FIRST|^F$/i.test(flight.cabinClassCode)
        ? 'F'
        : 'Y';
    const assignments = new Map(
      (intake.snapshot.passengerAssignments ?? []).map((item) => [
        item.customerId,
        item,
      ]),
    );
    const order = intake.workflow.roomOrder.length
      ? intake.workflow.roomOrder
      : intake.snapshot.passengerIds;
    const passengers: IranAirtourManifestRow[] = [];
    for (const customerId of order) {
      const customer = (
        await this.customers.detail(
          customerId,
          actor,
          traceId,
          'customer-verification',
        )
      ).data;
      const override = intake.workflow.ageOverrides[customerId];
      const age = override ?? assignments.get(customerId)?.ageCategory;
      passengers.push({
        firstName: required(customer, 'passportFirstName', 'نام لاتین پاسپورت'),
        lastName: required(
          customer,
          'passportLastName',
          'نام خانوادگی لاتین پاسپورت',
        ),
        gender: required(customer, 'gender', 'جنسیت') === 'M' ? 'MR' : 'MS',
        passengerType:
          age === 'INF' || age === 'INFANT'
            ? 'INFANT'
            : age === 'CHD' || age === 'CHILD'
              ? 'CHILD'
              : 'ADULT',
        birthDate: required(customer, 'birthDate', 'تاریخ تولد'),
        nationalId: customer.nationalId?.trim() ?? '',
        nationality: required(customer, 'nationalityCode', 'ملیت ISO3'),
        passportNumber: required(customer, 'passportNumber', 'شماره پاسپورت'),
        passportIssuingCountry: required(
          customer,
          'passportIssuingCountryCode',
          'کشور صادرکننده پاسپورت ISO3',
        ),
        birthCountry: required(
          customer,
          'birthCountryCode',
          'کشور محل تولد ISO3',
        ),
        passportExpiryDate: required(
          customer,
          'passportExpiryDate',
          'تاریخ انقضای پاسپورت',
        ),
        cabinClass: cabin,
      });
    }
    const template = await readFile(
      join(__dirname, 'templates', 'iran-airtour-antalya-pax-list.xlsx'),
    );
    return {
      bytes: buildIranAirtourManifest(template, passengers),
      contractNumber: intake.snapshot.contractNumber,
    };
  }
}

@Controller('reservations/requests/:intakeId')
@UseGuards(AuthGuard)
export class ReservationManifestController {
  constructor(
    @Inject(ReservationManifestService)
    private readonly service: ReservationManifestService,
  ) {}

  @Get('manifest.xlsx')
  @Header('Cache-Control', 'private, no-store')
  async export(
    @Param('intakeId') id: string,
    @Req() req: AuthenticatedRequest,
  ) {
    const result = await this.service.export(
      id,
      req.actor,
      req.headers['x-request-id'] as string | undefined,
    );
    return new StreamableFile(result.bytes, {
      type: MANIFEST_XLSX_MIME,
      disposition: `attachment; filename="iran-airtour-${result.contractNumber.replace(/[^A-Za-z0-9_-]/g, '_')}.xlsx"`,
    });
  }
}

@Controller('reservations/manifests')
@UseGuards(AuthGuard)
export class ReservationManifestBatchController {
  constructor(
    @Inject(ReservationManifestService)
    private readonly service: ReservationManifestService,
  ) {}

  @Get('tickets')
  @Header('Cache-Control', 'private, no-store')
  async tickets(
    @Query('fromDate') fromDate: string,
    @Query('toDate') toDate: string,
    @Req() req: AuthenticatedRequest,
  ) {
    return {
      data: await this.service.listTickets({ fromDate, toDate }, req.actor),
    };
  }

  @Post('tickets/:offerId.xlsx')
  @Header('Cache-Control', 'private, no-store')
  async exportTicket(
    @Param('offerId') offerId: string,
    @Body() input: ReservationManifestTicketExportInputV1,
    @Headers('idempotency-key') idempotencyKey: string | undefined,
    @Req() req: AuthenticatedRequest,
    @Res({ passthrough: true }) response: Response,
  ) {
    const result = await this.service.exportTicket(
      offerId,
      input,
      idempotencyKey,
      req.actor,
      req.headers['x-request-id'] as string | undefined,
    );
    response.setHeader('X-Nora-Manifest-Contracts', result.contractCount);
    response.setHeader('X-Nora-Manifest-Passengers', result.passengerCount);
    response.setHeader(
      'X-Nora-Manifest-Skipped-Finance',
      result.skippedFinanceCount,
    );
    return new StreamableFile(result.bytes, {
      type: MANIFEST_XLSX_MIME,
      disposition: 'attachment; filename="' + result.fileName + '.xlsx"',
    });
  }

  @Post('iran-airtour-antalya.xlsx')
  @Header('Cache-Control', 'private, no-store')
  async exportRange(
    @Body() input: ReservationManifestBatchInput,
    @Headers('idempotency-key') idempotencyKey: string | undefined,
    @Req() req: AuthenticatedRequest,
    @Res({ passthrough: true }) response: Response,
  ) {
    const result = await this.service.exportRange(
      input,
      idempotencyKey,
      req.actor,
      req.headers['x-request-id'] as string | undefined,
    );
    response.setHeader('X-Nora-Manifest-Contracts', result.contractCount);
    response.setHeader('X-Nora-Manifest-Passengers', result.passengerCount);
    response.setHeader(
      'X-Nora-Manifest-Skipped-Finance',
      result.skippedFinanceCount,
    );
    const mode = result.includePreviouslyExported ? 'all' : 'new';
    return new StreamableFile(result.bytes, {
      type: MANIFEST_XLSX_MIME,
      disposition: `attachment; filename="iran-airtour-antalya-${result.fromDate}-${result.toDate}-${mode}.xlsx"`,
    });
  }
}
