import { execFileSync } from 'node:child_process';
import { randomBytes, randomUUID } from 'node:crypto';
import { readFileSync, readdirSync } from 'node:fs';
import { resolve } from 'node:path';
import { parseEnv } from 'node:util';
import { ConfigService } from '@nestjs/config';
import { createDatabaseClient, type DatabaseClient } from '@rubi/database';
import { afterAll, beforeAll, describe, expect, it } from 'vitest';
import type { DatabaseService } from '../src/database/database.service';
import { masterDataDemoRecords } from '../src/master-data/demo/demo-data';
import {
  DEMO_ACTOR_ID,
  seedLocalMasterDataDemo,
} from '../src/master-data/demo/local-demo';
import { MasterDataContactCrypto } from '../src/master-data/master-data-contact.crypto';
import { MasterDataRepository } from '../src/master-data/master-data.repository';
import { MasterDataService } from '../src/master-data/master-data.service';

const databaseName = `rubi_md_demo_test_${randomUUID().replaceAll('-', '')}`;
const contactKey = randomBytes(32).toString('base64');
const attribution = {
  createdByUserId: DEMO_ACTOR_ID,
  updatedByUserId: DEMO_ACTOR_ID,
};
let client: DatabaseClient;
let databaseUrl: string;
let service: MasterDataService;
let created = false;
let sentinelId: string;
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
    { input, encoding: 'utf8', stdio: 'pipe', timeout: 60000 },
  );
}
const run = (apply: boolean) =>
  seedLocalMasterDataDemo({
    databaseUrl,
    environment: 'test',
    contactKey,
    apply,
  });

