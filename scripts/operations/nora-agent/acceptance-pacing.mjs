/** Evaluation pacing is provider-driven, never a synthetic daily allowance. */
import { createHash } from 'node:crypto';

/** Resume only unchanged source and intact original single-case receipts. */
export function verifiedCompletedCases(state, sourceHash, readReceipt) {
  if (state?.sourceHash !== sourceHash || !Array.isArray(state.cases))
    throw Error('SOURCE_CHANGED_RESTART_FULL_MATRIX');
  const completed = new Set();
  for (const entry of state.cases.filter((row) => row.exitCode === 0)) {
    if (
      !Number.isInteger(entry.id) ||
      entry.id < 1 ||
      entry.id > 30 ||
      !/^nora-live-matrix-[a-f0-9]{32}\.json$/.test(entry.receiptFile)
    )
      throw Error('ACCEPTANCE_RESUME_RECEIPT_INVALID');
    const raw = readReceipt(entry.receiptFile);
    if (createHash('sha256').update(raw).digest('hex') !== entry.receiptSha256)
      throw Error('ACCEPTANCE_RESUME_RECEIPT_CHANGED');
    const rows = JSON.parse(raw);
    if (rows.length !== 1 || rows[0].id !== entry.id)
      throw Error('ACCEPTANCE_RESUME_RECEIPT_INVALID');
    const {
      exitCode,
      receiptFile,
      receiptSha256,
      attempt,
      finishedAt,
      ...recorded
    } = entry;
    void exitCode;
    void receiptFile;
    void receiptSha256;
    void attempt;
    void finishedAt;
    if (JSON.stringify(recorded) !== JSON.stringify(rows[0]))
      throw Error('ACCEPTANCE_RESUME_RECEIPT_CHANGED');
    completed.add(entry.id);
  }
  return completed;
}
export function acceptanceWaitMs(result) {
  if (result.error !== 'AGENT_PROVIDER_RATE_LIMITED') return 0;
  const delay = result.retryAfterMs;
  if (typeof delay !== 'number' || !Number.isSafeInteger(delay) || delay <= 0)
    throw new Error('PROVIDER_RETRY_TIME_REQUIRED');
  return delay;
}

/** All30 oracles still run serially; healthy requests incur no pacing delay. */
export async function runAcceptanceCases({
  runCase,
  wait,
  onProgress = () => {},
  now = Date.now,
  continueOnFailure = false,
  completed = new Set(),
}) {
  const failed = [];
  for (let index = 1; index <= 30; index++) {
    if (completed.has(index)) continue;
    for (let attempt = 1; attempt <= 6; attempt++) {
      onProgress({ status: 'RUNNING', nextAttemptAt: null });
      const result = await runCase(index);
      onProgress({
        result,
        attempt,
        finishedAt: new Date(now()).toISOString(),
      });
      if (result.error === 'AGENT_PROVIDER_RATE_LIMITED') {
        const delay = acceptanceWaitMs(result);
        onProgress({
          status: 'WAITING_FOR_QUOTA',
          nextAttemptAt: new Date(now() + delay).toISOString(),
        });
        // Do not wait once more if this run will not make another attempt.
        if (attempt === 6)
          throw Error(`SCENARIO_${index}_QUOTA_STILL_UNAVAILABLE`);
        await wait(delay);
        continue;
      }
      if (result.exitCode !== 0) {
        if (!continueOnFailure)
          throw Error(`SCENARIO_${index}_FAILED_REVIEW_REQUIRED`);
        failed.push(index);
      }
      break;
    }
  }
  if (failed.length)
    throw Error(`SCENARIOS_${failed.join('_')}_FAILED_REVIEW_REQUIRED`);
}
