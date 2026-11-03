import { lookup } from 'node:dns/promises';
import { BlockList } from 'node:net';
import { request as httpsRequest } from 'node:https';
import { request as httpRequest } from 'node:http';
import type { GhestirooConfig } from './ghestiroo.store';

const blocked = new BlockList();
for (const [ip, prefix] of [
  ['0.0.0.0', 8],
  ['10.0.0.0', 8],
  ['127.0.0.0', 8],
  ['169.254.0.0', 16],
  ['172.16.0.0', 12],
  ['192.168.0.0', 16],
  ['100.64.0.0', 10],
  ['192.0.0.0', 24],
  ['192.0.2.0', 24],
  ['198.18.0.0', 15],
  ['198.51.100.0', 24],
  ['203.0.113.0', 24],
  ['224.0.0.0', 4],
  ['240.0.0.0', 4],
] as const)
  blocked.addSubnet(ip, prefix, 'ipv4');

export function ghestirooOrigin(value: string) {
  const url = new URL(value);
  const local =
    process.env.NODE_ENV !== 'production' &&
    process.env.NORA_GHESTIROO_ALLOW_LOCAL === 'true' &&
    ['localhost', '127.0.0.1'].includes(url.hostname);
  if (
    url.username ||
    url.password ||
    url.search ||
    url.hash ||
    url.pathname !== '/' ||
    (!local &&
      (url.protocol !== 'https:' || (url.port && url.port !== '443'))) ||
    (local && url.protocol !== 'http:')
  )
    throw Error('INVALID_ORIGIN');
  return { url, local };
}

export async function ghestirooRequest(
  config: GhestirooConfig,
  operation: string,
  after = '',
  nextApiKey?: string,
  options?: {
    actor?: { subject: string; branch: string; name: string };
    payload?: unknown;
  },
): Promise<Record<string, unknown>> {
  if (
    ![
      'capabilities',
      'catalog',
      'customers',
      'requests',
      'cases',
      'admin-grants',
      'renew',
      'workspace',
      'presence',
      'dashboard',
    ].includes(operation) ||
    (after && !/^[a-f0-9]{32}$/.test(after)) ||
    (operation === 'renew' && !/^[A-Za-z0-9_-]{64}$/.test(nextApiKey ?? ''))
  )
    throw Error('INVALID_OPERATION');
  const { url, local } = ghestirooOrigin(config.origin);
  const addresses = await lookup(url.hostname, { all: true });
  if (
    !addresses.length ||
    (!local &&
      addresses.some((a) => a.family !== 4 || blocked.check(a.address, 'ipv4')))
  )
    throw Error('UNSAFE_DESTINATION');
  const path = `/admin/integration/nora/v1/${['capabilities', 'admin-grants', 'renew', 'workspace', 'presence', 'dashboard'].includes(operation) ? operation : `resources/${operation}`}${after ? `?after=${after}` : ''}`;
  const body =
    operation === 'renew'
      ? JSON.stringify({ nextApiKey })
      : ['workspace', 'dashboard'].includes(operation)
        ? JSON.stringify(options?.payload)
        : undefined;
  if (body && Buffer.byteLength(body) > 8 * 1024 * 1024)
    throw Error('REQUEST_TOO_LARGE');
  return new Promise((resolve, reject) => {
    const req = (local ? httpRequest : httpsRequest)(
      {
        hostname: addresses[0]!.address,
        family: addresses[0]!.family,
        servername: url.hostname,
        port: url.port || (local ? 80 : 443),
        method: ['admin-grants', 'renew', 'workspace', 'dashboard'].includes(
          operation,
        )
          ? 'POST'
          : 'GET',
        path,
        headers: {
          Host: url.host,
          accept: 'application/json',
          authorization: `Bearer ${config.apiKey}`,
          'x-nora-connection': config.connectionId,
          ...(options?.actor
            ? {
                'x-nora-subject': options.actor.subject,
                'x-nora-branch': options.actor.branch,
                'x-nora-name': encodeURIComponent(options.actor.name),
              }
            : {}),
          ...(body
            ? {
                'content-type': 'application/json',
                'content-length': Buffer.byteLength(body),
              }
            : {}),
        },
        timeout: 10000,
      },
      (response) => {
        const chunks: Buffer[] = [];
        let bytes = 0;
        response.on('data', (chunk: Buffer) => {
          bytes += chunk.length;
          if (bytes > (operation === 'workspace' ? 8 : 1) * 1024 * 1024)
            req.destroy(Error('RESPONSE_TOO_LARGE'));
          else chunks.push(chunk);
        });
        response.on('error', () => reject(Error('CONNECTION_FAILED')));
        response.on('end', () => {
          if (
            response.statusCode !== 200 ||
            !response.headers['content-type']?.includes('application/json')
          ) {
            let detail: string | undefined;
            try {
              const value = JSON.parse(Buffer.concat(chunks).toString()) as {
                detail?: unknown;
              };
              if (typeof value.detail === 'string')
                detail = value.detail
                  .slice(0, 2000)
                  .split(config.apiKey)
                  .join('[redacted]');
            } catch {
              /* No raw upstream body escapes. */
            }
            return reject(
              Object.assign(Error(`UPSTREAM_${response.statusCode}`), {
                detail,
              }),
            );
          }
          try {
            const data = JSON.parse(Buffer.concat(chunks).toString()) as Record<
              string,
              unknown
            >;
            if (data.contract !== 'ghestiroo.nora.v1')
              throw Error('INVALID_CONTRACT');
            resolve(data);
          } catch {
            reject(Error('INVALID_CONTRACT'));
          }
        });
      },
    );
    const deadline = setTimeout(() => req.destroy(Error('TIMEOUT')), 12000);
    req.on('close', () => clearTimeout(deadline));
    req.on('timeout', () => req.destroy(Error('TIMEOUT')));
    req.on('error', () => reject(Error('CONNECTION_FAILED')));
    req.end(body);
  });
}
