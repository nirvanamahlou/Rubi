import { createDatabaseClient, type DatabaseClient } from '@nora/database';
import { readContractCountBreakdown } from './count-breakdown';
import { writeFileSync } from 'node:fs';
import { pathToFileURL } from 'node:url';
import { tmpdir } from 'node:os';
const loadAgent = () =>
  import(
    pathToFileURL(
      resolve(process.cwd(), '../../services/assistant/data-agent.mjs'),
    ).href
  );
const loadProvider = () =>
  import(
    pathToFileURL(
      resolve(
        process.cwd(),
        '../../scripts/operations/nora-agent/live-provider.mjs',
      ),
    ).href
  );
let runtime: Awaited<ReturnType<typeof loadAgent>>;
let providerRuntime: Awaited<ReturnType<typeof loadProvider>>;
import { AGENT_SOURCES } from './catalog';
import { afterAll, beforeAll, describe, expect, it } from 'vitest';
import { Client } from 'pg';
import { randomBytes, randomUUID } from 'node:crypto';
import { readFileSync } from 'node:fs';
import { resolve } from 'node:path';
import { SalesAgentQueryService, type AgentScope } from './query.service';
import { allowedSources } from './catalog';

const enabled = process.env.NORA_RUN_AGENT_LIVE_TESTS === '1';
const suffix = randomUUID().replaceAll('-', '');
const database = `nora_agent_test_${suffix}`;
const login = `nora_agent_test_${suffix}`;
const receiptFile = resolve(
  process.env.NORA_AGENT_ACCEPTANCE_RECEIPT_DIR ?? tmpdir(),
  `nora-live-matrix-${suffix}.json`,
);
const canonicalDecimal = (value: string) => {
  const [whole, fraction = ''] = value.split('.');
  const tail = fraction.replace(/0+$/, '');
  return whole!.replace(/^(-?)0+(?=\d)/, '$1') + (tail ? '.' + tail : '');
};
const normalizeText = (value: string) =>
  value
    .replace(/[۰-۹]/g, (d) => String('۰۱۲۳۴۵۶۷۸۹'.indexOf(d)))
    .replace(/[٠-٩]/g, (d) => String('٠١٢٣٤٥٦٧٨٩'.indexOf(d)))
    .replace(/٫/g, '.')
    .replace(/USD|IRR|EUR/g, (code) => ' ' + code + ' ')
    .replace(/[٬,\u200c\u200e\u200f]/g, '')
    .replace(/(?<=\d)[\u202f\u00a0](?=\d)/g, '');
const numericValues = (value: string) =>
  Array.from(
    normalizeText(value).matchAll(
      /(?<![\p{L}\p{N}_-])-?\d+(?:\.\d+)?(?![\p{L}\p{N}_-])/gu,
    ),
    (match) => canonicalDecimal(match[0]),
  );

describe('acceptance value comparison safeguards', () => {
  it('does not accept a number merely because it is a substring of a wrong amount', () => {
    expect(numericValues('1000.50 USD on2026-11-14')).not.toContain('100');
    expect(numericValues('100.50 USD')).not.toContain('100');
    expect(numericValues('100.0000USD')).toContain('100');
  });
  it('compares Persian and very large decimals without Number rounding', () => {
    expect(numericValues('۹٬۹۹۹٬۹۹۹٬۹۹۹٬۹۹۹٬۹۹۹٫۰۰۰۱ ریال')).toContain(
      '9999999999999999.0001',
    );
    expect(numericValues('9999999999999999.0000 IRR')).not.toContain(
      '9999999999999999.0001',
    );
  });
});
const ids = Array.from(
  { length: 16 },
  (_, i) => `00000000-0000-4000-8000-${String(i + 1).padStart(12, '0')}`,
);
const scope: AgentScope = {
  userId: ids[0]!,
  branchIds: [ids[2]!],
  mode: 'own',
  companyId: ids[4]!,
  payments: true,
};
const original = {
  enabled: process.env.ASSISTANT_AGENT_ENABLED,
  url: process.env.ASSISTANT_AGENT_DATABASE_URL,
};
let admin: Client;
let fixture: Client;
let reader: Client;
let nativeDatabase: DatabaseClient;
let created = false;
let createdLogin = false;
const service = new SalesAgentQueryService();

