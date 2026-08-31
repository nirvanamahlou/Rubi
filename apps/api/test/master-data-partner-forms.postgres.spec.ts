import { execFileSync } from 'node:child_process';
import { randomBytes, randomUUID } from 'node:crypto';
import { readFileSync, readdirSync } from 'node:fs';
import { resolve } from 'node:path';
import { parseEnv } from 'node:util';
import { ConfigService } from '@nestjs/config';
import type { AuthenticatedActor } from '@rubi/contracts';
import { createDatabaseClient, type DatabaseClient } from '@rubi/database';
import { afterAll, beforeAll, describe, expect, it } from 'vitest';
import type { DatabaseService } from '../src/database/database.service';
import { MasterDataContactCrypto } from '../src/master-data/master-data-contact.crypto';
import { MasterDataRepository } from '../src/master-data/master-data.repository';
import { MasterDataService } from '../src/master-data/master-data.service';

import { postgresTestTarget } from './postgres-test-target';
const postgresTarget = postgresTestTarget();

const enabled = process.env.RUBI_RUN_PARTNER_POSTGRES_TESTS === '1';
const databaseName = `rubi_md_partner_test_${randomUUID().replaceAll('-', '')}`;
const userId = '11111111-1111-4111-8111-111111111111';
const attribution = { createdByUserId: userId, updatedByUserId: userId };
const actor: AuthenticatedActor = {
  userId,
  sessionId: userId,
  branchIds: [userId],
  permissions: [
    'master_data.create',
    'master_data.update',
    'master_data.read',
    'master_data.status.manage',
    'master_data.sensitive_contact.unmask',
  ],
};
let client: DatabaseClient;
let service: MasterDataService;
let repository: MasterDataRepository;
let created = false;
let organizationId: string;
let otherOrganizationId: string;
let contactId: string;
let otherContactId: string;
const plaintextPhone = '+12025550123'; // Reserved fictional North American number; test DB only.

