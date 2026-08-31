import assert from 'node:assert/strict';
import http from 'node:http';
import { after, test } from 'node:test';
import { createPreviewProxy } from './server.mjs';

const servers = [];
async function listen(server) {
  servers.push(server);
  await new Promise((resolve) => server.listen(0, '127.0.0.1', resolve));
  return server.address().port;
}
after(async () => {
  for (const server of servers) {
    server.closeAllConnections();
    await new Promise((resolve) => server.close(resolve));
  }
});
const seen = [];
const apiPort = await listen(
  http.createServer(async (req, res) => {
    let body = '';
    for await (const chunk of req) body += chunk;
    seen.push({
      path: req.url,
      method: req.method,
      headers: req.headers,
      body,
    });
    if (req.url === '/api/v1/auth-cookie-test') {
      // Synthetic transport fixture only, never connected to Rubi or used to authenticate it.
      res.setHeader('set-cookie', [
        'transport_a=synthetic; HttpOnly; SameSite=Lax',
        'transport_b=synthetic; HttpOnly',
      ]);
    }
    res.writeHead(req.url.includes('protected') ? 401 : 200, {
      'content-type': 'application/json',
    });
    res.end(JSON.stringify({ source: 'synthetic-api' }));
  }),
);
const webPort = await listen(
  http.createServer((_req, res) => {
    res.end('synthetic-web');
  }),
);
const proxyPort = await listen(createPreviewProxy({ webPort, apiPort }));
const base = 'http://127.0.0.1:' + proxyPort;

test('routes only the fixed API prefix and preserves encoded query', async () => {
  assert.equal(await (await fetch(base + '/login')).text(), 'synthetic-web');
  assert.equal(await (await fetch(base + '/api/v10')).text(), 'synthetic-web');
  assert.equal(
    (await (await fetch(base + '/api/v1/reference?q=a%26b')).json()).source,
    'synthetic-api',
  );
  assert.equal(seen.at(-1).path, '/api/v1/reference?q=a%26b');
});
test('streams method/body and retains actual Origin without inventing auth', async () => {
  await fetch(base + '/api/v1/transport-test', {
    method: 'POST',
    headers: { origin: base, 'content-type': 'application/json' },
    body: '{"synthetic":true}',
  });
  assert.equal(seen.at(-1).method, 'POST');
  assert.equal(seen.at(-1).body, '{"synthetic":true}');
  assert.equal(seen.at(-1).headers.origin, base);
  assert.equal(seen.at(-1).headers.authorization, undefined);
});
test('preserves status and separate Set-Cookie headers, never grants CORS', async () => {
  assert.equal((await fetch(base + '/api/v1/protected')).status, 401);
  const result = await fetch(base + '/api/v1/auth-cookie-test');
  assert.equal(result.headers.getSetCookie().length, 2);
  assert.equal(result.headers.get('access-control-allow-origin'), null);
});
test('rejects foreign origin, DNS rebinding and cross-site requests before upstream', async () => {
  const count = seen.length;
  assert.equal(
    (
      await fetch(base + '/api/v1/protected', {
        headers: { origin: 'https://foreign.invalid' },
      })
    ).status,
    403,
  );
  assert.equal(
    (
      await fetch(base + '/api/v1/protected', {
        headers: { 'sec-fetch-site': 'cross-site' },
      })
    ).status,
    403,
  );
  const status = await new Promise((resolve, reject) => {
    const req = http.get(
      base + '/api/v1/protected',
      { headers: { host: 'foreign.invalid:' + proxyPort } },
      (res) => {
        res.resume();
        resolve(res.statusCode);
      },
    );
    req.on('error', reject);
  });
  assert.equal(status, 403);
  assert.equal(seen.length, count);
});
test('reports unreachable upstream without exposing connection details', async () => {
  const closed = http.createServer();
  await new Promise((resolve) => closed.listen(0, '127.0.0.1', resolve));
  const closedPort = closed.address().port;
  await new Promise((resolve) => closed.close(resolve));
  const port = await listen(
    createPreviewProxy({ webPort, apiPort: closedPort }),
  );
  const response = await fetch('http://127.0.0.1:' + port + '/api/v1/health');
  assert.equal(response.status, 502);
  assert.deepEqual(await response.json(), {
    error: { message: 'Preview upstream unavailable' },
  });
});
