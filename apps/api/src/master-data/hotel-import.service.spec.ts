import type { AuthenticatedActor } from '@nora/contracts';
import { MasterHotelImportStatus } from '@nora/database';
import { strToU8, zipSync } from 'fflate';
import { createHash } from 'node:crypto';
import { readFileSync } from 'node:fs';
import { mkdir, writeFile } from 'node:fs/promises';
import { join, resolve } from 'node:path';
import { describe, expect, it, vi } from 'vitest';

import type { DatabaseService } from '../database/database.service';
import { HOTEL_IMPORT_HEADERS } from './hotel-import.parser';
import { HotelImportService } from './hotel-import.service';

const actor: AuthenticatedActor = {
  userId: '11111111-1111-4111-8111-111111111111',
  sessionId: '22222222-2222-4222-8222-222222222222',
  branchIds: ['33333333-3333-4333-8333-333333333333'],
  permissions: ['master_data.import'],
};

function escapeXml(value: string) {
  return value.replace(/&/g, '&amp;').replace(/</g, '&lt;');
}

function cell(reference: string, value: string) {
  return value
    ? `<c r="${reference}" t="inlineStr"><is><t>${escapeXml(value)}</t></is></c>`
    : `<c r="${reference}"/>`;
}

function workbook(requiredOnly = false, extended = false) {
  const values = [
    'HTL-BODRUM-IMPORT-001',
    'Bodrum Marina Hotel',
    'بدروم',
    'بدروم',
    'Cumhuriyet Cd. No: 42',
    '5',
    '',
    '',
    '',
    '',
    'هتل ساحلی نزدیک مارینا',
    '',
    'ورود از ساعت ۱۴',
    '',
    '',
    'منتشرشده',
    'TRUE',
    '',
  ];
  values.push(
    extended ? 'www.hotel.example' : '',
    extended ? 'خیر' : '',
    extended ? 'هتل مارینا' : '',
  );
  if (requiredOnly)
    values.forEach((_, index) => {
      if (index !== 1 && index !== 3) values[index] = '';
    });
  const row = (number: number, source: readonly string[]) =>
    source
      .map((value, index) =>
        cell(`${String.fromCharCode(65 + index)}${number}`, value),
      )
      .join('');
  return Buffer.from(
    zipSync({
      '[Content_Types].xml': strToU8('<Types/>'),
      'xl/workbook.xml': strToU8(
        '<workbook><sheets><sheet name="Hotels"/><sheet name="راهنما"/></sheets></workbook>',
      ),
      'xl/worksheets/sheet1.xml': strToU8(
        `<worksheet><sheetData><row>${row(1, HOTEL_IMPORT_HEADERS)}</row><row>${row(2, values)}</row></sheetData></worksheet>`,
      ),
    }),
  );
}

