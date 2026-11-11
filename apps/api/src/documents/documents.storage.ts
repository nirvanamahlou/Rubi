import {
  createCipheriv,
  createDecipheriv,
  createHash,
  randomBytes,
} from 'node:crypto';
import { constants } from 'node:fs';
import { access, mkdir, open, rm, type FileHandle } from 'node:fs/promises';
import { dirname, resolve, sep } from 'node:path';
import { Readable } from 'node:stream';

import { Inject, Injectable } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';

import { validateStorageObjectKey } from './documents.validation';

const headerSize = 36;
const chunkSize = 64 * 1024;

function integrityError() {
  return new Error('Stored document failed integrity verification.');
}

async function readExactly(file: FileHandle, position: number, length: number) {
  const bytes = Buffer.allocUnsafe(length);
  let offset = 0;
  while (offset < length) {
    const { bytesRead } = await file.read(
      bytes,
      offset,
      length - offset,
      position + offset,
    );
    if (!bytesRead) throw integrityError();
    offset += bytesRead;
  }
  return bytes;
}

function digest(bytes: Buffer) {
  return createHash('sha256').update(bytes).digest();
}

@Injectable()
export class LocalDocumentStorage {
  private readonly quarantineRoot: string;
  private readonly encryptionKey: Buffer;

  constructor(@Inject(ConfigService) config: ConfigService) {
    this.quarantineRoot = resolve(
      config.getOrThrow<string>('DOCUMENTS_STORAGE_ROOT'),
      'quarantine',
    );
    this.encryptionKey = Buffer.from(
      config.getOrThrow<string>('DOCUMENTS_STORAGE_ENCRYPTION_KEY_BASE64'),
      'base64',
    );
    if (this.encryptionKey.length !== 32) {
      throw new Error('Documents storage encryption key must be 32 bytes.');
    }
  }

  private pathFor(objectKey: string): string {
    if (!validateStorageObjectKey(objectKey)) {
      throw new Error('Invalid document storage key.');
    }
    const fullPath = resolve(this.quarantineRoot, ...objectKey.split('/'));
    if (!fullPath.startsWith(`${this.quarantineRoot}${sep}`)) {
      throw new Error('Document storage path escapes its private root.');
    }
    return fullPath;
  }

  /**
   * Public module port for liveness consumers. It validates only the private
   * storage root; no file, object key, or document metadata is disclosed.
   */
  async health(): Promise<void> {
    await mkdir(this.quarantineRoot, { recursive: true, mode: 0o700 });
    await access(this.quarantineRoot, constants.R_OK | constants.W_OK);
  }

  putQuarantined(objectKey: string, contents: Buffer): Promise<void> {
    return this.putQuarantinedStream(objectKey, [contents]);
  }

  async putQuarantinedStream(
    objectKey: string,
    contents: Iterable<Uint8Array> | AsyncIterable<Uint8Array>,
  ): Promise<void> {
    const target = this.pathFor(objectKey);
    const iv = randomBytes(12);
    const cipher = createCipheriv('aes-256-gcm', this.encryptionKey, iv);
    cipher.setAAD(Buffer.from(objectKey, 'utf8'));

    async function* encryptedChunks() {
      const header = Buffer.alloc(headerSize);
      header.write('RUBIDOC1', 'ascii');
      iv.copy(header, 8);
      yield header;
      for await (const chunk of contents) {
        for (let offset = 0; offset < chunk.length; offset += chunkSize)
          yield cipher.update(chunk.subarray(offset, offset + chunkSize));
      }
      yield cipher.final();
    }

    await mkdir(dirname(target), { recursive: true, mode: 0o700 });
    const file = await open(target, 'wx', 0o600);
    try {
      try {
        await file.writeFile(encryptedChunks());
        const tag = cipher.getAuthTag();
        // Finalize the existing header layout without buffering the ciphertext.
        let offset = 0;
        while (offset < tag.length) {
          const { bytesWritten } = await file.write(
            tag,
            offset,
            tag.length - offset,
            8 + iv.length + offset,
          );
          if (!bytesWritten)
            throw new Error('Could not write document authentication tag.');
          offset += bytesWritten;
        }
      } finally {
        await file.close();
      }
    } catch (error) {
      await rm(target, { force: true });
      throw error;
    }
  }

  async removeQuarantined(objectKey: string): Promise<void> {
    await rm(this.pathFor(objectKey), { force: true });
  }

