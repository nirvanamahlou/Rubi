import assert from 'node:assert/strict';
import { test } from 'node:test';
import {
  createAuthorization,
  isToolAllowed,
  requireToolAccess,
} from './authorization.mjs';

const actor = { userId: 'a', permissions: [], branchIds: ['branch-a'] };
test('invalid identities and changed user never pass authentication', async () => {
  for (const value of [
    null,
    {},
    { ...actor, permissions: [true] },
    { ...actor, branchIds: [{}] },
    { ...actor, userId: '' },
  ]) {
    const authenticate = createAuthorization({ identity: async () => value });
    await assert.rejects(authenticate('cookie', new AbortController().signal), {
      message: 'INVALID_IDENTITY',
    });
  }
  const authenticate = createAuthorization({ identity: async () => actor });
  await assert.rejects(
    authenticate('cookie', new AbortController().signal, 'b'),
    { message: 'FORBIDDEN' },
  );
});

test('screen or administrator grants never replace corporate permissions', () => {
  const admin = {
    ...actor,
    permissions: ['ui.administrator', 'ui.screen.assistant.executive'],
  };
  assert.equal(isToolAllowed(admin, 'calendar'), true);
  for (const id of [
    'sales.weekly',
    'sales.contract-balances',
    'customer-affairs.call-conversion',
  ])
    assert.throws(() => requireToolAccess(admin, id), { message: 'FORBIDDEN' });
  const sales = { ...actor, permissions: ['sales.contracts.read.all'] };
  requireToolAccess(sales, 'sales.weekly');
  assert.equal(isToolAllowed(sales, 'sales.contract-balances'), false);
  assert.equal(isToolAllowed(sales, 'customer-affairs.call-conversion'), false);
});
