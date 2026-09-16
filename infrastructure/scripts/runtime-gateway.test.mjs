import assert from 'node:assert/strict';
import http from 'node:http';
import test from 'node:test';
import { createRuntimeGateway } from './runtime-gateway.mjs';

function listen(server) {
  return new Promise((resolve, reject) => {
    server.once('error', reject);
    server.listen(0, '127.0.0.1', () => resolve(server.address().port));
  });
}

function close(server) {
  return new Promise((resolve, reject) => {
    server.close((error) => (error ? reject(error) : resolve()));
  });
}

function request(port, { method = 'GET', path = '/', body } = {}) {
  return new Promise((resolve, reject) => {
    const outgoing = http.request(
      {
        hostname: '127.0.0.1',
        port,
        method,
        path,
        headers: { host: 'localhost:3100' },
      },
      (response) => {
        const chunks = [];
        response.on('data', (chunk) => chunks.push(chunk));
        response.on('end', () =>
          resolve({
            status: response.statusCode,
            body: Buffer.concat(chunks).toString('utf8'),
          }),
        );
      },
    );
    outgoing.on('error', reject);
    if (body) outgoing.write(body);
    outgoing.end();
  });
}

test('proxies the request method, path, host and body', async () => {
  const backend = http.createServer((incoming, response) => {
    const chunks = [];
    incoming.on('data', (chunk) => chunks.push(chunk));
    incoming.on('end', () => {
      response.writeHead(201, { 'content-type': 'application/json' });
      response.end(
        JSON.stringify({
          method: incoming.method,
          url: incoming.url,
          host: incoming.headers.host,
          body: Buffer.concat(chunks).toString('utf8'),
        }),
      );
    });
  });
  const backendPort = await listen(backend);
  const gateway = createRuntimeGateway({
    targetHost: '127.0.0.1',
    targetPort: backendPort,
  });
  const gatewayPort = await listen(gateway);

  try {
    const result = await request(gatewayPort, {
      method: 'POST',
      path: '/workbench?tab=messages',
      body: 'latest=true',
    });
    assert.equal(result.status, 201);
    assert.deepEqual(JSON.parse(result.body), {
      method: 'POST',
      url: '/workbench?tab=messages',
      host: 'localhost:3100',
      body: 'latest=true',
    });
  } finally {
    await close(gateway);
    await close(backend);
  }
});

test('returns a useful 502 while the web runtime is unavailable', async () => {
  const unavailablePort = 65_534;
  const gateway = createRuntimeGateway({
    targetHost: '127.0.0.1',
    targetPort: unavailablePort,
  });
  const gatewayPort = await listen(gateway);

  try {
    const result = await request(gatewayPort);
    assert.equal(result.status, 502);
    assert.match(result.body, /runtime is starting/i);
  } finally {
    await close(gateway);
  }
});
