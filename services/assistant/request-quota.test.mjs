import test from 'node:test';
import assert from 'node:assert/strict';
import { requestQuotaExemptions, validateQuotaExemptions } from './request-quota.mjs';

test('private configuration uses exact immutable UUIDs, normalized and copied', () => {
  const id = '11111111-1111-4111-8111-111111111AAA';
  assert.deepEqual(requestQuotaExemptions({}), []);
  assert.deepEqual(requestQuotaExemptions({ ASSISTANT_RATE_LIMIT_EXEMPT_USER_IDS: ` ${id},${id.toLowerCase()} ` }), [id.toLowerCase()]);
  const input = [id];
  const parsed = validateQuotaExemptions(input);
  input.length = 0;
  assert.equal(parsed.length, 1);
});
test('names, malformed/empty entries and excess identities fail startup rather than granting broad bypass', () => {
  for (const value of ['demo,danial', '*', '11111111-1111-4111-8111-111111111111,', ' ', 1])
    assert.throws(() => requestQuotaExemptions({ ASSISTANT_RATE_LIMIT_EXEMPT_USER_IDS: value }), /INVALID_ASSISTANT_RATE_EXEMPTIONS/);
  assert.throws(() => validateQuotaExemptions(Array(17).fill('11111111-1111-4111-8111-111111111111')), /INVALID_ASSISTANT_RATE_EXEMPTIONS/);
});
