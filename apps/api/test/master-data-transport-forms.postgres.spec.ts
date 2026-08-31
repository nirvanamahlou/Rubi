import { execFileSync } from 'node:child_process';
import { randomBytes, randomUUID } from 'node:crypto';
import { readFileSync, readdirSync } from 'node:fs';
import { resolve } from 'node:path';
import { parseEnv } from 'node:util';
import {
  MASTER_TRANSPORT_FORM_RESOURCES,
  type AuthenticatedActor,
  type MasterDataRecord,
} from '@rubi/contracts';
import { createDatabaseClient, type DatabaseClient } from '@rubi/database';
import { afterAll, beforeAll, describe, expect, it } from 'vitest';
import type { DatabaseService } from '../src/database/database.service';
import { MasterDataRepository } from '../src/master-data/master-data.repository';
import { MasterDataService } from '../src/master-data/master-data.service';

const enabled = process.env.RUBI_RUN_TRANSPORT_POSTGRES_TESTS === '1';
const databaseName = `rubi_md_transport_test_${randomUUID().replaceAll('-', '')}`;
const userId = '11111111-1111-4111-8111-111111111111';
const actor: AuthenticatedActor = {
  userId,
  sessionId: userId,
  branchIds: [userId],
  permissions: [
    'master_data.create',
    'master_data.update',
    'master_data.read',
    'master_data.status.manage',
  ],
};
let client: DatabaseClient;
let service: MasterDataService;
let repository: MasterDataRepository;
let created = false;
const records: Record<string, MasterDataRecord> = {};
let facilityId: string;

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

