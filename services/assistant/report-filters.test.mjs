import assert from 'node:assert/strict';
import { test } from 'node:test';
import { resolveReportFilters, parseFilterSearch } from './report-filters.mjs';
import { createToolExecutor } from './tool-executor.mjs';
const now = new Date('2026-10-13T08:00:00Z');
test('filter boundary uses complete Tehran days and rejects duplicates, extra selectors and impossible dates', () => {
  assert.deepEqual(resolveReportFilters({}, now), {
    startDate: '2026-10-06',
    endDate: '2026-10-12',
    branchId: null,
    originId: null,
    destinationId: null,
  });
  assert.equal(
    resolveReportFilters(
      { startDate: '2026-07-15', endDate: '2026-10-12' },
      now,
    ).startDate,
    '2026-07-15',
  );
  for (const input of [
    { startDate: '2026-02-30', endDate: '2026-03-01' },
    { startDate: '2026-10-13', endDate: '2026-10-13' },
    { startDate: '2026-07-14', endDate: '2026-10-12' },
    { userId: 'other' },
    { startDate: '2026-10-12' },
  ])
    assert.throws(() => resolveReportFilters(input, now));
  assert.throws(() => parseFilterSearch('?branchId=a&branchId=b', now));
  assert.throws(() => parseFilterSearch('?companyId=a', now));
});
test('filtered tool rejects unauthorized branch before reading source', async () => {
  const execute = createToolExecutor({
    now: () => now,
    authenticate: async () => ({
      userId: 'a',
      branchIds: [],
      permissions: ['sales.contracts.read.all'],
    }),
    client: { readTool: () => assert.fail('unauthorized read') },
  });
  await assert.rejects(
    execute(
      'sales.report.v2',
      { branchId: 'aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaaa' },
      {
        cookie: 'synthetic',
        signal: new AbortController().signal,
        actorId: 'a',
      },
    ),
    { message: 'FORBIDDEN' },
  );
});