  async openQuarantined(
    objectKey: string,
    expectedSizeBytes: number,
  ): Promise<Readable> {
    const target = this.pathFor(objectKey);
    const { header, digests } = await this.authenticateObject(
      target,
      objectKey,
      expectedSizeBytes,
      'stream',
    );

    // GCM authenticates the entire file at final(). Only start delivery after
    // that succeeds. Compare each ciphertext chunk on the second pass so
    // changes after verification cannot introduce unverified plaintext.
    return Readable.from(
      this.streamVerified(
        target,
        objectKey,
        header,
        expectedSizeBytes,
        digests,
      ),
      { objectMode: false },
    );
  }

  async verifyQuarantined(objectKey: string, expectedSizeBytes: number) {
    await this.authenticateObject(
      this.pathFor(objectKey),
      objectKey,
      expectedSizeBytes,
      'verify',
    );
  }

  private async authenticateObject(
    target: string,
    objectKey: string,
    expectedSizeBytes: number,
    mode: 'verify' | 'stream' | 'buffer',
    range = { offset: 0, length: expectedSizeBytes },
  ) {
    if (!Number.isSafeInteger(expectedSizeBytes) || expectedSizeBytes < 0)
      throw integrityError();
    const rangeEnd = range.offset + range.length;
    if (
      !Number.isSafeInteger(range.offset) ||
      !Number.isSafeInteger(range.length) ||
      range.offset < 0 ||
      range.length < 0 ||
      rangeEnd > expectedSizeBytes
    )
      throw integrityError();
    const file = await open(target, 'r');
    const digests: Buffer[] = [];
    let header: Buffer;
    let contents: Buffer | undefined;
    try {
      const stat = await file.stat();
      if (!stat.isFile() || stat.size - headerSize !== expectedSizeBytes)
        throw integrityError();
      if (mode === 'buffer') contents = Buffer.allocUnsafe(range.length);
      header = await readExactly(file, 0, headerSize);
      const decipher = this.decipher(objectKey, header);
      for (let offset = 0; offset < expectedSizeBytes; offset += chunkSize) {
        const bytes = await readExactly(
          file,
          headerSize + offset,
          Math.min(chunkSize, expectedSizeBytes - offset),
        );
        if (mode === 'stream') digests.push(digest(bytes));
        const plaintext = decipher.update(bytes);
        if (contents) {
          const start = Math.max(offset, range.offset);
          const end = Math.min(offset + plaintext.length, rangeEnd);
          if (start < end)
            plaintext.copy(
              contents,
              start - range.offset,
              start - offset,
              end - offset,
            );
        }
      }
      decipher.final();
    } catch (error) {
      contents?.fill(0);
      throw error;
    } finally {
      await file.close();
    }

    return { header, digests, contents };
  }

  private async *streamVerified(
    target: string,
    objectKey: string,
    header: Buffer,
    size: number,
    digests: readonly Buffer[],
  ) {
    const file = await open(target, 'r');
    try {
      const decipher = this.decipher(objectKey, header);
      for (let offset = 0; offset < size; offset += chunkSize) {
        const bytes = await readExactly(
          file,
          headerSize + offset,
          Math.min(chunkSize, size - offset),
        );
        if (!digest(bytes).equals(digests[offset / chunkSize]!))
          throw integrityError();
        yield decipher.update(bytes);
      }
      decipher.final();
    } finally {
      await file.close();
    }
  }

  private decipher(objectKey: string, header: Buffer) {
    if (
      header.length !== headerSize ||
      header.subarray(0, 8).toString('ascii') !== 'RUBIDOC1'
    )
      throw integrityError();
    const decipher = createDecipheriv(
      'aes-256-gcm',
      this.encryptionKey,
      header.subarray(8, 20),
    );
    decipher.setAAD(Buffer.from(objectKey, 'utf8'));
    decipher.setAuthTag(header.subarray(20, headerSize));
    return decipher;
  }

  async readQuarantinedRange(
    objectKey: string,
    expectedSizeBytes: number,
    offset: number,
    length: number,
  ): Promise<Buffer> {
    const { contents } = await this.authenticateObject(
      this.pathFor(objectKey),
      objectKey,
      expectedSizeBytes,
      'buffer',
      { offset, length },
    );
    return contents!;
  }

  async readQuarantined(
    objectKey: string,
    expectedSizeBytes: number,
  ): Promise<Buffer> {
    return this.readQuarantinedRange(
      objectKey,
      expectedSizeBytes,
      0,
      expectedSizeBytes,
    );
  }
}
