/**
 * Opt-in, non-HTTP ProcurementService.list benchmark.
 * Run from apps/api with tsx --tsconfig tsconfig.json ../../docs/tasks/PROCUREMENT-001-load.ts.
 * DATABASE_URL must point to the dedicated task DB; no operational DB is accepted.
 * --prepare-only creates entirely synthetic fixtures; --measure-only preserves them.
 */
import { createRequire } from 'node:module';
import { performance } from 'node:perf_hooks';
import { writeFileSync } from 'node:fs';
import { resolve } from 'node:path';

import { ProcurementService } from '../../apps/api/src/procurement/procurement.service';
import { PrismaClient } from '../../packages/database/src/generated/prisma/client';
import { PROCUREMENT_REQUEST_STATUSES, type AuthenticatedActor } from '../../packages/contracts/src';

const repo = resolve(process.cwd(), '../..');
const requireDatabase = createRequire(resolve(repo, 'packages/database/package.json'));
const { PrismaPg } = requireDatabase('@prisma/adapter-pg');
const { Client } = requireDatabase('pg');
const uri = new URL(process.env.DATABASE_URL ?? '');
if (process.env.PROCUREMENT_LOAD_TEST !== '1' || uri.hostname !== '127.0.0.1' || uri.port !== '55473' || uri.pathname !== '/procurement_001_load_test') {
  throw new Error('Refusing any endpoint other than the dedicated PROCUREMENT-001 load database');
}
const client = new PrismaClient({ adapter: new PrismaPg({ connectionString: uri.toString(), max: 10 }), log: [{ emit: 'event', level: 'query' }] });
const pg = new Client({ connectionString: uri.toString(), connectionTimeoutMillis: 60000 });
let totalQueries = 0;
let captured: { query: string; params: string } | undefined;
let additionalCaptured: Array<{ query: string; params: string }> = [];
client.$on('query', (event) => {
  totalQueries += 1;
  if (!captured) captured = { query: event.query, params: event.params };
  else if (event.query !== captured.query && !additionalCaptured.some((query) => query.query === event.query)) additionalCaptured.push({ query: event.query, params: event.params });
});

async function prepare() {
  const current = Number((await pg.query('SELECT count(*) FROM procurement_request')).rows[0].count);
  if (current === 100000) return { generated: false, requests: current };
  if (current !== 0) throw new Error('Refusing to replace an unexpected nonempty load dataset');
  const started = performance.now();
  await pg.query('BEGIN');
  try {
    await pg.query(`INSERT INTO branches (id,code,name,"updatedAt")
      SELECT md5('proc-load-branch-'||g)::uuid,'LOAD-'||g,'Synthetic load branch '||g,now() FROM generate_series(0,4) g`);
    await pg.query(`INSERT INTO iam_users (id,username,"displayName","passwordHash","updatedAt")
      SELECT md5('proc-load-user-'||g)::uuid,'proc-load-user-'||g,'Synthetic load user '||g,'disabled-synthetic-fixture',now() FROM generate_series(0,99) g`);
    await pg.query(`INSERT INTO procurement_request
      (id,number,"branchId","requesterUserId","ownerUserId","unitId",status,title,category,priority,urgent,"requiredAt",data,"createdAt","updatedAt")
      SELECT md5('proc-load-request-'||g)::uuid,'LOAD-'||lpad(g::text,8,'0'),
        md5('proc-load-branch-'||((g-1)%5))::uuid,
        md5('proc-load-user-'||((g-1)%100))::uuid,
        CASE WHEN g%4=0 THEN NULL ELSE md5('proc-load-user-'||((g+36)%100))::uuid END,
        'load-unit-'||((g-1)%5)||'-'||(((g-1)/5)%4),
        ($1::text[])[(((g-1)/5)%array_length($1::text[],1))+1],
        'Synthetic Procurement '||g, 'OFFICE','NORMAL',false,
        timestamptz '2026-10-01 00:00:00+00' + (g%30)*interval '1 day',
        jsonb_build_object('title','Synthetic Procurement '||g,'branchId',md5('proc-load-branch-'||((g-1)%5))::uuid,
          'unitId','load-unit-'||((g-1)%5)||'-'||(((g-1)/5)%4),'purchaseType','GENERAL','category','OFFICE',
          'needReason','Entirely synthetic load evidence; no business commitment','requiredAt','2026-10-01T00:00:00.000Z',
          'priority','NORMAL','urgent',false,'urgencyReason','','estimatedAmount',null,'currencyCode',null,
          'unknownEstimateReason','Synthetic list-only fixture','deliveryLocation','Synthetic office','notes',repeat('synthetic ',30),
          'documents','[]'::jsonb,'origin',jsonb_build_object('kind','GENERAL'),
          'items',jsonb_build_array(jsonb_build_object('id',md5('proc-load-item-'||g)::uuid,'kind','GOODS',
            'description','Synthetic office item','specification','Test-only','quantity','1','unit','piece','acceptanceCriteria','','period',''))),
        timestamptz '2026-01-01 00:00:00+00' + g*interval '1 second',
        timestamptz '2026-01-01 00:00:00+00' + g*interval '1 second'
      FROM generate_series(1,100000) g`, [[...PROCUREMENT_REQUEST_STATUSES]]);
    await pg.query(`INSERT INTO procurement_request_item (id,"requestId",kind,description,quantity,unit,"updatedAt")
      SELECT md5('proc-load-item-'||g)::uuid,md5('proc-load-request-'||g)::uuid,'GOODS','Synthetic office item',1,'piece',now() FROM generate_series(1,100000) g`);
    await pg.query('COMMIT');
  } catch (error) { await pg.query('ROLLBACK'); throw error; }
  await pg.query('ANALYZE procurement_request');
  await pg.query('ANALYZE procurement_request_item');
  return { generated: true, requests: 100000, items: 100000, generationMs: Math.round(performance.now() - started) };
}

