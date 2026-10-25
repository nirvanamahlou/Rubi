import { createHmac, createHash, randomUUID } from 'node:crypto';
import { lookup } from 'node:dns/promises';
import { request as httpRequest } from 'node:http';
import { request as httpsRequest } from 'node:https';
import { BlockList } from 'node:net';

export interface NiyayeshConnection {
  origin: string;
  local: boolean;
  client: string;
  system: string;
  organization: string;
  environment: string;
  keyId: string;
  secret: string;
  users: {
    userId: string;
    branchId: string;
    subject: string;
    resources: string[];
  }[];
}

export function signingHeaders(
  c: NiyayeshConnection,
  subject: string,
  path: string,
) {
  const timestamp = String(Math.floor(Date.now() / 1000));
  const nonce = randomUUID().replaceAll('-', '');
  const canonical = [
    'erp.v1',
    c.client,
    c.system,
    c.organization,
    c.environment,
    c.keyId,
    'GET',
    path,
    timestamp,
    nonce,
    subject,
    '',
    '',
    '',
    createHash('sha256').update('').digest('hex'),
  ].join('\n');
  return {
    'X-ERP-Client': c.client,
    'X-ERP-System': c.system,
    'X-ERP-Organization': c.organization,
    'X-ERP-Environment': c.environment,
    'X-ERP-Key-ID': c.keyId,
    'X-ERP-Actor': subject,
    'X-ERP-Timestamp': timestamp,
    'X-ERP-Nonce': nonce,
    'X-ERP-Signature': createHmac('sha256', c.secret)
      .update(canonical)
      .digest('hex'),
    Accept: 'application/json',
  };
}

const blocked = new BlockList();
for (const [address, prefix] of [
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
  blocked.addSubnet(address, prefix, 'ipv4');

export async function destination(c: NiyayeshConnection) {
  const url = new URL(c.origin);
  if (
    url.username ||
    url.password ||
    url.search ||
    url.hash ||
    url.pathname !== '/'
  )
    throw Error('INVALID_ORIGIN');
  const local =
    c.local &&
    process.env.NODE_ENV !== 'production' &&
    ['127.0.0.1', 'localhost', 'host.docker.internal'].includes(url.hostname);
  if (!local && (url.protocol !== 'https:' || (url.port && url.port !== '443')))
    throw Error('HTTPS_REQUIRED');
  if (local && url.protocol !== 'http:') throw Error('INVALID_LOCAL_PROTOCOL');
  const addresses = await lookup(url.hostname, { all: true });
  // Public connections intentionally support only public IPv4. DNS is resolved
  // once and the validated address is pinned while TLS verifies the original host.
  if (
    !addresses.length ||
    (!local &&
      addresses.some((a) => a.family !== 4 || blocked.check(a.address, 'ipv4')))
  )
    throw Error('UNSAFE_DESTINATION');
  return { url, address: addresses[0]! };
}

export async function niyayeshRead(
  c: NiyayeshConnection,
  subject: string,
  path: string,
): Promise<unknown> {
  if (!/^\/api\/v1\/integration\/(capabilities|resources\/)/.test(path))
    throw Error('INVALID_PATH');
  const { url, address } = await destination(c);
  return new Promise((resolve, reject) => {
    const req = (url.protocol === 'https:' ? httpsRequest : httpRequest)(
      {
        hostname: address.address,
        family: address.family,
        port: url.port || (url.protocol === 'http:' ? 80 : 443),
        servername: url.hostname,
        method: 'GET',
        path,
        headers: { ...signingHeaders(c, subject, path), Host: url.host },
        timeout: 10000,
      },
      (response) => {
        const chunks: Buffer[] = [];
        let bytes = 0;
        if (
          response.statusCode !== 200 ||
          !response.headers['content-type']?.includes('application/json')
        ) {
          response.resume();
          reject(Error(`UPSTREAM_${response.statusCode ?? 502}`));
          return;
        }
        response.on('data', (chunk: Buffer) => {
          bytes += chunk.length;
          if (bytes > 2 * 1024 * 1024) {
            req.destroy(Error('RESPONSE_TOO_LARGE'));
            return;
          }
          chunks.push(chunk);
        });
        response.on('end', () => {
          try {
            resolve(JSON.parse(Buffer.concat(chunks).toString()) as unknown);
          } catch {
            reject(Error('INVALID_RESPONSE'));
          }
        });
        response.on('error', () => reject(Error('CONNECTION_FAILED')));
      },
    );
    req.on('timeout', () => req.destroy(Error('TIMEOUT')));
    req.on('error', () => reject(Error('CONNECTION_FAILED')));
    req.end();
  });
}
