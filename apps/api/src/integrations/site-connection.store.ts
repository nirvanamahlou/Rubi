import {
  createCipheriv,
  createDecipheriv,
  createHash,
  hkdfSync,
  randomBytes,
} from 'node:crypto';
import { mkdir, open, readFile, readdir, link, unlink } from 'node:fs/promises';
import { join, resolve } from 'node:path';
import { ConflictException, ServiceUnavailableException } from '@nestjs/common';
import type { NiyayeshConnection } from './niyayesh.client';

export type SiteStoredConnection = NiyayeshConnection & {
  version: number;
  updatedAt: string;
};
const purpose = 'nora.integrations.site-connection.v1';

/** Adapter-owned persistent storage; no site credentials enter the registry. */
export class SiteConnectionStore {
  private directory() {
    const explicit = process.env.NORA_SITE_CONNECTIONS_CONFIG_DIR;
    const fallback = process.env.NORA_GHESTIROO_CONFIG_DIR;
    return explicit
      ? resolve(explicit)
      : fallback
        ? join(resolve(fallback), 'sites')
        : null;
  }
  private masterKey() {
    return (
      process.env.NORA_SITE_CONNECTIONS_STORAGE_KEY ??
      process.env.NORA_GHESTIROO_STORAGE_KEY ??
      ''
    );
  }
  ready() {
    return !!this.directory() && /^[A-Za-z0-9+/]{43}=$/.test(this.masterKey());
  }
  private scope(branch: string, site: string) {
    if (!/^[a-f\d-]{36}$/i.test(branch) || !/^[a-z\d-]{1,80}$/i.test(site))
      throw new ServiceUnavailableException('شناسه اتصال معتبر نیست.');
    if (!this.ready())
      throw new ServiceUnavailableException(
        'نگهداری امن اتصال روی سرور آماده نیست.',
      );
    const aad = Buffer.from(`${purpose}\0${branch}\0${site}`);
    return {
      directory: this.directory()!,
      aad,
      prefix: createHash('sha256').update(aad).digest('hex'),
    };
  }
  private key() {
    return Buffer.from(
      hkdfSync(
        'sha256',
        Buffer.from(this.masterKey(), 'base64'),
        Buffer.from(purpose),
        Buffer.from('credential encryption'),
        32,
      ),
    );
  }
  async read(
    branch: string,
    site: string,
  ): Promise<SiteStoredConnection | null> {
    const scope = this.scope(branch, site);
    try {
      let files: string[];
      try {
        files = await readdir(scope.directory);
      } catch (error) {
        if ((error as NodeJS.ErrnoException).code === 'ENOENT') return null;
        throw error;
      }
      const latest = files
        .map((name) => {
          const match = new RegExp(
            `^${scope.prefix}\\.v([1-9][0-9]*)\\.json$`,
          ).exec(name);
          return match ? { name, version: Number(match[1]) } : null;
        })
        .filter(
          (item): item is { name: string; version: number } =>
            !!item && Number.isSafeInteger(item.version),
        )
        .sort((a, b) => b.version - a.version)[0];
      if (!latest) return null;
      const raw = await readFile(join(scope.directory, latest.name), 'utf8');
      if (raw.length > 65536) throw Error();
      const envelope = JSON.parse(raw) as {
        iv: string;
        tag: string;
        data: string;
      };
      const cipher = createDecipheriv(
        'aes-256-gcm',
        this.key(),
        Buffer.from(envelope.iv, 'base64'),
      );
      cipher.setAAD(scope.aad);
      cipher.setAuthTag(Buffer.from(envelope.tag, 'base64'));
      const value = JSON.parse(
        Buffer.concat([
          cipher.update(Buffer.from(envelope.data, 'base64')),
          cipher.final(),
        ]).toString(),
      ) as SiteStoredConnection;
      if (
        value.registrySystemId !== site ||
        value.version !== latest.version ||
        !Array.isArray(value.users) ||
        typeof value.secret !== 'string'
      )
        throw Error();
      return value;
    } catch {
      throw new ServiceUnavailableException(
        'خواندن اطلاعات رمز‌شده اتصال ممکن نیست.',
      );
    }
  }
  async write(
    branch: string,
    site: string,
    config: SiteStoredConnection,
    expectedVersion: number,
  ) {
    const scope = this.scope(branch, site);
    if (
      !Number.isSafeInteger(expectedVersion) ||
      expectedVersion < 0 ||
      expectedVersion >= Number.MAX_SAFE_INTEGER
    )
      throw new ConflictException('نسخه اتصال معتبر نیست.');
    await mkdir(scope.directory, { recursive: true, mode: 0o700 });
    const current = await this.read(branch, site);
    if ((current?.version ?? 0) !== expectedVersion)
      throw new ConflictException(
        'اتصال تغییر کرده است؛ دوباره بارگذاری کنید.',
      );
    const path = join(
      scope.directory,
      `${scope.prefix}.v${expectedVersion + 1}.json`,
    );
    const temporary = `${path}.${randomBytes(8).toString('hex')}.tmp`;
    try {
      const iv = randomBytes(12);
      const cipher = createCipheriv('aes-256-gcm', this.key(), iv);
      cipher.setAAD(scope.aad);
      const bytes = Buffer.concat([
        cipher.update(
          JSON.stringify({
            ...config,
            registrySystemId: site,
            version: expectedVersion + 1,
          }),
        ),
        cipher.final(),
      ]);
      const file = await open(temporary, 'wx', 0o600);
      try {
        await file.writeFile(
          JSON.stringify({
            iv: iv.toString('base64'),
            tag: cipher.getAuthTag().toString('base64'),
            data: bytes.toString('base64'),
          }),
        );
        await file.sync();
      } finally {
        await file.close();
      }
      try {
        await link(temporary, path);
      } catch (error) {
        if ((error as NodeJS.ErrnoException).code === 'EEXIST')
          throw new ConflictException(
            'اتصال تغییر کرده است؛ دوباره بارگذاری کنید.',
          );
        throw error;
      }
      if (process.platform !== 'win32') {
        const dir = await open(scope.directory, 'r');
        try {
          await dir.sync();
        } finally {
          await dir.close();
        }
      }
    } finally {
      await unlink(temporary).catch(() => undefined);
    }
  }
}
