import http from 'node:http';
import net from 'node:net';
import { pathToFileURL } from 'node:url';

function parsePort(value, name) {
  const port = Number(value);
  if (!Number.isInteger(port) || port < 1 || port > 65_535) {
    throw new Error(`${name} must be an integer between 1 and 65535.`);
  }
  return port;
}

function parseArguments(argv) {
  const values = new Map();
  for (let index = 0; index < argv.length; index += 2) {
    const key = argv[index];
    const value = argv[index + 1];
    if (!key?.startsWith('--') || value === undefined) {
      throw new Error('Arguments must be supplied as --name value pairs.');
    }
    values.set(key.slice(2), value);
  }

  return {
    listenHost: values.get('listen-host') ?? '127.0.0.1',
    listenPort: parsePort(values.get('listen-port') ?? '3100', 'listen-port'),
    targetHost: values.get('target-host') ?? '127.0.0.1',
    targetPort: parsePort(values.get('target-port') ?? '3110', 'target-port'),
  };
}

function writeBadGateway(response) {
  if (response.headersSent) {
    response.destroy();
    return;
  }
  response.writeHead(502, { 'content-type': 'text/plain; charset=utf-8' });
  response.end(
    'The current Nora web runtime is starting. Please refresh shortly.',
  );
}

export function createRuntimeGateway({ targetHost, targetPort }) {
  const server = http.createServer((request, response) => {
    const upstream = http.request(
      {
        hostname: targetHost,
        port: targetPort,
        method: request.method,
        path: request.url,
        headers: request.headers,
      },
      (upstreamResponse) => {
        response.writeHead(
          upstreamResponse.statusCode ?? 502,
          upstreamResponse.statusMessage,
          upstreamResponse.headers,
        );
        upstreamResponse.pipe(response);
      },
    );

    upstream.on('error', () => writeBadGateway(response));
    request.on('error', () => upstream.destroy());
    request.pipe(upstream);
  });

  server.on('upgrade', (request, socket, head) => {
    const upstream = net.connect(targetPort, targetHost, () => {
      const headerLines = [];
      for (let index = 0; index < request.rawHeaders.length; index += 2) {
        headerLines.push(
          `${request.rawHeaders[index]}: ${request.rawHeaders[index + 1]}`,
        );
      }
      upstream.write(
        `${request.method} ${request.url} HTTP/${request.httpVersion}\r\n${headerLines.join('\r\n')}\r\n\r\n`,
      );
      if (head.length > 0) upstream.write(head);
      socket.pipe(upstream).pipe(socket);
    });
    upstream.on('error', () => socket.destroy());
    socket.on('error', () => upstream.destroy());
  });

  return server;
}

if (
  process.argv[1] &&
  import.meta.url === pathToFileURL(process.argv[1]).href
) {
  const options = parseArguments(process.argv.slice(2));
  const server = createRuntimeGateway(options);
  server.listen(options.listenPort, options.listenHost, () => {
    process.stdout.write(
      `Nora runtime gateway listening on http://${options.listenHost}:${options.listenPort} -> http://${options.targetHost}:${options.targetPort}\n`,
    );
  });
}
