import { createCipheriv, createDecipheriv, randomBytes } from 'node:crypto';
import { mkdir, open, readFile, rename, unlink } from 'node:fs/promises';
import { resolve, join } from 'node:path';
import { ConflictException, ServiceUnavailableException } from '@nestjs/common';

export interface GhestirooConfig {
  contract: 'ghestiroo.nora.v1';
  origin: string;
  noraOrigin: string;
  connectionId: string;
  apiKey: string;
  expiresAt: string;
  scopes: string[];
  allowedUserIds: string[];
  version: number;
}

export class GhestirooStore {
  ready() {
    return (
      !!process.env.NORA_GHESTIROO_CONFIG_DIR &&
      /^[A-Za-z0-9+/]{43}=$/.test(process.env.NORA_GHESTIROO_STORAGE_KEY ?? '')
    );
  }
  private location(branch: string) {
    if (!this.ready())
      throw new ServiceUnavailableException(
        'مسیر امن و کلید نگهداری اتصال روی سرور تنظیم نشده است.',
      );
    if (!/^[a-f0-9-]{36}$/i.test(branch)) throw new Error('INVALID_BRANCH');
    return join(
      resolve(process.env.NORA_GHESTIROO_CONFIG_DIR!),
      `${branch}.json`,
    );
  }
  async read(branch: string): Promise<GhestirooConfig | null> {
    const path = this.location(branch);
    let value: string;
    try {
      value = await readFile(path, 'utf8');
    } catch (e) {
      if ((e as NodeJS.ErrnoException).code === 'ENOENT') return null;
      throw e;
    }
    try {
      const envelope = JSON.parse(value) as {
        iv: string;
        tag: string;
        data: string;
      };
      const cipher = createDecipheriv(
        'aes-256-gcm',
        Buffer.from(process.env.NORA_GHESTIROO_STORAGE_KEY!, 'base64'),
        Buffer.from(envelope.iv, 'base64'),
      );
      cipher.setAAD(Buffer.from(branch));
      cipher.setAuthTag(Buffer.from(envelope.tag, 'base64'));
      return JSON.parse(
        Buffer.concat([
          cipher.update(Buffer.from(envelope.data, 'base64')),
          cipher.final(),
        ]).toString(),
      ) as GhestirooConfig;
    } catch {
      throw new ServiceUnavailableException(
        'خواندن تنظیمات رمز‌شده اتصال ممکن نیست.',
      );
    }
  }
  async write(
    branch: string,
    config: GhestirooConfig,
    expectedVersion: number,
  ) {
    const path = this.location(branch);
    await mkdir(resolve(process.env.NORA_GHESTIROO_CONFIG_DIR!), {
      recursive: true,
      mode: 0o700,
    });
    let lock;
    try {
      lock = await open(`${path}.lock`, 'wx', 0o600);
    } catch {
      throw new ConflictException(
        'تنظیمات در حال تغییر است؛ دوباره تلاش کنید.',
      );
    }
    const temporary = `${path}.${randomBytes(8).toString('hex')}.tmp`;
    try {
      const current = await this.read(branch);
      if ((current?.version ?? 0) !== expectedVersion)
        throw new ConflictException(
          'تنظیمات تغییر کرده است؛ دوباره بارگذاری کنید.',
        );
      const iv = randomBytes(12);
      const cipher = createCipheriv(
        'aes-256-gcm',
        Buffer.from(process.env.NORA_GHESTIROO_STORAGE_KEY!, 'base64'),
        iv,
      );
      cipher.setAAD(Buffer.from(branch));
      const data = Buffer.concat([
        cipher.update(
          JSON.stringify({ ...config, version: expectedVersion + 1 }),
        ),
        cipher.final(),
      ]);
      const file = await open(temporary, 'wx', 0o600);
      try {
        await file.writeFile(
          JSON.stringify({
            iv: iv.toString('base64'),
            tag: cipher.getAuthTag().toString('base64'),
            data: data.toString('base64'),
          }),
        );
        await file.sync();
      } finally {
        await file.close();
      }
      await rename(temporary, path);
    } finally {
      await unlink(temporary).catch(() => undefined);
      await lock.close();
      await unlink(`${path}.lock`);
    }
  }
}
