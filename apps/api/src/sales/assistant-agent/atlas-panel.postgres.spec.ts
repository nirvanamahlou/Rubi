import { randomUUID } from 'node:crypto';
import { execFileSync } from 'node:child_process';
import { readFileSync } from 'node:fs';
import { resolve } from 'node:path';
import { Client } from 'pg';
import { expect, it } from 'vitest';
import type { AuthenticatedActor } from '@nora/contracts';
import { createDatabaseClient, type DatabaseClient } from '@nora/database';
import type { DatabaseService } from '../../database/database.service';
import type { LegalEntitiesService } from '../../legal-entities/legal-entities.service';
import type {
  SalesCustomersPublicAdapter,
  SalesTicketAvailabilityPort,
} from '../sales.adapters';
import { SalesRepository } from '../sales.repository';
import { SalesService } from '../sales.service';
import { ContractCompanyScope } from '../contract-company-scope.public';
import { readContractCountBreakdown } from './count-breakdown';
import { readStandardSalesSummary } from './rolling-sales';
import { CONTRACT_AMOUNT_RANKING_EXAMPLE } from './catalog';
import { validateAgentSql } from './sql-policy';

it.skipIf(process.env.NORA_RUN_AGENT_POSTGRES_TESTS !== '1')(
  'reconciles the Sales dashboard and scoped Nora reads on one disposable database',
  async () => {
    const address = new URL(process.env.NORA_AGENT_TEST_DATABASE_URL!);
    if (
      !['127.0.0.1', 'localhost'].includes(address.hostname) ||
      address.port !== '5432'
    )
      throw Error('LOOPBACK_TEST_DATABASE_REQUIRED');
    const name = 'nora_atlas_test_' + randomUUID().replaceAll('-', '');
    address.pathname = '/postgres';
    const admin = new Client({ connectionString: address.toString() });
    await admin.connect();
    let created = false,
      fixture: Client | undefined,
      db: DatabaseClient | undefined;
    try {
      await admin.query('CREATE DATABASE "' + name + '"');
      created = true;
      address.pathname = '/' + name;
      const folder = resolve('../../packages/database');
      fixture = new Client({ connectionString: address.toString() });
      await fixture.connect();
      // Prisma references this migration-owned SQL default while creating the document table.
      const archiveDefault = readFileSync(
        resolve(
          folder,
          'prisma/migrations/20260901090000_documents_vertical_slice/migration.sql',
        ),
        'utf8',
      ).match(
        /CREATE FUNCTION documents_generate_archive_code\(\)[\s\S]*?\$\$;/,
      )?.[0];
      if (!archiveDefault) throw Error('Missing archive default in migration');
      await fixture.query(archiveDefault);
      const ddl = execFileSync(
        process.execPath,
        [
          'node_modules/prisma/build/index.js',
          'migrate',
          'diff',
          '--from-empty',
          '--to-schema',
          'prisma/schema.prisma',
          '--script',
        ],
        {
          cwd: folder,
          env: { ...process.env, DATABASE_URL: address.toString() },
          encoding: 'utf8',
          maxBuffer: 8 * 1024 * 1024,
          stdio: ['ignore', 'pipe', 'ignore'],
          timeout: 60000,
        },
      );
      await fixture.query(ddl);
      await fixture.query(
        readFileSync(
          resolve(
            folder,
            'prisma/migrations/20261114120000_nora_agent_sales_views/migration.sql',
          ),
          'utf8',
        ),
      );
      db = createDatabaseClient(address.toString());
      const company = await db.legalEntity.create({
        data: { code: 'TEST', persianName: 'شرکت آزمایشی' },
      });
      const owner = randomUUID(),
        branch = randomUUID(),
        customer = randomUUID();
      for (const [idx, status] of (
        [
          'CONFIRMED',
          'COMPLETED',
          'CANCELLED',
          'CONFIRMED',
          'CONFIRMED',
        ] as const
      ).entries()) {
        await db.salesContract.create({
          data: {
            contractNumber: 'ATLAS-' + idx,
            legalEntityId: company.id,
            branchId: branch,
            ownerUserId: idx === 3 ? randomUUID() : owner,
            customerId: customer,
            payerCustomerId: customer,
            customerNameSnapshot: 'Synthetic',
            originId: randomUUID(),
            destinationId: randomUUID(),
            tripType: 'ONE_WAY',
            departureDate: new Date('2026-11-24'),
            status,
            hiddenAt: idx === 4 ? new Date() : null,
            confirmedAt: idx === 3 ? null : new Date(Date.now() - 60_000),
            createIdempotencyKey: randomUUID(),
            createRequestFingerprint: '0'.repeat(64),
            priceComponents: {
              create: [
                {
                  title: 'base',
                  type: 'BASE',
                  currencyCode: 'IRR',
                  amount: '105.5',
                },
                {
                  title: 'discount',
                  type: 'DISCOUNT',
                  currencyCode: 'IRR',
                  amount: '5.5',
                },
                {
                  title: 'base',
                  type: 'BASE',
                  currencyCode: 'USD',
                  amount: '10.125',
                },
              ],
            },
          },
        });
      }
      const actor = {
        userId: owner,
        branchIds: [branch],
        permissions: ['sales.contracts.read.own'],
      } as AuthenticatedActor;
      const databaseService = { client: db } as DatabaseService;
      const context = new ContractCompanyScope(databaseService, {
        current: async () => ({
          data: { isAggregate: false, legalEntity: company },
        }),
      } as unknown as LegalEntitiesService);
      const panel = new SalesService(
        new SalesRepository(databaseService),
        {} as SalesCustomersPublicAdapter,
        {} as SalesTicketAvailabilityPort,
        undefined,
        undefined,
        undefined,
        undefined,
        undefined,
        undefined,
        context,
      );
      const { data } = await panel.dashboard(actor);
      const scope = {
        userId: owner,
        branchIds: [branch],
        companyId: company.id,
        mode: 'own' as const,
        payments: false,
      };
      const count = await readContractCountBreakdown(db, scope);
      const administrator = { ...scope, mode: 'all' as const, branchIds: [] };
      const all = await readContractCountBreakdown(db, administrator);
      const personal = await readContractCountBreakdown(
        db,
        administrator,
        'mine',
      );
      expect(all.rows[0]?.total).toBe(4);
      expect(personal.rows[0]).toMatchObject({
        total: 3,
        panel_non_cancelled: 2,
        sales_cancelled: 1,
      });
      expect(personal.rows).toEqual(count.rows);
      const standard = await readStandardSalesSummary(db, administrator);
      expect(standard.total).toBe(2);
      expect(
        standard.totals.map(({ currencyCode, amount }) => [
          currencyCode,
          Number(amount),
        ]),
      ).toEqual([
        ['IRR', 200],
        ['USD', 20.25],
      ]);
      expect(data.activeContracts).toBe(1);
      expect(count.rows[0]?.active_panel).toBe(data.activeContracts);
      await fixture.query('BEGIN READ ONLY');
      await fixture.query('SET LOCAL ROLE nora_agent_reader');
      await fixture.query("SELECT set_config('nora_agent.scope',$1,true)", [
        JSON.stringify(scope),
      ]);
      const money = await fixture.query<{
        currency_code: string;
        total: string;
      }>(
        "SELECT a.currency_code, trim_scale(sum(a.amount))::text AS total FROM nora_agent.amounts a JOIN nora_agent.contracts c ON a.contract_id=c.id WHERE c.status IN ('CONFIRMED','COMPLETED') GROUP BY a.currency_code",
      );
      const ranking = validateAgentSql(CONTRACT_AMOUNT_RANKING_EXAMPLE, [
        'amounts',
        'contracts',
      ]);
      const tied = await fixture.query(ranking.sql);
      expect(tied.rows).toEqual([
        { contract_number: 'ATLAS-0', amount: '10.1250', currency_code: 'USD' },
        { contract_number: 'ATLAS-1', amount: '10.1250', currency_code: 'USD' },
      ]);
      await fixture.query('COMMIT');
      const amounts = Object.fromEntries(
        money.rows.map((row) => [row.currency_code, row.total]),
      );
      expect(amounts).toEqual({ IRR: '200', USD: '20.25' });
      expect(data.rialSales).toBe(amounts.IRR);
      expect(data.foreignCommitments).toEqual([
        { currencyCode: 'USD', amount: amounts.USD },
      ]);
    } finally {
      await db?.$disconnect();
      await fixture?.end();
      if (created && /^nora_atlas_test_[a-f0-9]{32}$/.test(name))
        await admin.query('DROP DATABASE "' + name + '"');
      await admin.end();
    }
  },
  120000,
);
