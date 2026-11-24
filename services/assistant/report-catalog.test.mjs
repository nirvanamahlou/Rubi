import test from 'node:test';
import assert from 'node:assert/strict';
import { createReportCatalog } from './report-catalog.mjs';

const catalog = [
  {
    code: 'tickets_manifest',
    title: 'فهرست مسافران',
    producerStatus: 'READY',
    grain: 'MANIFEST',
    version: 1,
    approvedView: 'reservations.reporting.delivery.v1',
  },
  {
    code: 'organization_secret',
    title: 'فهرست مسافران خصوصی',
    producerStatus: 'PENDING_CONNECTION',
    grain: 'private',
    version: 1,
  },
];
function harness(responses, modules) {
  const fetcher = async (url, options) => {
    assert.equal(url, 'https://synthetic.invalid/api/v1/reports/catalog');
    assert.equal(options.redirect, 'error');
    return Response.json(responses.shift() ?? []);
  };
  return createReportCatalog({
    modules,
    base: 'https://synthetic.invalid/api/v1',
    cookie: 'fake',
    signal: new AbortController().signal,
    fetcher,
  });
}
test('search and describe approved reports while technical fields remain local', async () => {
  const reports = harness([catalog, catalog, catalog, []]);
  assert.deepEqual(await reports.search('فهرست مسافران', 3), [
    { id: 'report:tickets_manifest', description: 'فهرست مسافران' },
  ]);
  const item = await reports.describe('report:tickets_manifest');
  assert.ok(item.dateBasis);
  assert.equal(item.approvedView, undefined);
  await reports.revalidate();
  await assert.rejects(reports.revalidate(), /AGENT_CONTEXT_CHANGED/);
});
test('metadata for unavailable sources is inaccessible even with an exact id', async () => {
  const reports = harness([catalog, []]);
  await assert.rejects(
    reports.describe('report:organization_secret'),
    /SOURCE_NOT_ALLOWED/,
  );
  assert.deepEqual(await reports.search('فهرست مسافران', 3), []);
});

test('module rollout hides otherwise permitted sources on search and exact describe', async () => {
  const reports = harness([catalog, catalog], 'sales');
  assert.deepEqual(await reports.search('مسافران', 3), []);
  await assert.rejects(
    reports.describe('report:tickets_manifest'),
    /SOURCE_NOT_ALLOWED/,
  );
});

test('distinguishes denied discovery, an unavailable catalog and permission loss after discovery', async () => {
  const responses = [
    new Response(null, { status: 403 }),
    new Response(null, { status: 503 }),
    Response.json(catalog),
    new Response(null, { status: 403 }),
  ];
  const reports = createReportCatalog({
    base: 'https://synthetic.invalid/api/v1',
    cookie: 'synthetic',
    signal: new AbortController().signal,
    fetcher: async () => responses.shift(),
  });
  assert.deepEqual(await reports.search('فهرست مسافران', 3), []);
  await assert.rejects(
    reports.search('فهرست مسافران', 3),
    /AGENT_SOURCE_UNAVAILABLE/,
  );
  assert.equal((await reports.search('فهرست مسافران', 3)).length, 1);
  await assert.rejects(reports.revalidate(), /AGENT_SOURCE_UNAVAILABLE/);
});
