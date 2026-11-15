/** Serial quota-paced synthetic evaluation; never deploys or changes production. */
import { createHash } from 'node:crypto';
import { spawn } from 'node:child_process';
import {
  readFileSync,
  writeFileSync,
  readdirSync,
  mkdirSync,
  openSync,
  closeSync,
  unlinkSync,
} from 'node:fs';
import { resolve } from 'node:path';
import { fileURLToPath } from 'node:url';
import { setTimeout as pause } from 'node:timers/promises';

if (!process.argv.includes('--run-synthetic'))
  throw Error('EXPLICIT_SYNTHETIC_RUN_REQUIRED');
const privateEnv = process.env.NORA_ACCEPTANCE_ENV_FILE;
const directory = process.env.NORA_AGENT_ACCEPTANCE_RECEIPT_DIR;
if (!privateEnv || !directory)
  throw Error('PRIVATE_ENV_AND_RECEIPT_DIRECTORY_REQUIRED');
const root = fileURLToPath(new URL('../../../', import.meta.url));
const api = resolve(root, 'apps/api');
const pinnedFiles = [
  'pnpm-lock.yaml',
  'services/assistant/agent-provider.mjs',
  'services/assistant/data-agent.mjs',
  'apps/api/src/sales/assistant-agent/live-acceptance.spec.ts',
  'apps/api/src/sales/assistant-agent/query.service.ts',
  'apps/api/src/sales/assistant-agent/sql-policy.ts',
  'apps/api/src/sales/assistant-agent/catalog.ts',
  'scripts/operations/nora-agent/live-provider.mjs',
  'packages/database/prisma/migrations/20261114120000_nora_agent_sales_views/migration.sql',
];
const fingerprint = () =>
  createHash('sha256')
    .update(
      pinnedFiles
        .map((path) => path + '\n' + readFileSync(resolve(root, path), 'utf8'))
        .join('\n'),
    )
    .digest('hex');
const sourceHash = fingerprint();
mkdirSync(directory, { recursive: true });
const lockPath = resolve(directory, 'nora-live-acceptance.lock');
const lock = openSync(lockPath, 'wx');
writeFileSync(lock, String(process.pid));
const statePath = resolve(directory, 'nora-live-acceptance-progress.json');
const state = {
  source: 'NORA-DATA-AGENT-LIVE-ACCEPTANCE-1114',
  sourceHash,
  status: 'WAITING_FOR_QUOTA',
  startedAt: new Date().toISOString(),
  cases: [],
  nextAttemptAt: null,
};
let stopping = false;
let child;
const save = () => writeFileSync(statePath, JSON.stringify(state, null, 2));
for (const event of ['SIGINT', 'SIGTERM'])
  process.once(event, () => {
    stopping = true;
    child?.kill();
  });
async function wait(ms) {
  state.nextAttemptAt = new Date(Date.now() + ms).toISOString();
  save();
  while (ms > 0 && !stopping) {
    const step = Math.min(ms, 30000);
    await pause(step);
    ms -= step;
  }
  if (stopping) throw Error('STOPPED');
}
async function runCase(index) {
  if (fingerprint() !== sourceHash)
    throw Error('SOURCE_CHANGED_RESTART_FULL_MATRIX');
  const existing = new Set(readdirSync(directory));
  const logPath = resolve(directory, `scenario-${index}-${Date.now()}.log`);
  let output = '';
  const code = await new Promise((resolveExit, reject) => {
    child = spawn(
      process.execPath,
      [
        '--env-file=' + privateEnv,
        'node_modules/vitest/vitest.mjs',
        'run',
        'src/sales/assistant-agent/live-acceptance.spec.ts',
        '-t',
        `live ${index}:`,
      ],
      {
        cwd: api,
        windowsHide: true,
        signal: AbortSignal.timeout(240000),
        env: {
          ...process.env,
          NORA_RUN_AGENT_LIVE_TESTS: '1',
          NORA_ACCEPTANCE_SYNTHETIC_DIAGNOSTICS: 'true',
        },
      },
    );
    child.stdout.on('data', (value) => {
      output += value;
    });
    child.stderr.on('data', (value) => {
      output += value;
    });
    child.once('error', reject);
    child.once('close', resolveExit);
  });
  writeFileSync(logPath, output);
  const files = readdirSync(directory).filter(
    (name) =>
      !existing.has(name) && /^nora-live-matrix-[a-f0-9]{32}\.json$/.test(name),
  );
  if (files.length !== 1)
    throw Error('ACCEPTANCE_RECEIPT_MISSING_OR_AMBIGUOUS');
  const rows = JSON.parse(readFileSync(resolve(directory, files[0]), 'utf8'));
  if (fingerprint() !== sourceHash)
    throw Error('SOURCE_CHANGED_RESTART_FULL_MATRIX');
  if (rows.length !== 1 || rows[0].id !== index)
    throw Error('ACCEPTANCE_CASE_MISMATCH');
  return { exitCode: code, receiptFile: files[0], ...rows[0] };
}
try {
  // The daily bucket is depleted. Accumulate capacity for a complete request,
  // rather than spending each small replenishment on another partial plan.
  await wait(3600000);
  for (let index = 1; index <= 30; index++) {
    let completed;
    for (let attempt = 1; attempt <= 6; attempt++) {
      state.status = 'RUNNING';
      state.nextAttemptAt = null;
      save();
      const result = await runCase(index);
      state.cases.push({
        ...result,
        attempt,
        finishedAt: new Date().toISOString(),
      });
      save();
      if (result.error === 'AGENT_PROVIDER_RATE_LIMITED') {
        state.status = 'WAITING_FOR_QUOTA';
        await wait(Math.max(3600000, Number(result.retryAfterMs) || 0));
        continue;
      }
      if (result.exitCode !== 0)
        throw Error(`SCENARIO_${index}_FAILED_REVIEW_REQUIRED`);
      completed = result;
      break;
    }
    if (!completed) throw Error(`SCENARIO_${index}_QUOTA_STILL_UNAVAILABLE`);
    if (index < 30) {
      state.status = 'PACING';
      // Current verified free Organization ceiling:200000 tokens/day.
      // Pacing is outside the unchanged60s/8-turn Agent request deadline.
      await wait(
        Math.max(
          65000,
          Math.ceil(
            (((completed.tokens ?? 0) + (completed.rejectedTokenReserve ?? 0)) *
              86400000) /
              200000,
          ),
        ),
      );
    }
  }
  state.status = 'MODEL_MATRIX_PASSED_REQUIRES_BROWSER_AND_REVIEW';
} catch (error) {
  state.status = stopping ? 'STOPPED' : 'REVIEW_REQUIRED';
  state.reason = error.message;
  process.exitCode = 1;
} finally {
  state.finishedAt = new Date().toISOString();
  save();
  closeSync(lock);
  if (readFileSync(lockPath, 'utf8') === String(process.pid))
    unlinkSync(lockPath);
}
