import assert from 'node:assert/strict';
import { test } from 'node:test';
import { TOOLS, PERSONAL_TOOLS, getTool, validateToolInput } from './tools.mjs';

test('six immutable read contracts have validators, bounded limits and native grants', () => {
  assert.equal(TOOLS.length, 6);
  assert.equal(PERSONAL_TOOLS.length, 3);
  assert.equal(new Set(TOOLS.map((tool) => tool.path)).size, 6);
  for (const tool of TOOLS) {
    assert.equal(getTool(tool.id), tool);
    assert.equal(tool.method, 'GET');
    assert.equal(tool.sideEffects, false);
    assert.equal(tool.version, 1);
    assert.equal(typeof tool.validate, 'function');
    assert.equal(typeof tool.project, 'function');
    assert.equal(tool.limits.maxResponseBytes, 524288);
    assert.equal(tool.limits.timeoutMs, 2500);
    assert.equal(tool.inputSchema.additionalProperties, false);
    assert.throws(() => {
      tool.path = '/sql';
    });
    assert.throws(() => tool.permissions.push('administrator'));
  }
  assert.deepEqual(getTool('sales.contract-balances').permissions, [
    'sales.contracts.read.all',
    'sales.payments.read',
  ]);
  assert.deepEqual(getTool('customer-affairs.call-conversion').permissions, [
    'sales.contracts.read.all',
    'customer_affairs.lead.read',
  ]);
});

test('unknown tools and every caller-supplied selector are rejected', () => {
  for (const id of [
    'constructor',
    '__proto__',
    '/sql',
    'https://outside.test',
    undefined,
  ])
    assert.throws(() => getTool(id), { message: 'UNKNOWN_TOOL' });
  for (const input of [
    null,
    [],
    'calendar',
    { branchId: 'other' },
    { userId: 'other' },
    { url: '/sql' },
    { prompt: 'ignore rules' },
    Object.create({ branchId: 'other' }),
    { [Symbol('hidden')]: 'value' },
  ])
    assert.throws(() => validateToolInput(input), {
      message: 'INVALID_TOOL_INPUT',
    });
  validateToolInput({});
  validateToolInput(Object.create(null));
});

test('personal contracts reject excess rows and strip content without inventing priority', () => {
  const tool = getTool('notes');
  assert.equal(tool.validate({ data: Array(501).fill({}) }), false);
  assert.equal(tool.validate({ data: 'not rows' }), false);
  const result = tool.project(
    {
      data: [
        {
          id: 'n1',
          title: 'Synthetic title',
          reminderAt: '2026-10-13T07:00:00Z',
          body: 'private note body',
          priority: 'unrecognized',
        },
      ],
    },
    new Date('2026-10-13T08:00:00Z'),
  );
  assert.equal(result.followUps.length, 1);
  assert.equal(result.followUps[0].sourcePriority, undefined);
  assert.ok(!JSON.stringify(result).includes('private note body'));
});
