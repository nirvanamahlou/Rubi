import { afterAll, beforeAll, describe, expect, it } from 'vitest';
import { Client } from 'pg';
import { randomBytes, randomUUID } from 'node:crypto';
import { readFileSync } from 'node:fs';
import { resolve } from 'node:path';
import { SalesAgentQueryService, type AgentScope } from './query.service';
import { allowedSources } from './catalog';

const enabled = process.env.NORA_RUN_AGENT_POSTGRES_TESTS === '1';
const suffix = randomUUID().replaceAll('-', '');
const database = `nora_agent_test_${suffix}`;
const login = `nora_agent_test_${suffix}`;
const ids = Array.from(
  { length: 12 },
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
let created = false;
let createdLogin = false;
const service = new SalesAgentQueryService();

describe.skipIf(!enabled)('isolated PostgreSQL model SQL boundary', () => {
  beforeAll(async () => {
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
    const password = randomBytes(32).toString('hex');
    address.pathname = `/${database}`;
    fixture = new Client({ connectionString: address.toString() });
    await fixture.connect();
    await fixture.query(`
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
        `INSERT INTO sales_contracts VALUES($1,$2,$3,$4,$5,'Synthetic buyer','DOMESTIC',$3,$3,'2026-11-14','CONFIRMED','NOT_SENT',now(),now(),null,now(),$6)`,
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
      "INSERT INTO sales_contract_price_components VALUES($1,'USD',125.2500,'BASE'),($1,'USD',25.2500,'DISCOUNT'),($1,'IRR',9999999999999999.0001,'BASE')",
      [ids[6]],
    );
    await fixture.query(
      "INSERT INTO sales_contract_passengers VALUES(gen_random_uuid(),$1,'Synthetic One','ADULT','NEVER_EXPOSE'),(gen_random_uuid(),$1,'Synthetic Two','ADULT','NEVER_EXPOSE')",
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
  }, 30000);

  afterAll(async () => {
    await service.onModuleDestroy();
    await reader?.end();
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
  });

  it('filters ownership, branch, selected company and hidden rows without model predicates', async () => {
    const run = (selected: AgentScope) =>
      service.query(
        'SELECT contract_number FROM contracts ORDER BY contract_number',
        selected,
        allowedSources(true),
      );
    expect((await run(scope)).rows.map((row) => row.contract_number)).toEqual([
      'TEST-0',
    ]);
    expect(
      (await run({ ...scope, mode: 'branch' })).rows.map(
        (row) => row.contract_number,
      ),
    ).toEqual(['TEST-0', 'TEST-1']);
    expect(
      (await run({ ...scope, mode: 'all' })).rows.map(
        (row) => row.contract_number,
      ),
    ).toEqual(['TEST-0', 'TEST-1', 'TEST-2']);
    expect(
      (await run({ ...scope, mode: 'all', companyId: null })).rows.length,
    ).toBe(4);
    expect((await run({ ...scope, branchIds: [] })).rows.length).toBe(0);
  });
  it('preserves Decimal precision/currency and preaggregates before passenger joins', async () => {
    const result = await service.query(
      'SELECT currency_code,amount FROM amounts ORDER BY currency_code',
      scope,
      allowedSources(true),
    );
    expect(result.rows).toEqual([
      { currency_code: 'IRR', amount: '9999999999999999.0001' },
      { currency_code: 'USD', amount: '100.0000' },
    ]);
    const joined = await service.query(
      'SELECT a.currency_code,a.amount,count(p.id) AS passengers FROM amounts a JOIN passengers p ON p.contract_id=a.contract_id GROUP BY a.currency_code,a.amount ORDER BY a.currency_code',
      scope,
      allowedSources(true),
    );
    expect(joined.rows[1]).toEqual({
      currency_code: 'USD',
      amount: '100.0000',
      passengers: '2',
    });
  });
  it('keeps pending payments separate and prevents ungranted payment reads', async () => {
    const result = await service.query(
      'SELECT status,sum(amount) AS total,currency_code FROM payments GROUP BY status,currency_code ORDER BY status',
      scope,
      allowedSources(true),
    );
    expect(result.rows.map((row) => row.total)).toEqual(['20.0000', '30.0000']);
    await expect(
      service.query(
        'SELECT * FROM payments',
        { ...scope, payments: false },
        allowedSources(false),
      ),
    ).rejects.toThrow('SOURCE_NOT_ALLOWED');
  });
  it('database grants deny base tables and writes, and no context means no rows', async () => {
    expect(
      (await reader.query('SELECT count(*) FROM nora_agent.contracts')).rows[0]
        .count,
    ).toBe('0');
    await expect(
      reader.query('SELECT * FROM public.sales_contracts'),
    ).rejects.toThrow(/permission denied/);
    await expect(
      reader.query("UPDATE nora_agent.contracts SET customer_name='bad'"),
    ).rejects.toThrow();
    await expect(
      reader.query('SET ROLE nora_agent_view_owner'),
    ).rejects.toThrow();
    await expect(
      service.query(
        'SELECT passport_secret FROM passengers',
        scope,
        allowedSources(true),
      ),
    ).rejects.toThrow();
    await expect(
      service.query(
        'SELECT card_secret FROM payments',
        scope,
        allowedSources(true),
      ),
    ).rejects.toThrow();
  });
  it('transaction-local scope does not leak between pooled users or failures', async () => {
    await expect(
      service.query(
        'SELECT absent_column FROM contracts',
        scope,
        allowedSources(true),
      ),
    ).rejects.toThrow();
    const second = await service.query(
      'SELECT contract_number FROM contracts',
      { ...scope, userId: ids[1]! },
      allowedSources(true),
    );
    expect(second.rows.map((row) => row.contract_number)).toEqual(['TEST-1']);
    const originalUser = await service.query(
      'SELECT contract_number FROM contracts',
      scope,
      allowedSources(true),
    );
    expect(originalUser.rows.map((row) => row.contract_number)).toEqual([
      'TEST-0',
    ]);
  });
  it('caps rows, retains date-only values and rejects ambiguous output aliases', async () => {
    const date = await service.query(
      'SELECT departure_date FROM contracts',
      scope,
      allowedSources(true),
    );
    expect(date.rows[0]!.departure_date).toBe('2026-11-14');
    await expect(
      service.query(
        'SELECT id AS duplicate,contract_number AS duplicate FROM contracts',
        scope,
        allowedSources(true),
      ),
    ).rejects.toThrow('DUPLICATE_RESULT_COLUMNS');
    await fixture.query(
      `INSERT INTO sales_contracts SELECT gen_random_uuid(), 'CAP-'||n, $1::uuid,$2::uuid,$3::uuid,'Synthetic cap','DOMESTIC',$1::uuid,$1::uuid,'2026-11-14','CONFIRMED','NOT_SENT',now(),now(),null,now(),null FROM generate_series(1,205) n`,
      [ids[2], ids[0], ids[4]],
    );
    const result = await service.query(
      'SELECT contract_number FROM contracts ORDER BY contract_number',
      scope,
      allowedSources(true),
    );
    expect(result.rows).toHaveLength(200);
    expect(result.truncated).toBe(true);
  });
});