describe.skipIf(!enabled)('transport forms on isolated PostgreSQL 18', () => {
  beforeAll(async () => {
    const local = parseEnv(
      readFileSync(
        process.env.RUBI_TRANSPORT_TEST_ENV_FILE ??
          resolve(process.cwd(), '.env'),
        'utf8',
      ),
    );
    const url = new URL(local.DATABASE_URL!);
    if (
      !['localhost', '127.0.0.1'].includes(url.hostname) ||
      url.port !== '55432'
    )
      throw new Error('Only local Rubi PostgreSQL is allowed.');
    if (!/^rubi_md_transport_test_[a-f0-9]{32}$/.test(databaseName))
      throw new Error('Invalid isolated DB name');
    sql('postgres', `CREATE DATABASE "${databaseName}";`);
    created = true;
    const migrations = resolve(
      process.cwd(),
      '../../packages/database/prisma/migrations',
    );
    for (const entry of readdirSync(migrations, { withFileTypes: true })
      .filter((item) => item.isDirectory())
      .sort((a, b) => a.name.localeCompare(b.name))) {
      if (entry.name === '20260831120000_master_data_transport_forms')
        sql(
          databaseName,
          `INSERT INTO master_train_types (id,code,manufacturer,model,name,category,amenities,"createdByUserId","updatedByUserId","updatedAt") VALUES ('22222222-2222-4222-8222-222222222222','LEGACY_TEST','Legacy maker','Legacy model','Legacy train','SLEEPER',ARRAY['legacy preserved'],'${userId}','${userId}',CURRENT_TIMESTAMP);`,
        );
      sql(
        databaseName,
        readFileSync(resolve(migrations, entry.name, 'migration.sql'), 'utf8'),
      );
    }
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
      execFileSync(process.execPath, ['--import', 'tsx', 'prisma/seed.ts'], {
        cwd: resolve(process.cwd(), '../../packages/database'),
        env,
        stdio: 'pipe',
        timeout: 60000,
      });
    client = createDatabaseClient(url.toString());
    expect(
      (
        await client.$queryRawUnsafe<{ version: string }[]>('SELECT version()')
      )[0]?.version,
    ).toContain('PostgreSQL 18.');
    const legacy = await client.masterTrainType.findUniqueOrThrow({
      where: { code: 'LEGACY_TEST' },
    });
    expect(legacy.amenities).toEqual(['legacy preserved']);
    expect(legacy.isUnderReview).toBe(false);
    expect(legacy.isActive).toBe(true);
    expect(await client.masterDraftExchangeRate.count()).toBe(0);
    repository = new MasterDataRepository({ client } as DatabaseService);
    service = new MasterDataService(repository);
    const country = await client.masterCountry.findFirstOrThrow();
    const org = async (role: string) =>
      (
        await service.create(
          'organizations',
          {
            legalName: `Test ${role}`,
            displayName: `Test ${role}`,
            roleCodes: role,
          },
          actor,
        )
      ).data.id;
    facilityId = (
      await service.create(
        'facilities',
        { name: 'Test facility', englishName: 'Test facility' },
        actor,
      )
    ).data.id;
    const input: Record<string, Record<string, string>> = {
      airlines: {
        code: 'ZZ',
        name: 'Test airline',
        englishName: 'Test airline',
        icaoCode: 'ZZZ',
        organizationId: await org('AIRLINE'),
        countryId: country.id,
      },
      'aircraft-types': {
        name: 'Test aircraft',
        englishName: 'Test aircraft',
        manufacturer: 'Test',
        model: 'Aircraft',
        bodyType: 'NARROW_BODY',
      },
      'rail-companies': {
        name: 'Test rail',
        englishName: 'Test rail',
        organizationId: await org('RAIL_OPERATOR'),
        countryId: country.id,
      },
      'bus-companies': {
        name: 'Test bus',
        englishName: 'Test bus',
        organizationId: await org('BUS_PROVIDER'),
        countryId: country.id,
      },
      'train-types': {
        name: 'Test train',
        englishName: 'Test train',
        manufacturer: 'Test',
        model: 'Train',
        category: 'SLEEPER',
        facilityIds: facilityId,
      },
      'bus-types': {
        name: 'Test bus type',
        englishName: 'Test bus type',
        manufacturer: 'Test',
        model: 'Bus',
        serviceClass: 'VIP',
        facilityIds: facilityId,
      },
    };
    for (const [resource, values] of Object.entries(input))
      records[resource] = (
        await service.create(
          resource,
          { ...values, transportStatus: 'ACTIVE' },
          actor,
        )
      ).data;
    records['baggage-rules'] = (
      await service.create(
        'baggage-rules',
        {
          name: 'Test baggage',
          airlineId: records.airlines!.id,
          passengerType: 'ADT',
          routeScope: 'INTERNATIONAL',
          allowance: '23.50',
          unit: 'KG',
          pieceCount: '2',
          validFrom: '2026-01-01',
          validTo: '2027-01-01',
          transportStatus: 'ACTIVE',
        },
        actor,
      )
    ).data;
  }, 240000);

  afterAll(async () => {
    if (client) await client.$disconnect();
    if (created && /^rubi_md_transport_test_[a-f0-9]{32}$/.test(databaseName))
      sql('postgres', `DROP DATABASE "${databaseName}" WITH (FORCE);`);
  }, 30000);

  it.each(MASTER_TRANSPORT_FORM_RESOURCES)(
    'creates/edits/audits %s with permissions, constraints and optimistic lock',
    async (resource) => {
      const record = records[resource]!;
      const updated = (
        await service.update(
          resource,
          record.id,
          { name: record.name + ' edited', transportStatus: 'UNDER_REVIEW' },
          record.version,
          actor,
        )
      ).data;
      expect(updated.version).toBe(2);
      expect(updated.status).toBe('inactive');
      expect(updated.attributes.transportStatus).toBe('UNDER_REVIEW');
      await expect(
        service.update(
          resource,
          record.id,
          { name: 'stale' },
          record.version,
          actor,
        ),
      ).rejects.toThrow('هم‌زمان');
      const table = 'master_' + resource.replaceAll('-', '_');
      await expect(
        client.$executeRawUnsafe(
          `UPDATE "${table}" SET "isActive" = true WHERE id = '${record.id}'`,
        ),
      ).rejects.toThrow();
      const active = await repository.list(resource, {
        search: '',
        status: 'active',
        sortBy: 'name',
        sortDirection: 'asc',
        page: 1,
        pageSize: 25,
      });
      expect(active.rows.some((row) => row.id === record.id)).toBe(false);
      const review = await repository.list(resource, {
        search: '',
        status: 'all',
        transportStatus: 'UNDER_REVIEW',
        sortBy: 'name',
        sortDirection: 'asc',
        page: 1,
        pageSize: 25,
      });
      expect(review.rows.some((row) => row.id === record.id)).toBe(true);
      await expect(
        service.update(
          resource,
          record.id,
          { transportStatus: 'ACTIVE' },
          updated.version,
          { ...actor, permissions: ['master_data.update'] },
        ),
      ).rejects.toThrow('مجوز');
      const audit = await client.masterDataAuditEvent.findMany({
        where: { resource, entityId: record.id },
        orderBy: { occurredAt: 'asc' },
      });
      expect(audit).toHaveLength(2);
      expect(audit[1]?.afterSnapshot).toMatchObject({
        isUnderReview: true,
        isActive: false,
        version: 2,
      });
      const reactivated = (
        await service.status(
          resource,
          record.id,
          'active',
          updated.version,
          actor,
        )
      ).data;
      expect(reactivated.attributes.transportStatus).toBe('ACTIVE');
      records[resource] = reactivated;
    },
  );
  it('persists/clears train facilities, blocks missing FK and preserves audit/legacy values', async () => {
    const record = records['train-types']!;
    expect(record.attributes.facilityIds).toBe(facilityId);
    expect(record.attributes.facilityNames).toBe('Test facility');
    await expect(
      client.masterFacility.delete({ where: { id: facilityId } }),
    ).rejects.toThrow();
    await expect(
      client.masterTrainTypeFacility.create({
        data: {
          trainTypeId: record.id,
          facilityId: randomUUID(),
          assignedByUserId: userId,
        },
      }),
    ).rejects.toThrow();
    const result = await service.update(
      'train-types',
      record.id,
      { facilityIds: '' },
      record.version,
      actor,
    );
    expect(result.data.attributes.facilityIds).toBe('');
    expect(
      await client.masterTrainTypeFacility.count({
        where: { trainTypeId: record.id },
      }),
    ).toBe(0);
    const legacy = await client.masterTrainType.findUniqueOrThrow({
      where: { code: 'LEGACY_TEST' },
    });
    expect(legacy.amenities).toEqual(['legacy preserved']);
  });
  it('rejects invalid baggage values and retains omitted validity on patch', async () => {
    const record = records['baggage-rules']!;
    for (const values of [
      { allowance: '-1' },
      { allowance: '1.123' },
      { pieceCount: '0' },
      { unit: 'PC', pieceCount: '' },
      { validTo: '2025-01-01' },
    ])
      await expect(
        service.update(
          'baggage-rules',
          record.id,
          values,
          record.version,
          actor,
        ),
      ).rejects.toThrow();
    const result = await service.update(
      'baggage-rules',
      record.id,
      { description: 'Updated without changing validity' },
      record.version,
      actor,
    );
    expect(result.data.attributes.validFrom).toBe(record.attributes.validFrom);
    expect(result.data.attributes.validTo).toBe(record.attributes.validTo);
  });
});
