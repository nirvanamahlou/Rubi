import assert from 'node:assert/strict';
import { test } from 'node:test';
import { checkPlan, extendOwnAccess } from './live-ingress-bootstrap.mjs';

const id = '11111111-1111-4111-8111-111111111111';
const userId = '22222222-2222-4222-8222-222222222222';
const plan = {
  phase: 'preview',
  branchId: id,
  connectionId: id,
  staff: [{ userId, extension: '301' }],
};

test('call center access additions preserve every unrelated grant/control', () => {
  const before = {
    permissionCodes: ['sales.contracts.read.own'],
    screenIds: ['sales.contracts'],
    allowedControlIds: ['field.customers.name'],
  };
  const result = extendOwnAccess(before, [
    'customer_affairs.call_center.contacts.read.own',
  ]);
  assert.ok(result.permissionCodes.includes('sales.contracts.read.own'));
  assert.ok(result.screenIds.includes('sales.contracts'));
  assert.deepEqual(result.allowedControlIds, before.allowedControlIds);
  assert.ok(!result.permissionCodes.some((p) => p.endsWith('.team')));
  assert.ok(
    !result.permissionCodes.includes(
      'customer_affairs.call_center.recordings.read',
    ),
  );
  assert.deepEqual(before.permissionCodes, ['sales.contracts.read.own']);
});

test('repeated access extension is idempotent', () => {
  const before = { permissionCodes: [], screenIds: [], allowedControlIds: [] };
  const once = extendOwnAccess(before, ['customer_affairs.call_center.read']);
  assert.deepEqual(
    extendOwnAccess(once, ['customer_affairs.call_center.read']),
    once,
  );
});

test('valid private preview plan is accepted', () =>
  assert.doesNotThrow(() => checkPlan(plan)));
test('shared physical extension cannot be silently mapped to one guessed employee', () => {
  assert.throws(
    () =>
      checkPlan({
        ...plan,
        staff: [...plan.staff, { userId: id, extension: '301' }],
      }),
    /Ambiguous/,
  );
});
test('missing account and arbitrary extension values are refused', () => {
  assert.throws(() =>
    checkPlan({ ...plan, staff: [{ userId: '', extension: '301' }] }),
  );
  assert.throws(() =>
    checkPlan({ ...plan, staff: [{ userId, extension: '*' }] }),
  );
});