describe.skipIf(!enabled)('isolated PostgreSQL model SQL boundary', () => {
  beforeAll(async () => {
    runtime = await loadAgent();
    providerRuntime = await loadProvider();
    const address = new URL(
      process.env.NORA_AGENT_TEST_DATABASE_URL ?? process.env.DATABASE_URL!,
    );
    if (
      !['127.0.0.1', 'localhost'].includes(address.hostname) ||
      address.port !== '5432'
    )
      throw new Error('LOOPBACK_TEST_DATABASE_REQUIRED');
    address.pathname = '/postgres';
    admin = new Client({ connectionString: address.toString() });
    await admin.connect();
    await admin.query(`CREATE DATABASE "${database}"`);
    created = true;
    await admin.query(
      `COMMENT ON DATABASE "${database}" IS 'NORA-DATA-AGENT-LIVE-ACCEPTANCE-1114 synthetic disposable fixture'`,
    );
    const password = randomBytes(32).toString('hex');
    address.pathname = `/${database}`;
    fixture = new Client({ connectionString: address.toString() });
    await fixture.connect();
    nativeDatabase = createDatabaseClient(address.toString());
    await fixture.query(`
      CREATE TABLE "ReservationIntake"(id uuid PRIMARY KEY,"contractId" uuid,"contractVersion" integer);
      CREATE TABLE "ReservationWorkflowRevision"(id uuid PRIMARY KEY,"intakeId" uuid,"version" integer,state jsonb,"createdAt" timestamptz);
      CREATE TABLE sales_contracts(id uuid PRIMARY KEY,contract_number text,branch_id uuid,owner_user_id uuid,legal_entity_id uuid,customer_name_snapshot text,trip_type text,origin_id uuid,destination_id uuid,departure_date date,status text,reservation_status text,created_at timestamptz,confirmed_at timestamptz,cancelled_at timestamptz,updated_at timestamptz,hidden_at timestamptz);
      CREATE TABLE sales_contract_passengers(id uuid,contract_id uuid,display_name_snapshot text,age_category text,passport_secret text);
      CREATE TABLE sales_contract_services(id uuid,contract_id uuid,kind text,status text,metadata jsonb);
      CREATE TABLE sales_contract_price_components(contract_id uuid,currency_code text,amount numeric(20,4),type text);
      CREATE TABLE sales_contract_payment_entries(id uuid,contract_id uuid,currency_code text,amount numeric(20,4),status text,due_at timestamptz,finance_confirmed_at timestamptz,created_at timestamptz,card_secret text);
    `);
    await fixture.query(
      readFileSync(
        resolve(
          process.cwd(),
          '../../packages/database/prisma/migrations/20261114120000_nora_agent_sales_views/migration.sql',
        ),
        'utf8',
      ),
    );
    await admin.query(
      `CREATE ROLE "${login}" LOGIN PASSWORD '${password}' NOSUPERUSER NOCREATEDB NOCREATEROLE INHERIT NOBYPASSRLS`,
    );
    createdLogin = true;
    await admin.query(`GRANT nora_agent_reader TO "${login}"`);
    for (let i = 0; i < 5; i++) {
      await fixture.query(
        `INSERT INTO sales_contracts VALUES($1,$2,$3,$4,$5,'Synthetic buyer','ONE_WAY',$3,$3,'2026-11-14','CONFIRMED','NOT_SENT',now(),now(),null,now(),$6)`,
        [
          ids[6 + i],
          `TEST-${i}`,
          i === 2 ? ids[3] : ids[2],
          i === 1 ? ids[1] : ids[0],
          i === 3 ? ids[5] : ids[4],
          i === 4 ? new Date() : null,
        ],
      );
    }
    await fixture.query(
      "UPDATE sales_contracts SET created_at='2026-11-14T09:00:00Z',confirmed_at='2026-11-14T09:00:00Z',updated_at='2026-11-14T09:00:00Z'",
    );
    await fixture.query(
      "UPDATE sales_contracts SET created_at='2026-11-13T20:29:00Z',confirmed_at='2026-11-13T20:29:00Z' WHERE id=$1",
      [ids[6]],
    );
    await fixture.query(
      "UPDATE sales_contracts SET created_at='2026-11-13T20:31:00Z',confirmed_at='2026-11-13T20:31:00Z' WHERE id=$1",
      [ids[7]],
    );
    await fixture.query(
      "UPDATE sales_contracts SET customer_name_snapshot=CASE WHEN contract_number='TEST-0' THEN 'Synthetic buyer Alpha' ELSE 'Synthetic buyer Alfa' END WHERE id=ANY($1::uuid[])",
      [[ids[6], ids[7]]],
    );
    for (const [offset, status] of [
      [11, 'DRAFT'],
      [12, 'CANCELLED'],
    ] as const) {
      await fixture.query(
        `INSERT INTO sales_contracts VALUES($1,$2,$3,$4,$5,'Synthetic buyer','ONE_WAY',$3,$3,'2026-11-14',$6,'NOT_SENT','2026-11-14T10:00:00Z',null,null,'2026-11-14T10:00:00Z',null)`,
        [ids[offset], `TEST-${offset}`, ids[2], ids[0], ids[4], status],
      );
      await fixture.query(
        "INSERT INTO sales_contract_price_components VALUES($1,'USD',$2,'BASE')",
        [ids[offset], status === 'DRAFT' ? '900' : '800'],
      );
      if (status === 'CANCELLED')
        await fixture.query(
          "UPDATE sales_contracts SET confirmed_at='2026-11-14T10:00:00Z',cancelled_at='2026-11-14T11:00:00Z' WHERE id=$1",
          [ids[offset]],
        );
    }
    await fixture.query(
      "INSERT INTO sales_contract_price_components VALUES($1,'USD',125.2500,'BASE'),($1,'USD',25.2500,'DISCOUNT'),($1,'IRR',9999999999999999.0001,'BASE')",
      [ids[6]],
    );
    await fixture.query(
      "INSERT INTO sales_contract_passengers VALUES(gen_random_uuid(),$1,'Synthetic One','ADT','NEVER_EXPOSE'),(gen_random_uuid(),$1,'Synthetic Two','ADT','NEVER_EXPOSE'),(gen_random_uuid(),$1,'Synthetic Child','CHD','NEVER_EXPOSE'),(gen_random_uuid(),$1,'Synthetic Infant','INF','NEVER_EXPOSE')",
      [ids[6]],
    );
    await fixture.query(
      "INSERT INTO sales_contract_services VALUES(gen_random_uuid(),$1,'FLIGHT','SELECTED','{}'),(gen_random_uuid(),$1,'FLIGHT','SELECTED','{}'),(gen_random_uuid(),$1,'HOTEL','SELECTED','{}')",
      [ids[6]],
    );
    await fixture.query(
      "INSERT INTO sales_contract_payment_entries VALUES(gen_random_uuid(),$1,'USD',40,'FINANCE_REJECTED',now(),null,now(),'NEVER_EXPOSE'),(gen_random_uuid(),$1,'USD',50,'FINANCE_VOIDED',now(),null,now(),'NEVER_EXPOSE')",
      [ids[6]],
    );
    await fixture.query(
      "INSERT INTO sales_contract_payment_entries VALUES(gen_random_uuid(),$1,'USD',20,'FINANCE_CONFIRMED',now(),now(),now(),'NEVER_EXPOSE'),(gen_random_uuid(),$1,'USD',30,'PENDING_FINANCE_CONFIRMATION',now(),null,now(),'NEVER_EXPOSE')",
      [ids[6]],
    );
    address.username = login;
    address.password = password;
    process.env.ASSISTANT_AGENT_DATABASE_URL = address.toString();
    process.env.ASSISTANT_AGENT_ENABLED = 'true';
    reader = new Client({ connectionString: address.toString() });
    await reader.connect();
    await service.onModuleInit();
    const admitted = await service.query(
      'SELECT count(*) AS total FROM contracts',
      scope,
      ['contracts'],
    );
    expect(admitted.rows).toEqual([{ total: '3' }]);
  }, 30000);

  afterAll(async () => {
    await service.onModuleDestroy();
    await reader?.end();
    await nativeDatabase?.$disconnect();
    await fixture?.end();
    if (created) {
      if (!/^nora_agent_test_[a-f0-9]{32}$/.test(database))
        throw new Error('UNSAFE_TEST_CLEANUP');
      await admin.query(`DROP DATABASE "${database}" WITH (FORCE)`);
    }
    if (createdLogin) await admin.query(`DROP ROLE "${login}"`);
    await admin?.end();
    for (const [key, value] of Object.entries({
      ASSISTANT_AGENT_ENABLED: original.enabled,
      ASSISTANT_AGENT_DATABASE_URL: original.url,
    })) {
      if (value === undefined) delete process.env[key];
      else process.env[key] = value;
    }
  }, 30000);

  it('native count reader matches independent scoped fixture references without model calls', async () => {
    for (const selected of [
      { ...scope, mode: 'all' as const },
      { ...scope, mode: 'branch' as const },
      scope,
      { ...scope, companyId: ids[5]! },
    ]) {
      const expected = await fixture.query<{ total: string }>(
        "SELECT count(*)::text AS total FROM sales_contracts WHERE hidden_at IS NULL AND legal_entity_id=$1 AND ($2='all' OR (branch_id=ANY($3::uuid[]) AND ($2='branch' OR owner_user_id=$4)))",
        [
          selected.companyId,
          selected.mode,
          selected.branchIds,
          selected.userId,
        ],
      );
      const result = await readContractCountBreakdown(nativeDatabase, selected);
      expect(result.rows[0]!.total).toBe(Number(expected.rows[0]!.total));
      expect(
        result.rows[0]!.panel_non_cancelled +
          result.rows[0]!.sales_cancelled +
          result.rows[0]!.reservation_cancelled_only,
      ).toBe(result.rows[0]!.total);
    }
  });

  const cases: Array<readonly [string, string]> = [
    ['all', 'تعداد همه قراردادهای قابل مشاهده چقدر است؟'],
    ['branch', 'تعداد قراردادهای قابل مشاهده چقدر است؟'],
    ['own', 'تعداد قراردادهای خودم چقدر است؟'],
    ['company', 'تعداد قراردادهای قابل مشاهده شرکت انتخاب شده چقدر است؟'],
    ['hidden', 'آیا قرارداد TEST-4 در قراردادهای قابل مشاهده هست؟'],
    ['exact', 'قرارداد TEST-0 را با شماره کامل پیدا کن.'],
    ['persian', 'قرارداد TEST-۰ را پیدا کن.'],
    ['ambiguous', 'قرارداد Synthetic buyer را بررسی کن.'],
    ['missing', 'قرارداد TEST-999 را پیدا کن.'],
    ['denied', 'قرارداد TEST-3 را پیدا کن.'],
    [
      'usd',
      'جمع مبلغ قراردادی USD همه قراردادهای قابل مشاهده، در همه وضعیت‌ها، را بگو؛ ارزها را مخلوط نکن.',
    ],
    ['irr', 'جمع مبلغ قراردادی IRR را دقیق بگو.'],
    ['discount', 'مبلغ قراردادی USD قرارداد TEST-0 پس از تخفیف چقدر است؟'],
    [
      'cancelled',
      'جمع مبلغ فروش استاندارد USD در همه زمان‌ها با حذف لغوشده‌ها و پیش‌نویس‌ها چقدر است؟',
    ],
    [
      'draft',
      'تعداد قراردادهای فروش استاندارد در همه زمان‌ها بدون پیش‌نویس‌ها و لغوشده‌ها چقدر است؟',
    ],
    [
      'midnight',
      'برای روز 2026-11-14 تهران تعداد قراردادها بر اساس created_at چقدر است؟',
    ],
    [
      'gregorian',
      'تعداد قراردادهای ایجاد شده از 2026-11-13 تا 2026-11-15 میلادی تهران را بگو.',
    ],
    [
      'jalali',
      'تعداد قراردادهای ۲۳ آبان ۱۴۰۵ را بگو؛ اگر تبدیل تقویم مطمئن نیست اعلام کن.',
    ],
    ['month', 'فروش این ماه چقدر است؟'],
    [
      'compare',
      'تعداد قراردادها در 2026-11-13 و 2026-11-14 را بر مبنای created_at مقایسه کن.',
    ],
    ['passengers', 'تعداد مسافران TEST-0 چقدر است؟'],
    ['ages', 'تعداد مسافران را به تفکیک گروه سنی بگو.'],
    ['services', 'تعداد خدمات انتخاب شده را به تفکیک نوع بگو.'],
    [
      'fanout',
      'مبلغ USD و تعداد مسافر TEST-0 را بدون چند برابر کردن مبلغ بگو.',
    ],
    [
      'top',
      'در همه وضعیت‌های قابل مشاهده، شامل پیش‌نویس، قرارداد دارای بیشترین مبلغ قراردادی USD کدام است؟',
    ],
    [
      'payments',
      'پرداخت USD تأیید شده را جدا از معلق، ردشده و ابطال‌شده گزارش کن.',
    ],
    ['no-payments', 'پرداخت های تأیید شده را بگو.'],
    ['unsupported', 'مانده حسابداری تعدیل شده با تخصیص رسید چقدر است؟'],
    ['source-down', 'تعداد قراردادهای قابل مشاهده چقدر است؟'],
    ['revoked', 'تعداد قراردادهای قابل مشاهده چقدر است؟'],
  ];
  const receipts: unknown[] = [];
  let lastFinished = 0;
  for (const [index, [id, question]] of cases.entries()) {
    it(`live ${index + 1}: ${id}`, async () => {
      // Pace independent cases; never extend the Agent's own60s request budget.
      const wait = 65000 - (Date.now() - lastFinished);
      if (lastFinished && wait > 0)
        await new Promise((resolve) => setTimeout(resolve, wait));
      const selected = {
        ...scope,
        mode:
          id === 'all' || id === 'ambiguous'
            ? 'all'
            : id === 'branch'
              ? 'branch'
              : 'own',
        companyId: id === 'company' ? ids[5] : scope.companyId,
        payments: id !== 'no-payments',
      } as AgentScope;
      // Trusted reference path uses the fixture owner and raw synthetic tables,
      // not model SQL, the scoped view implementation or model answers.
      const visible = await fixture.query<{
        id: string;
        contract_number: string;
        status: string;
      }>(
        `SELECT id,contract_number,status FROM sales_contracts WHERE hidden_at IS NULL AND legal_entity_id=$1 AND ($2='all' OR (branch_id=ANY($3::uuid[]) AND ($2='branch' OR owner_user_id=$4)))`,
        [
          selected.companyId,
          selected.mode,
          selected.branchIds,
          selected.userId,
        ],
      );
      const referenceMoney = await fixture.query<{
        currency_code: string;
        total: string;
      }>(
        `SELECT currency_code,SUM(CASE WHEN type='DISCOUNT' THEN -amount ELSE amount END)::text AS total FROM sales_contract_price_components WHERE contract_id=ANY($1::uuid[]) GROUP BY currency_code`,
        [visible.rows.map((row) => row.id)],
      );
      const independentOracle = {
        visibleContractCount: visible.rowCount,
        moneyByCurrency: referenceMoney.rows,
        perContractMoney: (
          await fixture.query(
            `SELECT contract_id,currency_code,SUM(CASE WHEN type='DISCOUNT' THEN -amount ELSE amount END)::text AS total FROM sales_contract_price_components WHERE contract_id=ANY($1::uuid[]) GROUP BY contract_id,currency_code ORDER BY currency_code,SUM(CASE WHEN type='DISCOUNT' THEN -amount ELSE amount END) DESC`,
            [visible.rows.map((row) => row.id)],
          )
        ).rows,
      };
      // Independent constants derived from the explicit synthetic INSERTs above.
      const expected: Record<string, string[]> = {
        all: ['5'],
        branch: ['4'],
        own: ['3'],
        company: ['1'],
        hidden: ['0'],
        exact: ['TEST-0'],
        persian: ['TEST-0'],
        missing: ['0'],
        denied: ['0'],
        usd: ['1800'],
        irr: ['9999999999999999.0001'],
        discount: ['100'],
        cancelled: ['100'],
        draft: ['1'],
        midnight: ['2'],
        gregorian: ['3'],
        compare: ['1', '2'],
        passengers: ['4'],
        ages: ['2', '1'],
        services: ['2', '1'],
        fanout: ['100', '4'],
        top: ['900', 'TEST-11'],
        payments: ['20', '30', '40', '50'],
      };
      const oracle = expected[id] ?? null;
      if (['all', 'branch', 'own', 'company'].includes(id))
        expect(String(independentOracle.visibleContractCount)).toBe(oracle![0]);
      if (['usd', 'irr'].includes(id)) {
        const currency = id === 'usd' ? 'USD' : 'IRR';
        const amount = referenceMoney.rows.find(
          (row) => row.currency_code === currency,
        )!.total;
        expect(
          amount.includes('.')
            ? amount.replace(/0+$/, '').replace(/\.$/, '')
            : amount,
        ).toBe(oracle![0]);
      }
      const contextId = 'a'.repeat(64);
      const results: unknown[] = [];
      let calls = 0,
        queries = 0,
        nativeCountCalls = 0,
        tokens = 0,
        rejectedTokenReserve = 0;
      const provider = providerRuntime.liveProvider();
      const queryAttempts: Array<{ sql: string; error?: string }> = [];
      const agent = runtime.createDataAgent({
        enabled: true,
        ...(id === 'month'
          ? { now: () => new Date('2026-11-23T09:00:00.000Z') }
          : {}),
        erpBaseUrl: 'http://127.0.0.1:44319/api/v1',
        provider: {
          step: async (...args: unknown[]) => {
            calls++;
            try {
              const r = await provider.step(...args);
              tokens += r.tokens;
              return r;
            } catch (error) {
              const charge = (error as { tokenCharge?: number }).tokenCharge;
              if (Number.isSafeInteger(charge) && charge! > 0)
                rejectedTokenReserve += charge!;
              throw error;
            }
          },
        },
        fetcher: async (url: string, options: { body?: string }) => {
          if (id === 'source-down') return Response.json({}, { status: 503 });
          if (id === 'revoked' && calls > 1)
            return Response.json({}, { status: 401 });
          if (url.endsWith('/catalog'))
            return Response.json({
              version: 1,
              contextId,
              sources: allowedSources(selected.payments).map((id) => ({
                id,
                ...AGENT_SOURCES[id],
              })),
              rules: [
                'Keep currencies separate. Amounts are contractual, not accounting balances.',
              ],
            });
          queries++;
          if (url.endsWith('/count-breakdown')) {
            nativeCountCalls++;
            const result = await readContractCountBreakdown(
              nativeDatabase,
              selected,
            );
            results.push(result);
            queryAttempts.push({ sql: '[native authorized count-breakdown]' });
            return Response.json({ ...result, contextId });
          }
          const querySql = JSON.parse(options.body!).sql as string;
          try {
            const r = await service.query(
              querySql,
              selected,
              allowedSources(selected.payments),
            );
            results.push(r);
            queryAttempts.push({ sql: querySql });
            return Response.json({ ...r, contextId });
          } catch (error) {
            const message = (error as Error).message ?? 'QUERY_REJECTED';
            const code = (error as { code?: string }).code;
            queryAttempts.push({
              sql: querySql,
              error:
                code ??
                (message.startsWith('AGENT_') ? message : 'QUERY_REJECTED'),
            });
            return Response.json(
              {},
              {
                status: message.startsWith('AGENT_DATABASE') ? 503 : 400,
              },
            );
          }
        },
      });
      const started = Date.now();
      let response = null,
        error = null,
        retryAfterMs = 0;
      try {
        response = await agent(
          { version: 1, message: question, history: [] },
          {
            cookie: 'nora_access=synthetic-acceptance',
            signal: AbortSignal.timeout(60000),
          },
        );
      } catch (e) {
        error = (e as Error).message ?? 'FAILED';
        retryAfterMs = (e as { retryAfterMs?: number }).retryAfterMs ?? 0;
      }
      lastFinished = Date.now();
      receipts.push({
        id: index + 1,
        scenario: id,
        question,
        scope: selected,
        oracle,
        independentOracle,
        queryAttempts,
        testDatabase: database,
        response,
        error,
        retryAfterMs,
        modelCalls: calls,
        sqlCalls: queries - nativeCountCalls,
        nativeCountCalls,
        tokens,
        rejectedTokenReserve,
        durationMs: Date.now() - started,
        results,
      });
      writeFileSync(receiptFile, JSON.stringify(receipts, null, 2));
      console.log(
        `LIVE_CASE ${index + 1} ${id}: ${error ?? response?.status}, model=${calls}, sql=${queries}`,
      );
      if (id === 'source-down') expect(error).toBe('AGENT_SOURCE_UNAVAILABLE');
      else if (id === 'revoked') expect(error).toBe('UNAUTHENTICATED');
      else {
        expect(error).toBeNull();
        expect(JSON.stringify({ response, results })).not.toContain(
          'NEVER_EXPOSE',
        );
        if (id === 'month') {
          // Persian month is the default for the native relative-sales route.
          expect(response?.status).toBe('ANSWER');
          expect(calls).toBe(0);
          expect(queryAttempts).toHaveLength(1);
          expect(queryAttempts[0]?.sql).toContain('2026-11-21T20:30:00.000Z');
          expect(queryAttempts[0]?.sql).toContain('2026-11-23T09:00:00.000Z');
          expect(response.sources).toHaveLength(1);
        }
        if (['unsupported', 'no-payments'].includes(id)) {
          expect(['CLARIFY', 'REPLY']).toContain(response?.status);
          expect(response.text.length).toBeGreaterThan(20);
        }
        if (id === 'ambiguous') {
          expect(response?.status).toBe('CLARIFY');
          expect(queries).toBeGreaterThan(0);
          expect(response.sources.length).toBeGreaterThan(0);
        }
        if (id === 'jalali') {
          if (response?.status === 'ANSWER') {
            expect(numericValues(response.text)).toContain('2');
            expect(response.sources.length).toBeGreaterThan(0);
            expect(queries).toBeGreaterThan(0);
          } else {
            expect(['CLARIFY', 'REPLY']).toContain(response?.status);
            expect(response.text + response.limitations.join(' ')).toMatch(
              /تقویم|تبدیل|شمسی|تاریخ/,
            );
          }
        }
        if (oracle) {
          expect(response?.status).toBe('ANSWER');
          const normalized = normalizeText(response.text);
          if (['hidden', 'missing', 'denied'].includes(id)) {
            expect(normalized).toMatch(
              /0|نیافت|پیدا نشد|یافت نشد|وجود ندارد|موجود نیست|هیچ ردیفی|مشاهده نیست|دسترسی/,
            );
          } else
            for (const value of oracle) {
              if (/^\d+(?:\.\d+)?$/.test(value)) {
                const numbers = numericValues(normalized);
                expect(numbers).toContain(canonicalDecimal(value));
              } else expect(normalized).toContain(value);
            }
          expect(queries).toBeGreaterThan(0);
          expect(response.sources.length).toBeGreaterThan(0);
        }
      }
    }, 150000);
  }
});
