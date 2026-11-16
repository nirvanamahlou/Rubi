/** Evaluation pacing is provider-driven, never a synthetic daily allowance. */
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
}) {
  for (let index = 1; index <= 30; index++) {
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
      if (result.exitCode !== 0)
        throw Error(`SCENARIO_${index}_FAILED_REVIEW_REQUIRED`);
      break;
    }
  }
}
