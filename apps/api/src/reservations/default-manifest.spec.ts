import type { SalesServiceInput } from '@nora/contracts';
import { readFile } from 'node:fs/promises';
import { join } from 'node:path';
import { Readable } from 'node:stream';
import { strFromU8, unzipSync } from 'fflate';
import { describe, expect, it, vi } from 'vitest';
import {
  buildDefaultManifest,
  defaultManifestAge,
  type DefaultManifestRow,
} from './default-manifest';
import { ReservationManifestService } from './reservation-manifest';

const actor = {
  userId: 'user',
  branchIds: ['branch'],
  permissions: [
    'reservations.read',
    'reservations.documents.manage',
    'customers.read',
    'customers.sensitive.read',
  ],
} as never;
const range = {
  fromDate: '2026-10-01',
  toDate: '2026-10-01',
  includePreviouslyExported: true,
};
const sheet = (bytes: Uint8Array) =>
  strFromU8(unzipSync(bytes)['xl/worksheets/sheet1.xml']!);

function fixture(
  international = false,
  selectedTemplate: string | null = null,
) {
  const snapshot = {
    contractId: 'contract',
    contractNumber: 'SC-SYNTHETIC',
    serviceSelections: [] as SalesServiceInput[],
    passengerIds: ['p1', 'hotel-only'],
    passengerAssignments: [
      { customerId: 'p1', ageCategory: 'ADT', serviceClientKeys: ['flight'] },
      {
        customerId: 'hotel-only',
        ageCategory: 'ADT',
        serviceClientKeys: ['hotel'],
      },
    ],
    ticketSelections: [
      {
        serviceClientKey: 'flight',
        direction: 'OUTBOUND',
        offerId: 'offer',
        originId: 'origin',
        destinationId: 'destination',
        departureAt: '2026-09-30T22:00:00Z',
        arrivalAt: '2026-10-01T01:00:00Z',
        carrierNameSnapshot: 'Synthetic Air',
        serviceNumberSnapshot: 'TEST-1',
        cabinClassCode: 'BUSINESS',
      },
    ],
  };
  const intake = {
    id: 'intake',
    contractId: 'contract',
    contractVersion: 1,
    branchId: 'branch',
    snapshot,
  };
  const workflow = {
    detail: vi.fn().mockResolvedValue({
      ...intake,
      workflow: { roomOrder: ['hotel-only', 'p1'], ageOverrides: {} },
    }),
  };
  const customers = {
    detail: vi.fn().mockResolvedValue({
      data: {
        displayName: 'Synthetic Passenger',
        firstName: 'علی',
        lastName: 'نمونه',
        nationalId: '0012345678',
        birthDate: '1990-01-01',
        gender: 'M',
        nationalityCode: 'IRN',
        ...(international || selectedTemplate
          ? {
              passportFirstName: 'ALI',
              passportLastName: 'EXAMPLE',
              passportNumber: 'X000123',
              passportExpiryDate: '2030-01-01',
              passportIssuingCountryCode: 'IRN',
              birthCountryCode: 'IRN',
            }
          : {}),
      },
    }),
  };
  const directory = {
    cityReference: vi.fn(async (id: string) => ({
      name: id,
      countryId: international && id === 'destination' ? 'tr' : 'ir',
    })),
    manifestTemplateById: vi.fn().mockResolvedValue({
      id: 'chosen',
      name: 'Synthetic Air — Destination',
      versionNumber: 2,
      fileReferenceId: 'file',
    }),
  };
  const finance = {
    readCustomerContract: vi.fn().mockResolvedValue({ approved: true }),
  };
  const database = {
    client: {
      reservationIntake: { findMany: vi.fn().mockResolvedValue([intake]) },
      reservationManifestExport: {
        findUnique: vi.fn().mockResolvedValue(null),
        create: vi.fn().mockResolvedValue({}),
      },
      reservationManifestExportItem: {
        findMany: vi.fn().mockResolvedValue([]),
      },
    },
  };
  const documents = { readManifestTemplateReference: vi.fn() };
  const tickets = {
    manifestSelection: vi.fn().mockResolvedValue(selectedTemplate),
  };
  const service = new ReservationManifestService(
    workflow as never,
    customers as never,
    directory as never,
    finance as never,
    database as never,
    documents as never,
    tickets as never,
  );
  return {
    service,
    snapshot,
    workflow,
    customers,
    directory,
    finance,
    database,
    documents,
    tickets,
  };
}

