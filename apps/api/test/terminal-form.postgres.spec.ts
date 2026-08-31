import { execFileSync } from 'node:child_process';
import { randomBytes, randomUUID } from 'node:crypto';
import { readFileSync, readdirSync } from 'node:fs';
import { createRequire } from 'node:module';
import { resolve } from 'node:path';
import { parseEnv } from 'node:util';
import { createDatabaseClient, type DatabaseClient } from '@rubi/database';
import type { AuthenticatedActor } from '@rubi/contracts';
import { afterAll, beforeAll, describe, expect, it } from 'vitest';
import type { DatabaseService } from '../src/database/database.service';
import { MasterDataRepository } from '../src/master-data/master-data.repository';
import { MasterDataService } from '../src/master-data/master-data.service';

const enabled = process.env.RUBI_RUN_TERMINAL_POSTGRES_TESTS === '1';
const databaseName = `rubi_md_terminal_test_${randomUUID().replaceAll('-', '')}`;
const migrationName = '20260831110000_master_data_terminal_details';
const userId = '11111111-1111-4111-8111-111111111111';
const legacyCountryId = randomUUID();
const legacyCityId = randomUUID();
const legacyAirportId = randomUUID();
const legacyTerminalId = randomUUID();
const legacySnapshotSql = `SELECT "id", "airportId", "code", "name", "terminalType", "isActive" FROM "master_terminals" WHERE "id" = '${legacyTerminalId}';`;
const actor: AuthenticatedActor = {
  userId,
  sessionId: userId,
  branchIds: [userId],
  permissions: [
    'master_data.read',
    'master_data.create',
    'master_data.update',
    'master_data.status.manage',
  ],
};
let client: DatabaseClient;
let service: MasterDataService;
let created = false;
let airportId: string;
let terminalId: string;
let legacyBefore: string;
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
    {
      input,
      encoding: 'utf8',
      stdio: ['pipe', 'pipe', 'pipe'],
      timeout,
    },
  );
}
describe.skipIf(!enabled)('terminal form on isolated PostgreSQL 18', () => {
  beforeAll(async () => {
    const local = parseEnv(
      readFileSync(resolve(process.cwd(), '.env'), 'utf8'),
    );
    const url = new URL(local.DATABASE_URL!);
    if (
      !['localhost', '127.0.0.1'].includes(url.hostname) ||
      url.port !== '55432'
    )
      throw new Error('Only local Rubi PostgreSQL is allowed.');
    if (!/^rubi_md_terminal_test_[a-f0-9]{32}$/.test(databaseName))
      throw new Error('Invalid isolated database name');
    sql('postgres', `CREATE DATABASE "${databaseName}";`);
    created = true;
    const migrations = resolve(
      process.cwd(),
      '../../packages/database/prisma/migrations',
    );
    const directories = readdirSync(migrations, { withFileTypes: true })
      .filter((item) => item.isDirectory())
      .sort((a, b) => a.name.localeCompare(b.name));
    // One psql process preserves statement autocommit while avoiding dozens of
    // Docker startup round trips on a shared development machine.
    sql(
      databaseName,
      directories
        .filter((item) => item.name < migrationName)
        .map((entry) =>
          readFileSync(
            resolve(migrations, entry.name, 'migration.sql'),
            'utf8',
          ),
        )
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
    const packagePath = resolve(process.cwd(), '../../packages/database');
    const seed = () =>
      execFileSync(
        process.execPath,
        [
          '--import',
          'tsx',
          process.env.RUBI_TERMINAL_TEST_SEED ?? 'prisma/seed.ts',
        ],
        {
          cwd: packagePath,
          env,
          stdio: 'pipe',
          timeout: 60000,
        },
      );
    // Use pre-migration SQL for the legacy fixture: the current generated client
    // cannot seed an older schema that lacks its newly introduced columns.
    sql(databaseName, `
      INSERT INTO "master_countries" ("id", "code", "name", "englishName", "createdByUserId", "updatedByUserId", "updatedAt")
        VALUES ('${legacyCountryId}', 'ZZ', 'کشور آزمون', 'Test country', '${userId}', '${userId}', NOW());
      INSERT INTO "master_cities" ("id", "countryId", "code", "name", "englishName", "createdByUserId", "updatedByUserId", "updatedAt")
        VALUES ('${legacyCityId}', '${legacyCountryId}', 'LEGACY_TEST', 'شهر آزمون', 'Test city', '${userId}', '${userId}', NOW());
      INSERT INTO "master_airports" ("id", "cityId", "iataCode", "icaoCode", "name", "englishName", "ianaTimezone", "latitude", "longitude", "createdByUserId", "updatedByUserId", "updatedAt")
        VALUES ('${legacyAirportId}', '${legacyCityId}', 'ZZZ', 'ZZZZ', 'فرودگاه آزمون', 'Test airport', 'UTC', 0, 0, '${userId}', '${userId}', NOW());
      INSERT INTO "master_terminals" ("id", "airportId", "code", "name", "terminalType", "createdByUserId", "updatedByUserId", "updatedAt")
        VALUES ('${legacyTerminalId}', '${legacyAirportId}', 'LEGACY_TEST', 'ترمینال پیش از مهاجرت', 'DOMESTIC', '${userId}', '${userId}', NOW());
    `);
    legacyBefore = sql(
      databaseName,
      legacySnapshotSql,
    );
    sql(
      databaseName,
      directories
        .filter((item) => item.name >= migrationName)
        .map((entry) =>
          readFileSync(
            resolve(migrations, entry.name, 'migration.sql'),
            'utf8',
          ),
        )
        .join('\n'),
      90000,
    );
    seed();
    seed();
    // Optional isolated generated client avoids replacing a live server's client.
    const clientPath = process.env.RUBI_TERMINAL_TEST_CLIENT;
    if (clientPath) {
      const { PrismaClient } = (await import(clientPath)) as {
        PrismaClient: new (options: { adapter: unknown }) => DatabaseClient;
      };
      const dependency = createRequire(resolve(packagePath, 'package.json'))(
        '@prisma/adapter-pg',
      ) as { PrismaPg: new (options: { connectionString: string }) => unknown };
      client = new PrismaClient({
        adapter: new dependency.PrismaPg({ connectionString: url.toString() }),
      });
    } else client = createDatabaseClient(url.toString());
    service = new MasterDataService(
      new MasterDataRepository({ client } as DatabaseService),
    );
    airportId = (await client.masterAirport.findFirstOrThrow()).id;
    expect(sql(databaseName, 'SELECT version();')).toContain('PostgreSQL 18.');
  }, 240000);
  afterAll(async () => {
    if (client) await client.$disconnect();
    if (created && /^rubi_md_terminal_test_[a-f0-9]{32}$/.test(databaseName))
      sql('postgres', `DROP DATABASE "${databaseName}";`);
  }, 30000);
  it('preserves existing terminals through migration and a second seed without inventing metadata', () => {
    expect(
      sql(
        databaseName,
        legacySnapshotSql,
      ),
    ).toBe(legacyBefore);
    expect(
      sql(
        databaseName,
        'SELECT count(*) FROM "master_terminals" WHERE "gateCount" IS NOT NULL OR "operatingHoursMode" IS NOT NULL OR "isUnderMaintenance";',
      ).trim(),
    ).toBe('0');
  });
  it('round-trips new fields, derived airport metadata, partial patches, status and audit', async () => {
    const result = await service.create(
      'terminals',
      {
        name: 'ترمینال آزمون مستقل',
        englishName: 'Isolated test terminal',
        airportId,
        terminalType: 'MIXED',
        gateCount: '28',
        operatingHoursMode: 'TIME_RANGE',
        opensAt: '05:00',
        closesAt: '24:00',
        status: 'maintenance',
      },
      actor,
    );
    terminalId = result.data.id;
    expect(result.data.attributes).toMatchObject({
      gateCount: 28,
      terminalType: 'MIXED',
      opensAt: '05:00',
      closesAt: '24:00',
      isUnderMaintenance: true,
      updatedByUserId: userId,
      cityName: expect.any(String),
      airportIcaoCode: expect.any(String),
    });
    const updated = await service.update(
      'terminals',
      terminalId,
      { opensAt: '06:00' },
      1,
      actor,
    );
    expect(updated.data.attributes).toMatchObject({
      opensAt: '06:00',
      closesAt: '24:00',
      isUnderMaintenance: true,
    });
    await expect(
      service.update('terminals', terminalId, { gateCount: 8 }, 1, actor),
    ).rejects.toThrow('هم‌زمان');
    const active = await service.update(
      'terminals',
      terminalId,
      { status: 'active' },
      2,
      actor,
    );
    expect(active.data.status).toBe('active');
    expect(active.data.attributes.isUnderMaintenance).toBe(false);
    const list = await service.list('terminals', {
      terminalType: 'MIXED',
      airportId,
      search: 'مستقل',
      status: 'active',
      sortBy: 'name',
      sortDirection: 'asc',
      page: 1,
      pageSize: 20,
    });
    expect(list.meta.total).toBe(1);
    expect(list.data[0]?.attributes.airportIcaoCode).toBe(
      result.data.attributes.airportIcaoCode,
    );
    const audits = await client.masterDataAuditEvent.findMany({
      where: { entityId: terminalId },
    });
    expect(audits).toHaveLength(3);
    expect(audits[0]?.actorUserId).toBe(userId);
    expect(
      audits.some((audit) =>
        JSON.stringify(audit.afterSnapshot).includes(
          '"isUnderMaintenance":true',
        ),
      ),
    ).toBe(true);
  });
  it.each([
    '"gateCount" = -1',
    '"gateCount" = 2147483648',
    '"isUnderMaintenance" = true, "isActive" = true',
    '"operatingHoursMode" = NULL',
    '"operatingHoursMode" = \'ALL_DAY\'',
    '"operatingHoursMode" = \'INVALID\'',
    '"opensAt" = \'24:00\'',
    '"closesAt" = \'24:01\'',
    '"opensAt" = \'06:60\'',
    '"opensAt" = NULL',
    '"closesAt" = NULL',
    '"closesAt" = \'06:00\'',
  ])('database rejects invalid direct writes: %s', (assignment) => {
    expect(() =>
      sql(
        databaseName,
        `UPDATE "master_terminals" SET ${assignment} WHERE "id" = '${terminalId}';`,
      ),
    ).toThrow();
  });
  it('accepts overnight hours and optional-field clearing with actual SQL constraints', async () => {
    await service.update(
      'terminals',
      terminalId,
      { opensAt: '22:00', closesAt: '06:00' },
      3,
      actor,
    );
    const cleared = await service.update(
      'terminals',
      terminalId,
      { gateCount: '', operatingHoursMode: '', opensAt: '', closesAt: '' },
      4,
      actor,
    );
    expect(cleared.data.attributes).toMatchObject({
      gateCount: null,
      operatingHoursMode: null,
      opensAt: null,
      closesAt: null,
    });
    const fullDay = await service.update(
      'terminals',
      terminalId,
      { gateCount: 0, operatingHoursMode: 'ALL_DAY' },
      5,
      actor,
    );
    expect(fullDay.data.attributes).toMatchObject({
      gateCount: 0,
      operatingHoursMode: 'ALL_DAY',
    });
    expect(() =>
      sql(
        databaseName,
        `UPDATE "master_terminals" SET "airportId" = '99999999-9999-4999-8999-999999999999' WHERE "id" = '${terminalId}';`,
      ),
    ).toThrow(/foreign key/i);
  });
});
