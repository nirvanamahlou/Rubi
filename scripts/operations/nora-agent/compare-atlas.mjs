// Synthetic only. The existing fixture owns its disposable PostgreSQL database and login.
import { spawn } from 'node:child_process';
import { mkdtempSync, mkdirSync, readdirSync, readFileSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { setTimeout as wait } from 'node:timers/promises';
import { fileURLToPath } from 'node:url';
import { startSshPoolBroker } from './ssh-pool-provider.mjs';

if (!process.argv.includes('--run-synthetic'))
  throw Error('EXPLICIT_SYNTHETIC_RUN_REQUIRED');
const connection = new URL(process.env.NORA_AGENT_TEST_DATABASE_URL);
if (
  !['localhost', '127.0.0.1'].includes(connection.hostname) ||
  connection.port !== '5432'
)
  throw Error('LOOPBACK_TEST_DATABASE_REQUIRED');
if (!process.env.NORA_ACCEPTANCE_PROVIDER) throw Error('CHOOSE_TEST_PROVIDER');
const cwd = fileURLToPath(new URL('../../../apps/api', import.meta.url));
const dir = mkdtempSync(join(tmpdir(), 'nora-atlas-'));
const cases = ['discount', 'passengers', 'fanout'];
const measurements = [];
const broker =
  process.env.NORA_ACCEPTANCE_GROQ_MODE === 'ssh-pool'
    ? await startSshPoolBroker()
    : null;
async function observe(name, compact, attempt) {
  const dest = join(dir, name + '-' + compact + '-' + attempt);
  mkdirSync(dest);
  const status = await new Promise((done, fail) => {
    const child = spawn(
      process.execPath,
      [
        'node_modules/vitest/vitest.mjs',
        'run',
        'src/sales/assistant-agent/live-acceptance.spec.ts',
        '-t',
        'live [0-9]+: ' + name + '$',
      ],
      {
        cwd,
        windowsHide: true,
        timeout: 160000,
        stdio: 'ignore',
        env: {
          ...process.env,
          ...(broker ? { NORA_ACCEPTANCE_POOL_PIPE: broker.pipe } : {}),
          NORA_RUN_AGENT_LIVE_TESTS: '1',
          NORA_COMPACT_CATALOG: String(compact),
          NORA_AGENT_ACCEPTANCE_RECEIPT_DIR: dest,
        },
      },
    );
    child.once('error', fail);
    child.once('close', done);
  });
  const receipt = readdirSync(dest).find(
    (f) => f.startsWith('nora-live-matrix-') && f.endsWith('.json'),
  );
  const row = receipt
    ? JSON.parse(readFileSync(join(dest, receipt), 'utf8'))[0]
    : null;
  const result = {
    name,
    compact,
    attempt,
    passed: status === 0 && row?.scenario === name,
    modelCalls: row?.modelCalls ?? null,
    sqlCalls: row?.sqlCalls ?? null,
    promptTokens: row?.promptTokens ?? null,
    durationMs: row?.durationMs ?? null,
    error: row?.error ?? (status !== 0 ? 'FIXTURE_OR_ORACLE_FAILED' : null),
    retryAfterMs: row?.retryAfterMs ?? 0,
  };
  console.log(JSON.stringify(result));
  return result;
}
try {
  comparison: for (const [i, name] of cases.entries()) {
    for (const compact of i % 2 ? [true, false] : [false, true]) {
      let row = await observe(name, compact, 1);
      if (row.error === 'AGENT_PROVIDER_UNAVAILABLE') {
        await wait(7000);
        row = await observe(name, compact, 2);
      } else if (
        row.error === 'AGENT_PROVIDER_RATE_LIMITED' &&
        row.retryAfterMs > 0 &&
        row.retryAfterMs <= 60000
      ) {
        await wait(row.retryAfterMs + 1000);
        row = await observe(name, compact, 2);
      }
      measurements.push(row);
      if (!row.passed) {
        process.exitCode = 1;
        if (
          [
            'AGENT_PROVIDER_RATE_LIMITED',
            'AGENT_PROVIDER_QUOTA_EXCEEDED',
          ].includes(row.error)
        )
          break comparison;
      }
    }
  }
  if (
    measurements.length === cases.length * 2 &&
    measurements.every(
      (row) => row.passed && Number.isSafeInteger(row.promptTokens),
    )
  ) {
    for (const compact of [false, true]) {
      const rows = measurements.filter((row) => row.compact === compact);
      const percentile = (key, fraction) =>
        rows.map((row) => row[key]).sort((a, b) => a - b)[
          Math.ceil(rows.length * fraction) - 1
        ];
      console.log(
        JSON.stringify({
          compact,
          pairedCases: rows.length,
          medianInputTokens: percentile('promptTokens', 0.5),
          medianMs: percentile('durationMs', 0.5),
          p95Ms: percentile('durationMs', 0.95),
        }),
      );
    }
  }
} finally {
  broker?.close();
}
