import { createCipheriv, createDecipheriv, randomBytes } from 'node:crypto';
import { mkdir, open, readFile, readdir, link, unlink } from 'node:fs/promises';
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
  pendingRenewal?: { apiKey: string };
  lastRenewedAt?: string;
  renewalRetryAt?: string;
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
    let path = this.location(branch);
    const versions = await this.files();
    const latest = versions
      .filter((name) => name.startsWith(`${branch}.v`))
      .map((name) => ({
        name,
        version: Number(name.slice(branch.length + 2, -5)),
      }))
      .filter((row) => Number.isSafeInteger(row.version) && row.version > 1)
      .sort((a, b) => b.version - a.version)[0];
    if (latest)
      path = join(resolve(process.env.NORA_GHESTIROO_CONFIG_DIR!), latest.name);
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
  private async files() {
    if (!this.ready()) return [];
    try {
      return await readdir(resolve(process.env.NORA_GHESTIROO_CONFIG_DIR!));
    } catch (e) {
      if ((e as NodeJS.ErrnoException).code === 'ENOENT') return [];
      throw e;
    }
  }
  async branches() {
    return (await this.files())
      .filter((name) => /^[a-f0-9-]{36}\.json$/i.test(name))
      .map((name) => name.slice(0, -5));
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
    if (
      !Number.isSafeInteger(expectedVersion) ||
      expectedVersion < 0 ||
      expectedVersion >= Number.MAX_SAFE_INTEGER
    )
      throw new ConflictException();
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
      // Publish a complete encrypted version with atomic no-overwrite semantics.
      // No persistent lock survives a crash, and competing writers cannot replace
      // the same version. The legacy file remains readable during migration.
      try {
        await link(
          temporary,
          expectedVersion === 0
            ? path
            : path.replace(/\.json$/, `.v${expectedVersion + 1}.json`),
        );
      } catch (e) {
        if ((e as NodeJS.ErrnoException).code === 'EEXIST')
          throw new ConflictException(
            'تنظیمات تغییر کرده است؛ دوباره بارگذاری کنید.',
          );
        throw e;
      }
      if (process.platform !== 'win32') {
        const directory = await open(
          resolve(process.env.NORA_GHESTIROO_CONFIG_DIR!),
          'r',
        );
        try {
          await directory.sync();
        } finally {
          await directory.close();
        }
      }
    } finally {
      await unlink(temporary).catch(() => undefined);
    }
  }
}
