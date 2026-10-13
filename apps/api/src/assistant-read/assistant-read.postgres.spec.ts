import { createRequire } from 'node:module';
import { randomUUID } from 'node:crypto';
import { readFileSync, readdirSync } from 'node:fs';
import { resolve } from 'node:path';
import { pathToFileURL } from 'node:url';
import { createServer, type Server } from 'node:http';
import { createDatabaseClient, type DatabaseClient } from '@nora/database';
import { JwtService } from '@nestjs/jwt';
import type { INestApplication } from '@nestjs/common';
import { beforeAll, afterAll, describe, expect, it } from 'vitest';
import { startAssistantRead } from './main';
import { DatabaseService } from '../database/database.service';
import { IamService } from '../iam/iam.service';
import type { SalesAssistantController } from '../sales/sales-assistant.controller';
import type { CustomerAffairsAssistantController } from '../customer-affairs/customer-affairs-assistant.controller';
import { salesAssistantWindows } from '../sales/sales-assistant-report';

const enabled = process.env.NORA_RUN_ASSISTANT_POSTGRES_TESTS === '1';
const databaseName = `nora_assistant_test_${randomUUID().replaceAll('-', '')}`;
const originalUrl = process.env.DATABASE_URL;
const originalSecret = process.env.IAM_ACCESS_TOKEN_SECRET;
const originalMasterKey = process.env.MASTER_DATA_IMPORT_TOKEN_KEY_BASE64;
let client: DatabaseClient;
let app: INestApplication;
let created = false;
let cookie: string;
let roleId: string;
let relay: Server;
let assistant: Server;
let assistantOrigin: string;
async function listen(server: Server) {
  await new Promise<void>((resolve) => server.listen(0, '127.0.0.1', resolve));
  const address = server.address();
  if (!address || typeof address === 'string') throw new Error('TEST_ADDRESS');
  return `http://127.0.0.1:${address.port}`;
}
async function close(server: Server | undefined) {
  if (server) {
    server.closeAllConnections();
    await new Promise<void>((resolve) => server.close(() => resolve()));
  }
}
const origin = 'http://127.0.0.1:44319/api/v1';
const PgClient = createRequire(
  resolve(process.cwd(), '../../packages/database/package.json'),
)('pg').Client as new (options: { connectionString: string }) => {
  connect(): Promise<void>;
  query(input: string): Promise<unknown>;
  end(): Promise<void>;
};
async function sql(database: string, statement: string) {
  const url = new URL(originalUrl!);
  url.pathname = `/${database}`;
  const connection = new PgClient({ connectionString: url.toString() });
  try {
    await connection.connect();
    await connection.query(statement);
  } finally {
    await connection.end();
  }
}
describe.skipIf(!enabled)(
  'isolated PostgreSQL → native report API → independent assistant',
  () => {
    beforeAll(async () => {
      const url = new URL(originalUrl!);
      if (
        !['127.0.0.1', 'localhost'].includes(url.hostname) ||
        url.port !== '5432'
      )
        throw new Error('Isolated local PostgreSQL required');
      await sql('postgres', `CREATE DATABASE "${databaseName}"`);
      created = true;
      const root = resolve(
        process.cwd(),
        '../../packages/database/prisma/migrations',
      );
      await sql(
        databaseName,
        readdirSync(root, { withFileTypes: true })
          .filter((entry) => entry.isDirectory())
          .sort((a, b) => a.name.localeCompare(b.name))
          .map((entry) =>
            readFileSync(resolve(root, entry.name, 'migration.sql'), 'utf8'),
          )
          .join('\n'),
      );
      url.pathname = `/${databaseName}`;
      client = createDatabaseClient(url.toString());
      const user = await client.user.create({
        data: {
          username: randomUUID(),
          displayName: 'Synthetic assistant evaluator',
          passwordHash: 'synthetic-not-a-login-hash',
        },
      });
      const branch = await client.branch.create({
        data: { code: randomUUID(), name: 'Synthetic authorized branch' },
      });
      await client.userBranch.create({
        data: { userId: user.id, branchId: branch.id },
      });
      const role = await client.role.create({
        data: {
          code: randomUUID(),
          name: 'Synthetic read grants',
          users: { create: { userId: user.id } },
        },
      });
      roleId = role.id;
      for (const code of [
        'sales.contracts.read.all',
        'sales.payments.read',
        'customer_affairs.lead.read',
      ]) {
        const permission = await client.permission.upsert({
          where: { code },
          create: { code, module: 'synthetic', name: code },
          update: {},
        });
        await client.rolePermission.create({
          data: { roleId, permissionId: permission.id },
        });
      }
      const session = await client.session.create({
        data: {
          userId: user.id,
          familyId: randomUUID(),
          refreshTokenHash: '0'.repeat(64),
          expiresAt: new Date(Date.now() + 3600000),
        },
      });
      const customer = await client.customer.create({
        data: {
          kind: 'PERSON',
          firstName: 'Synthetic',
          lastName: 'Customer',
          displayName: 'Synthetic private customer',
          ownerBranchId: branch.id,
          createdByUserId: user.id,
          updatedByUserId: user.id,
        },
      });
      const country = await client.masterCountry.create({
        data: {
          code: 'ZZ',
          name: 'Synthetic country',
          createdByUserId: user.id,
          updatedByUserId: user.id,
        },
      });
      const originCity = await client.masterCity.create({
        data: {
          code: 'SRC',
          name: 'Synthetic origin',
          countryId: country.id,
          createdByUserId: user.id,
          updatedByUserId: user.id,
        },
      });
      const destination = await client.masterCity.create({
        data: {
          code: 'DST',
          name: 'Synthetic destination',
          countryId: country.id,
          createdByUserId: user.id,
          updatedByUserId: user.id,
        },
      });
      const at = new Date(
        Date.parse(salesAssistantWindows(new Date()).current.startUtc) +
          86400000,
      );
      const data = {
        branchId: branch.id,
        ownerUserId: user.id,
        customerId: customer.id,
        payerCustomerId: customer.id,
        customerNameSnapshot: 'Synthetic private customer',
        tripType: 'ONE_WAY' as const,
        originId: originCity.id,
        destinationId: destination.id,
        departureDate: new Date(),
        createIdempotencyKey: randomUUID(),
        createRequestFingerprint: '0'.repeat(64),
        createdAt: at,
        confirmedAt: new Date(),
        status: 'CONFIRMED' as const,
      };
      const receiptAccount = await client.financeSettlementAccount.create({
        data: {
          branchId: branch.id,
          title: 'Synthetic receipt account',
          kind: 'CASH',
          currencyCode: 'USD',
          createdByUserId: user.id,
        },
      });
      const contract = await client.salesContract.create({
        data: {
          ...data,
          contractNumber: 'SYNTHETIC-VALID',
          priceComponents: {
            create: [
              {
                type: 'BASE',
                title: 'Synthetic price',
                amount: '100.0001',
                currencyCode: 'USD',
              },
              {
                type: 'DISCOUNT',
                title: 'Synthetic discount',
                amount: '10',
                currencyCode: 'USD',
              },
            ],
          },
          payments: {
            create: [
              {
                amount: '20',
                currencyCode: 'USD',
                dueAt: new Date(),
                method: 'CASH',
                status: 'FINANCE_CONFIRMED',
                idempotencyKey: randomUUID(),
                requestFingerprint: '0'.repeat(64),
                createdByUserId: user.id,
                financeConfirmedAt: new Date(),
                financeReceiptAccountId: receiptAccount.id,
              },
              {
                amount: '5',
                currencyCode: 'USD',
                dueAt: new Date(),
                method: 'CASH',
                status: 'PENDING_FINANCE_CONFIRMATION',
                idempotencyKey: randomUUID(),
                requestFingerprint: '0'.repeat(64),
                createdByUserId: user.id,
              },
            ],
          },
        },
      });
      await client.salesContract.create({
        data: {
          ...data,
          contractNumber: 'SYNTHETIC-CANCELLED',
          createIdempotencyKey: randomUUID(),
          status: 'CANCELLED',
        },
      });
      const lead = await client.customerAffairsLead.create({
        data: {
          trackingNumber: randomUUID().replaceAll('-', ''),
          branchId: branch.id,
          title: 'Synthetic lead',
          sourceReference: randomUUID(),
          inboundChannel: 'PHONE',
          contactOccurredAt: at,
          travelNeed: 'Synthetic travel',
          passengerCount: 1,
          passengerComposition: {},
          requestedServices: [],
          priority: 'NORMAL',
          assigneeUserId: user.id,
          nextAction: 'Synthetic next action',
          nextActionAt: new Date(),
          createdByUserId: user.id,
          updatedByUserId: user.id,
        },
      });
      await client.customerAffairsTimeline.createMany({
        data: [0, 1].map((index) => ({
          leadId: lead.id,
          type: 'CALL',
          summary: 'Synthetic call',
          occurredAt: new Date(at.getTime() + index * 1000),
          actorUserId: user.id,
          documentVersionIds: [],
        })),
      });
      const foreignBranch = await client.branch.create({
        data: { code: randomUUID(), name: 'Synthetic unauthorized branch' },
      });
      const foreignLead = await client.customerAffairsLead.create({
        data: {
          trackingNumber: randomUUID().replaceAll('-', ''),
          branchId: foreignBranch.id,
          title: 'Synthetic foreign lead',
          sourceReference: randomUUID(),
          inboundChannel: 'PHONE',
          contactOccurredAt: at,
          travelNeed: 'Synthetic foreign travel',
          passengerCount: 1,
          passengerComposition: {},
          requestedServices: [],
          priority: 'NORMAL',
          assigneeUserId: user.id,
          nextAction: 'Synthetic',
          nextActionAt: new Date(),
          createdByUserId: user.id,
          updatedByUserId: user.id,
        },
      });
      await client.customerAffairsTimeline.create({
        data: {
          leadId: foreignLead.id,
          type: 'CALL',
          summary: 'Synthetic unauthorized call',
          occurredAt: at,
          actorUserId: user.id,
          documentVersionIds: [],
        },
      });
      await client.customerAffairsHandoff.create({
        data: {
          leadId: lead.id,
          packageVersion: 1,
          idempotencyKey: randomUUID(),
          requestFingerprint: '0'.repeat(64),
          payloadSnapshot: {},
          status: 'ACCEPTED',
          salesContractId: contract.id,
          respondedAt: new Date(),
          createdByUserId: user.id,
        },
      });
      process.env.DATABASE_URL = url.toString();
      process.env.IAM_ACCESS_TOKEN_SECRET =
        'synthetic-assistant-integration-secret-at-least-32-characters';
      process.env.MASTER_DATA_IMPORT_TOKEN_KEY_BASE64 = Buffer.alloc(
        32,
        3,
      ).toString('base64');
      process.env.ERP_ASSISTANT_READ_PORT = '44319';
      app = await startAssistantRead();
      cookie = `nora_access=${await app.get(JwtService).signAsync({ sub: user.id, sid: session.id, type: 'access' }, { issuer: 'nora-api', audience: 'nora-web', expiresIn: '1h' })}`;
      relay = createServer((request, response) => {
        response.setHeader('content-type', 'application/json');
        if (request.url === '/api/v1/iam/auth/access') {
          const token =
            request.headers.cookie?.replace(/^nora_access=/, '') ?? '';
          void app
            .get(IamService)
            .authenticate(token)
            .then((actor) => response.end(JSON.stringify(actor)))
            .catch(() => {
              response.writeHead(401);
              response.end('{}');
            });
        } else if (request.url?.startsWith('/api/v1/workbench/'))
          response.end(
            JSON.stringify(
              request.url.endsWith('procurement-follow-ups')
                ? { items: [] }
                : { data: [] },
            ),
          );
        else {
          response.writeHead(404);
          response.end('{}');
        }
      });
      const erpBaseUrl = `${await listen(relay)}/api/v1`;
      const moduleUrl = pathToFileURL(
        resolve(process.cwd(), '../../services/assistant/server.mjs'),
      ).href;
      const { createAssistantServer } = await import(moduleUrl);
      assistant = createAssistantServer({
        erpBaseUrl,
        erpReportsBaseUrl: origin,
        erpAuthBaseUrl: origin,
        audit: () => undefined,
      }) as Server;
      assistantOrigin = await listen(assistant);
    }, 120000);
    afterAll(async () => {
      await close(assistant);
      await close(relay);
      await app?.close();
      await client?.$disconnect();
      process.env.DATABASE_URL = originalUrl;
      if (originalSecret === undefined)
        delete process.env.IAM_ACCESS_TOKEN_SECRET;
      else process.env.IAM_ACCESS_TOKEN_SECRET = originalSecret;
      if (originalMasterKey === undefined)
        delete process.env.MASTER_DATA_IMPORT_TOKEN_KEY_BASE64;
      else process.env.MASTER_DATA_IMPORT_TOKEN_KEY_BASE64 = originalMasterKey;
      if (created && /^nora_assistant_test_[a-f0-9]{32}$/.test(databaseName))
        await sql('postgres', `DROP DATABASE "${databaseName}" WITH (FORCE)`);
    }, 60000);
    it('executes real owner queries, native JWT authorization, currency math and no business writes', async () => {
      const get = (path: string) =>
        fetch(origin + path, { headers: { cookie } });
      expect((await fetch(origin + '/sales/assistant/weekly')).status).toBe(
        401,
      );
      expect(
        (
          await fetch(origin + '/sales/assistant/weekly', {
            method: 'POST',
            headers: { cookie },
          })
        ).status,
      ).toBe(405);
      const weekly = (await (
        await get('/sales/assistant/weekly')
      ).json()) as Awaited<ReturnType<SalesAssistantController['weekly']>>;
      expect(weekly.current.contractCount).toBe(1);
      expect(weekly.current.contractAmountsBeforeRefunds).toEqual([
        { currencyCode: 'USD', amount: '90.0001' },
      ]);
      expect(weekly.current.routes[0]?.originName).toBe('Synthetic origin');
      const balances = (await (
        await get('/sales/assistant/contract-balances')
      ).json()) as Awaited<ReturnType<SalesAssistantController['balances']>>;
      expect(balances.totals[0]).toMatchObject({
        amount: '90.0001',
        outstanding: '70.0001',
        pendingFinance: '5',
      });
      const conversion = (await (
        await get('/customer-affairs/assistant/call-conversion')
      ).json()) as Awaited<
        ReturnType<CustomerAffairsAssistantController['conversion']>
      >;
      expect(conversion.current).toMatchObject({
        contactedLeads: 1,
        convertedLeads: 1,
        conversionBasisPoints: 10000,
      });
      expect(JSON.stringify([weekly, balances, conversion])).not.toContain(
        'Synthetic private customer',
      );
      const modelUrl = pathToFileURL(
        resolve(process.cwd(), '../web/src/modules/assistant/model.ts'),
      ).href;
      const proxyUrl = pathToFileURL(
        resolve(process.cwd(), '../web/src/modules/assistant/proxy.ts'),
      ).href;
      const { assistantActionSchema, assistantFilteredActionSchema } =
        await import(modelUrl);
      const { proxyAssistantAction, proxyAssistantV2Action } = await import(
        proxyUrl
      );
      for (const action of [
        'daily-summary',
        'sales-analysis',
        'receivables-follow-up',
      ]) {
        const result: Response = await proxyAssistantAction(
          new Request(`http://localhost/api/assistant/actions/${action}`, {
            headers: { cookie },
          }),
          assistantOrigin,
          action,
        );
        expect(result.status).toBe(200);
        const evidence = await result.json();
        expect(assistantActionSchema.safeParse(evidence).success).toBe(true);
      }
      const options = await (
        await get('/sales/assistant/filter-options')
      ).json();
      expect(options.branches).toHaveLength(1);
      expect(options.cities).toHaveLength(2);
      const civil = (at: string) => {
        const parts = Object.fromEntries(
          new Intl.DateTimeFormat('en-GB-u-ca-gregory', {
            timeZone: 'Asia/Tehran',
            year: 'numeric',
            month: '2-digit',
            day: '2-digit',
          })
            .formatToParts(new Date(at))
            .map((part) => [part.type, part.value]),
        );
        return parts.year + '-' + parts.month + '-' + parts.day;
      };
      const params = new URLSearchParams({
        startDate: civil(weekly.current.startUtc),
        endDate: civil(
          new Date(Date.parse(weekly.current.endUtc) - 1).toISOString(),
        ),
        branchId: options.branches[0].id,
      });
      for (const action of [
        'daily-summary',
        'sales-analysis',
        'receivables-follow-up',
      ]) {
        const response: Response = await proxyAssistantV2Action(
          new Request(
            'http://localhost/api/assistant/v2/actions/' +
              action +
              '?' +
              params,
            { headers: { cookie } },
          ),
          assistantOrigin,
          action,
        );
        expect(response.status).toBe(200);
        const body = await response.json();
        expect(assistantFilteredActionSchema.safeParse(body).success).toBe(
          true,
        );
        if (action === 'sales-analysis') {
          expect(body.report.current.contractAmountsBeforeRefunds).toEqual(
            weekly.current.contractAmountsBeforeRefunds,
          );
          expect(body.conversion.status).toBe('READY');
        }
      }
      expect(
        (await get('/sales/assistant/report?branchId=' + randomUUID())).status,
      ).toBe(403);
      const route = weekly.current.routes[0]!;
      params.set('originId', route.originId);
      params.set('destinationId', route.destinationId);
      const routeReport = await (
        await get('/sales/assistant/report?' + params)
      ).json();
      expect(routeReport.current.contractCount).toBe(1);
      params.set('originId', randomUUID());
      expect(
        (await (await get('/sales/assistant/report?' + params)).json()).current
          .contractCount,
      ).toBe(0);
      await expect(
        app.get(DatabaseService).client
          .$executeRaw`UPDATE sales_contracts SET version = version WHERE false`,
      ).rejects.toThrow();
      expect(await client.salesContract.count()).toBe(2);
      await client.rolePermission.deleteMany({ where: { roleId } });
      expect((await get('/sales/assistant/weekly')).status).toBe(403);
    });
  },
);
