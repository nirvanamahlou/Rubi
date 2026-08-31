import { execFileSync } from 'node:child_process';
import { randomUUID } from 'node:crypto';
import { existsSync, readFileSync, readdirSync } from 'node:fs';
import { createRequire } from 'node:module';
import { resolve } from 'node:path';
import { parseEnv } from 'node:util';
import { ConflictException, ForbiddenException } from '@nestjs/common';
import type { AuthenticatedActor } from '@rubi/contracts';
import { createDatabaseClient, type DatabaseClient } from '@rubi/database';
import { afterAll, beforeAll, describe, expect, it } from 'vitest';
import type { DatabaseService } from '../src/database/database.service';
import { MasterDataRepository } from '../src/master-data/master-data.repository';
import { MasterDataService } from '../src/master-data/master-data.service';

// Opt in explicitly; never migrate, seed, or clean up the application database.
const enabled = process.env.RUBI_RUN_TRAVEL_FORM_POSTGRES_TESTS === '1';
const databaseName = `rubi_md_travel_form_test_${randomUUID().replaceAll('-', '')}`;
const migrationName = '20260831100000_master_data_travel_reference_forms';
const actorId = '11111111-1111-4111-8111-111111111111';
const countryId = '44444444-4444-4444-8444-444444444444';
const transferId = '55555555-5555-4555-8555-555555555555';
const visaId = '66666666-6666-4666-8666-666666666666';
const actor: AuthenticatedActor = {
  userId: actorId,
  sessionId: '22222222-2222-4222-8222-222222222222',
  branchIds: ['33333333-3333-4333-8333-333333333333'],
  permissions: [
    'master_data.create',
    'master_data.update',
    'master_data.status.manage',
  ],
};
let created = false;
let client: DatabaseClient;
let service: MasterDataService;
let migrationSql: string;

function sql(database: string, input: string) {
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
    ],
    {
      input,
      encoding: 'utf8',
      stdio: ['pipe', 'pipe', 'pipe'],
      timeout: 30000,
    },
  );
}

