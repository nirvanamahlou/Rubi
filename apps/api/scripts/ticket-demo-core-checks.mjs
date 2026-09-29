import { test } from 'node:test';
import assert from 'node:assert/strict';
import { readFile } from 'node:fs/promises';
import {
  assertLocalTarget,
  runTicketDemo,
  validateFixture,
} from './ticket-demo-core.mjs';

const fixture = JSON.parse(
  (
    await readFile(
      new URL(
        '../src/ticket-catalog/demo/pc-a-tickets-20260929.json',
        import.meta.url,
      ),
      'utf8',
    )
  ).replace(/^\uFEFF/, ''),
);
const config = {
  actorUserId: '10000000-0000-4000-8000-000000000001',
  branchId: '10000000-0000-4000-8000-000000000002',
  cities: Object.fromEntries(fixture.cities.map((c) => [c.key, c.key])),
};
function database() {
  const state = {
    offers: [],
    targets: [],
    standalone: [],
    roundTrips: [],
    commissions: [],
    blocked: new Set(),
  };
  const model = (name) => ({
    async findUnique({ where }) {
      return state[name].find((r) => r.id === where.id) ?? null;
    },
    async create({ data }) {
      const row = { version: 1, ...structuredClone(data) };
      if (name === 'offers') {
        row.audit = data.audit.create;
      }
      state[name].push(row);
      return row;
    },
    async update({ where, data }) {
      const row = state[name].find((r) => r.id === where.id);
      row.status = data.status;
      row.version++;
      return row;
    },
    async updateMany() {
      return { count: 0 };
    },
    async findMany({ where }) {
      return state[name].filter((r) => where.id.in.includes(r.id));
    },
    async count({ where }) {
      return state.blocked.has(where.id) ? 1 : 0;
    },
  });
  const tx = {
    ticketPublishedOffer: model('offers'),
    ticketSalePriceTarget: model('targets'),
    ticketOfferStandaloneSalePrice: model('standalone'),
    ticketOfferRoundTripSalePrice: model('roundTrips'),
    ticketSaleCommissionRevision: model('commissions'),
    async $executeRawUnsafe() {},
    async $queryRawUnsafe() {},
    ticketOfferAudit: {
      async create({ data }) {
        state.offers.find((r) => r.id === data.offerId).audit.push(data);
      },
    },
  };
  return {
    state,
    client: {
      async $transaction(work) {
        const before = structuredClone(state);
        try {
          return await work(tx);
        } catch (error) {
          Object.assign(state, before);
          throw error;
        }
      },
    },
  };
}

