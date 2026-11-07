import { createHash, createHmac, randomUUID } from 'node:crypto';
import { request as httpsRequest } from 'node:https';
import { request as httpRequest } from 'node:http';
import {
  destination,
  NiyayeshUpstreamError,
  type NiyayeshConnection,
} from './niyayesh.client';

export const JAHAN_CONTRACT = 'jahan-bastan.nora.v1';
export const JAHAN_RESOURCES = [
  'countries',
  'destinations',
  'tours',
  'hotels',
  'service-offers',
  'editorial-content',
  'exchange-rates',
  'site-analytics',
  'customer-accounts',
  'customer-orders',
];

/** Fixed native adapter; arbitrary URLs, methods and business commands never pass. */
export async function jahanRequest(
  config: NiyayeshConnection,
  subject: string,
  nativePath: string,
  options: {
    method?: string;
    body?: string;
    command?: string;
    version?: string;
  } = {},
): Promise<Record<string, unknown>> {
  const c = config.jahan;
  const method = options.method ?? 'GET';
  if (
    config.protocol !== JAHAN_CONTRACT ||
    !c ||
    c.siteId !== 'jahan-bastan' ||
    c.state !== 'ACTIVE'
  )
    throw Error('INVALID_SITE');
  const path = nativePath
    .replace(/^\/api\/v1\/integration\//, '/api/v1/integration/nora/v1/')
    .replace(/^\/api\/v1\/admin\//, '/api/v1/integration/nora/v1/catalogue/');
  const suffix = path.replace('/api/v1/integration/nora/v1/', '');
  const read =
    method === 'GET' &&
    (/^(capabilities|dashboard|presence)$/.test(suffix) ||
      /^report\?from=\d{4}-\d{2}-\d{2}&to=\d{4}-\d{2}-\d{2}$/.test(suffix) ||
      /^resources\/[a-z-]+(?:\/\d+|\?after_id=\d+&limit=25(?:&metric=[a-z-]+)?(?:&report_metric=[a-z]+&from=\d{4}-\d{2}-\d{2}&to=\d{4}-\d{2}-\d{2})?(?:&q=[A-Za-z0-9%_.!~*'()-]{1,900})?(?:&status=(?:draft|published|archived))?)$/.test(
        suffix,
      ) ||
      /^catalogue\/[a-z-]+\/(schema|value\/\d+)$/.test(suffix) ||
      /^workbooks\/(hotels|tour-prices)\/template$/.test(suffix));
  const write =
    method === 'POST' &&
    (/^(renew|lifecycle)$/.test(suffix) ||
      /^workbooks\/(hotels|tour-prices)$/.test(suffix) ||
      /^catalogue\/[a-z-]+$/.test(suffix));
  const edit = method === 'PATCH' && /^catalogue\/[a-z-]+\/\d+$/.test(suffix);
  if (
    (!read && !write && !edit) ||
    !path.startsWith('/api/v1/integration/nora/v1/')
  )
    throw Error('INVALID_PATH');
  if ((options.body?.length ?? 0) > 8 * 1024 * 1024)
    throw Error('REQUEST_TOO_LARGE');
  const { url, address } = await destination(config);
  const timestamp = String(Math.floor(Date.now() / 1000));
  const nonce = randomUUID().replaceAll('-', '');
  const canonical = [
    JAHAN_CONTRACT,
    c.connectionId,
    c.siteId,
    config.organization,
    config.environment,
    c.branchId,
    subject,
    method,
    path,
    timestamp,
    nonce,
    options.command ?? '',
    options.version ?? '',
    createHash('sha256')
      .update(options.body ?? '')
      .digest('hex'),
  ].join('\n');
  return new Promise((resolve, reject) => {
    const req = (url.protocol === 'https:' ? httpsRequest : httpRequest)(
      {
        hostname: address.address,
        family: address.family,
        servername: url.hostname,
        port: url.port || (url.protocol === 'https:' ? 443 : 80),
        method,
        path,
        headers: {
          Host: url.host,
          Accept: 'application/json',
          Authorization: `Bearer ${config.secret}`,
          'X-Nora-Connection': c.connectionId,
          'X-Nora-Subject': subject,
          'X-Nora-Branch': c.branchId,
          'X-Nora-Timestamp': timestamp,
          'X-Nora-Request': nonce,
          'X-Nora-Signature': createHmac('sha256', c.signingKey)
            .update(canonical)
            .digest('hex'),
          ...(options.body ? { 'Content-Type': 'application/json' } : {}),
          ...(options.command ? { 'Idempotency-Key': options.command } : {}),
          ...(options.version ? { 'X-Nora-Version': options.version } : {}),
        },
      },
      (response) => {
        const chunks: Buffer[] = [];
        let bytes = 0;
        response.on('data', (chunk: Buffer) => {
          bytes += chunk.length;
          if (bytes > 8 * 1024 * 1024) {
            req.destroy(Error('RESPONSE_TOO_LARGE'));
            return;
          }
          chunks.push(chunk);
        });
        response.on('error', () => reject(Error('CONNECTION_FAILED')));
        response.on('end', () => {
          if (
            ![200, 201].includes(response.statusCode ?? 0) ||
            !response.headers['content-type']?.includes('application/json')
          ) {
            reject(new NiyayeshUpstreamError(response.statusCode ?? 502, ''));
            return;
          }
          try {
            const value = JSON.parse(
              Buffer.concat(chunks).toString(),
            ) as Record<string, unknown>;
            if (!value || typeof value !== 'object' || Array.isArray(value))
              throw Error();
            resolve(value);
          } catch {
            reject(Error('INVALID_RESPONSE'));
          }
        });
      },
    );
    const deadline = setTimeout(
      () => req.destroy(Error('TIMEOUT')),
      method === 'GET' ? 10000 : 60000,
    );
    req.on('close', () => clearTimeout(deadline));
    req.on('error', (error) => reject(error));
    req.end(options.body);
  });
}
