import { readFile } from 'node:fs/promises';
import { join } from 'node:path';
import { strFromU8, unzipSync } from 'fflate';
import { describe, expect, it, vi } from 'vitest';
import { buildIranAirtourManifest } from './reservation-manifest';
import { ReservationManifestService } from './reservation-manifest';

describe('Iran Airtour Antalya MANIFEST', () => {
  it('keeps the airline workbook and fills the first passenger without formulas', async () => {
    const template = await readFile(
      join(__dirname, 'templates', 'iran-airtour-antalya-pax-list.xlsx'),
    );
    const bytes = buildIranAirtourManifest(template, [
      {
        firstName: 'ALI',
        lastName: 'EXAMPLE',
        gender: 'MR',
        passengerType: 'ADULT',
        birthDate: '1990-02-03',
        nationalId: '0012345678',
        nationality: 'IRN',
        passportNumber: 'X1234567',
        passportIssuingCountry: 'IRN',
        birthCountry: 'IRN',
        passportExpiryDate: '2030-04-05',
        cabinClass: 'Y',
      },
    ]);
    const files = unzipSync(bytes);
    const workbook = strFromU8(files['xl/workbook.xml']!);
    const sheet = strFromU8(files['xl/worksheets/sheet1.xml']!);
    expect(Object.keys(files)).toContain('xl/worksheets/sheet7.xml');
    expect(workbook).toContain('name="Pax List"');
    expect(workbook).toContain('name="Country"');
    expect(sheet).toContain('ALI');
    expect(sheet).toContain('X1234567');
    expect(sheet).toContain('1990/02/03');
    expect(sheet).not.toContain('<x:f>');
  });

  it('rejects an empty or oversized passenger list', async () => {
    const template = await readFile(
      join(__dirname, 'templates', 'iran-airtour-antalya-pax-list.xlsx'),
    );
    expect(() => buildIranAirtourManifest(template, [])).toThrow(
      'مسافری برای ساخت MANIFEST وجود ندارد.',
    );
    const passenger = {
      firstName: 'ALI',
      lastName: 'EXAMPLE',
      gender: 'MR' as const,
      passengerType: 'ADULT' as const,
      birthDate: '1990-02-03',
      nationalId: '',
      nationality: 'IRN',
      passportNumber: 'X1234567',
      passportIssuingCountry: 'IRN',
      birthCountry: 'IRN',
      passportExpiryDate: '2030-04-05',
      cabinClass: 'Y',
    };
    expect(() =>
      buildIranAirtourManifest(
        template,
        Array.from({ length: 62 }, () => passenger),
      ),
    ).toThrow('حداکثر ۶۱ مسافر');
  });
});

describe('MANIFEST financial delivery gate', () => {
  it('stops before reading travel or passenger details while Finance is locked', async () => {
    const workflow = {
      detail: vi.fn().mockResolvedValue({ snapshot: {} }),
    };
    const customers = { detail: vi.fn() };
    const directory = { cityReference: vi.fn() };
    const delivery = {
      read: vi.fn().mockResolvedValue({ approved: false, version: 0 }),
    };
    const service = new ReservationManifestService(
      workflow as never,
      customers as never,
      directory as never,
      delivery as never,
      { client: {} } as never,
    );
    await expect(
      service.export('request', {
        branchIds: ['branch'],
        permissions: [
          'reservations.read',
          'reservations.documents.manage',
          'customers.read',
          'customers.sensitive.read',
        ],
      } as never),
    ).rejects.toThrow('تأیید تحویل مدارک');
    expect(delivery.read).toHaveBeenCalledWith('request');
    expect(directory.cityReference).not.toHaveBeenCalled();
    expect(customers.detail).not.toHaveBeenCalled();
  });
});

