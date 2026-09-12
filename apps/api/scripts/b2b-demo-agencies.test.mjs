import { test } from 'node:test';
import assert from 'node:assert/strict';
import { demoAgencyNames } from './b2b-demo-agencies.mjs';

test('explicit all-agency selection paginates and excludes other roles', async () => {
  const previous = process.env.B2B_DEMO_ALL_EXISTING;
  try {
    delete process.env.B2B_DEMO_ALL_EXISTING;
    assert.deepEqual(await demoAgencyNames({}, ['bounded']), ['bounded']);
    process.env.B2B_DEMO_ALL_EXISTING = '1';
    const calls = [];
    const master = {
      async list(resource, query) {
        calls.push([resource, query.page]);
        return {
          data:
            query.page === 1
              ? [
                  {
                    name: 'Agency',
                    attributes: { roleCodes: 'AGENCY,SUPPLIER' },
                  },
                  { name: 'Supplier', attributes: { roleCodes: 'SUPPLIER' } },
                ]
              : [{ name: 'Last agency', attributes: { roleCodes: 'AGENCY' } }],
          meta: { total: 3 },
        };
      },
    };
    assert.deepEqual(await demoAgencyNames(master, []), [
      'Agency',
      'Last agency',
    ]);
    assert.deepEqual(calls, [
      ['organizations', 1],
      ['organizations', 2],
    ]);
    await assert.rejects(
      () =>
        demoAgencyNames(
          {
            async list() {
              return {
                data: [1, 2].map(() => ({
                  name: 'duplicate',
                  attributes: { roleCodes: 'AGENCY' },
                })),
                meta: { total: 2 },
              };
            },
          },
          [],
        ),
      /Duplicate agency/,
    );
  } finally {
    if (previous === undefined) delete process.env.B2B_DEMO_ALL_EXISTING;
    else process.env.B2B_DEMO_ALL_EXISTING = previous;
  }
});
