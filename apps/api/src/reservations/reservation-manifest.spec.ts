import { inspectManifestTemplate } from '../common/manifest/workbook-template';
import { Readable } from 'node:stream';
import { contractFlightMetadata } from '@nora/contracts';
import { manifestJourneys } from './manifest-journeys';
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

describe('MANIFEST passenger permission gate', () => {
  it('stops before reading details without sensitive passenger permission', async () => {
    const workflow = {
      detail: vi
        .fn()
        .mockResolvedValue({ contractId: 'contract', snapshot: {} }),
    };
    const customers = { detail: vi.fn() };
    const directory = { cityReference: vi.fn() };
    const delivery = {
      readCustomerContract: vi
        .fn()
        .mockResolvedValue({ approved: false, version: 0 }),
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
        ],
      } as never),
    ).rejects.toThrow('مجوز تهیه MANIFEST');
    expect(delivery.readCustomerContract).not.toHaveBeenCalled();
    expect(directory.cityReference).not.toHaveBeenCalled();
    expect(customers.detail).not.toHaveBeenCalled();
  });
});

describe('MANIFEST ticket cards', () => {
  it('lists outbound and return tickets with the default when no template is assigned', async () => {
    const snapshot = {
      contractNumber: 'SC-TEST',
      passengerIds: ['p1', 'p2'],
      ticketSelections: [
        {
          offerId: 'outbound-offer',
          direction: 'OUTBOUND',
          originId: 'tehran',
          destinationId: 'antalya',
          departureAt: '2026-09-20T07:00:00.000Z',
          arrivalAt: '2026-09-20T10:00:00.000Z',
          carrierNameSnapshot: 'IRAN AIRTOUR',
          serviceNumberSnapshot: 'B9-9710',
          cabinClassCode: 'ECONOMY',
        },
        {
          offerId: 'return-offer',
          direction: 'RETURN',
          originId: 'antalya',
          destinationId: 'tehran',
          departureAt: '2026-09-27T07:00:00.000Z',
          arrivalAt: '2026-09-27T10:00:00.000Z',
          carrierNameSnapshot: 'NO TEMPLATE AIR',
          serviceNumberSnapshot: 'NT-10',
          cabinClassCode: 'ECONOMY',
        },
      ],
    };
    const directory = {
      cityReference: vi.fn(async (id: string) => ({
        name: id,
        englishName: id.toUpperCase(),
        countryId: id === 'tehran' ? 'ir' : 'tr',
      })),
      manifestTemplate: vi.fn(async (carrier: string) =>
        carrier === 'IRAN AIRTOUR'
          ? { id: 'template', name: 'Sparta', versionNumber: 2 }
          : null,
      ),
    };
    const service = new ReservationManifestService(
      {} as never,
      {} as never,
      directory as never,
      {
        readCustomerContract: vi.fn().mockResolvedValue({ approved: true }),
      } as never,
      {
        client: {
          reservationIntake: {
            findMany: vi.fn().mockResolvedValue([
              {
                id: 'intake',
                contractId: 'contract',
                contractVersion: 1,
                receivedAt: new Date(),
                snapshot,
              },
            ]),
          },
        },
      } as never,
      undefined,
      undefined,
      {
        detail: vi.fn(async (_kind: string, id: string) => ({
          data: { name: id === 'ir' ? 'ایران' : 'ترکیه' },
        })),
      } as never,
    );

    const cards = await service.listTickets(
      { fromDate: '2026-09-20', toDate: '2026-09-27' },
      {
        branchIds: ['branch'],
        permissions: ['reservations.read'],
      } as never,
    );

    expect(cards).toHaveLength(2);
    expect(cards[0]).toMatchObject({
      offerId: 'outbound-offer',
      direction: 'OUTBOUND',
      originId: 'tehran',
      destinationId: 'antalya',
      originCountryId: 'ir',
      originCountryName: 'ایران',
      destinationCountryId: 'tr',
      destinationCountryName: 'ترکیه',
      passengerCount: 2,
      template: { id: 'default', name: 'گزارش‌گیری', versionNumber: 1 },
      unavailableReason: null,
    });
    expect(cards[1]).toMatchObject({
      offerId: 'return-offer',
      direction: 'RETURN',
      template: { id: 'default', name: 'گزارش‌گیری', versionNumber: 1 },
    });
    expect(cards[1]?.unavailableReason).toBeNull();
    const routes = await service.listRoutes({
      branchIds: ['branch'],
      permissions: ['reservations.read'],
    } as never);
    expect(routes).toEqual(
      expect.arrayContaining([
        expect.objectContaining({
          originId: 'tehran',
          destinationId: 'antalya',
          originCountryName: 'ایران',
          destinationCountryName: 'ترکیه',
        }),
      ]),
    );
    expect(directory.manifestTemplate).not.toHaveBeenCalled();
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
        readCustomerContract: vi
          .fn()
          .mockResolvedValue({ approved: true, version: 1 }),
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

it('keeps missing airline fields blank and appends a linked warning sheet without passenger values', async () => {
  const template = await readFile(
    join(__dirname, 'templates', 'iran-airtour-antalya-pax-list.xlsx'),
  );
  const bytes = buildIranAirtourManifest(template, [
    {
      firstName: 'SYNTHETIC',
      lastName: '',
      gender: '',
      passengerType: '',
      birthDate: '',
      nationalId: '',
      nationality: '',
      passportNumber: '',
      passportIssuingCountry: '',
      birthCountry: '',
      passportExpiryDate: '',
      cabinClass: '',
    },
  ]);
  const files = unzipSync(bytes);
  expect(strFromU8(files['xl/worksheets/sheet1.xml']!)).toContain(
    '<x:t xml:space="preserve"></x:t>',
  );
  const warnings = strFromU8(files['xl/worksheets/nora-empty-cells.xml']!);
  expect(warnings).toContain('Last name');
  expect(warnings).toContain('>2<');
  expect(warnings).not.toContain('SYNTHETIC');
  expect(strFromU8(files['xl/workbook.xml']!)).toContain('name="EMPTY CELLS"');
  expect(strFromU8(files['xl/_rels/workbook.xml.rels']!)).toContain(
    'worksheets/nora-empty-cells.xml',
  );
  expect(strFromU8(files['[Content_Types].xml']!)).toContain(
    '/xl/worksheets/nora-empty-cells.xml',
  );
});

describe('floating flight manifest', () => {
  const originId = '10000000-0000-4000-8000-000000000001',
    destinationId = '10000000-0000-4000-8000-000000000002';
  function setup() {
    const snapshot = {
      contractId: 'contract',
      contractNumber: 'SYNTHETIC',
      passengerIds: ['p1', 'p2'],
      ticketSelections: [
        {
          offerId: 'catalog',
          serviceClientKey: 'catalog-key',
          direction: 'OUTBOUND',
          originId,
          destinationId,
          departureAt: '2026-11-08T08:00:00Z',
          arrivalAt: '2026-11-08T10:00:00Z',
          carrierNameSnapshot: 'TEST AIR',
          serviceNumberSnapshot: '123',
          cabinClassCode: 'ECONOMY',
        },
      ],
      serviceSelections: [
        {
          kind: 'FLIGHT',
          clientKey: 'floating',
          titleSnapshot: 'Floating',
          status: 'NEEDS_RESERVATION_CONFIRMATION',
          metadata: contractFlightMetadata({
            version: 1,
            direction: 'OUTBOUND',
            originId,
            destinationId,
            departureAt: '2026-11-08T08:00:00.000Z',
            arrivalAt: '2026-11-08T10:00:00.000Z',
            carrierNameSnapshot: 'TEST AIR',
            serviceNumberSnapshot: '456',
            cabinClassCode: 'ECONOMY',
          }),
        },
      ],
      passengerAssignments: [
        {
          customerId: 'p1',
          ageCategory: 'ADT',
          serviceClientKeys: ['floating'],
        },
        {
          customerId: 'p2',
          ageCategory: 'ADT',
          serviceClientKeys: ['catalog-key'],
        },
      ],
    };
    const row = {
      id: 'intake',
      contractId: 'contract',
      contractVersion: 1,
      status: 'QUEUED',
      snapshot,
    };
    const workflow = {
      detail: vi.fn(async () => ({
        ...row,
        workflow: { roomOrder: [], ageOverrides: {} },
      })),
    };
    const customers = {
      detail: vi.fn(async () => ({
        data: {
          firstName: 'Sample',
          lastName: 'Traveler',
          passportFirstName: 'SAMPLE',
          passportLastName: 'TRAVELER',
          birthDate: '1990-01-01',
          gender: 'M',
          passportNumber: 'A1234567',
          passportExpiryDate: '2030-01-01',
          nationalityCode: 'IRN',
        },
      })),
    };
    const documents = { readManifestTemplateReference: vi.fn() };
    const directory = {
      manifestTemplateById: vi.fn(async () => ({
        id: '10000000-0000-4000-8000-000000000099',
        name: 'Custom',
        versionNumber: 1,
        fileReferenceId: 'custom-file',
      })),
      cityReference: vi.fn(async (id: string) => ({
        name: id,
        englishName: id === originId ? 'TEHRAN' : 'ANTALYA',
        countryId: id === originId ? 'IR' : 'TR',
      })),
    };
    const client = {
      reservationIntake: { findMany: vi.fn(async () => [row]) },
      reservationManifestExport: {
        findUnique: vi.fn(async () => null),
        create: vi.fn(),
      },
    };
    const tickets = {
      manifestSelection: vi.fn(async () => null),
      manifestInventory: vi.fn(async () => []),
    };
    const service = new ReservationManifestService(
      workflow as never,
      customers as never,
      directory as never,
      {} as never,
      { client } as never,
      documents as never,
      tickets as never,
    );
    const actor = {
      userId: 'user',
      branchIds: ['branch'],
      permissions: [
        'reservations.read',
        'reservations.documents.manage',
        'customers.read',
        'customers.sensitive.read',
      ],
    };
    return {
      service,
      snapshot,
      row,
      client,
      tickets,
      actor,
      customers,
      directory,
      documents,
    };
  }
  const range = { fromDate: '2026-11-08', toDate: '2026-11-08' };
  it('defaults to charter and lists only floating flights when selected, without catalog/template lookups for floating identities', async () => {
    const f = setup();
    expect(
      (await f.service.listTickets(range, f.actor as never)).map(
        (c) => c.offerId,
      ),
    ).toEqual(['catalog']);
    f.tickets.manifestSelection.mockClear();
    f.tickets.manifestInventory.mockClear();
    const cards = await f.service.listTickets(
      { ...range, flightSupplyType: 'FLOATING' },
      f.actor as never,
    );
    expect(cards).toHaveLength(1);
    expect(cards[0]).toMatchObject({
      flightSupplyType: 'FLOATING',
      passengerCount: 1,
      template: { id: 'default' },
    });
    expect(f.tickets.manifestSelection).not.toHaveBeenCalled();
    expect(f.tickets.manifestInventory).toHaveBeenCalledWith([], ['branch']);
    await expect(
      f.service.listTickets(
        { ...range, flightSupplyType: 'BAD' },
        f.actor as never,
      ),
    ).rejects.toThrow();
  });
  it('exports assigned floating passengers in the same default workbook as charter', async () => {
    const f = setup();
    const id = manifestJourneys(f.snapshot as never).find(
      (t) => t.flightSupplyType === 'FLOATING',
    )!.offerId;
    const result = await f.service.exportTicket(
      id,
      { ...range, includePreviouslyExported: true },
      'synthetic-key',
      f.actor as never,
    );
    expect(result.passengerCount).toBe(1);
    expect(result.contractCount).toBe(1);
    const files = unzipSync(result.bytes);
    const sheet = strFromU8(files['xl/worksheets/sheet1.xml']!);
    expect(sheet).toContain('SAMPLE');
    expect(sheet).toContain('456');
    expect(f.customers.detail).toHaveBeenCalledWith(
      'p1',
      f.actor,
      undefined,
      'customer-verification',
    );
    expect(f.tickets.manifestSelection).not.toHaveBeenCalled();
    expect(f.client.reservationManifestExport.create).toHaveBeenCalled();
  });
  it.each(['OUTBOUND', 'RETURN'] as const)(
    'exports the selected floating %s leg in PNL, Report and an uploaded template without requiring a catalog offer',
    async (direction) => {
      for (const format of ['DEFAULT_MANIFEST', 'REPORT', 'CUSTOM'] as const) {
        const f = setup();
        f.snapshot.ticketSelections = [];
        f.snapshot.serviceSelections[0]!.metadata = contractFlightMetadata({
          version: 1,
          direction,
          originId: direction === 'OUTBOUND' ? originId : destinationId,
          destinationId: direction === 'OUTBOUND' ? destinationId : originId,
          departureAt: '2026-11-08T08:00:00.000Z',
          arrivalAt: '2026-11-08T10:00:00.000Z',
          carrierNameSnapshot: 'FLOATING AIR',
          serviceNumberSnapshot: direction === 'OUTBOUND' ? 'FLT100' : 'FLT101',
          cabinClassCode: 'BUSINESS',
        });
        const template = await readFile(
          join(__dirname, 'templates', 'iran-airtour-antalya-pax-list.xlsx'),
        );
        f.documents.readManifestTemplateReference.mockResolvedValue({
          stream: Readable.from([template]),
        });
        const [card] = await f.service.listTickets(
          { ...range, flightSupplyType: 'FLOATING' },
          f.actor as never,
        );
        expect(card?.direction).toBe(direction);
        const result = await f.service.exportTicket(
          card!.offerId,
          {
            ...range,
            includePreviouslyExported: true,
            ...(format === 'CUSTOM'
              ? { manifestTemplateId: '10000000-0000-4000-8000-000000000099' }
              : { builtinTemplate: format }),
          },
          'synthetic-' + format,
          f.actor as never,
        );
        expect(result.passengerCount).toBe(1);
        expect(result.contractCount).toBe(1);
        expect(result.fileExtension).toBe(
          format === 'DEFAULT_MANIFEST' ? 'xlsm' : 'xlsx',
        );
        const layout = inspectManifestTemplate(result.bytes);
        const first = layout.parsed.find(
          (row) => row.number === layout.headerRow + 1,
        );
        expect(first?.cells.some((cell) => cell.value === 'SAMPLE')).toBe(true);
        expect(f.customers.detail).toHaveBeenCalledOnce();
        expect(f.customers.detail).toHaveBeenCalledWith(
          'p1',
          f.actor,
          undefined,
          'customer-verification',
        );
        expect(f.tickets.manifestSelection).not.toHaveBeenCalled();
        if (format === 'CUSTOM')
          expect(
            f.documents.readManifestTemplateReference,
          ).toHaveBeenCalledWith('custom-file', f.actor);
        else
          expect(
            f.documents.readManifestTemplateReference,
          ).not.toHaveBeenCalled();
      }
    },
  );
  it('shares a stable identity across contracts but separates different routes or departure times', () => {
    const f = setup();
    const first = manifestJourneys(f.snapshot as never).find(
      (t) => t.flightSupplyType === 'FLOATING',
    )!;
    const second = structuredClone(f.snapshot);
    second.contractId = 'another';
    second.serviceSelections[0]!.clientKey = 'other-key';
    expect(
      manifestJourneys(second as never).find(
        (t) => t.flightSupplyType === 'FLOATING',
      )!.offerId,
    ).toBe(first.offerId);
    second.serviceSelections[0]!.metadata = {
      ...second.serviceSelections[0]!.metadata,
      flightDepartureAt: '2026-11-08T09:00:00.000Z',
    };
    expect(
      manifestJourneys(second as never).find(
        (t) => t.flightSupplyType === 'FLOATING',
      )!.offerId,
    ).not.toBe(first.offerId);
  });
});