type Sample = { scenario: string; ms: number; error: string | null };
const percentile = (values: number[], p: number) => values[Math.max(0, Math.ceil(values.length * p) - 1)] ?? null;
function summarize(samples: Sample[]) {
  const durations = samples.map((sample) => sample.ms).sort((a, b) => a - b);
  return { calls: samples.length, errors: samples.filter((sample) => sample.error !== null).length,
    p50Ms: percentile(durations, 0.5), p95Ms: percentile(durations, 0.95), p99Ms: percentile(durations, 0.99),
    maxMs: durations.at(-1) ?? null };
}

async function main() {
  await pg.connect();
  const preparation = process.argv.includes('--measure-only') ? { generated: false, requests: Number((await pg.query('SELECT count(*) FROM procurement_request')).rows[0].count) } : await prepare();
  if (preparation.requests !== 100000) throw new Error('Exactly100000 synthetic requests are required');
  const fixtureCounts = (await pg.query(`SELECT
    (SELECT count(*)::int FROM procurement_request) AS requests,
    (SELECT count(*)::int FROM procurement_request_item) AS items,
    (SELECT count(*)::int FROM branches) AS branches,
    (SELECT count(*)::int FROM iam_users) AS users,
    (SELECT count(DISTINCT "unitId")::int FROM procurement_request) AS units,
    (SELECT count(DISTINCT status)::int FROM procurement_request) AS statuses`)).rows[0];
  if (fixtureCounts.items !== 100000 || fixtureCounts.branches !== 5 || fixtureCounts.users !== 100 || fixtureCounts.units !== 20 || fixtureCounts.statuses !== PROCUREMENT_REQUEST_STATUSES.length)
    throw new Error('Synthetic fixture cardinalities are not as expected');
  console.log(JSON.stringify({ phase: 'fixtures_verified', ...fixtureCounts }));
  if (process.argv.includes('--prepare-only')) { console.log(JSON.stringify({ phase: 'prepared', ...preparation })); return; }
  const branch = (await pg.query("SELECT id FROM branches WHERE code='LOAD-0'")).rows[0].id;
  const user = (await pg.query("SELECT id FROM iam_users WHERE username='proc-load-user-0'")).rows[0].id;
  const actor = (permission: string): AuthenticatedActor => ({ userId: user, sessionId: user, branchIds: [branch], permissions: [permission] as AuthenticatedActor['permissions'] });
  const all = actor('procurement.read.all');
  const own = actor('procurement.read.own');
  const unit = actor('procurement.read.unit');
  const hr = { self: async () => ({ userId: user, branchId: branch, unitId: 'load-unit-0-0' }) };
  const service = new ProcurementService({ client } as never, {} as never, hr as never, {} as never, {} as never, {} as never, {} as never, {} as never);
  const scenarios = [
    { name: 'first_page_read_all', query: { page: 1 }, actor: all },
    { name: 'status_filtered_read_all', query: { page: 1, status: 'APPROVED' }, actor: all },
    { name: 'own_scope_diagnostic', query: { page: 1 }, actor: own },
    { name: 'unit_scope_diagnostic', query: { page: 1 }, actor: unit },
    { name: 'high_page_350_diagnostic', query: { page: 350 }, actor: all },
  ];
  const startedAt = new Date().toISOString();
  const explain: Record<string, unknown> = {};
  for (const scenario of scenarios) {
    captured = undefined;
    additionalCaptured = [];
    for (let i = 0; i < 5; i += 1) await service.list(scenario.query, scenario.actor);
    if (!captured) throw new Error('Prisma query capture unavailable');
    const query = captured as { query: string; params: string };
    const result = await pg.query('EXPLAIN (ANALYZE, BUFFERS, FORMAT JSON) ' + query.query, JSON.parse(query.params));
    const additionalQueries: unknown[] = [];
    for (const second of additionalCaptured) {
      const secondPlan = await pg.query('EXPLAIN (ANALYZE, BUFFERS, FORMAT JSON) ' + second.query, JSON.parse(second.params));
      additionalQueries.push({ query: second.query, plan: secondPlan.rows[0]['QUERY PLAN'] });
    }
    explain[scenario.name] = { query: query.query, plan: result.rows[0]['QUERY PLAN'], additionalQueries };
  }
  if (process.argv.includes('--explain-only')) {
    writeFileSync(resolve(process.env.TEMP ?? repo, 'PROCUREMENT-001-load-precheck.json'), JSON.stringify(explain, null, 2) + '\n');
    console.log(JSON.stringify({ phase: 'explain-only', scenarios: scenarios.length, benchmarkMeasured: false }));
    return;
  }
  const results: Record<string, unknown> = {};
  const allSamples: Sample[] = [];
  async function run(name: string, calls: number, choices: typeof scenarios) {
    console.log(JSON.stringify({ phase: name + '_started', calls, concurrency: 50 }));
    const samples: Sample[] = [];
    const queryStart = totalQueries;
    const started = performance.now();
    let cursor = 0;
    await Promise.all(Array.from({ length: 50 }, async () => {
      while (true) {
        const index = cursor++;
        if (index >= calls) return;
        const scenario = choices[index % choices.length]!;
        const begin = performance.now();
        let error: string | null = null;
        try {
          const response = await service.list(scenario.query, scenario.actor);
          if (response.items.length !== 50) throw new Error('Expected50 list rows');
        } catch (failure) { error = failure instanceof Error ? failure.name + ': ' + failure.message : 'Unknown error'; }
        samples.push({ scenario: scenario.name, ms: Math.round((performance.now() - begin) * 100) / 100, error });
      }
    }));
    results[name] = { ...summarize(samples), wallMs: Math.round(performance.now() - started), queries: totalQueries - queryStart,
      byScenario: Object.fromEntries(choices.map((choice) => [choice.name, summarize(samples.filter((sample) => sample.scenario === choice.name))])) };
    allSamples.push(...samples);
    console.log(JSON.stringify({ phase: name, ...summarize(samples), queries: totalQueries - queryStart }));
  }
  await run('primary_mixed', 500, scenarios.slice(0, 2));
  await run('own_scope', 100, [scenarios[2]!]);
  await run('unit_scope', 100, [scenarios[3]!]);
  await run('high_page', 100, [scenarios[4]!]);
  const stats = (await pg.query("SELECT pg_size_pretty(pg_total_relation_size('procurement_request')) AS request_storage, avg(pg_column_size(data))::int AS avg_draft_json_bytes FROM procurement_request")).rows[0];
  const evidence = { task: 'PROCUREMENT-001', method: 'Real ProcurementService.list; direct service invocation, no HTTP/UI measurements',
    startedAt, finishedAt: new Date().toISOString(), node: process.version, postgres: (await pg.query('SHOW server_version')).rows[0].server_version,
    database: 'procurement_001_load_test', container: 'rubi-procurement-001-pg18', endpoint: '127.0.0.1:55473',
    migrationCount: Number((await pg.query('SELECT count(*) FROM _prisma_migrations WHERE finished_at IS NOT NULL AND rolled_back_at IS NULL')).rows[0].count),
    fixtures: { ...preparation, actualCounts: fixtureCounts, requestItems: 100000, branches: 5, users: 100, units: 20, statuses: [...PROCUREMENT_REQUEST_STATUSES],
      generatedWith: 'PostgreSQL generate_series + deterministic md5 UUIDs; synthetic JSON drafts and normalized items; no passenger/contact/credential data',
      limitation: 'List fixtures are not end-to-end commercial histories; no quotes, receipts, invoices or approval graphs generated' },
    concurrency: 50, connectionPoolMax: 10, warmupCallsPerScenario: 5, primaryCalls: 500, diagnosticCallsEach: 100,
    ownerStubs: 'In-memory HR.self returns synthetic actor unit; other owner adapters are unused by list; permission-scoped actors are synthetic',
    results, storage: stats, explain, errors: allSamples.filter((sample) => sample.error),
    target: { primaryP95MsLessThan: 2000, passed: (results.primary_mixed as { p95Ms: number; errors: number }).p95Ms < 2000 && (results.primary_mixed as { errors: number }).errors === 0 },
    limitations: ['No HTTP, authentication, browser rendering or network-client latency measured', 'Single desktop host shared with normal apps; no production capacity guarantee', 'Five warmups per scenario; SQL EXPLAIN ran before measured calls', 'Deep-page OFFSET diagnostic tests a known pagination cost'],
    cleanup: 'Only a dedicated synthetic load database was created; existing task test databases and shared runtimes untouched. Dataset retained temporarily for inspectable evidence/optimization.' };
  writeFileSync(resolve(repo, 'docs/tasks/PROCUREMENT-001-load.json'), JSON.stringify(evidence, null, 2) + '\n');
  console.log(JSON.stringify({ phase: 'complete', target: evidence.target }));
}
main().catch((failure) => { console.error(failure instanceof Error ? failure.message : 'Load benchmark failed'); process.exitCode = 1; }).finally(async () => { await client.$disconnect(); await pg.end(); });
