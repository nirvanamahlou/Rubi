const { test } = require('node:test');
const assert = require('node:assert/strict');
const {
  assertOnlyTeamGrant,
  TEAM,
} = require('./repair-request-manager-access.cjs');
const before = {
  permissionCodes: ['customer_affairs.call_center.workflow.manage'],
  screenIds: ['customer-affairs.call-center'],
  allowedControlIds: ['field.call.subject'],
};
const after = { ...before, permissionCodes: [...before.permissionCodes, TEAM] };
test('allows exactly the team capability and an already repaired snapshot', () => {
  assert.doesNotThrow(() => assertOnlyTeamGrant(before, after));
  assert.doesNotThrow(() => assertOnlyTeamGrant(after, after));
});
test('rejects unrelated grants, removed permissions, screens and controls', () => {
  for (const changed of [
    {
      ...after,
      permissionCodes: [...after.permissionCodes, 'iam.users.manage'],
    },
    { ...after, permissionCodes: [TEAM] },
    { ...after, screenIds: [...after.screenIds, 'system.settings'] },
    { ...after, allowedControlIds: [] },
    before,
  ])
    assert.throws(() => assertOnlyTeamGrant(before, changed));
});
