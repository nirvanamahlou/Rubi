import { ConfigService } from '@nestjs/config';
import type { AuthenticatedActor } from '@nora/contracts';
import { createDatabaseClient } from '@nora/database';
import { randomUUID } from 'node:crypto';
import { readFileSync } from 'node:fs';
import { resolve } from 'node:path';
import { describe, expect, it } from 'vitest';
import type { DatabaseService } from '../database/database.service';
import { HotelImportService } from './hotel-import.service';
import {
  HOTEL_IMPORT_MIME,
  HOTEL_IMPORT_TEMPLATE_VERSION,
} from './hotel-import.parser';
import { MasterDataRepository } from './master-data.repository';
import { MasterDataService } from './master-data.service';

const url = process.env.HOTEL_PROFILE_DATABASE_URL;
describe.skipIf(!url)(
  'hotel workbook to editable profile on isolated PostgreSQL',
  () => {
    it.each(['legacy', '14-column'])(
      'persists %s sample rows, fills a missing field, reopens it, and skips duplicates',
      async (format) => {
        if (!url || new URL(url).pathname !== '/hotel_profile_test')
          throw new Error('Dedicated hotel_profile_test database required');
        const client = createDatabaseClient(url);
        const database = { client } as DatabaseService;
        const actor: AuthenticatedActor = {
          userId: randomUUID(),
          sessionId: randomUUID(),
          branchIds: [randomUUID()],
          permissions: [
            'master_data.read',
            'master_data.create',
            'master_data.update',
            'master_data.import',
          ],
        };
        const importer = new HotelImportService(
          database,
          new ConfigService({
            MASTER_DATA_IMPORT_TOKEN_KEY_BASE64: Buffer.alloc(32, 8).toString(
              'base64',
            ),
          }),
        );
        const repository = new MasterDataRepository(database);
        const service = new MasterDataService(repository);
        const countryId = randomUUID();
        const cityId = randomUUID();
        try {
          await client.masterCountry.create({
            data: {
              id: countryId,
              code: 'XZ',
              name: 'Synthetic import country',
              createdByUserId: actor.userId,
              updatedByUserId: actor.userId,
            },
          });
          await client.masterCity.create({
            data: {
              id: cityId,
              countryId,
              code: 'SYNTHETIC_KUS',
              name: 'کوش‌آداسی',
              createdByUserId: actor.userId,
              updatedByUserId: actor.userId,
            },
          });
          const buffer = readFileSync(
            resolve(
              process.cwd(),
              format === '14-column'
                ? 'test/fixtures/hotel-master-template-14-columns.xlsx'
                : '../web/public/templates/hotel-master-template.xlsx',
            ),
          );
          const file = {
            buffer,
            originalname: 'hotel-master-template.xlsx',
            mimetype: HOTEL_IMPORT_MIME,
            size: buffer.length,
          };
          const preview = await importer.preview(
            file,
            {
              countryId,
              cityId,
              templateVersion: HOTEL_IMPORT_TEMPLATE_VERSION,
            },
            actor,
          );
          expect(preview.data.issues).toEqual([]);
          const result = await importer.commit(
            preview.data.sessionId,
            {
              previewToken: preview.data.previewToken,
              idempotencyKey: randomUUID(),
              duplicateBehavior: 'SKIP',
              createMissingReferences: true,
            },
            actor,
          );
          expect(result.data.counts).toMatchObject({
            created: 3,
            updated: 0,
            skipped: 0,
          });
          const hotels = await client.masterHotel.findMany({
            where: { cityId },
            orderBy: { name: 'asc' },
          });
          expect(hotels.map((hotel) => hotel.name)).toEqual([
            'Charisma De Luxe Hotel',
            'Ramada Resort Kusadasi',
            'Signature Blue Resort',
          ]);
          expect(hotels[0]).toMatchObject({
            serviceLevel: 'لوکس',
            description: 'هتل ساحلی پنج ستاره',
            hotelRules: 'ورود ۱۴:۰۰ | خروج ۱۲:۰۰',
            sourceDestination: 'کوش‌آداسی',
            sourceRefundRules: 'تا ۷۲ ساعت طبق قرارداد',
            sourceFeatured: true,
            internalNote: null,
          });
          expect(hotels[2]?.isActive).toBe(false);
          const first = hotels[0]!;
          const saved = await service.update(
            'hotels',
            first.id,
            {
              internalNote: 'completed later',
              description: 'edited description',
              sourceMainImage: 'https://example.test/main.jpg',
              sourceGalleryImages:
                'https://example.test/1.jpg|https://example.test/2.jpg',
            },
            first.version,
            actor,
          );
          expect(saved.data.attributes).toMatchObject({
            internalNote: 'completed later',
            serviceLevel: 'لوکس',
            mealServiceNames: 'UALL',
            roomTypeNames: 'Double',
          });
          const reopened = await repository.find('hotels', first.id);
          expect(reopened).toMatchObject({
            internalNote: 'completed later',
            description: 'edited description',
            version: 2,
            sourceGalleryImages:
              'https://example.test/1.jpg|https://example.test/2.jpg',
          });
          const again = await importer.preview(
            file,
            {
              countryId,
              cityId,
              templateVersion: HOTEL_IMPORT_TEMPLATE_VERSION,
            },
            actor,
          );
          const skipped = await importer.commit(
            again.data.sessionId,
            {
              previewToken: again.data.previewToken,
              idempotencyKey: randomUUID(),
              duplicateBehavior: 'SKIP',
              createMissingReferences: true,
            },
            actor,
          );
          expect(skipped.data.counts).toMatchObject({ created: 0, skipped: 3 });
          expect(await client.masterHotel.count({ where: { cityId } })).toBe(3);
          expect(
            (await repository.find('hotels', first.id))?.internalNote,
          ).toBe('completed later');
        } finally {
          importer.onModuleDestroy();
          const ids = (
            await client.masterHotel.findMany({
              where: { cityId },
              select: { id: true },
            })
          ).map(({ id }) => id);
          await client.masterHotelFacility.deleteMany({
            where: { hotelId: { in: ids } },
          });
          await client.masterHotelMealService.deleteMany({
            where: { hotelId: { in: ids } },
          });
          await client.masterHotelRoomType.deleteMany({
            where: { hotelId: { in: ids } },
          });
          await client.masterHotel.deleteMany({ where: { cityId } });
          await client.masterHotelImportSession.deleteMany({
            where: { cityId },
          });
          await client.masterCity.deleteMany({ where: { id: cityId } });
          await client.masterCountry.deleteMany({ where: { id: countryId } });
          await client.$disconnect();
        }
      },
      180_000,
    );
  },
);