describe.skipIf(!enabled)(
  'travel reference forms on isolated PostgreSQL 18',
  () => {
    beforeAll(async () => {
      const envFile = [
        resolve(process.cwd(), '.env'),
        resolve(process.cwd(), '../../.env'),
      ].find(existsSync);
      const databaseUrl =
        process.env.DATABASE_URL ??
        (envFile
          ? parseEnv(readFileSync(envFile, 'utf8')).DATABASE_URL
          : undefined);
      if (!databaseUrl) throw new Error('A local DATABASE_URL is required.');
      const configured = new URL(databaseUrl);
      if (
        !['localhost', '127.0.0.1'].includes(configured.hostname) ||
        configured.port !== '55432'
      )
        throw new Error('Only the local Rubi PostgreSQL port is allowed.');
      if (!/^rubi_md_travel_form_test_[a-f0-9]{32}$/.test(databaseName))
        throw new Error('Invalid test database name.');
      sql('postgres', `CREATE DATABASE "${databaseName}";`);
      created = true;
      const migrations = resolve(
        process.cwd(),
        '../../packages/database/prisma/migrations',
      );
      const entries = readdirSync(migrations, { withFileTypes: true })
        .filter((entry) => entry.isDirectory())
        .sort((a, b) => a.name.localeCompare(b.name));
      const migrationStatements: string[] = [];
      for (const entry of entries) {
        if (entry.name === migrationName) {
          // Legacy rows have no new fields. Verify the expand migration preserves them.
          migrationStatements.push(
            `
          INSERT INTO "master_countries" ("id","code","name","englishName","createdByUserId","updatedByUserId","updatedAt")
          VALUES ('${countryId}','IR','Test country','Test country','${actorId}','${actorId}',CURRENT_TIMESTAMP);
          INSERT INTO "master_transfer_types" ("id","code","name","vehicleType","serviceMode","suggestedCapacity","createdByUserId","updatedByUserId","updatedAt")
          VALUES ('${transferId}','TEST_LEGACY_TRANSFER','Test legacy transfer','Van','PRIVATE',8,'${actorId}','${actorId}',CURRENT_TIMESTAMP);
          INSERT INTO "master_visa_services" ("id","countryId","code","name","visaType","referenceValidityDays","createdByUserId","updatedByUserId","updatedAt")
          VALUES ('${visaId}','${countryId}','TEST_LEGACY_VISA','Test legacy visa','Tourist',90,'${actorId}','${actorId}',CURRENT_TIMESTAMP);
        `,
          );
        }
        const contents = readFileSync(
          resolve(migrations, entry.name, 'migration.sql'),
          'utf8',
        );
        migrationStatements.push(contents);
        if (entry.name === migrationName) migrationSql = contents;
      }
      expect(migrationSql).toBeTruthy();
      sql(databaseName, migrationStatements.join('\n'));
      configured.pathname = `/${databaseName}`;
      // Allow a freshly generated client in a temporary directory, without replacing the live client's build.
      const modulePath = process.env.RUBI_TRAVEL_TEST_DATABASE_MODULE;
      const factory = modulePath
        ? (
            createRequire(resolve(process.cwd(), 'package.json'))(
              modulePath,
            ) as { createDatabaseClient: typeof createDatabaseClient }
          ).createDatabaseClient
        : createDatabaseClient;
      client = factory(configured.toString());
      service = new MasterDataService(
        new MasterDataRepository({ client } as DatabaseService),
      );
      const version = await client.$queryRawUnsafe<{ version: string }[]>(
        'SELECT version() AS version',
      );
      expect(version[0]!.version).toContain('PostgreSQL 18.');
    }, 180000);

    afterAll(async () => {
      if (client) await client.$disconnect();
      if (
        created &&
        /^rubi_md_travel_form_test_[a-f0-9]{32}$/.test(databaseName)
      )
        sql('postgres', `DROP DATABASE "${databaseName}" WITH (FORCE);`);
    }, 30000);

    it('preserves legacy data and defaults after every migration', async () => {
      const transfers = await client.$queryRawUnsafe<Record<string, unknown>[]>(
        'SELECT * FROM "master_transfer_types" WHERE "id" = $1::uuid',
        transferId,
      );
      const visas = await client.$queryRawUnsafe<Record<string, unknown>[]>(
        'SELECT * FROM "master_visa_services" WHERE "id" = $1::uuid',
        visaId,
      );
      expect(transfers[0]).toMatchObject({
        suggestedCapacity: 8,
        suggestedCapacityMin: null,
        version: 1,
      });
      expect(visas[0]).toMatchObject({
        referenceValidityDays: 90,
        referenceValidityMode: 'DAYS',
        version: 1,
      });
    });

    it('stores capacity, description and status together, auditing one version and rejecting stale edits', async () => {
      const result = await service.create(
        'transfer-types',
        {
          name: 'Test transfer',
          vehicleType: 'Van',
          serviceMode: 'PRIVATE',
          suggestedCapacityMin: '4',
          suggestedCapacity: '8',
          description: 'Test description',
          status: 'inactive',
        },
        actor,
      );
      expect(result.data).toMatchObject({
        status: 'inactive',
        version: 1,
        attributes: {
          suggestedCapacityMin: 4,
          suggestedCapacity: 8,
          usageCount: null,
        },
      });
      const changed = await service.update(
        'transfer-types',
        result.data.id,
        { suggestedCapacityMin: '5', status: 'active' },
        1,
        actor,
      );
      expect(changed.data).toMatchObject({
        status: 'active',
        version: 2,
        attributes: { suggestedCapacityMin: 5, suggestedCapacity: 8 },
      });
      await expect(
        service.update(
          'transfer-types',
          result.data.id,
          { suggestedCapacity: '9' },
          1,
          actor,
        ),
      ).rejects.toBeInstanceOf(ConflictException);
      const audit = await client.masterDataAuditEvent.findMany({
        where: { entityId: result.data.id },
        orderBy: { occurredAt: 'asc' },
      });
      expect(audit).toHaveLength(2);
      expect(audit[1]!.beforeSnapshot).toMatchObject({
        isActive: false,
        suggestedCapacityMin: 4,
        version: 1,
      });
      expect(audit[1]!.afterSnapshot).toMatchObject({
        isActive: true,
        suggestedCapacityMin: 5,
        version: 2,
      });
    });

    it('switches visa validity both ways without carrying contradictory days and persists its guide', async () => {
      const result = await service.create(
        'visa-services',
        {
          name: 'Test visa',
          countryId,
          visaType: 'Tourist',
          referenceValidityDays: '30',
          guidanceFileReference: '77777777-7777-4777-8777-777777777777',
        },
        actor,
      );
      const passport = await service.update(
        'visa-services',
        result.data.id,
        { referenceValidityMode: 'PASSPORT_EXPIRY', status: 'inactive' },
        1,
        actor,
      );
      expect(passport.data).toMatchObject({
        status: 'inactive',
        attributes: {
          referenceValidityMode: 'PASSPORT_EXPIRY',
          referenceValidityDays: null,
          guidanceFileReference: '77777777-7777-4777-8777-777777777777',
        },
      });
      const days = await service.update(
        'visa-services',
        result.data.id,
        {
          referenceValidityMode: 'DAYS',
          referenceValidityDays: '60',
          status: 'active',
        },
        2,
        actor,
      );
      expect(days.data).toMatchObject({
        status: 'active',
        version: 3,
        attributes: {
          referenceValidityDays: 60,
          referenceValidityMode: 'DAYS',
        },
      });
      expect(
        await client.masterDataAuditEvent.count({
          where: { entityId: result.data.id },
        }),
      ).toBe(3);
    });

    it('does not save either field or status without status permission', async () => {
      await expect(
        service.update(
          'transfer-types',
          transferId,
          { name: 'Unauthorized change', status: 'inactive' },
          1,
          { ...actor, permissions: ['master_data.update'] },
        ),
      ).rejects.toBeInstanceOf(ForbiddenException);
      expect(
        await client.masterTransferType.findUnique({
          where: { id: transferId },
        }),
      ).toMatchObject({
        name: 'Test legacy transfer',
        isActive: true,
        version: 1,
      });
    });

    it.each([
      [
        'minimum above maximum',
        'master_transfer_types',
        '"suggestedCapacityMin" = 9',
        transferId,
        'capacity_range_check',
      ],
      [
        'minimum without maximum',
        'master_transfer_types',
        '"suggestedCapacityMin" = 4, "suggestedCapacity" = NULL',
        transferId,
        'capacity_range_check',
      ],
      [
        'minimum below one',
        'master_transfer_types',
        '"suggestedCapacityMin" = 0',
        transferId,
        'capacity_range_check',
      ],
      [
        'maximum above limit',
        'master_transfer_types',
        '"suggestedCapacity" = 101',
        transferId,
        'capacity_check',
      ],
      [
        'unknown validity mode',
        'master_visa_services',
        '"referenceValidityMode" = \'UNKNOWN\'',
        visaId,
        'validity_mode_check',
      ],
      [
        'expiry with fixed days',
        'master_visa_services',
        '"referenceValidityMode" = \'PASSPORT_EXPIRY\'',
        visaId,
        'validity_mode_days_check',
      ],
      [
        'negative days',
        'master_visa_services',
        '"referenceValidityDays" = -1',
        visaId,
        'validity_check',
      ],
      [
        'missing country',
        'master_visa_services',
        '"countryId" = \'88888888-8888-4888-8888-888888888888\'',
        visaId,
        'country_fkey',
      ],
    ])(
      'enforces SQL integrity for %s',
      (_label, table, mutation, id, constraint) => {
        expect(() =>
          sql(
            databaseName,
            `UPDATE "${table}" SET ${mutation} WHERE "id" = '${id}';`,
          ),
        ).toThrow(constraint);
      },
    );

    it('rolls back the whole edit and claimed version if writing Audit fails', async () => {
      sql(
        databaseName,
        `
      CREATE FUNCTION reject_travel_test_audit() RETURNS trigger LANGUAGE plpgsql AS $$ BEGIN RAISE EXCEPTION 'Test audit failure'; END; $$;
      CREATE TRIGGER reject_travel_test_audit BEFORE INSERT ON "master_audit_events" FOR EACH ROW EXECUTE FUNCTION reject_travel_test_audit();
    `,
      );
      try {
        await expect(
          service.update(
            'transfer-types',
            transferId,
            { suggestedCapacityMin: '4', status: 'inactive' },
            1,
            actor,
          ),
        ).rejects.toThrow();
        expect(
          await client.masterTransferType.findUnique({
            where: { id: transferId },
          }),
        ).toMatchObject({ isActive: true, version: 1 });
        const rows = await client.$queryRawUnsafe<
          { suggestedCapacityMin: number | null }[]
        >(
          'SELECT "suggestedCapacityMin" FROM "master_transfer_types" WHERE "id" = $1::uuid',
          transferId,
        );
        expect(rows[0]!.suggestedCapacityMin).toBeNull();
      } finally {
        sql(
          databaseName,
          'DROP TRIGGER reject_travel_test_audit ON "master_audit_events"; DROP FUNCTION reject_travel_test_audit();',
        );
      }
    });
  },
);
