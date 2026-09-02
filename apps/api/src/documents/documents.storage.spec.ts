import { mkdtemp, readFile, rm } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import { join } from 'node:path';

import { ConfigService } from '@nestjs/config';
import { afterEach, beforeEach, describe, expect, it } from 'vitest';

import { LocalDocumentStorage } from './documents.storage';

const objectKey =
  'documents/44444444-4444-4444-8444-444444444444/v1/88888888-8888-4888-8888-888888888888.bin';

describe('LocalDocumentStorage encryption boundary', () => {
  let root: string;
  let storage: LocalDocumentStorage;

  beforeEach(async () => {
    root = await mkdtemp(join(tmpdir(), 'rubi-documents-storage-'));
    storage = new LocalDocumentStorage(
      new ConfigService({
        DOCUMENTS_STORAGE_ROOT: root,
        DOCUMENTS_STORAGE_ENCRYPTION_KEY_BASE64: Buffer.alloc(32, 7).toString(
          'base64',
        ),
      }),
    );
  });

  afterEach(async () => {
    await rm(root, { recursive: true, force: true });
  });

  it('stores ciphertext at rest and returns authenticated plaintext', async () => {
    const contents = Buffer.from('%PDF-1.7\nprivate document bytes');
    await storage.putQuarantined(objectKey, contents);

    const stored = await readFile(
      join(root, 'quarantine', ...objectKey.split('/')),
    );
    expect(stored.subarray(0, 8).toString('ascii')).toBe('RUBIDOC1');
    expect(stored.includes(contents)).toBe(false);

    const stream = await storage.openQuarantined(objectKey, contents.length);
    const chunks: Buffer[] = [];
    for await (const chunk of stream) chunks.push(Buffer.from(chunk));
    expect(Buffer.concat(chunks)).toEqual(contents);
  });

  it('rejects non-opaque and path-traversal object keys', async () => {
    await expect(
      storage.putQuarantined('../../contract.pdf', Buffer.from('unsafe')),
    ).rejects.toThrow(/Invalid document storage key/);
  });
});
