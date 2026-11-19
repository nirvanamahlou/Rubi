/** Immediate serial synthetic evaluation; only actual provider throttling delays a retry. */
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
  existsSync,
} from 'node:fs';
import { resolve } from 'node:path';
import { fileURLToPath } from 'node:url';
import { setTimeout as pause } from 'node:timers/promises';
import {
  runAcceptanceCases,
  verifiedCompletedCases,
} from './acceptance-pacing.mjs';
import { startSshPoolBroker } from './ssh-pool-provider.mjs';

if (!process.argv.includes('--run-synthetic'))
  throw Error('EXPLICIT_SYNTHETIC_RUN_REQUIRED');
const privateEnv = process.env.NORA_ACCEPTANCE_ENV_FILE;
const provider = process.env.NORA_ACCEPTANCE_PROVIDER ?? 'groq';
if (!['groq', 'openai'].includes(provider))
  throw Error('INVALID_ACCEPTANCE_PROVIDER');
if (provider === 'openai' && !process.env.OPENAI_API_KEY?.trim())
  throw Error('OPENAI_PROJECT_KEY_REQUIRED');
const firstCase = provider === 'openai' ? 3 : 1;
const directory = process.env.NORA_AGENT_ACCEPTANCE_RECEIPT_DIR;
if (!privateEnv || !directory)
  throw Error('PRIVATE_ENV_AND_RECEIPT_DIRECTORY_REQUIRED');
const root = fileURLToPath(new URL('../../../', import.meta.url));
const api = resolve(root, 'apps/api');
const pinnedFiles = [
  'pnpm-lock.yaml',
  'scripts/operations/nora-agent/run-live-acceptance-fast.mjs',
  'scripts/operations/nora-agent/acceptance-pacing.mjs',

  'apps/api/src/sales/assistant-agent/live-acceptance.spec.ts',
  'apps/api/src/sales/assistant-agent/query.service.ts',
  'apps/api/src/sales/assistant-agent/count-breakdown.ts',
  'apps/api/src/reservations/reservation-reporting-cancellations.public.ts',
  'apps/api/src/sales/assistant-agent/sql-policy.ts',
  'apps/api/src/sales/assistant-agent/catalog.ts',
  'scripts/operations/nora-agent/live-provider.mjs',
  'scripts/operations/nora-agent/ssh-pool-provider.mjs',
  'packages/database/prisma/migrations/20261114120000_nora_agent_sales_views/migration.sql',
];
const fingerprint = () =>
  createHash('sha256')
    .update(
      [
        ...pinnedFiles,
        ...readdirSync(resolve(root, 'services/assistant'))
          .filter(
            (name) => name.endsWith('.mjs') && !name.endsWith('.test.mjs'),
          )
          .sort()
          .map((name) => 'services/assistant/' + name),
      ]
        .map((path) => path + '\n' + readFileSync(resolve(root, path), 'utf8'))
        .join('\n'),
    )
    .digest('hex');
const sourceHash = fingerprint();
mkdirSync(directory, { recursive: true });
const lockPath = resolve(directory, 'nora-live-acceptance.lock');
const statePath = resolve(directory, 'nora-live-acceptance-progress.json');
if (existsSync(statePath) && !process.argv.includes('--resume'))
  throw Error('EXISTING_RECEIPTS_REQUIRE_EXPLICIT_RESUME');
const state = process.argv.includes('--resume')
  ? JSON.parse(readFileSync(statePath, 'utf8'))
  : {
      source: 'NORA-ACCEPTANCE-PACING-1116',
      sourceHash,
      status: 'READY',
      startedAt: new Date().toISOString(),
      cases: [],
      nextAttemptAt: null,
    };
const completed = verifiedCompletedCases(state, sourceHash, (name) =>
  readFileSync(resolve(directory, name), 'utf8'),
);
if (
  (state.provider ?? 'groq') !== provider &&
  process.argv.includes('--resume')
)
  throw Error('ACCEPTANCE_PROVIDER_CHANGED');
state.provider = provider;
state.firstCase = firstCase;
delete state.reason;
const lock = openSync(lockPath, 'wx');
writeFileSync(lock, String(process.pid));
let stopping = false;
let child;
let poolBroker;
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
  poolBroker?.assertHealthy();
  if (fingerprint() !== sourceHash)
    throw Error('SOURCE_CHANGED_RESTART_FULL_MATRIX');
  const existing = new Set(readdirSync(directory));
  const logPath = resolve(directory, `scenario-${index}-${Date.now()}.log`);
  let output = '';
  const code = await new Promise((resolveExit, reject) => {
    child = spawn(
      process.execPath,
      [
        ...(process.env.NORA_ACCEPTANCE_GROQ_MODE === 'local-proxy'
          ? ['--use-env-proxy']
          : []),
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
  const raw = readFileSync(resolve(directory, files[0]), 'utf8');
  const rows = JSON.parse(raw);
  if (fingerprint() !== sourceHash)
    throw Error('SOURCE_CHANGED_RESTART_FULL_MATRIX');
  if (rows.length !== 1 || rows[0].id !== index)
    throw Error('ACCEPTANCE_CASE_MISMATCH');
  return {
    exitCode: code,
    receiptFile: files[0],
    receiptSha256: createHash('sha256').update(raw).digest('hex'),
    ...rows[0],
  };
}
try {
  if (
    provider === 'groq' &&
    process.env.NORA_ACCEPTANCE_GROQ_MODE === 'ssh-pool'
  ) {
    poolBroker = await startSshPoolBroker();
    process.env.NORA_ACCEPTANCE_POOL_PIPE = poolBroker.pipe;
  }
  await runAcceptanceCases({
    continueOnFailure: process.argv.includes('--diagnose-all'),
    completed,
    firstCase,
    runCase,
    wait,
    onProgress(event) {
      if (event.result)
        state.cases.push({
          ...event.result,
          attempt: event.attempt,
          finishedAt: event.finishedAt,
        });
      if (event.status) state.status = event.status;
      if (Object.hasOwn(event, 'nextAttemptAt'))
        state.nextAttemptAt = event.nextAttemptAt;
      save();
    },
  });
  state.status =
    firstCase === 1
      ? 'MODEL_MATRIX_PASSED_REQUIRES_BROWSER_AND_REVIEW'
      : 'OPENAI_CASES_3_30_PASSED';
} catch (error) {
  state.status = stopping ? 'STOPPED' : 'REVIEW_REQUIRED';
  state.reason = error.message;
  process.exitCode = 1;
} finally {
  poolBroker?.close();
  state.finishedAt = new Date().toISOString();
  save();
  closeSync(lock);
  if (readFileSync(lockPath, 'utf8') === String(process.pid))
    unlinkSync(lockPath);
}
