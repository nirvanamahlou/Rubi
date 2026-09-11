// Standalone, loopback-only review of the same document served by /workbench/demo.
// Requires Node 24 (the repository engine). No auth cookie, backend, or DB is used.
import { createServer } from 'node:http';
import { readFile } from 'node:fs/promises';
import { workbenchDemoHeaders } from './demo-response.ts';

const port = Number(process.argv[2] || 3301);
if (!Number.isInteger(port) || port < 1024 || port > 65535) {
  throw new Error('Provide an unprivileged port between 1024 and 65535.');
}
const file = new URL('./workbench-demo.html', import.meta.url);
const server = createServer(async (req, res) => {
  if (!['GET', 'HEAD'].includes(req.method ?? '')) {
    res.writeHead(405, { Allow: 'GET, HEAD' });
    res.end();
    return;
  }
  const pathname = new URL(req.url ?? '/', 'http://127.0.0.1').pathname;
  if (pathname !== '/' && pathname !== '/workbench/demo') {
    res.writeHead(404);
    res.end();
    return;
  }
  try {
    const html = await readFile(file, 'utf8');
    res.writeHead(200, workbenchDemoHeaders);
    res.end(req.method === 'HEAD' ? undefined : html);
  } catch {
    res.writeHead(503, { 'Cache-Control': 'no-store' });
    res.end('Preview document unavailable.');
  }
});
server.listen(port, '127.0.0.1', () => {
  process.stdout.write(
    `Synthetic workbench: http://127.0.0.1:${port}/workbench/demo\n`,
  );
});
process.on('SIGINT', () => server.close());
process.on('SIGTERM', () => server.close());
