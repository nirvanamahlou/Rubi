import assert from 'node:assert/strict';
import { test } from 'vitest';
import {
  assertLocalDatabase,
  createMissingCompanies,
  inspectCompanies,
  localCompanies,
} from './local-legal-entities-lib.mjs';

test('rejects remote and production databases', () => {
  for (const url of [
    'postgresql://example.test/rubi',
    'https://localhost/rubi',
  ])
    assert.throws(() => assertLocalDatabase(url, 'development'));
  assert.throws(() =>
    assertLocalDatabase('postgresql://localhost/rubi', 'production'),
  );
  assert.doesNotThrow(() =>
    assertLocalDatabase('postgresql://127.0.0.1:55433/rubi', 'development'),
  );
});

test('reports missing companies without writing or reactivating inactive companies', async () => {
  const result = await inspectCompanies({
    legalEntity: {
      findMany: async () => [{ code: 'JAHAN_BASTAN', isActive: false }],
    },
  });
  assert.equal(
    result.find(({ code }) => code === 'JAHAN_BASTAN').status,
    'inactive-preserved',
  );
  assert.equal(result.filter(({ status }) => status === 'missing').length, 3);
});

test('creates only missing companies with their initial snapshot and is repeatable', async () => {
  const rows = new Map([
    [
      localCompanies[0].code,
      { id: 'existing', isActive: false, persianName: 'Preserve custom name' },
    ],
  ]);
  const snapshots = [];
  const actorId = '10000000-0000-4000-8000-000000000001';
  const transaction = {
    user: { findFirst: async () => ({ id: actorId }) },
    legalEntity: {
      findUnique: async ({ where }) => rows.get(where.code),
      create: async ({ data }) => {
        const row = { ...data, id: data.code };
        rows.set(data.code, row);
        return row;
      },
    },
    legalEntityBrandingVersion: {
      create: async ({ data }) => snapshots.push(data),
    },
  };
  const database = { $transaction: async (run) => run(transaction) };
  assert.deepEqual(await createMissingCompanies(database, actorId), {
    created: 3,
    preserved: 1,
  });
  assert.deepEqual(await createMissingCompanies(database, actorId), {
    created: 0,
    preserved: 4,
  });
  assert.equal(snapshots.length, 3);
  assert.ok(
    snapshots.every(
      ({ version, createdByUserId, snapshot }) =>
        version === 1 &&
        createdByUserId === actorId &&
        snapshot.logoFileId === null,
    ),
  );
  assert.equal(
    rows.get(localCompanies[0].code).persianName,
    'Preserve custom name',
  );
  assert.equal(rows.get(localCompanies[0].code).isActive, false);
});

test('does not create an operator or a company when the operator is missing', async () => {
  const database = {
    $transaction: async (run) => run({ user: { findFirst: async () => null } }),
  };
  await assert.rejects(
    createMissingCompanies(database, '10000000-0000-4000-8000-000000000001'),
  );
});
