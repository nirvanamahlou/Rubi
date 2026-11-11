import { mkdtemp, open, readFile, rm } from 'node:fs/promises';
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
    root = await mkdtemp(join(tmpdir(), 'nora-documents-storage-'));
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
    const contents = Buffer.alloc(160 * 1024, 11);
    contents.write('%PDF-1.7\nprivate document bytes');
    await storage.putQuarantined(objectKey, contents);

    const stored = await readFile(
      join(root, 'quarantine', ...objectKey.split('/')),
    );
    expect(stored.subarray(0, 8).toString('ascii')).toBe('RUBIDOC1');
    expect(stored.includes(contents)).toBe(false);

    const stream = await storage.openQuarantined(objectKey, contents.length);
    const chunks: Buffer[] = [];
    for await (const chunk of stream) chunks.push(Buffer.from(chunk));
    expect(chunks.length).toBeGreaterThan(1);
    expect(Buffer.concat(chunks)).toEqual(contents);
  });

  it('fills the compatibility buffer from authenticated chunks and checks size before allocating', async () => {
    const contents = Buffer.alloc(257 * 1024 + 3);
    for (let offset = 0; offset < contents.length; offset++)
      contents[offset] = offset % 251;
    await storage.putQuarantined(objectKey, contents);
    await expect(
      storage.readQuarantined(objectKey, contents.length),
    ).resolves.toEqual(contents);
    await expect(
      storage.readQuarantinedRange(objectKey, contents.length, 65_534, 12),
    ).resolves.toEqual(contents.subarray(65_534, 65_546));
    await expect(
      storage.readQuarantinedRange(
        objectKey,
        contents.length,
        contents.length - 1,
        2,
      ),
    ).rejects.toThrow('Stored document failed integrity verification.');
    await expect(
      storage.readQuarantined(objectKey, Number.MAX_SAFE_INTEGER),
    ).rejects.toThrow('Stored document failed integrity verification.');
    await expect(
      storage.readQuarantined(objectKey, contents.length - 1),
    ).rejects.toThrow('Stored document failed integrity verification.');
  });

  it('writes an async source in the existing authenticated format', async () => {
    const first = Buffer.alloc(97 * 1024, 12);
    const second = Buffer.from('second stream chunk');
    async function* source() {
      yield first;
      await Promise.resolve();
      yield second;
    }
    await storage.putQuarantinedStream(objectKey, source());
    const stream = await storage.openQuarantined(
      objectKey,
      first.length + second.length,
    );
    const chunks: Buffer[] = [];
    for await (const chunk of stream) chunks.push(Buffer.from(chunk));
    expect(Buffer.concat(chunks)).toEqual(Buffer.concat([first, second]));
  });

  it('cleans up failed streams without replacing an existing file', async () => {
    async function* source() {
      yield Buffer.from('partially produced content');
      throw new Error('source failed');
    }
    await expect(
      storage.putQuarantinedStream(objectKey, source()),
    ).rejects.toThrow('source failed');
    const target = join(root, 'quarantine', ...objectKey.split('/'));
    await expect(readFile(target)).rejects.toMatchObject({ code: 'ENOENT' });
    await storage.putQuarantined(objectKey, Buffer.from('existing'));
    const existing = await readFile(target);
    await expect(
      storage.putQuarantinedStream(objectKey, source()),
    ).rejects.toMatchObject({ code: 'EEXIST' });
    expect(await readFile(target)).toEqual(existing);
  });

  it('rejects corrupted ciphertext before delivering it, including changes after opening', async () => {
    const contents = Buffer.alloc(160 * 1024, 11);
    await storage.putQuarantined(objectKey, contents);
    await expect(
      storage.verifyQuarantined(objectKey, contents.length),
    ).resolves.toBeUndefined();
    const stream = await storage.openQuarantined(objectKey, contents.length);
    const file = await open(
      join(root, 'quarantine', ...objectKey.split('/')),
      'r+',
    );
    try {
      const offset = 36;
      const byte = Buffer.alloc(1);
      await file.read(byte, 0, 1, offset);
      byte[0] = byte[0]! ^ 1;
      await file.write(byte, 0, 1, offset);
    } finally {
      await file.close();
    }
    await expect(
      storage.openQuarantined(objectKey, contents.length),
    ).rejects.toThrow();
    await expect(
      storage.verifyQuarantined(objectKey, contents.length),
    ).rejects.toThrow();
    await expect(
      storage.readQuarantined(objectKey, contents.length),
    ).rejects.toThrow();
    await expect(
      storage.readQuarantinedRange(objectKey, contents.length, 100_000, 16),
    ).rejects.toThrow();
    const chunks: Buffer[] = [];
    const consume = async () => {
      for await (const chunk of stream) chunks.push(Buffer.from(chunk));
    };
    await expect(consume()).rejects.toThrow(/integrity verification/);
    expect(chunks).toHaveLength(0);
  });

  it('rejects non-opaque and path-traversal object keys', async () => {
    await expect(
      storage.putQuarantined('../../contract.pdf', Buffer.from('unsafe')),
    ).rejects.toThrow(/Invalid document storage key/);
  });

  it('checks the private storage root without reading a document', async () => {
    await expect(storage.health()).resolves.toBeUndefined();
  });
});
