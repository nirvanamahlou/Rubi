import assert from 'node:assert/strict';
import { test } from 'node:test';
import { mappingDecision } from './repair-extension-mapping.mjs';
const plan = {
  phase: 'preview',
  extension: '112',
  expectedVersion: 0,
  connectionId: 'connection',
  branchId: 'branch',
  username: 'manager',
};
const user = {
  id: 'user',
  username: 'manager',
  status: 'ACTIVE',
  branches: [{ branch: { id: 'branch' } }],
};
const connection = {
  id: 'connection',
  branchId: 'branch',
  active: true,
  synthetic: false,
  mappings: [],
};
const decide = (
  p = plan,
  c = connection,
  u = user,
  ids = ['user'],
  shared = false,
  eligible = true,
  route = true,
) => mappingDecision(p, c, u, ids, shared, eligible, route);
test('missing mapping requires bounded repair in preview or apply', () => {
  assert.equal(decide().change, true);
  assert.equal(decide({ ...plan, phase: 'apply' }).change, true);
});
test('existing exact active mapping is idempotent', () => {
  assert.equal(
    decide(plan, {
      ...connection,
      mappings: [
        { extension: '112', userId: 'user', active: true, version: 2 },
      ],
    }).change,
    false,
  );
});
test('never overwrites another user even when mapping inactive', () => {
  for (const active of [true, false])
    assert.throws(
      () =>
        decide(plan, {
          ...connection,
          mappings: [{ extension: '112', userId: 'other', active }],
        }),
      /MAPPING_CONFLICT/,
    );
});
test('shared, unlinked and conflicting HR records fail closed', () => {
  for (const ids of [[], ['other'], ['user', 'other']])
    assert.throws(
      () => decide(plan, connection, user, ids),
      /UNIQUE_HR_LINK_REQUIRED/,
    );
  assert.throws(
    () => decide(plan, connection, user, ['user'], true),
    /UNIQUE_HR_LINK_REQUIRED/,
  );
});
test('inactive account, changed branch or username is rejected', () => {
  for (const change of [
    { status: 'DISABLED' },
    { username: 'other' },
    { branches: [] },
  ])
    assert.throws(
      () => decide(plan, connection, { ...user, ...change }),
      /ACCOUNT_CHANGED/,
    );
});
test('no grants are added to compensate missing route or eligibility', () => {
  assert.throws(
    () => decide(plan, connection, user, ['user'], false, false),
    /EXISTING_CALL_ACCESS_REQUIRED/,
  );
  assert.throws(
    () => decide(plan, connection, user, ['user'], false, true, false),
    /EXISTING_CALL_ACCESS_REQUIRED/,
  );
});
test('inactive, synthetic or changed connection rejected', () => {
  for (const change of [
    { active: false },
    { synthetic: true },
    { id: 'other' },
    { branchId: 'other' },
  ])
    assert.throws(
      () => decide(plan, { ...connection, ...change }),
      /CONNECTION_CHANGED/,
    );
});
test('stale version cannot activate a modified mapping', () => {
  assert.throws(
    () =>
      decide(plan, {
        ...connection,
        mappings: [
          { extension: '112', userId: 'user', active: false, version: 3 },
        ],
      }),
    /MAPPING_VERSION_CHANGED/,
  );
});
test('unsupported phase or malformed extension rejected', () => {
  for (const change of [
    { phase: 'rollback' },
    { extension: '../112' },
    { expectedVersion: -1 },
  ])
    assert.throws(() => decide({ ...plan, ...change }), /INVALID_PLAN/);
});