test('only explicit local development/test connections are accepted', () => {
  assertLocalTarget(
    'postgresql://local:pass@127.0.0.1:5432/rubi?schema=public',
    'development',
  );
  for (const [url, environment] of [
    ['postgresql://localhost/rubi', 'production'],
    ['postgresql://example.com/rubi', 'test'],
    ['postgresql://localhost/rubi?host=evil', 'test'],
    ['postgresql://localhost/rubi?schema=private', 'test'],
    ['https://localhost/rubi', 'test'],
  ])
    assert.throws(() => assertLocalTarget(url, environment));
});
test('snapshot contains only approved ticket data and closed references', () => {
  validateFixture(fixture, config);
  assert.equal(fixture.offers.length, 20);
  assert.equal(fixture.offers.filter((r) => r.archived).length, 9);
  assert.equal(fixture.standalone.length, 4);
  assert.equal(fixture.roundTrips.length, 4);
  assert.equal(fixture.commissions.length, 12);
  assert.doesNotMatch(
    JSON.stringify(fixture),
    /actorUserId|createdByUserId|branchId|email|phone|password|passport|contractId|payment/i,
  );
  const broken = structuredClone(fixture);
  broken.roundTrips[0].returnOfferId = config.actorUserId;
  assert.throws(() => validateFixture(broken, config), /outside/);
  assert.throws(
    () => validateFixture(fixture, { ...config, cities: {} }),
    /Map/,
  );
});
test('preview performs inserts but rolls everything back', async () => {
  const { client, state } = database();
  const result = await runTicketDemo(client, fixture, config);
  assert.equal(result.created, 20);
  assert.equal(result.applied, false);
  assert.equal(state.offers.length, 0);
  assert.equal(state.targets.length, 0);
});
test('import preserves archived state, prices and decimal precision; repeated import creates nothing', async () => {
  const { client, state } = database();
  assert.equal(
    (await runTicketDemo(client, fixture, config, { apply: true })).created,
    20,
  );
  assert.equal(
    state.offers.filter((r) =>
      r.audit.some((a) => a.action === 'ticket.offer.archived'),
    ).length,
    9,
  );
  assert.equal(state.roundTrips.length, 4);
  assert.equal(state.commissions.length, 12);
  const result = await runTicketDemo(client, fixture, config, { apply: true });
  assert.equal(result.created, 0);
  assert.equal(result.reused, 20);
  assert.equal(state.standalone.length, 4);
  state.standalone[0].amount = '9007199254740992.0001';
  await assert.rejects(
    runTicketDemo(client, fixture, config, { apply: true }),
    /differs at amount/,
  );
});
test('existing source rows require explicit adoption and mismatch rolls back tagging', async () => {
  const { client, state } = database();
  await runTicketDemo(client, fixture, config, { apply: true });
  for (const row of state.offers)
    row.audit = row.audit.filter((a) => !a.action.startsWith('ticket.demo.'));
  for (const row of state.targets) row.code = 'source';
  await assert.rejects(
    runTicketDemo(client, fixture, config, { apply: true }),
    /adopt-source/,
  );
  state.offers[1].carrierName = 'unrelated change';
  await assert.rejects(
    runTicketDemo(client, fixture, config, { apply: true, adoptSource: true }),
    /differs/,
  );
  assert.equal(
    state.offers[0].audit.some((a) => a.action.startsWith('ticket.demo.')),
    false,
  );
  state.offers[1].carrierName = fixture.offers[1].carrierName;
  assert.equal(
    (
      await runTicketDemo(client, fixture, config, {
        apply: true,
        adoptSource: true,
      })
    ).reused,
    20,
  );
});
test('clear touches only marked records in the configured branch and preserves immutable fares', async () => {
  const { client, state } = database();
  await runTicketDemo(client, fixture, config, { apply: true });
  state.offers[1].audit = []; // unrelated record with the same source ID cannot be cleared
  const result = await runTicketDemo(client, fixture, config, {
    apply: true,
    clear: true,
  });
  assert.equal(result.archived, 10);
  assert.equal(state.offers[1].status, 'ACTIVE');
  assert.equal(state.standalone.length, 4);
  assert.equal(
    (await runTicketDemo(client, fixture, config, { apply: true, clear: true }))
      .archived,
    0,
  );
});
test('a linked ticket aborts the entire batch, including earlier archives', async () => {
  const { client, state } = database();
  await runTicketDemo(client, fixture, config, { apply: true });
  state.blocked.add(fixture.offers.filter((row) => !row.archived).at(-1).id);
  await assert.rejects(
    runTicketDemo(client, fixture, config, { apply: true, clear: true }),
    /in use/,
  );
  assert.equal(
    state.offers.filter((r) =>
      r.audit.some((a) => a.action === 'ticket.offer.archived'),
    ).length,
    9,
  );
});
test('clearing in preview mode leaves visibility unchanged', async () => {
  const { client, state } = database();
  await runTicketDemo(client, fixture, config, { apply: true });
  assert.equal(
    (await runTicketDemo(client, fixture, config, { clear: true })).archived,
    11,
  );
  assert.equal(
    state.offers.filter((r) =>
      r.audit.some((a) => a.action === 'ticket.offer.archived'),
    ).length,
    9,
  );
});
