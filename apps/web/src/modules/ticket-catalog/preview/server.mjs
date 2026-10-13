// Local-only reverse proxy for the isolated Ticket Catalog preview.
// No auth/session creation, credential logging, CORS grants or configurable remote target.
import http from 'node:http';
import { pathToFileURL } from 'node:url';

const hopHeaders = [
  'connection',
  'proxy-connection',
  'keep-alive',
  'transfer-encoding',
  'te',
  'trailer',
  'upgrade',
  'proxy-authorization',
  'proxy-authenticate',
];
function endError(response, status, message) {
  if (response.headersSent) {
    response.destroy();
    return;
  }
  response.writeHead(status, {
    'content-type': 'application/json',
    'cache-control': 'no-store',
  });
  response.end(JSON.stringify({ error: { message } }));
}
function cleanHeaders(headers) {
  const result = { ...headers };
  const nominated = String(result.connection ?? '')
    .split(',')
    .map((name) => name.trim().toLowerCase());
  for (const name of [...hopHeaders, ...nominated]) delete result[name];
  return result;
}
export function createPreviewProxy({
  webPort = 3212,
  apiPort = 4000,
  timeoutMs = 15000,
} = {}) {
  for (const port of [webPort, apiPort]) {
    if (!Number.isInteger(port) || port < 1 || port > 65535)
      throw new Error('Invalid loopback target port');
  }
  const server = http.createServer((request, response) => {
    const allowedHosts = ['localhost', '127.0.0.1'].map(
      (host) => host + ':' + request.socket.localPort,
    );
    const host = request.headers.host;
    if (!allowedHosts.includes(host))
      return endError(response, 403, 'Only the local preview host is allowed');
    const origin = request.headers.origin;
    if (
      (origin && origin !== 'http://' + host) ||
      request.headers['sec-fetch-site'] === 'cross-site'
    ) {
      return endError(response, 403, 'Cross-origin requests are not allowed');
    }
    if (!request.url?.startsWith('/') || request.url.startsWith('//'))
      return endError(response, 400, 'Origin-form path required');
    if (
      !['GET', 'HEAD', 'POST', 'PUT', 'PATCH', 'DELETE', 'OPTIONS'].includes(
        request.method,
      )
    )
      return endError(response, 405, 'Method not allowed');
    const api = /^\/api\/v1(?:\/|\?|$)/.test(request.url);
    const port = api ? apiPort : webPort;
    const headers = cleanHeaders(request.headers);
    // Preserve the user's actual Origin; never impersonate an allowed CORS origin.
    // Drop untrusted proxy identity headers and derive forwarding metadata locally.
    for (const name of Object.keys(headers)) {
      if (name.startsWith('x-forwarded-') || name === 'forwarded')
        delete headers[name];
    }
    headers.host = api ? '127.0.0.1:' + port : host;
    headers['x-forwarded-host'] = host;
    headers['x-forwarded-proto'] = 'http';
    const upstream = http.request(
      {
        hostname: '127.0.0.1',
        port,
        method: request.method,
        path: request.url,
        headers,
      },
      (incoming) => {
        response.writeHead(
          incoming.statusCode ?? 502,
          cleanHeaders(incoming.headers),
        );
        incoming.on('error', () => response.destroy());
        incoming.pipe(response);
      },
    );
    upstream.setTimeout(timeoutMs, () =>
      upstream.destroy(new Error('Timeout')),
    );
    upstream.on('error', () =>
      endError(response, 502, 'Preview upstream unavailable'),
    );
    request.on('aborted', () => upstream.destroy());
    request.on('error', () => upstream.destroy());
    response.on('close', () => {
      if (!response.writableFinished) upstream.destroy();
    });
    request.pipe(upstream);
  });
  server.on('connect', (_request, socket) => socket.destroy());
  server.on('upgrade', (_request, socket) => socket.destroy());
  return server;
}
if (
  process.argv[1] &&
  import.meta.url === pathToFileURL(process.argv[1]).href
) {
  const server = createPreviewProxy();
  server.listen(3211, '127.0.0.1', () => {
    console.info(
      'Ticket preview http://localhost:3211 → Web 3212 / API 4000 (loopback only)',
    );
  });
  const stop = () => {
    server.close();
    server.closeAllConnections();
  };
  process.on('SIGINT', stop);
  process.on('SIGTERM', stop);
}
