import type { AuthenticatedActor } from '@rubi/contracts';
import { MasterHotelImportStatus } from '@rubi/database';
import { strToU8, zipSync } from 'fflate';
import { createHash } from 'node:crypto';
import { mkdir, writeFile } from 'node:fs/promises';
import { join } from 'node:path';
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

function workbook() {
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
  it('persists every valid parsed row in hotels and writes audit records', async () => {
    const buffer = workbook();
    const previewToken = 'preview-token';
    const stagingFileName = 'hotel-import-service-test.xlsx';
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
      city: { name: 'بدروم' },
      rowCount: 1,
      validCount: 1,
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
          createdCount: 1,
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
    await writeFile(join(internals.stagingDirectory, stagingFileName), buffer);

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
        counts: { created: 1, updated: 0, skipped: 0 },
      });
      expect(tx.masterHotel.create).toHaveBeenCalledWith({
        data: expect.objectContaining({
          code: 'HTL-BODRUM-IMPORT-001',
          name: 'Bodrum Marina Hotel',
          cityId: session.cityId,
          isActive: true,
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
  });
});
