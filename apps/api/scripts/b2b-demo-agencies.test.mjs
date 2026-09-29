import { afterEach, describe, expect, it } from 'vitest';
import { demoAgencyNames } from './b2b-demo-agencies.mjs';

const previous = process.env.B2B_DEMO_ALL_EXISTING;

afterEach(() => {
  if (previous === undefined) delete process.env.B2B_DEMO_ALL_EXISTING;
  else process.env.B2B_DEMO_ALL_EXISTING = previous;
});

describe('B2B demo agency selection', () => {
  it('explicitly paginates all agencies and excludes other roles', async () => {
    delete process.env.B2B_DEMO_ALL_EXISTING;
    await expect(demoAgencyNames({}, ['bounded'])).resolves.toEqual([
      'bounded',
    ]);
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
    await expect(demoAgencyNames(master, [])).resolves.toEqual([
      'Agency',
      'Last agency',
    ]);
    expect(calls).toEqual([
      ['organizations', 1],
      ['organizations', 2],
    ]);
    await expect(
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
    ).rejects.toThrow(/Duplicate agency/);
  });
});
