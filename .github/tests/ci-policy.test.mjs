import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { posix } from 'node:path';
import { test } from 'node:test';

const workflow = readFileSync(
  new URL('../workflows/ci.yml', import.meta.url),
  'utf8',
).replaceAll('\r\n', '\n');

// Deliberately check this workflow's simple block-list policy, not arbitrary YAML
// or arbitrary Actions expressions. GitHub validates the complete workflow.
function branchFilters(event) {
  const block = workflow.match(
    new RegExp(`^  ${event}:\n([\\s\\S]*?)(?=^  [a-z_]+:|^\\S)`, 'm'),
  );
  assert.ok(block, `Missing ${event} trigger`);
  assert.match(block[1], /^    branches:\n/m);
  return [...block[1].matchAll(/^      - '?([^'\n]+)'?$/gm)].map(
    (match) => match[1],
  );
}

const computerBranches = ['a', 'b', 'c', 'd'].flatMap((id) => [
  `codex/pc-${id}-same-task`,
  `codex/pc-${id}-another-task`,
]);

for (const event of ['push', 'pull_request']) {
  test(`${event} covers all four computers and future IDs without removing existing bases`, () => {
    const patterns = branchFilters(event);
    assert.deepEqual(patterns, ['main', 'develop', 'codex/pc-*']);
    // Only literal names and a single '*' are supported by this policy check.
    for (const branch of [
      'main',
      'develop',
      ...computerBranches,
      'codex/pc-e-future-task',
    ]) {
      assert.ok(
        patterns.some((pattern) => posix.matchesGlob(branch, pattern)),
        `${event} missed ${branch}`,
      );
    }
    for (const branch of ['feature/unrelated', 'codex/unassigned-task']) {
      assert.ok(
        !patterns.some((pattern) => posix.matchesGlob(branch, pattern)),
      );
    }
  });
}

const group = workflow.match(/^  group: (.+)$/m)?.[1];
const expectedGroup =
  'rubi-ci-${{ github.event_name }}-${{ github.event.pull_request.head.ref || github.ref_name }}';

function concurrencyKey(event, ref, head = '') {
  assert.equal(group, expectedGroup);
  return group
    .replace('${{ github.event_name }}', event)
    .replace(
      '${{ github.event.pull_request.head.ref || github.ref_name }}',
      head || ref,
    );
}

test('different computers, tasks and push/PR events have distinct concurrency groups', () => {
  const keys = computerBranches.flatMap((branch) => [
    concurrencyKey('push', branch),
    concurrencyKey('pull_request', '123/merge', branch),
  ]);
  assert.equal(new Set(keys).size, computerBranches.length * 2);
  assert.match(workflow, /^  cancel-in-progress: true$/m);
});

test('new commits to the same event/head replace only that branch run', () => {
  assert.equal(
    concurrencyKey('pull_request', '123/merge', computerBranches[0]),
    concurrencyKey('pull_request', '456/merge', computerBranches[0]),
  );
  assert.notEqual(
    concurrencyKey('push', 'develop'),
    concurrencyKey('push', computerBranches[0]),
  );
});

test('hosted isolation, read-only credentials and all original gates remain enabled', () => {
  assert.equal((workflow.match(/runs-on: ubuntu-latest/g) ?? []).length, 4);
  assert.equal((workflow.match(/persist-credentials: false/g) ?? []).length, 4);
  assert.match(workflow, /^permissions:\n  contents: read$/m);
  assert.match(workflow, /image: postgres:18\.1-alpine/);
  assert.doesNotMatch(workflow, /self-hosted|pull_request_target|secrets\./);
  for (const command of [
    'pnpm lint',
    'pnpm typecheck',
    'pnpm test',
    'pnpm build',
    'pnpm install --frozen-lockfile',
    'prisma migrate deploy',
    'prisma migrate status',
    'node --test .github/tests/ci-policy.test.mjs',
  ]) {
    assert.ok(workflow.includes(command), `Missing gate: ${command}`);
  }
  assert.equal(
    (workflow.match(/pnpm --filter @rubi\/database db:seed/g) ?? []).length,
    2,
  );
});