describe.skipIf(process.env.RUBI_RUN_DEMO_POSTGRES_TESTS !== '1')(
  'Master Data demo on isolated PostgreSQL 18',
  () => {
    beforeAll(async () => {
      const local = parseEnv(
        readFileSync(resolve(process.cwd(), '.env'), 'utf8'),
      );
      const url = new URL(local.DATABASE_URL!);
      if (
        !['localhost', '127.0.0.1'].includes(url.hostname) ||
        url.port !== '55432' ||
        !/^rubi_md_demo_test_[a-f0-9]{32}$/.test(databaseName)
      )
        throw new Error('Invalid local test target');
      sql('postgres', `CREATE DATABASE "${databaseName}";`);
      created = true;
      const migrations = resolve(
        process.cwd(),
        '../../packages/database/prisma/migrations',
      );
      const files = readdirSync(migrations, { withFileTypes: true })
        .filter((entry) => entry.isDirectory())
        .sort((a, b) => a.name.localeCompare(b.name));
      sql(
        databaseName,
        files
          .map((entry) =>
            readFileSync(
              resolve(migrations, entry.name, 'migration.sql'),
              'utf8',
            ),
          )
          .join('\n'),
      );
      url.pathname = `/${databaseName}`;
      databaseUrl = url.toString();
      client = createDatabaseClient(databaseUrl);
      expect(
        (
          await client.$queryRawUnsafe<{ version: string }[]>(
            'SELECT version()',
          )
        )[0]?.version,
      ).toContain('PostgreSQL 18.');
      service = new MasterDataService(
        new MasterDataRepository({ client } as DatabaseService),
        new MasterDataContactCrypto(
          new ConfigService({
            MASTER_DATA_IMPORT_TOKEN_KEY_BASE64: contactKey,
          }),
        ),
      );
      sentinelId = (
        await client.masterCountry.create({
          data: {
            code: 'IR',
            name: 'Existing reference - do not edit',
            englishName: 'Existing',
            ...attribution,
          },
        })
      ).id;
    }, 120000);

    afterAll(async () => {
      if (client) await client.$disconnect();
      if (created && /^rubi_md_demo_test_[a-f0-9]{32}$/.test(databaseName))
        sql('postgres', `DROP DATABASE "${databaseName}" WITH (FORCE);`);
    });

    it('rolls back the entire batch on a collision without overwriting an existing record', async () => {
      const bank = await client.masterBank.create({
        data: {
          code: 'DEMO_BANK_1',
          name: 'Existing bank',
          englishName: 'Existing',
          countryId: sentinelId,
          ...attribution,
        },
      });
      await expect(run(true)).rejects.toThrow('bank-1');
      expect(await client.masterCountry.count()).toBe(1);
      expect(await client.masterCurrency.count()).toBe(0);
      expect(await client.masterDataAuditEvent.count()).toBe(0);
      expect(
        await client.masterBank.findUnique({ where: { id: bank.id } }),
      ).toEqual(bank);
      await client.masterBank.delete({ where: { id: bank.id } }); // Only this isolated test's sentinel.
    }, 120000);

    it('previews every fixture through real validation and rolls back all records and audit entries', async () => {
      const result = await run(false);
      expect(result.created).toBe(masterDataDemoRecords().length);
      expect(result.applied).toBe(false);
      expect(await client.masterCountry.count()).toBe(1);
      expect(await client.masterDataAuditEvent.count()).toBe(0);
    }, 120000);

    it('applies once, preserves existing and edited records, and never duplicates on rerun', async () => {
      const sentinel = await client.masterCountry.findUnique({
        where: { id: sentinelId },
      });
      const first = await run(true);
      expect(first.created).toBe(masterDataDemoRecords().length);
      const sampleId = first.records.find((row) => row.key === 'city-1')!.id;
      const edited = await client.masterCity.update({
        where: { id: sampleId },
        data: { englishName: 'User edited sample', version: { increment: 1 } },
      });
      const auditCount = await client.masterDataAuditEvent.count();
      const second = await run(true);
      expect(second.created).toBe(0);
      expect(second.reused).toBe(first.created);
      expect(second.records).toEqual(first.records);
      expect(await client.masterDataAuditEvent.count()).toBe(auditCount);
      expect(
        await client.masterCity.findUnique({ where: { id: sampleId } }),
      ).toEqual(edited);
      expect(
        await client.masterCountry.findUnique({ where: { id: sentinelId } }),
      ).toEqual(sentinel);
    }, 120000);

    it('exposes all samples through list/detail with real relations and protected contacts, without FX or fake connections', async () => {
      const report = await run(true);
      for (const resource of new Set(
        report.records.map((row) => row.resource),
      )) {
        const result = await service.list(resource, {
          search: '',
          status: 'all',
          sortBy: 'name',
          sortDirection: 'asc',
          page: 1,
          pageSize: 100,
        });
        for (const fixture of report.records.filter(
          (row) => row.resource === resource,
        )) {
          expect(
            result.data.some((row) => row.id === fixture.id),
            resource,
          ).toBe(true);
          const detail = (await service.detail(resource, fixture.id)).data;
          expect(detail.id).toBe(fixture.id);
          if (
            ['airlines', 'rail-companies', 'bus-companies'].includes(resource)
          ) {
            expect(detail.attributes.integrationConnectionReference).toBeNull();
            expect(detail.attributes.integrationConnectionStatus).toBe(
              'UNAVAILABLE',
            );
          }
        }
      }
      expect(await client.masterHotelMealService.count()).toBe(4);
      expect(await client.masterSupplierService.count()).toBe(4);
      expect(await client.masterBrokerService.count()).toBe(4);
      expect(await client.masterInsurancePlanCoverage.count()).toBe(2);
      expect(await client.masterCompositeHotelMember.count()).toBe(2);
      expect(await client.masterDraftExchangeRate.count()).toBe(0);
      const contacts = await service.list('organization-contacts', {
        search: '',
        status: 'all',
        sortBy: 'name',
        sortDirection: 'asc',
        page: 1,
        pageSize: 10,
      });
      expect(JSON.stringify(contacts)).not.toContain(
        'master-demo-1@example.invalid',
      );
      expect(JSON.stringify(contacts)).toContain('•');
      const audits = await client.masterDataAuditEvent.findMany();
      expect(JSON.stringify(audits)).not.toContain(
        'master-demo-1@example.invalid',
      );
      expect(JSON.stringify(audits)).not.toContain('emailEncrypted');
      expect(
        await client.masterManifestTemplate.count({
          where: { publicationStatus: 'DRAFT', fileReferenceId: null },
        }),
      ).toBe(2);
      expect(
        await client.masterAirline.count({
          where: { logoFileReference: { not: null } },
        }),
      ).toBe(0);
    }, 120000);
  },
);
