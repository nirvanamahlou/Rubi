import assert from 'node:assert/strict';
import { mkdtempSync, mkdirSync, rmSync, writeFileSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import test from 'node:test';
import { verifyAgentWebBuild } from './verify-web-build.mjs';

function fixture(t, chunks) {
  const dir = mkdtempSync(join(tmpdir(), 'nora-web-build-'));
  t.after(() => rmSync(dir, { recursive: true, force: true }));
  mkdirSync(join(dir, 'chunks'));
  chunks.forEach((source, i) =>
    writeFileSync(join(dir, 'chunks', `${i}.js`), source),
  );
  return dir;
}
const route = 'fetch("/api/assistant/v3/conversation");';
test('fresh enabled composer passes without executing application JavaScript', (t) => {
  const dir = fixture(t, [route + 'render({agentMode:!0})', 'unrelated()']);
  assert.deepEqual(verifyAgentWebBuild(dir), {
    agentComposers: 1,
    enabled: true,
  });
});
test('runtime-only public environment reference fails admission', (t) => {
  const dir = fixture(t, [
    route +
      'render({agentMode:"true"===process.env.NEXT_PUBLIC_ASSISTANT_AGENT_ENABLED})',
  ]);
  assert.throws(() => verifyAgentWebBuild(dir), /NOT_INLINED_TRUE/);
});
test('disabled composer cannot borrow a true default from another chunk', (t) => {
  const dir = fixture(t, [
    route + 'render({agentMode:!1})',
    'render({agentMode:!0})',
  ]);
  assert.throws(() => verifyAgentWebBuild(dir), /NOT_INLINED_TRUE/);
});
test('mixed stale and current assets fail; guard must precede asset retention', (t) => {
  const dir = fixture(t, [
    route + 'render({agentMode:true})',
    route + 'process.env.NEXT_PUBLIC_ASSISTANT_AGENT_ENABLED',
  ]);
  assert.throws(() => verifyAgentWebBuild(dir), /NOT_INLINED_TRUE/);
});
test('missing route or directory never certifies an Agent build', (t) => {
  assert.throws(
    () => verifyAgentWebBuild(fixture(t, ['unrelated()'])),
    /COMPOSER_MISSING/,
  );
  assert.throws(
    () => verifyAgentWebBuild(join(tmpdir(), 'nora-missing-build-1117')),
    /ENOENT/,
  );
});
