import { execFileSync } from 'node:child_process';
import { randomUUID } from 'node:crypto';
import { existsSync, readFileSync, readdirSync } from 'node:fs';
import { resolve } from 'node:path';
import { parseEnv } from 'node:util';
import { ConflictException } from '@nestjs/common';
import type { AuthenticatedActor } from '@rubi/contracts';
import { createDatabaseClient, type DatabaseClient } from '@rubi/database';
import { afterAll, beforeAll, describe, expect, it } from 'vitest';

import type { DatabaseService } from '../src/database/database.service';
import { MasterDataRepository } from '../src/master-data/master-data.repository';
import { MasterDataService } from '../src/master-data/master-data.service';

// Opt-in only. Never run migrations, fixtures or cleanup on the application DB.
const enabled = process.env.RUBI_RUN_DELETE_POSTGRES_TESTS === '1';
const container = 'rubi-postgres-1';
const databaseName = `rubi_md_delete_test_${randomUUID().replaceAll('-', '')}`;
const owner = 'rubi_local';
const actorId = '11111111-1111-4111-8111-111111111111';
const branchId = '33333333-3333-4333-8333-333333333333';
const attribution = { createdByUserId: actorId, updatedByUserId: actorId };
const actor: AuthenticatedActor = {
  userId: actorId,
  sessionId: '22222222-2222-4222-8222-222222222222',
  branchIds: [branchId],
  permissions: ['master_data.delete'],
};
let created = false;
let client: DatabaseClient;
let repository: MasterDataRepository;
let masterDataService: MasterDataService;
let countryId: string;
let cityId: string;

