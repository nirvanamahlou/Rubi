// Read-only operator probe. Never prints credentials, private events or contact data.
import { resolve } from 'node:path';
import { pathToFileURL } from 'node:url';
export async function check(env = process.env, request = fetch) {
  const url = new URL(
    env.TELEPHONY_CHECK_API_URL ?? 'http://127.0.0.1:4000/api/v1',
  );
  if (
    (url.protocol !== 'https:' &&
      !(
        url.protocol === 'http:' &&
        ['127.0.0.1', 'localhost', '[::1]'].includes(url.hostname)
      )) ||
    url.username ||
    url.password ||
    url.search ||
    url.hash
  )
    throw Error('Private HTTPS or loopback required.');
  const cookie = env.TELEPHONY_CHECK_COOKIE;
  const result = {
    checkedAt: new Date().toISOString(),
    apiReachable: false,
    anonymousOperationsDenied: false,
    internalHealth: null,
    provider: null,
    liveAcceptance: 'PENDING_REAL_PBX',
    authenticatedChecks: cookie ? 'FAILED' : 'NOT_SUPPLIED',
  };
  async function get(path, authenticated = false) {
    return request(url.toString().replace(/\/$/, '') + path, {
      redirect: 'error',
      signal: AbortSignal.timeout(10000),
      headers: authenticated && cookie ? { cookie } : {},
    });
  }
  const denied = await get('/integrations/telephony/health');
  result.apiReachable = true;
  result.anonymousOperationsDenied = denied.status === 401;
  await denied.body?.cancel();
  if (cookie) {
    const health = await get('/integrations/telephony/health', true);
    if (health.ok) {
      const data = await health.json();
      result.internalHealth = {
        state: data.state,
        pending: data.pending,
        retrying: data.retrying,
        dead: data.dead,
        oldestPendingSeconds: data.oldestPendingSeconds,
        unpublishedRecordings: data.unpublishedRecordings,
        alerts: data.alerts,
      };
      result.authenticatedChecks = 'PASSED';
    } else await health.body?.cancel();
    const provider = await get('/integrations/telephony/issabel/status', true);
    if (provider.ok) {
      const data = await provider.json();
      result.provider = {
        state: data.state,
        eventCoverage: data.eventCoverage,
        reconciliationSupported: data.reconciliationSupported,
      };
    } else await provider.body?.cancel();
  }
  return result;
}
if (
  process.argv[1] &&
  import.meta.url === pathToFileURL(resolve(process.argv[1])).href
) {
  try {
    const result = await check();
    console.log(JSON.stringify(result, null, 2));
    if (
      !result.anonymousOperationsDenied ||
      result.authenticatedChecks !== 'PASSED' ||
      result.internalHealth?.alerts?.length
    )
      process.exitCode = 2;
  } catch {
    console.error(
      'Readiness check failed; verify private endpoint and authorization.',
    );
    process.exitCode = 1;
  }
}
