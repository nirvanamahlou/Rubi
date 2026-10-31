import { afterEach, beforeEach, expect, it, vi } from 'vitest';
import { mkdtemp, readFile, readdir, rm, writeFile } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import {
  createPublicDocument,
  readPublicDocument,
  publicDocumentSettings,
} from './public-document-store';
import { GET } from '@/app/d/[token]/route';
import { proxy } from '@/proxy';
import { NextRequest } from 'next/server';
import { publicDocumentQr } from '../public/document-qr';

let root: string;
let env: Readonly<Record<string, string | undefined>>;
beforeEach(async () => {
  root = await mkdtemp(join(tmpdir(), 'public-document-test-'));
  env = {
    PUBLIC_TRAVEL_DOCUMENTS_ORIGIN: 'https://example.test',
    PUBLIC_TRAVEL_DOCUMENTS_ROOT: root,
    PUBLIC_TRAVEL_DOCUMENTS_KEY: 'ab'.repeat(32),
  };
});
afterEach(async () => {
  vi.unstubAllEnvs();
  await rm(root, { recursive: true, force: true });
});
const token = (url: string) => new URL(url).pathname.split('/').at(-1)!;
it('publishes independent immutable encrypted capabilities, never raw identifiers or passenger content on disk', async () => {
  const a = createPublicDocument(env)!,
    b = createPublicDocument(env)!;
  expect(a.url).not.toBe(b.url);
  expect(token(a.url)).toMatch(/^[A-Za-z0-9_-]{32}$/);
  const html = '<!doctype html><html>SYNTHETIC PASSENGER A</html>';
  await a.save(html);
  await b.save('<!doctype html><html>SYNTHETIC PASSENGER B</html>');
  expect(await readPublicDocument(token(a.url), env)).toBe(html);
  expect(await readPublicDocument(token(b.url), env)).not.toContain(
    'PASSENGER A',
  );
  for (const file of await readdir(root)) {
    expect(file).toMatch(/^[a-f0-9]{64}\.bin$/);
    const bytes = await readFile(join(root, file));
    expect(bytes.toString()).not.toContain('SYNTHETIC');
    expect(bytes.toString()).not.toContain(token(a.url));
  }
  await expect(a.save(html)).rejects.toThrow();
});
it('rejects modified, unknown and traversal tokens, tampered files and a different key', async () => {
  const document = createPublicDocument(env)!;
  await document.save('<!doctype html><html>SAFE</html>');
  expect(await readPublicDocument('../secret', env)).toBeUndefined();
  expect(await readPublicDocument('x'.repeat(32), env)).toBeUndefined();
  expect(
    await readPublicDocument(token(document.url), {
      ...env,
      PUBLIC_TRAVEL_DOCUMENTS_KEY: 'cd'.repeat(32),
    }),
  ).toBeUndefined();
  const path = join(root, (await readdir(root))[0]!);
  const bytes = await readFile(path);
  bytes[bytes.length - 1]! ^= 1;
  await writeFile(path, bytes);
  expect(await readPublicDocument(token(document.url), env)).toBeUndefined();
});
it('fails closed for partial or insecure configuration and oversize content', async () => {
  expect(publicDocumentSettings({})).toBeUndefined();
  expect(() =>
    publicDocumentSettings({
      PUBLIC_TRAVEL_DOCUMENTS_ORIGIN: 'https://example.test',
    }),
  ).toThrow();
  expect(() =>
    publicDocumentSettings({
      ...env,
      PUBLIC_TRAVEL_DOCUMENTS_ORIGIN: 'http://example.test',
    }),
  ).toThrow();
  await expect(
    createPublicDocument(env)!.save('<!doctype html>' + 'a'.repeat(10_000_000)),
  ).rejects.toThrow();
});
it('serves only the capability document without login with private no-store and inert HTML headers', async () => {
  for (const [name, value] of Object.entries(env)) vi.stubEnv(name, value!);
  const document = createPublicDocument(env)!;
  const html = '<!doctype html><html>ONLY THIS DOCUMENT</html>';
  await document.save(html);
  const request = new NextRequest(document.url);
  expect(proxy(request).headers.get('x-middleware-next')).toBe('1');
  expect(proxy(new NextRequest('https://example.test/d/list')).status).toBe(
    307,
  );
  expect(
    proxy(new NextRequest('https://example.test/reservations/requests/id/pdf'))
      .status,
  ).toBe(307);
  const result = await GET(request, {
    params: Promise.resolve({ token: token(document.url) }),
  });
  expect(result.status).toBe(200);
  expect(await result.text()).toBe(html);
  expect(result.headers.get('cache-control')).toContain('no-store');
  expect(result.headers.get('referrer-policy')).toBe('no-referrer');
  expect(result.headers.get('x-robots-tag')).toContain('noindex');
  expect(result.headers.get('content-security-policy')).toContain(
    "default-src 'none'",
  );
  expect(
    (await GET(request, { params: Promise.resolve({ token: 'x'.repeat(32) }) }))
      .status,
  ).toBe(404);
});
it('builds a real URL QR and rejects executable URLs, query strings and ID-based paths', () => {
  const url = createPublicDocument(env)!.url;
  expect(publicDocumentQr(url)).toContain('<svg');
  expect(publicDocumentQr(url)).toContain(url);
  expect(publicDocumentQr('javascript:alert(1)')).toBeNull();
  expect(publicDocumentQr(url + '?next=anything')).toBeNull();
  expect(publicDocumentQr('https://example.test/r/contract-id')).toBeNull();
});