function sql(database: string, input: string) {
  execFileSync(
    'docker',
    [
      'exec',
      '-i',
      container,
      'psql',
      '-U',
      owner,
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

describe.skipIf(!enabled)('safe deletion on isolated PostgreSQL 18', () => {
  beforeAll(async () => {
    const localEnvironment = [
      resolve(process.cwd(), '.env'),
      resolve(process.cwd(), '../../.env'),
    ].find(existsSync);
    const databaseUrl =
      process.env.DATABASE_URL ??
      (localEnvironment
        ? parseEnv(readFileSync(localEnvironment, 'utf8')).DATABASE_URL
        : undefined);
    if (!databaseUrl)
      throw new Error('Local DATABASE_URL is required for the isolated test.');
    const configured = new URL(databaseUrl);
    if (
      !['localhost', '127.0.0.1'].includes(configured.hostname) ||
      configured.port !== '55432'
    )
      throw new Error(
        'Deletion integration tests require the local Rubi PostgreSQL port.',
      );
    if (!/^rubi_md_delete_test_[a-f0-9]{32}$/.test(databaseName))
      throw new Error('Invalid test database name');
    sql('postgres', `CREATE DATABASE "${databaseName}";`);
    created = true;
    const migrations = resolve(
      process.cwd(),
      '../../packages/database/prisma/migrations',
    );
    for (const directory of readdirSync(migrations, { withFileTypes: true })
      .filter((entry) => entry.isDirectory())
      .sort((a, b) => a.name.localeCompare(b.name)))
      sql(
        databaseName,
        readFileSync(
          resolve(migrations, directory.name, 'migration.sql'),
          'utf8',
        ),
      );
    configured.pathname = `/${databaseName}`;
    client = createDatabaseClient(configured.toString());
    repository = new MasterDataRepository({ client } as DatabaseService);
    masterDataService = new MasterDataService(repository);
    const version = await client.$queryRawUnsafe<{ version: string }[]>(
      'SELECT version() AS version',
    );
    expect(version[0]!.version).toContain('PostgreSQL 18.');
    countryId = (
      await client.masterCountry.create({
        data: {
          code: 'IR',
          name: 'Test country',
          englishName: 'Test country',
          ...attribution,
        },
      })
    ).id;
    cityId = (
      await client.masterCity.create({
        data: {
          code: 'DELETE_TEST_CITY',
          name: 'Test city',
          englishName: 'Test city',
          countryId,
          ...attribution,
        },
      })
    ).id;
  }, 120000);

  afterAll(async () => {
    if (client) await client.$disconnect();
    if (created && /^rubi_md_delete_test_[a-f0-9]{32}$/.test(databaseName))
      sql('postgres', `DROP DATABASE "${databaseName}" WITH (FORCE);`);
  }, 30000);

  it('physically removes an unused bank while preserving its previous audit and recording deletion', async () => {
    const bank = await client.masterBank.create({
      data: {
        code: 'DELETE_UNUSED',
        name: 'Test bank',
        countryId,
        ...attribution,
      },
    });
    await client.masterDataAuditEvent.create({
      data: {
        action: 'master_data.create',
        resource: 'banks',
        entityId: bank.id,
        actorUserId: actorId,
        actorBranchId: branchId,
        outcome: 'SUCCESS',
        afterSnapshot: { id: bank.id, version: 1 },
      },
    });
    await repository.remove('banks', bank.id, bank.version, actorId, branchId);
    expect(
      await client.masterBank.findUnique({ where: { id: bank.id } }),
    ).toBeNull();
    const audit = await client.masterDataAuditEvent.findMany({
      where: { entityId: bank.id },
      orderBy: { occurredAt: 'asc' },
    });
    expect(audit.map((event) => event.action)).toEqual([
      'master_data.create',
      'master_data.delete',
    ]);
    expect(audit[1]!.beforeSnapshot).toEqual({ id: bank.id, version: 1 });
  });

  it('blocks a bank referenced by a branch and rolls back its version claim', async () => {
    const bank = await client.masterBank.create({
      data: {
        code: 'DELETE_USED',
        name: 'Test bank',
        countryId,
        ...attribution,
      },
    });
    const branch = await client.masterBankBranch.create({
      data: {
        bankId: bank.id,
        cityId,
        code: 'DELETE_BRANCH',
        name: 'Test branch',
        ...attribution,
      },
    });
    await expect(
      masterDataService.remove('banks', bank.id, 1, actor),
    ).rejects.toMatchObject({
      response: { code: 'MASTER_DATA_IN_USE' },
      status: 409,
    });
    expect(
      await client.masterBank.findUnique({ where: { id: bank.id } }),
    ).toMatchObject({ version: 1 });
    expect(
      await client.masterBankBranch.findUnique({ where: { id: branch.id } }),
    ).not.toBeNull();
    expect(
      await client.masterDataAuditEvent.count({ where: { entityId: bank.id } }),
    ).toBe(0);
  });

  it('rolls back owned links when an organization is still used; removes only owned links when free', async () => {
    const organization = await client.masterOrganization.create({
      data: {
        code: 'DELETE_ORG',
        legalName: 'Test organization',
        displayName: 'Test organization',
        ...attribution,
        roles: { create: { roleCode: 'SUPPLIER', assignedByUserId: actorId } },
      },
    });
    const service = await client.masterTravelService.create({
      data: { code: 'DELETE_SERVICE', name: 'Test service', ...attribution },
    });
    const supplier = await client.masterSupplier.create({
      data: {
        organizationId: organization.id,
        code: 'DELETE_SUPPLIER',
        ...attribution,
        services: {
          create: { serviceId: service.id, assignedByUserId: actorId },
        },
      },
    });
    await expect(
      masterDataService.remove('organizations', organization.id, 1, actor),
    ).rejects.toMatchObject({
      response: { code: 'MASTER_DATA_IN_USE' },
      status: 409,
    });
    expect(
      await client.masterOrganizationRole.count({
        where: { organizationId: organization.id },
      }),
    ).toBe(1);
    expect(
      await client.masterOrganization.findUnique({
        where: { id: organization.id },
      }),
    ).toMatchObject({ version: 1 });
    await repository.remove('suppliers', supplier.id, 1, actorId, branchId);
    expect(
      await client.masterSupplierService.count({
        where: { supplierId: supplier.id },
      }),
    ).toBe(0);
    expect(
      await client.masterTravelService.findUnique({
        where: { id: service.id },
      }),
    ).not.toBeNull();
    await repository.remove(
      'organizations',
      organization.id,
      1,
      actorId,
      branchId,
    );
    expect(
      await client.masterOrganizationRole.count({
        where: { organizationId: organization.id },
      }),
    ).toBe(0);
    expect(
      await client.masterOrganization.findUnique({
        where: { id: organization.id },
      }),
    ).toBeNull();
  });

  it('rolls back physical deletion and owned associations if audit append fails', async () => {
    const organization = await client.masterOrganization.create({
      data: {
        code: 'DELETE_AUDIT_FAIL',
        legalName: 'Test organization',
        displayName: 'Test organization',
        ...attribution,
        roles: { create: { roleCode: 'AGENCY', assignedByUserId: actorId } },
      },
    });
    sql(
      databaseName,
      `CREATE FUNCTION test_reject_delete_audit() RETURNS TRIGGER LANGUAGE plpgsql AS $$
      BEGIN IF NEW."entityId" = '${organization.id}'::uuid AND NEW.action = 'master_data.delete' THEN RAISE EXCEPTION 'test audit failure'; END IF; RETURN NEW; END $$;
      CREATE TRIGGER test_reject_delete_audit BEFORE INSERT ON master_audit_events FOR EACH ROW EXECUTE FUNCTION test_reject_delete_audit();`,
    );
    await expect(
      repository.remove('organizations', organization.id, 1, actorId, branchId),
    ).rejects.toThrow();
    expect(
      await client.masterOrganization.findUnique({
        where: { id: organization.id },
      }),
    ).toMatchObject({ version: 1 });
    expect(
      await client.masterOrganizationRole.count({
        where: { organizationId: organization.id },
      }),
    ).toBe(1);
    expect(
      await client.masterDataAuditEvent.count({
        where: { entityId: organization.id },
      }),
    ).toBe(0);
  });

  it('allows only one of two concurrent deletions and only one deletion audit', async () => {
    const bank = await client.masterBank.create({
      data: {
        code: 'DELETE_CONCURRENT',
        name: 'Test bank',
        countryId,
        ...attribution,
      },
    });
    const outcomes = await Promise.allSettled([
      repository.remove('banks', bank.id, 1, actorId, branchId),
      repository.remove('banks', bank.id, 1, actorId, branchId),
    ]);
    expect(
      outcomes.filter((result) => result.status === 'fulfilled'),
    ).toHaveLength(1);
    expect(
      outcomes.filter((result) => result.status === 'rejected'),
    ).toHaveLength(1);
    expect(
      await client.masterDataAuditEvent.count({
        where: { entityId: bank.id, action: 'master_data.delete' },
      }),
    ).toBe(1);
  });

  it('allows Draft deletion but retains approved currency-rate history and currency dependencies', async () => {
    const from = await client.masterCurrency.create({
      data: { code: 'USD', name: 'Test currency', ...attribution },
    });
    const to = await client.masterCurrency.create({
      data: { code: 'EUR', name: 'Test currency', ...attribution },
    });
    const data = {
      fromCurrencyId: from.id,
      toCurrencyId: to.id,
      rate: '1.2345678901',
      source: 'Isolated integration test',
      observedAt: new Date(),
      validFrom: new Date(),
      ...attribution,
    };
    const draft = await client.masterDraftExchangeRate.create({ data });
    await repository.remove('exchange-rates', draft.id, 1, actorId, branchId);
    expect(
      await client.masterDraftExchangeRate.findUnique({
        where: { id: draft.id },
      }),
    ).toBeNull();
    const approved = await client.masterDraftExchangeRate.create({
      data: {
        ...data,
        status: 'APPROVED',
        approvedAt: new Date(),
        approvedByUserId: '22222222-2222-4222-8222-222222222222',
      },
    });
    await expect(
      repository.remove('exchange-rates', approved.id, 1, actorId, branchId),
    ).rejects.toBeInstanceOf(ConflictException);
    await expect(
      masterDataService.remove('currencies', from.id, 1, actor),
    ).rejects.toMatchObject({
      response: { code: 'MASTER_DATA_IN_USE' },
      status: 409,
    });
    expect(
      await client.masterDraftExchangeRate.findUnique({
        where: { id: approved.id },
      }),
    ).toMatchObject({ status: 'APPROVED', version: 1 });
  });

  it('keeps all incoming Master Data foreign keys restrictive, including consumer FKs', async () => {
    const unsafe = await client.$queryRawUnsafe<{ name: string }[]>(
      `SELECT c.conname AS name FROM pg_constraint c JOIN pg_class target ON c.confrelid = target.oid WHERE c.contype = 'f' AND target.relname LIKE 'master_%' AND c.confdeltype NOT IN ('r', 'a')`,
    );
    expect(unsafe).toEqual([]);
  });
});
