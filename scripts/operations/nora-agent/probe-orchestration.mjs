// Run in the Web network namespace. No credential, chat message or ERP record is needed.
// HTTP redirects, HTML login pages and a healthy old service all fail their respective probes.
const erp = (
  process.env.NORA_ERP_API_BASE_URL || 'http://api:4000/api/v1'
).replace(/\/$/u, '');
const ingress = (
  process.env.NORA_PROBE_INGRESS || 'https://avinaofficial.ir'
).replace(/\/$/u, '');
const rows = [
  ['full-api-health', 'GET', erp + '/health', 200],
  ['full-api-identity', 'GET', erp + '/iam/auth/access', 401],
  ['full-api-company', 'GET', erp + '/legal-entities/context', 401],
  [
    'full-api-personal-sales',
    'GET',
    erp + '/sales/assistant-agent/my-contract-count',
    401,
  ],
  [
    'full-api-standard-sales',
    'GET',
    erp + '/sales/assistant-agent/standard-sales-summary',
    401,
  ],
  [
    'full-api-settled-vouchers',
    'GET',
    erp + '/reports/nora/settled-vouchers?page=1&pageSize=1',
    401,
  ],
  [
    'read-api-sales',
    'POST',
    ingress + '/api/v1/sales/assistant-agent/rolling-sales',
    401,
  ],
  ['nora-conversation', 'POST', ingress + '/v3/assistant/conversation', 401],
  ['nora-plan', 'POST', ingress + '/v3/assistant/plan', 401],
  [
    'browser-origin-refused',
    'POST',
    ingress + '/v3/assistant/plan',
    403,
    { origin: ingress },
  ],
  [
    'web-origin-required',
    'POST',
    ingress + '/api/assistant/v3/conversation',
    403,
  ],
  [
    'web-session-required',
    'POST',
    ingress + '/api/assistant/v3/conversation',
    401,
    { origin: ingress },
  ],
];
for (const [name, method, url, expected, headers] of rows) {
  let status = 0;
  let format = 'unreachable';
  try {
    const r = await fetch(url, {
      method,
      redirect: 'manual',
      signal: AbortSignal.timeout(5000),
      headers: { 'content-type': 'application/json', ...headers },
      ...(method === 'POST' ? { body: '{}' } : {}),
    });
    status = r.status;
    format = r.headers.get('content-type')?.includes('application/json')
      ? 'json'
      : 'other';
    await r.body?.cancel();
  } catch {
    /* Keep host and transport details out of receipts. */
  }
  const pass = status === expected && (expected === 403 || format === 'json');
  console.log(JSON.stringify({ name, expected, status, format, pass }));
  if (!pass) process.exitCode = 1;
}