describe('MANIFEST date-range history', () => {
  it('puts only a newly arrived contract in the next new-only export', async () => {
    const makeSnapshot = (contractNumber: string, customerId: string) => ({
      version: 1,
      requestId: `request-${contractNumber}`,
      contractId: `contract-${contractNumber}`,
      contractNumber,
      contractVersion: 1,
      customerId,
      passengerIds: [customerId],
      passengerAssignments: [
        {
          customerId,
          ageCategory: 'ADL',
          serviceClientKeys: ['flight'],
        },
      ],
      serviceSelections: [],
      selectedTicketOfferIds: ['flight'],
      hotelSelection: { cityId: 'antalya' },
      ticketSelections: [
        {
          serviceClientKey: 'flight',
          direction: 'OUTBOUND',
          offerId: 'offer',
          originId: 'tehran',
          destinationId: 'antalya',
          departureAt: '2026-09-20T07:00:00.000Z',
          arrivalAt: '2026-09-20T10:00:00.000Z',
          carrierNameSnapshot: 'IRAN AIRTOUR',
          serviceNumberSnapshot: 'B9-9710',
          cabinClassCode: 'ECONOMY',
        },
      ],
      createdAt: '2026-09-12T00:00:00.000Z',
    });
    const oldSnapshot = makeSnapshot('SC-OLD', 'customer-old');
    const newSnapshot = makeSnapshot('SC-NEW', 'customer-new');
    const intakes = [
      {
        id: 'intake-old',
        contractId: 'contract-old',
        contractVersion: 1,
        branchId: 'branch',
        receivedAt: new Date('2026-09-10T00:00:00Z'),
        snapshot: oldSnapshot,
      },
      {
        id: 'intake-new',
        contractId: 'contract-new',
        contractVersion: 1,
        branchId: 'branch',
        receivedAt: new Date('2026-09-12T00:00:00Z'),
        snapshot: newSnapshot,
      },
    ];
    const workflow = {
      detail: vi.fn(async (id: string) => ({
        id,
        snapshot: id === 'intake-old' ? oldSnapshot : newSnapshot,
        workflow: { roomOrder: [], ageOverrides: {} },
      })),
    };
    const customers = {
      detail: vi.fn(async (id: string) => ({
        data: {
          displayName: id,
          passportFirstName: id === 'customer-new' ? 'NEW' : 'OLD',
          passportLastName: 'PASSENGER',
          gender: 'M',
          birthDate: '1990-01-02',
          nationalId: '0012345678',
          nationalityCode: 'IRN',
          passportNumber: 'X1234567',
          passportIssuingCountryCode: 'IRN',
          birthCountryCode: 'IRN',
          passportExpiryDate: '2030-01-02',
        },
      })),
    };
    const create = vi.fn().mockResolvedValue({});
    const database = {
      client: {
        reservationManifestExport: {
          findUnique: vi.fn().mockResolvedValue(null),
          create,
        },
        reservationIntake: { findMany: vi.fn().mockResolvedValue(intakes) },
        reservationManifestExportItem: {
          findMany: vi.fn().mockResolvedValue([{ intakeId: 'intake-old' }]),
        },
      },
    };
    const service = new ReservationManifestService(
      workflow as never,
      customers as never,
      {
        cityReference: vi
          .fn()
          .mockResolvedValue({ name: 'آنتالیا', englishName: 'ANTALYA' }),
      } as never,
      {
        read: vi.fn().mockResolvedValue({ approved: true, version: 1 }),
      } as never,
      database as never,
    );
    const result = await service.exportRange(
      {
        fromDate: '2026-09-20',
        toDate: '2026-09-20',
        includePreviouslyExported: false,
      },
      'request-key',
      {
        userId: 'user',
        branchIds: ['branch'],
        permissions: [
          'reservations.read',
          'reservations.documents.manage',
          'customers.read',
          'customers.sensitive.read',
        ],
      } as never,
    );

    expect(result.contractCount).toBe(1);
    expect(result.passengerCount).toBe(1);
    expect(workflow.detail).toHaveBeenCalledWith('intake-new', ['branch']);
    const sheet = strFromU8(
      unzipSync(result.bytes)['xl/worksheets/sheet1.xml']!,
    );
    expect(sheet).toContain('NEW');
    expect(sheet).not.toContain('OLD');
    expect(create).toHaveBeenCalledWith(
      expect.objectContaining({
        data: expect.objectContaining({
          contractCount: 1,
          items: {
            create: [
              expect.objectContaining({
                intakeId: 'intake-new',
                contractId: 'contract-new',
              }),
            ],
          },
        }),
      }),
    );
  });
});
