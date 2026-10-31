import { test } from 'node:test';
import assert from 'node:assert/strict';
import { registerAdditionalExtension } from './additional-extension.mjs';
const branchId = '10000000-0000-4000-8000-000000000001';
const employeeId = '20000000-0000-4000-8000-000000000001';
const actor = {
  userId: '30000000-0000-4000-8000-000000000001',
  branchIds: [branchId],
  permissions: ['hr.manage'],
};
const input = {
  branchId,
  employeeId,
  primaryExtension: '201',
  additionalExtension: '211',
};
function fixture(
  records = [{ id: 'primary', values: ['201'] }],
  conflict = null,
) {
  const writes = [];
  const tx = {
    $queryRaw: async () => [],
    hrEmployee: {
      findFirst: async () => ({ id: employeeId, userId: actor.userId }),
    },
    hrRecord: {
      findMany: async () => records,
      findFirst: async () => conflict,
      create: async ({ data }) => {
        const r = { ...data, version: 1 };
        writes.push(['record', r]);
        records.push(r);
        return r;
      },
    },
    hrAuditEvent: { create: async ({ data }) => writes.push(['audit', data]) },
    hrNotification: {
      create: async ({ data }) => writes.push(['notification', data]),
    },
  };
  return {
    client: { $transaction: async (fn) => fn(tx) },
    tx,
    writes,
    records,
  };
}
test('additional extension preserves the primary and replay produces one audited addition', async () => {
  const f = fixture();
  assert.equal(
    (await registerAdditionalExtension(f.client, actor, input)).added,
    true,
  );
  assert.equal(
    (await registerAdditionalExtension(f.client, actor, input)).added,
    false,
  );
  assert.deepEqual(f.records[0], { id: 'primary', values: ['201'] });
  assert.deepEqual(f.records[1].values, ['211']);
  assert.deepEqual(
    f.writes.map(([kind]) => kind),
    ['record', 'audit', 'notification'],
  );
  assert.equal(f.writes[1][1].actorId, actor.userId);
  assert.equal(f.records[1].createdAt, undefined, 'never backdate access');
});
test('permission and branch checks reject before transaction/writes', async () => {
  const client = { $transaction: async () => assert.fail('must not run') };
  await assert.rejects(
    registerAdditionalExtension(client, { ...actor, permissions: [] }, input),
    /HR_MANAGE_REQUIRED/,
  );
  await assert.rejects(
    registerAdditionalExtension(client, { ...actor, branchIds: [] }, input),
    /BRANCH_FORBIDDEN/,
  );
});
test('rejects assigning another employee extension without overwriting shared identities', async () => {
  const f = fixture(undefined, { id: 'other-employee-record' });
  await assert.rejects(
    registerAdditionalExtension(f.client, actor, input),
    /EXTENSION_ALREADY_ASSIGNED/,
  );
  assert.equal(f.writes.length, 0);
});
test('stale primary precondition prevents unintended registration', async () => {
  const f = fixture([{ id: 'primary', values: ['202'] }]);
  await assert.rejects(
    registerAdditionalExtension(f.client, actor, input),
    /PRIMARY_EXTENSION_CHANGED/,
  );
  assert.equal(f.writes.length, 0);
});
test('inactive or unlinked employees cannot be given aliases', async () => {
  const f = fixture();
  f.tx.hrEmployee.findFirst = async () => null;
  await assert.rejects(
    registerAdditionalExtension(f.client, actor, input),
    /ACTIVE_LINKED_EMPLOYEE_REQUIRED/,
  );
  assert.equal(f.writes.length, 0);
});
test('rejects invalid or duplicate primary/alias values', async () => {
  const f = fixture();
  for (const additionalExtension of ['201', '21x', '', '12345678901234567'])
    await assert.rejects(
      registerAdditionalExtension(f.client, actor, {
        ...input,
        additionalExtension,
      }),
      /INVALID_EXTENSION_REGISTRATION/,
    );
  assert.equal(f.writes.length, 0);
});