describe('default ticket manifest', () => {
  it('exports domestic names and national ID without requiring passport details, and only assigned passengers', async () => {
    const f = fixture();
    const result = await f.service.exportTicket('offer', range, 'key', actor);
    const xml = sheet(result.bytes);
    expect(result.passengerCount).toBe(1);
    for (const value of [
      'نام قرارداد',
      'SC-SYNTHETIC',
      'نام خانوادگی',
      'علی',
      'نمونه',
      '2026-10-01',
      'TEST-1',
      'Synthetic Air',
      'بزرگسال',
      'IRN',
      '1990-01-01',
      'mr',
      'destination',
      'BUSINESS',
      '0012345678',
    ]) {
      expect(xml).toContain(value);
    }
    expect(xml).not.toContain('شماره پاسپورت');
    expect(xml).toContain('A1:M2');
    expect(f.customers.detail).toHaveBeenCalledExactlyOnceWith(
      'p1',
      actor,
      undefined,
      'customer-verification',
    );
    expect(f.documents.readManifestTemplateReference).not.toHaveBeenCalled();
    expect(
      f.database.client.reservationManifestExport.create,
    ).toHaveBeenCalledWith(
      expect.objectContaining({
        data: expect.objectContaining({ passengerCount: 1, contractCount: 1 }),
      }),
    );
  });

  it('uses the established blue header with white text and a left-to-right sheet', async () => {
    const result = await fixture().service.exportTicket(
      'offer',
      range,
      'key',
      actor,
    );
    const files = unzipSync(result.bytes);
    const styles = strFromU8(files['xl/styles.xml']!);
    expect(styles).toContain('fgColor rgb="FF1D4ED8"');
    expect(styles).toContain('color rgb="FFFFFFFF"');
    expect(styles).toContain('fontId="1" fillId="2"');
    expect(sheet(result.bytes)).toContain('rightToLeft="0"');
    expect(sheet(result.bytes)).toContain('s="1" t="inlineStr"');
  });

  it.each(['CHD', 'INF'])(
    'exports the assigned %s age and female title',
    async (age) => {
      const f = fixture();
      f.snapshot.passengerAssignments[0]!.ageCategory = age;
      const customer = (await f.customers.detail()).data;
      f.customers.detail.mockResolvedValue({
        data: { ...customer, gender: 'F' },
      });
      const result = await f.service.exportTicket('offer', range, 'key', actor);
      expect(sheet(result.bytes)).toContain(age === 'CHD' ? 'کودک' : 'نوزاد');
      expect(sheet(result.bytes)).toContain('>mrs<');
    },
  );

  it('keeps the operational age override ahead of the contract age', async () => {
    const f = fixture();
    const intake = await f.workflow.detail();
    f.workflow.detail.mockResolvedValue({
      ...intake,
      workflow: { ...intake.workflow, ageOverrides: { p1: 'CHILD' } },
    });
    expect(
      sheet((await f.service.exportTicket('offer', range, 'key', actor)).bytes),
    ).toContain('کودک');
  });

  it.each([
    ['2024-10-02', 'نوزاد'],
    ['2024-10-01', 'کودک'],
    ['2014-10-02', 'کودک'],
    ['2014-10-01', 'بزرگسال'],
  ])('derives legacy age on the actual travel day for %s', (birth, label) => {
    expect(defaultManifestAge(undefined, birth, '2026-10-01')).toBe(label);
  });

  it.each(['BUS', 'TRAIN'] as const)(
    'lists and exports %s with the proper columns and only assigned passengers',
    async (kind) => {
      const f = fixture();
      f.snapshot.ticketSelections = [];
      f.snapshot.serviceSelections = [
        {
          clientKey: 'ground',
          kind,
          titleSnapshot: 'Synthetic Transport',
          metadata: {
            date: '2026-10-01',
            pickup: 'تهران',
            dropoff: 'شیراز',
            carrierName: 'Synthetic Operator',
            serviceNumber: 'GROUND-1',
            cabinClass: 'VIP',
          },
        },
      ];
      f.snapshot.passengerAssignments[0]!.serviceClientKeys = ['ground'];
      f.snapshot.passengerAssignments[0]!.ageCategory = 'CHD';
      const cards = await f.service.listTickets(range, actor);
      expect(cards).toHaveLength(1);
      expect(cards[0]).toMatchObject({
        transportType: kind,
        originName: 'تهران',
        destinationName: 'شیراز',
        passengerCount: 1,
        template: { id: 'default' },
      });
      const result = await f.service.exportTicket(
        cards[0]!.offerId,
        { ...range, includePreviouslyExported: false },
        'key',
        actor,
      );
      const xml = sheet(result.bytes);
      for (const value of [
        'مقصد',
        'شیراز',
        'تاریخ حرکت',
        'GROUND-1',
        'Synthetic Operator',
        'کودک',
        'mr',
        '0012345678',
      ])
        expect(xml).toContain(value);
      expect(xml).toContain(kind === 'BUS' ? 'شرکت اتوبوسرانی' : 'شرکت ریلی');
      expect(xml).toContain(kind === 'BUS' ? 'کلاس اتوبوس' : 'کلاس قطار');
      expect(xml).not.toContain('ایرلاین');
      expect(xml).not.toContain('کلاس پروازی');
      expect(f.tickets.manifestSelection).not.toHaveBeenCalled();
      expect(f.directory.cityReference).not.toHaveBeenCalled();
      expect(
        f.database.client.reservationManifestExportItem.findMany,
      ).toHaveBeenCalledWith(
        expect.objectContaining({
          where: expect.objectContaining({
            export: {
              idempotencyKey: {
                startsWith: 'ticket:' + cards[0]!.offerId + ':',
              },
            },
          }),
        }),
      );
      expect(result.passengerCount).toBe(1);
    },
  );

  it('keeps ground financial approval before passenger reads', async () => {
    const f = fixture();
    f.snapshot.ticketSelections = [];
    f.snapshot.serviceSelections = [
      {
        clientKey: 'ground',
        kind: 'BUS',
        titleSnapshot: 'Bus',
        metadata: { date: '2026-10-01', pickup: 'A', dropoff: 'B' },
      },
    ];
    f.finance.readCustomerContract.mockResolvedValue({ approved: false });
    const [card] = await f.service.listTickets(range, actor);
    await expect(
      f.service.exportTicket(card!.offerId, range, 'key', actor),
    ).rejects.toThrow('تأیید مالی');
    expect(f.customers.detail).not.toHaveBeenCalled();
  });

  it('adds passport columns for international routes', async () => {
    const result = await fixture(true).service.exportTicket(
      'offer',
      range,
      'key',
      actor,
    );
    const xml = sheet(result.bytes);
    expect(xml).toContain('A1:O2');
    for (const value of [
      'شماره پاسپورت',
      'تاریخ انقضای پاسپورت',
      'X000123',
      '2030-01-01',
      'ALI',
      'EXAMPLE',
    ])
      expect(xml).toContain(value);
  });

  it('rejects incomplete international passports without recording a successful export', async () => {
    const f = fixture(true);
    f.customers.detail.mockResolvedValue({
      data: { firstName: 'علی' },
    } as never);
    await expect(
      f.service.exportTicket('offer', range, 'key', actor),
    ).rejects.toThrow('پاسپورت');
    expect(
      f.database.client.reservationManifestExport.create,
    ).not.toHaveBeenCalled();
  });

  it('keeps the financial gate before reading passengers or template files', async () => {
    const f = fixture();
    f.finance.readCustomerContract.mockResolvedValue({ approved: false });
    await expect(
      f.service.exportTicket('offer', range, 'key', actor),
    ).rejects.toThrow('تأیید مالی');
    expect(f.customers.detail).not.toHaveBeenCalled();
    expect(f.documents.readManifestTemplateReference).not.toHaveBeenCalled();
  });

  it('uses the explicitly chosen clean workbook through Documents', async () => {
    const f = fixture(false, 'chosen');
    const template = await readFile(
      join(__dirname, 'templates', 'iran-airtour-antalya-pax-list.xlsx'),
    );
    f.documents.readManifestTemplateReference.mockResolvedValue({
      stream: Readable.from([template]),
    });
    const result = await f.service.exportTicket('offer', range, 'key', actor);
    expect(f.tickets.manifestSelection).toHaveBeenCalledWith('offer', [
      'branch',
    ]);
    expect(f.directory.manifestTemplateById).toHaveBeenCalledWith(
      'chosen',
      '2026-10-01',
    );
    expect(f.documents.readManifestTemplateReference).toHaveBeenCalledWith(
      'file',
      actor,
    );
    expect(sheet(result.bytes)).toContain('X000123');
    expect(result.passengerCount).toBe(1);
  });

  it('marks only an invalid selected template unavailable and never silently exports the default', async () => {
    const f = fixture(false, 'chosen');
    f.directory.manifestTemplateById.mockRejectedValue(
      new Error('قالب انتخاب‌شده منقضی شده است.'),
    );
    const cards = await f.service.listTickets(range, actor);
    expect(cards[0]).toMatchObject({
      template: null,
      unavailableReason: 'قالب انتخاب‌شده منقضی شده است.',
    });
    await expect(
      f.service.exportTicket('offer', range, 'key', actor),
    ).rejects.toThrow('منقضی');
    expect(f.customers.detail).not.toHaveBeenCalled();
    expect(f.documents.readManifestTemplateReference).not.toHaveBeenCalled();
  });

  it('includes assigned flight passengers missing from a partial hotel room order', async () => {
    const f = fixture();
    const intake = await f.workflow.detail();
    f.workflow.detail.mockResolvedValue({
      ...intake,
      workflow: { roomOrder: ['hotel-only'], ageOverrides: {} },
    });
    const result = await f.service.exportTicket('offer', range, 'key', actor);
    expect(result.passengerCount).toBe(1);
    expect(sheet(result.bytes)).toContain('0012345678');
  });

  it('skips previously exported contracts for a new-only request', async () => {
    const f = fixture();
    f.database.client.reservationManifestExportItem.findMany.mockResolvedValue([
      { intakeId: 'intake' },
    ] as never);
    await expect(
      f.service.exportTicket(
        'offer',
        { ...range, includePreviouslyExported: false },
        'key',
        actor,
      ),
    ).rejects.toThrow('قرارداد جدید');
    expect(f.customers.detail).not.toHaveBeenCalled();
  });

  it('preserves zero-prefixed identifiers and escapes formula-like text in a large workbook', () => {
    const row: DefaultManifestRow = {
      contractName: '=HYPERLINK("x")',
      destination: 'Synthetic Destination',
      firstName: '<&>',
      lastName: 'EXAMPLE',
      flightDate: '2026-10-01',
      ticket: 'TEST',
      airline: 'Synthetic',
      ageCategory: 'کودک',
      nationality: 'IRN',
      birthDate: '',
      gender: '',
      cabinClass: 'ECONOMY',
      nationalId: '0012345678',
      passportNumber: '',
      passportExpiryDate: '',
    };
    const xml = sheet(
      buildDefaultManifest(
        Array.from({ length: 100 }, () => row),
        false,
      ),
    );
    expect(xml).toContain('A1:M101');
    expect(xml).toContain('0012345678');
    expect(xml).toContain('&lt;&amp;&gt;');
    expect(xml).toContain('=HYPERLINK(&quot;x&quot;)');
    expect(xml).not.toContain('<f>');
    expect(() => buildDefaultManifest([], false)).toThrow('مسافری');
  });
});
