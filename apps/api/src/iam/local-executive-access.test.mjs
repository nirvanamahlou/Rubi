import assert from 'node:assert/strict';
import { test } from 'node:test';
import { executiveAccess } from './local-executive-access.mjs';
function fixture({
  user = { id: 'user-1', status: 'ACTIVE' },
  role = null,
} = {}) {
  const writes = [];
  const tx = {
    user: {
      findUnique: async ({ where }) => {
        assert.equal(where.username, 'Amin');
        return user;
      },
    },
    role: {
      findUnique: async () => role,
      create: async ({ data }) => {
        writes.push(['role', data]);
        return { id: 'role-1' };
      },
    },
    permission: {
      upsert: async (arg) => {
        writes.push(['permission', arg]);
        return { id: 'perm-1' };
      },
    },
    rolePermission: {
      upsert: async (arg) => {
        writes.push(['rolePermission', arg]);
      },
    },
    userRole: {
      upsert: async (arg) => {
        writes.push(['grant', arg]);
      },
      deleteMany: async (arg) => {
        writes.push(['revoke', arg]);
      },
    },
    auditEvent: {
      create: async (arg) => {
        writes.push(['audit', arg]);
      },
    },
  };
  return {
    db: {
      $transaction: async (fn, options) => {
        assert.equal(options.isolationLevel, 'Serializable');
        return fn(tx);
      },
    },
    writes,
  };
}
test('dry-run and missing/inactive account never write', async () => {
  const f = fixture();
  assert.equal(
    (await executiveAccess(f.db, { username: 'Amin' })).apply,
    false,
  );
  assert.deepEqual(f.writes, []);
  for (const user of [null, { id: 'user-1', status: 'DISABLED' }]) {
    const denied = fixture({ user });
    await assert.rejects(
      executiveAccess(denied.db, { username: 'Amin', apply: true }),
    );
    assert.deepEqual(denied.writes, []);
  }
});
test('grant adds only the executive permission with an isolated role and honest audit', async () => {
  const f = fixture();
  await executiveAccess(f.db, { username: 'Amin', apply: true });
  assert.equal(
    f.writes.find(([key]) => key === 'permission')[1].create.code,
    'ui.screen.assistant.executive',
  );
  assert.equal(
    f.writes.find(([key]) => key === 'role')[1].code,
    'local-assistant-user-1',
  );
  assert.equal(
    f.writes.find(([key]) => key === 'audit')[1].data.actorUserId,
    null,
  );
  assert.equal(
    f.writes.some(([key]) => key === 'revoke'),
    false,
  );
});
test('shared, system or widened roles fail closed', async () => {
  for (const role of [
    { isSystem: true, isActive: true, users: [], permissions: [] },
    { isActive: true, users: [{ userId: 'other' }], permissions: [] },
    {
      isActive: true,
      users: [],
      permissions: [{ permission: { code: 'finance.write' } }],
    },
  ]) {
    const f = fixture({ role });
    await assert.rejects(
      executiveAccess(f.db, { username: 'Amin', apply: true }),
    );
    assert.deepEqual(f.writes, []);
  }
});
test('revoke removes only this temporary membership', async () => {
  const f = fixture({
    role: {
      id: 'role-1',
      isActive: true,
      users: [{ userId: 'user-1' }],
      permissions: [],
    },
  });
  await executiveAccess(f.db, { username: 'Amin', apply: true, revoke: true });
  assert.deepEqual(f.writes.find(([key]) => key === 'revoke')[1], {
    where: { userId: 'user-1', roleId: 'role-1' },
  });
  assert.equal(
    f.writes.some(([key]) => ['permission', 'grant', 'role'].includes(key)),
    false,
  );
});
