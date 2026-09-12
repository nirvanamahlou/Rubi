import {
  BadRequestException,
  Controller,
  ForbiddenException,
  Get,
  Header,
  Inject,
  Injectable,
  Param,
  Req,
  StreamableFile,
  UseGuards,
} from '@nestjs/common';
import { readFile } from 'node:fs/promises';
import { join } from 'node:path';
import { strFromU8, strToU8, unzipSync, zipSync } from 'fflate';
import type { AuthenticatedActor, CustomerDetail } from '@rubi/contracts';
import { AuthGuard } from '../iam/auth.guard';
import type { AuthenticatedRequest } from '../iam/iam.types';
import { CustomerService } from '../customers/customer.service';
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
  ) {}

  async export(id: string, actor: AuthenticatedActor, traceId?: string) {
    for (const permission of [
      'reservations.read',
      'reservations.documents.manage',
      'customers.read',
      'customers.sensitive.read',
    ])
      if (!actor.permissions.includes(permission as never))
        throw new ForbiddenException('مجوز تهیه MANIFEST مسافران وجود ندارد.');
    const intake = await this.workflow.detail(id, actor.branchIds);
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