function sql(database: string, input: string) {
  return execFileSync(
    'docker',
    [
      'exec',
      '-i',
      postgresTarget.container,
      'psql',
      '-U',
      postgresTarget.user,
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

describe.skipIf(!enabled)('partner forms on isolated PostgreSQL 18', () => {
  beforeAll(async () => {
    const local = process.env.RUBI_TEST_POSTGRES_CONTAINER
      ? process.env
      : parseEnv(readFileSync(resolve(process.cwd(), '.env'), 'utf8'));
    const url = new URL(local.DATABASE_URL!);
    if (
      !['localhost', '127.0.0.1'].includes(url.hostname) ||
      url.port !== postgresTarget.port
    )
      throw new Error('Only local Rubi PostgreSQL is allowed.');
    if (!/^rubi_md_partner_test_[a-f0-9]{32}$/.test(databaseName))
      throw new Error('Invalid isolated DB name');
    sql('postgres', `CREATE DATABASE "${databaseName}";`);
    created = true;
    const migrations = resolve(
      process.cwd(),
      '../../packages/database/prisma/migrations',
    );
    for (const entry of readdirSync(migrations, { withFileTypes: true })
      .filter((item) => item.isDirectory())
      .sort((a, b) => a.name.localeCompare(b.name)))
      sql(
        databaseName,
        readFileSync(resolve(migrations, entry.name, 'migration.sql'), 'utf8'),
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
    for (let run = 0; run < 2; run++)
      execFileSync(process.execPath, ['--import', 'tsx', 'prisma/seed.ts'], {
        cwd: packagePath,
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
    expect(await client.masterSupplier.count()).toBe(0);
    expect(await client.masterBroker.count()).toBe(0);
    repository = new MasterDataRepository({ client } as DatabaseService);
    const crypto = new MasterDataContactCrypto(
      new ConfigService({
        MASTER_DATA_IMPORT_TOKEN_KEY_BASE64: randomBytes(32).toString('base64'),
      }),
    );
    service = new MasterDataService(repository, crypto);
    organizationId = (
      await service.create(
        'organizations',
        {
          legalName: 'Test partner organization',
          displayName: 'Test organization',
          roleCodes: 'SUPPLIER,BROKER',
          personType: 'LEGAL',
        },
        actor,
      )
    ).data.id;
    otherOrganizationId = (
      await service.create(
        'organizations',
        {
          legalName: 'Other test organization',
          displayName: 'Other test',
          roleCodes: 'BROKER',
        },
        actor,
      )
    ).data.id;
    contactId = (
      await service.create(
        'organization-contacts',
        {
          organizationId,
          fullName: 'Test contact',
          preferredChannel: 'PHONE',
          phone: plaintextPhone,
        },
        actor,
      )
    ).data.id;
    otherContactId = (
      await service.create(
        'organization-contacts',
        {
          organizationId: otherOrganizationId,
          fullName: 'Other test contact',
          preferredChannel: 'EMAIL',
          email: 'test-contact@example.invalid',
        },
        actor,
      )
    ).data.id;
    await service.create(
      'travel-services',
      { code: 'TEST_HOTEL', name: 'Test hotel service' },
      actor,
    );
  }, 180000);

  afterAll(async () => {
    if (client) await client.$disconnect();
    if (created && /^rubi_md_partner_test_[a-f0-9]{32}$/.test(databaseName))
      sql('postgres', `DROP DATABASE "${databaseName}" WITH (FORCE);`);
  }, 30000);

  it.each(['suppliers', 'brokers'] as const)(
    'creates, reads, edits, clears and audits %s without disclosing contacts',
    async (resource) => {
      const result = await service.create(
        resource,
        {
          ...(resource === 'brokers' ? { name: 'Test broker' } : {}),
          organizationId,
          englishName: 'Test Partner',
          primaryContactId: contactId,
          serviceCodes: ['TEST_HOTEL'],
        },
        actor,
      );
      expect(result.data.attributes).toMatchObject({
        englishName: 'Test Partner',
        primaryContactId: contactId,
        organizationPersonType: 'LEGAL',
        serviceCodes: 'TEST_HOTEL',
      });
      expect(result.data.attributes.primaryPhoneMasked).toContain('•');
      expect(JSON.stringify(result)).not.toContain(plaintextPhone);
      const publicList = await service.list(resource, {
        search: 'Test Partner',
        status: 'all',
        sortBy: 'name',
        sortDirection: 'asc',
        page: 1,
        pageSize: 20,
      });
      expect(publicList.meta.total).toBe(1);
      expect(JSON.stringify(publicList)).not.toContain(plaintextPhone);
      const audits = await client.masterDataAuditEvent.findMany({
        where: { entityId: result.data.id },
      });
      expect(JSON.stringify(audits)).not.toMatch(
        /phoneEncrypted|phoneFingerprint|phoneEncryptionIv/,
      );
      expect(JSON.stringify(audits)).not.toContain(plaintextPhone);
      const updated = await service.update(
        resource,
        result.data.id,
        { englishName: 'Renamed Partner' },
        1,
        actor,
      );
      expect(updated.data.attributes.primaryContactId).toBe(contactId);
      await expect(
        service.update(
          resource,
          result.data.id,
          { englishName: 'stale' },
          1,
          actor,
        ),
      ).rejects.toThrow('هم‌زمان');
      await expect(
        service.update(
          resource,
          result.data.id,
          { primaryContactId: otherContactId },
          2,
          actor,
        ),
      ).rejects.toThrow('همان سازمان');
      const cleared = await service.update(
        resource,
        result.data.id,
        { englishName: '', primaryContactId: '', serviceCodes: '' },
        2,
        actor,
      );
      expect(cleared.data.attributes).toMatchObject({
        englishName: null,
        primaryContactId: null,
        serviceCodes: '',
      });
    },
  );

  it('enforces same-organization FK at the database layer and blocks identity transfer/deletion', async () => {
    const broker = await client.masterBroker.findUniqueOrThrow({
      where: { organizationId },
    });
    await expect(
      client.masterBroker.update({
        where: { id: broker.id },
        data: { primaryContactId: otherContactId },
      }),
    ).rejects.toMatchObject({ code: 'P2003' });
    await client.masterBroker.update({
      where: { id: broker.id },
      data: { primaryContactId: contactId },
    });
    expect(() =>
      sql(
        databaseName,
        `UPDATE "master_organization_contacts" SET "organizationId" = '${otherOrganizationId}' WHERE "id" = '${contactId}';`,
      ),
    ).toThrow(/foreign key constraint/i);
    expect(
      (
        await client.masterOrganizationContact.findUniqueOrThrow({
          where: { id: contactId },
        })
      ).organizationId,
    ).toBe(organizationId);
    expect(() =>
      sql(
        databaseName,
        `DELETE FROM "master_organization_contacts" WHERE "id" = '${contactId}';`,
      ),
    ).toThrow(/foreign key constraint/i);
    expect(
      await client.masterOrganizationContact.findUnique({
        where: { id: contactId },
      }),
    ).not.toBeNull();
  });

  it('rejects invalid person type and supports legacy unspecified identity without guessing', async () => {
    await expect(
      client.masterOrganization.update({
        where: { id: organizationId },
        data: { personType: 'BROKER' },
      }),
    ).rejects.toThrow();
    expect(
      (
        await client.masterOrganization.findUniqueOrThrow({
          where: { id: otherOrganizationId },
        })
      ).personType,
    ).toBeNull();
    const stored = await client.masterOrganizationContact.findUniqueOrThrow({
      where: { id: contactId },
    });
    expect(stored.phoneEncrypted).not.toBe(plaintextPhone);
    expect(stored.phoneMasked).not.toContain(plaintextPhone);
    const country = await client.masterCountry.findFirstOrThrow();
    const city = await client.masterCity.create({
      data: {
        code: 'TEST_PARTNER_CITY',
        name: 'Test city',
        englishName: 'Test city',
        countryId: country.id,
        ...attribution,
      },
    });
    expect(city.countryId).toBe(country.id);
  });
});