describe('HotelImportService commit persistence', () => {
  it.each([
    'legacy',
    'downloadable template',
    '14-column template',
    'required fields only',
    'extended columns',
  ])(
    'persists every valid parsed row from %s and writes audit records',
    async (source) => {
      const reduced = source === '14-column template';
      const extended = source === 'extended columns';
      const supplied = source === 'downloadable template' || reduced;
      const requiredOnly = source === 'required fields only';
      const buffer = supplied
        ? readFileSync(
            resolve(
              process.cwd(),
              reduced
                ? 'test/fixtures/hotel-master-template-14-columns.xlsx'
                : 'test/fixtures/hotel-master-template-18-columns.xlsx',
            ),
          )
        : workbook(requiredOnly, extended);
      const expectedHotels = supplied
        ? [
            {
              code: reduced
                ? expect.stringMatching(/^HOTEL_[A-F0-9]{12}$/)
                : 'HTL-KUS-001',
              name: 'Charisma De Luxe Hotel',
              isActive: true,
            },
            {
              code: reduced
                ? expect.stringMatching(/^HOTEL_[A-F0-9]{12}$/)
                : 'HTL-KUS-002',
              name: 'Ramada Resort Kusadasi',
              isActive: true,
            },
            {
              code: reduced
                ? expect.stringMatching(/^HOTEL_[A-F0-9]{12}$/)
                : 'HTL-KUS-003',
              name: 'Signature Blue Resort',
              isActive: false,
            },
          ]
        : [
            {
              code: requiredOnly
                ? expect.stringMatching(/^HOTEL_[A-F0-9]{12}$/)
                : 'HTL-BODRUM-IMPORT-001',
              name: extended ? 'هتل مارینا' : 'Bodrum Marina Hotel',
              isActive: true,
            },
          ];
      const previewToken = 'preview-token';
      const stagingFileName = `hotel-import-service-${supplied ? 'template' : 'legacy'}-test.xlsx`;
      const committedAt = new Date('2026-09-06T01:00:00.000Z');
      const session = {
        id: '44444444-4444-4444-8444-444444444444',
        status: MasterHotelImportStatus.PREVIEW_READY,
        previewExpiresAt: new Date(Date.now() + 60_000),
        previewTokenHash: '',
        stagingFileName,
        originalFileName: 'HOTEL_IMPORT_V1.xlsx',
        fileHash: createHash('sha256').update(buffer).digest('hex'),
        cityId: '55555555-5555-4555-8555-555555555555',
        city: { name: supplied ? 'کوش اداسی' : 'بدروم' },
        rowCount: expectedHotels.length,
        validCount: expectedHotels.length,
        invalidCount: 0,
        duplicateCount: 0,
        createdCount: 0,
        updatedCount: 0,
        skippedCount: 0,
        committedAt: null,
      };
      const tx = {
        masterHotelImportSession: {
          updateMany: vi.fn().mockResolvedValue({ count: 1 }),
          update: vi.fn().mockResolvedValue({
            ...session,
            status: MasterHotelImportStatus.COMPLETED,
            createdCount: expectedHotels.length,
            committedAt,
          }),
        },
        masterHotel: {
          findUnique: vi.fn().mockResolvedValue(null),
          create: vi.fn().mockResolvedValue({
            id: '66666666-6666-4666-8666-666666666666',
          }),
        },
        masterDataAuditEvent: { create: vi.fn().mockResolvedValue({}) },
        masterMealService: {
          findUnique: vi.fn().mockResolvedValue(null),
          create: vi.fn().mockResolvedValue({ id: 'meal-id', isActive: true }),
        },
        masterRoomType: {
          findUnique: vi.fn().mockResolvedValue(null),
          create: vi.fn().mockResolvedValue({ id: 'room-id', isActive: true }),
        },
        masterFacility: {
          findUnique: vi.fn().mockResolvedValue(null),
          create: vi
            .fn()
            .mockResolvedValue({ id: 'facility-id', isActive: true }),
        },
        masterHotelMealService: {
          createMany: vi.fn().mockResolvedValue({ count: 1 }),
        },
        masterHotelRoomType: {
          createMany: vi.fn().mockResolvedValue({ count: 1 }),
        },
        masterHotelFacility: {
          createMany: vi.fn().mockResolvedValue({ count: 1 }),
        },
      };
      const database = {
        client: {
          masterHotelImportSession: {
            findFirst: vi
              .fn()
              .mockResolvedValueOnce(session)
              .mockResolvedValueOnce(null),
          },
          $transaction: vi.fn(
            async (operation: (transaction: typeof tx) => unknown) =>
              operation(tx),
          ),
        },
      };
      const config = {
        getOrThrow: vi
          .fn()
          .mockReturnValue(Buffer.alloc(32, 7).toString('base64')),
      };
      const service = new HotelImportService(
        database as unknown as DatabaseService,
        config as never,
      );
      const internals = service as unknown as {
        stagingDirectory: string;
        tokenHash(value: string): string;
      };
      session.previewTokenHash = internals.tokenHash(previewToken);
      await mkdir(internals.stagingDirectory, { recursive: true });
      await writeFile(
        join(internals.stagingDirectory, stagingFileName),
        buffer,
      );

      try {
        const response = await service.commit(
          session.id,
          {
            previewToken,
            idempotencyKey: '77777777-7777-4777-8777-777777777777',
            duplicateBehavior: 'SKIP',
            createMissingReferences: true,
          },
          actor,
        );

        expect(response.data).toMatchObject({
          status: MasterHotelImportStatus.COMPLETED,
          counts: { created: expectedHotels.length, updated: 0, skipped: 0 },
        });
        expect(database.client.$transaction).toHaveBeenCalledWith(
          expect.any(Function),
          { timeout: 120_000, maxWait: 10_000 },
        );
        expect(tx.masterHotel.create).toHaveBeenCalledTimes(
          expectedHotels.length,
        );
        if (supplied)
          expect(tx.masterHotel.create).toHaveBeenNthCalledWith(1, {
            data: expect.objectContaining({
              address: 'Akyar Mevkii',
              starRating: 5,
              serviceLevel: 'لوکس',
              description: 'هتل ساحلی پنج ستاره',
              hotelRules: 'ورود ۱۴:۰۰ | خروج ۱۲:۰۰',
              sourceDestination: 'کوش‌آداسی',
              sourceRefundRules: 'تا ۷۲ ساعت طبق قرارداد',
              sourceFeatured: true,
              internalNote: null,
            }),
          });
        for (const hotel of expectedHotels)
          expect(tx.masterHotel.create).toHaveBeenCalledWith({
            data: expect.objectContaining({
              ...hotel,
              englishName: extended ? 'Bodrum Marina Hotel' : hotel.name,
              cityId: session.cityId,
            }),
          });
        expect(tx.masterDataAuditEvent.create).toHaveBeenCalledWith({
          data: expect.objectContaining({ resource: 'hotels' }),
        });
        if (extended)
          expect(tx.masterHotel.create).toHaveBeenCalledWith({
            data: expect.objectContaining({
              website: 'www.hotel.example',
              freeSale: false,
              name: 'هتل مارینا',
            }),
          });
        expect(tx.masterDataAuditEvent.create).toHaveBeenCalledWith({
          data: expect.objectContaining({
            action: 'master_data.hotel_import.create',
            resource: 'hotels',
          }),
        });
        expect(tx.masterDataAuditEvent.create).toHaveBeenCalledWith({
          data: expect.objectContaining({
            action: 'master_data.hotel_import.commit',
            resource: 'hotel-imports',
          }),
        });
      } finally {
        service.onModuleDestroy();
      }
    },
  );
});
