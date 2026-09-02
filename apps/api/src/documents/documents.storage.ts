import { createCipheriv, createDecipheriv, randomBytes } from 'node:crypto';
import { mkdir, readFile, rm, writeFile } from 'node:fs/promises';
import { dirname, resolve, sep } from 'node:path';
import { Readable } from 'node:stream';

import { Inject, Injectable } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';

import { validateStorageObjectKey } from './documents.validation';

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

  async putQuarantined(objectKey: string, contents: Buffer): Promise<void> {
    const target = this.pathFor(objectKey);
    const iv = randomBytes(12);
    const cipher = createCipheriv('aes-256-gcm', this.encryptionKey, iv);
    cipher.setAAD(Buffer.from(objectKey, 'utf8'));
    const encrypted = Buffer.concat([cipher.update(contents), cipher.final()]);
    const stored = Buffer.concat([
      Buffer.from('RUBIDOC1', 'ascii'),
      iv,
      cipher.getAuthTag(),
      encrypted,
    ]);
    await mkdir(dirname(target), { recursive: true, mode: 0o700 });
    await writeFile(target, stored, { flag: 'wx', mode: 0o600 });
  }

  async removeQuarantined(objectKey: string): Promise<void> {
    await rm(this.pathFor(objectKey), { force: true });
  }

  async openQuarantined(
    objectKey: string,
    expectedSizeBytes: number,
  ): Promise<Readable> {
    return Readable.from(
      await this.readQuarantined(objectKey, expectedSizeBytes),
    );
  }

  async readQuarantined(
    objectKey: string,
    expectedSizeBytes: number,
  ): Promise<Buffer> {
    const target = this.pathFor(objectKey);
    const stored = await readFile(target);
    if (
      stored.length < 36 ||
      stored.subarray(0, 8).toString('ascii') !== 'RUBIDOC1'
    ) {
      throw new Error('Stored document failed integrity verification.');
    }
    const decipher = createDecipheriv(
      'aes-256-gcm',
      this.encryptionKey,
      stored.subarray(8, 20),
    );
    decipher.setAAD(Buffer.from(objectKey, 'utf8'));
    decipher.setAuthTag(stored.subarray(20, 36));
    const contents = Buffer.concat([
      decipher.update(stored.subarray(36)),
      decipher.final(),
    ]);
    if (contents.length !== expectedSizeBytes) {
      throw new Error('Stored document failed integrity verification.');
    }
    return contents;
  }
}
