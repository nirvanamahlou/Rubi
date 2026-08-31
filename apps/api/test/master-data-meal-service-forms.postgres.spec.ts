import { execFileSync } from 'node:child_process';
import { randomBytes, randomUUID } from 'node:crypto';
import { readFileSync, readdirSync } from 'node:fs';
import { resolve } from 'node:path';
import { parseEnv } from 'node:util';
import { createDatabaseClient, type DatabaseClient } from '@rubi/database';
import type { AuthenticatedActor, MasterDataRecord } from '@rubi/contracts';
import { afterAll, beforeAll, describe, expect, it } from 'vitest';
import { unzipSync, strFromU8 } from 'fflate';
import { ConflictException, ForbiddenException } from '@nestjs/common';
import type { DatabaseService } from '../src/database/database.service';
import { MasterDataRepository } from '../src/master-data/master-data.repository';
import { MasterDataService } from '../src/master-data/master-data.service';

const enabled = process.env.RUBI_RUN_MEAL_POSTGRES_TESTS === '1';
const databaseName = `rubi_md_meal_test_${randomUUID().replaceAll('-', '')}`;
const migrationName = '20260831130000_master_data_meal_service_forms';
const id = '11111111-1111-4111-8111-111111111111';
const actor: AuthenticatedActor = {
  userId: id,
  sessionId: id,
  branchIds: [id],
  permissions: [
    'master_data.read',
    'master_data.create',
    'master_data.update',
    'master_data.status.manage',
    'master_data.export',
  ],
};
let client: DatabaseClient;
let service: MasterDataService;
let repository: MasterDataRepository;
let created = false;
let meal: MasterDataRecord;
function sql(database: string, input: string, timeout = 30000) {
  return execFileSync(
    'docker',
    [
      'exec',
      '-i',
      'rubi-postgres-1',
      'psql',
      '-U',
      'rubi_local',
      '-d',
      database,
      '-v',
      'ON_ERROR_STOP=1',
      '-At',
    ],
    { input, encoding: 'utf8', stdio: ['pipe', 'pipe', 'pipe'], timeout },
  );
}
const listQuery = {
  search: '',
  status: 'all' as const,
  sortBy: 'name' as const,
  sortDirection: 'asc' as const,
  page: 1,
  pageSize: 25,
};
describe.skipIf(!enabled)(
  'meal/service forms on isolated PostgreSQL 18',
  () => {
    beforeAll(async () => {
      const local = parseEnv(
        readFileSync(
          process.env.RUBI_MEAL_TEST_ENV_FILE ?? resolve(process.cwd(), '.env'),
          'utf8',
        ),
      );
      const url = new URL(local.DATABASE_URL!);
      if (
        !['localhost', '127.0.0.1'].includes(url.hostname) ||
        url.port !== '55432' ||
        !/^rubi_md_meal_test_[a-f0-9]{32}$/.test(databaseName)
      )
        throw new Error('Only isolated local test database is permitted.');
      sql('postgres', `CREATE DATABASE "${databaseName}";`);
      created = true;
      const migrations = resolve(
        process.cwd(),
        '../../packages/database/prisma/migrations',
      );
      const directories = readdirSync(migrations, { withFileTypes: true })
        .filter((item) => item.isDirectory())
        .sort((a, b) => a.name.localeCompare(b.name));
      const contents = (name: string) =>
        readFileSync(resolve(migrations, name, 'migration.sql'), 'utf8');
      sql(
        databaseName,
        directories
          .filter((item) => item.name < migrationName)
          .map((item) => contents(item.name))
          .join('\n'),
        90000,
      );
      sql(
        databaseName,
        `INSERT INTO master_meal_services (id,code,name,category,"includedMeals","isActive","createdByUserId","updatedByUserId","updatedAt") VALUES ('${id}','MEAL_SERVICE_LEGACY','Legacy preserved','SERVICE',ARRAY['Custom, meal'],false,'${id}','${id}',CURRENT_TIMESTAMP);`,
      );
      sql(
        databaseName,
        directories
          .filter((item) => item.name >= migrationName)
          .map((item) => contents(item.name))
          .join('\n'),
        90000,
      );
      url.pathname = `/${databaseName}`;
      const env = {
        ...process.env,
        ...local,
        DATABASE_URL: url.toString(),
        CUSTOMER_CONTACT_ENCRYPTION_KEY_BASE64:
          randomBytes(32).toString('base64'),
        CUSTOMER_CONTACT_FINGERPRINT_KEY_BASE64:
          randomBytes(32).toString('base64'),
        CUSTOMER_CONTACT_ENCRYPTION_KEY_VERSION: '1',
      };
      for (let run = 0; run < 2; run++)
        execFileSync(
          process.execPath,
          [
            '--import',
            'tsx',
            process.env.RUBI_MEAL_TEST_SEED ?? 'prisma/seed.ts',
          ],
          {
            cwd: resolve(process.cwd(), '../../packages/database'),
            env,
            stdio: 'pipe',
            timeout: 60000,
          },
        );
      client = createDatabaseClient(url.toString());
      expect(sql(databaseName, 'SELECT version();')).toContain(
        'PostgreSQL 18.',
      );
      repository = new MasterDataRepository({ client } as DatabaseService);
      service = new MasterDataService(repository);
    }, 240000);
    afterAll(async () => {
      if (client) await client.$disconnect();
      if (created && /^rubi_md_meal_test_[a-f0-9]{32}$/.test(databaseName))
        sql('postgres', `DROP DATABASE "${databaseName}";`);
    }, 30000);
    it('preserves legacy codes, custom meals, inactive states and seed idempotency', async () => {
      const legacy = await client.masterMealService.findUniqueOrThrow({
        where: { id },
      });
      expect(legacy).toMatchObject({
        code: 'MEAL_SERVICE_LEGACY',
        includedMeals: ['Custom, meal'],
        isActive: false,
        isUnderReview: false,
      });
      expect(await client.masterDraftExchangeRate.count()).toBe(0);
    });
    it('persists standard code, array, review and audit atomically', async () => {
      meal = (
        await service.create(
          'meal-services',
          {
            code: ' brn ',
            name: 'وعده آزمون',
            englishName: 'Test brunch',
            category: 'MEAL_PLAN',
            includedMeals: '["صبحانه","شام"]',
            status: 'under_review',
          },
          actor,
        )
      ).data;
      expect(meal).toMatchObject({
        code: 'BRN',
        status: 'inactive',
        attributes: {
          isUnderReview: true,
          includedMealsJson: '["صبحانه","شام"]',
        },
      });
      const audit = await client.masterDataAuditEvent.findFirstOrThrow({
        where: { entityId: meal.id },
      });
      expect(audit.afterSnapshot).toMatchObject({
        code: 'BRN',
        isActive: false,
        isUnderReview: true,
      });
    });
    it('enforces database uniqueness and review/inactive check', async () => {
      await expect(
        client.masterMealService.update({
          where: { id: meal.id },
          data: { isActive: true },
        }),
      ).rejects.toThrow();
      await expect(
        client.masterMealService.update({
          where: { id },
          data: { code: 'BRN' },
        }),
      ).rejects.toThrow();
    });
    it('filters review versus inactive distinctly; legacy active lookup excludes review', async () => {
      expect(
        (
          await repository.list('meal-services', {
            ...listQuery,
            mealServiceStatus: 'under_review',
          })
        ).rows.map((row) => row.id),
      ).toContain(meal.id);
      expect(
        (
          await repository.list('meal-services', {
            ...listQuery,
            mealServiceStatus: 'inactive',
          })
        ).rows.map((row) => row.id),
      ).not.toContain(meal.id);
      expect(
        (
          await repository.list('meal-services', {
            ...listQuery,
            status: 'active',
          })
        ).rows.map((row) => row.id),
      ).not.toContain(meal.id);
    });
    it('exports real status using the same review filter', async () => {
      const result = await service.downloadXlsx(
        {
          resource: 'meal-services',
          format: 'xlsx',
          filters: {
            search: '',
            status: 'all',
            sortBy: 'name',
            sortDirection: 'asc',
            mealServiceStatus: 'under_review',
          },
          columns: ['code', 'name', 'includedMeals', 'status'],
          locale: 'fa-IR',
          timezone: 'UTC',
        },
        actor,
      );
      const sheet = strFromU8(
        unzipSync(result.buffer)['xl/worksheets/sheet1.xml']!,
      );
      expect(sheet).toContain('در حال بررسی');
      expect(sheet).toContain('BRN');
      expect(sheet).not.toContain('MEAL_SERVICE_LEGACY');
    });
    it('rejects unauthorized status mutation without changing content or audit', async () => {
      const count = await client.masterDataAuditEvent.count({
        where: { entityId: meal.id },
      });
      await expect(
        service.update(
          'meal-services',
          meal.id,
          { name: 'Not saved', status: 'active' },
          meal.version,
          { ...actor, permissions: ['master_data.update'] },
        ),
      ).rejects.toBeInstanceOf(ForbiddenException);
      expect(
        (
          await client.masterMealService.findUniqueOrThrow({
            where: { id: meal.id },
          })
        ).name,
      ).toBe('وعده آزمون');
      expect(
        await client.masterDataAuditEvent.count({
          where: { entityId: meal.id },
        }),
      ).toBe(count);
    });
    it('partial edit preserves code/meals/review; stale version cannot overwrite', async () => {
      const next = (
        await service.update(
          'meal-services',
          meal.id,
          { englishName: 'Changed' },
          meal.version,
          actor,
        )
      ).data;
      expect(next).toMatchObject({
        code: meal.code,
        attributes: {
          includedMealsJson: meal.attributes.includedMealsJson,
          isUnderReview: true,
        },
      });
      await expect(
        service.update(
          'meal-services',
          meal.id,
          { includedMeals: [] },
          meal.version,
          actor,
        ),
      ).rejects.toBeInstanceOf(ConflictException);
      meal = next;
    });
    it('activation clears review and real hotel usage remains derived from links', async () => {
      meal = (
        await service.status(
          'meal-services',
          meal.id,
          'active',
          meal.version,
          actor,
        )
      ).data;
      expect(meal.attributes.isUnderReview).toBe(false);
      const city = await client.masterCity.findFirstOrThrow();
      await service.create(
        'hotels',
        { name: 'Meal test hotel', cityId: city.id, mealServiceIds: meal.id },
        actor,
      );
      expect(
        (await service.detail('meal-services', meal.id)).data.attributes
          .hotelCount,
      ).toBe(1);
      await expect(
        client.masterMealService.delete({ where: { id: meal.id } }),
      ).rejects.toThrow();
      const next = (
        await service.update(
          'meal-services',
          meal.id,
          { includedMeals: [] },
          meal.version,
          actor,
        )
      ).data;
      expect(next.attributes.includedMealsJson).toBe('[]');
      expect(next.attributes.hotelCount).toBe(1);
    });
  },
);
