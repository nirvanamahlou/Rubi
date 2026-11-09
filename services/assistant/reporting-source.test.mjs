import assert from 'node:assert/strict';
import { test } from 'node:test';
import {
  validCatalog,
  projectCatalog,
  validDashboard,
  projectDashboard,
} from './reporting-source.mjs';
import { getTool } from './tools.mjs';
test('catalog projects only public capability fields, preserving pending reports', () => {
  const rows = [
    {
      code: 'RPT-001',
      title: 'Sales',
      grain: 'ORDER',
      version: 1,
      producerStatus: 'PENDING_CONNECTION',
      approvedView: 'private_table',
    },
  ];
  assert.ok(validCatalog(rows));
  assert.equal(
    projectCatalog(rows).reports[0].producerStatus,
    'PENDING_CONNECTION',
  );
  assert.ok(!JSON.stringify(projectCatalog(rows)).includes('private_table'));
  assert.equal(validCatalog([...rows, ...rows]), false);
});
const sample = () => ({
  state: 'ready',
  message: 'ok',
  metadata: {
    generatedAt: '2026-11-09T00:00:00Z',
    dataAsOf: '2026-11-09T00:00:00Z',
    timezone: 'Asia/Tehran',
    reportVersion: 'reporting.dashboard.native.v1',
  },
  metrics: {
    sales: {
      value: '12345678901234567890.12',
      unit: 'IRR',
      detail: 'confirmed',
    },
  },
  visuals: { trend: { labels: ['today'], values: [1] } },
});
test('dashboard keeps exact source decimal strings and excludes arbitrary source fields', () => {
  const x = sample();
  x.secret = 'excluded';
  assert.ok(validDashboard(x));
  const r = projectDashboard(x);
  assert.equal(r.metrics.sales.value, x.metrics.sales.value);
  assert.equal(r.secret, undefined);
  assert.deepEqual(r.charts, ['trend']);
});
test('missing data is not zero; malformed or oversized sources fail closed', () => {
  assert.ok(
    validDashboard({
      state: 'empty',
      message: 'none',
      metadata: null,
      metrics: {},
      visuals: {},
    }),
  );
  let x = sample();
  x.visuals.trend.values = [Infinity];
  assert.equal(validDashboard(x), false);
  x = sample();
  x.metadata.reportVersion = 'unknown';
  assert.equal(validDashboard(x), false);
  x = sample();
  x.visuals.trend.labels = [];
  assert.equal(validDashboard(x), false);
  assert.equal(validCatalog(new Array(101).fill({})), false);
});
test('public reporting tools are fixed reads of native ERP, never arbitrary SQL or sidecar routes', () => {
  for (const id of ['reporting.catalog', 'dashboard.snapshot']) {
    let t = getTool(id);
    assert.equal(t.base, 'core');
    assert.equal(t.sideEffects, false);
    assert.ok(t.permissions.includes('reporting.read'));
  }
});
