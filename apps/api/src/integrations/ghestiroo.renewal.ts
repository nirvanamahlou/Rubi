import { randomBytes } from 'node:crypto';
import type { GhestirooStore, GhestirooConfig } from './ghestiroo.store';
import { ghestirooRequest } from './ghestiroo.client';

const DAY = 86400000;
const HOUR = 3600000;

/** Durable client-chosen rotation; retries never need a plaintext upstream key. */
export class GhestirooRenewal {
  private timer: ReturnType<typeof setInterval> | undefined;
  private sweeping = false;
  constructor(private readonly store: GhestirooStore) {}
  start() {
    if (this.timer) return;
    this.timer = setInterval(() => void this.sweep(), HOUR);
    this.timer.unref();
    void this.sweep();
  }
  stop() {
    if (this.timer) clearInterval(this.timer);
    this.timer = undefined;
  }
  async sweep() {
    if (this.sweeping || !this.store.ready()) return;
    this.sweeping = true;
    try {
      for (const branch of await this.store.branches()) {
        try {
          await this.ensure(branch);
        } catch {
          /* Isolate corrupt/unavailable branches; never log credentials. */
        }
      }
    } catch {
      /* Storage may be temporarily unavailable during maintenance. */
    } finally {
      this.sweeping = false;
    }
  }
  async ensure(
    branch: string,
    forceRetry = false,
  ): Promise<GhestirooConfig | null> {
    let config = await this.store.read(branch);
    if (!config) return null;
    if (
      !forceRetry &&
      config.renewalRetryAt &&
      Date.parse(config.renewalRetryAt) > Date.now()
    )
      return config;
    if (!config.pendingRenewal) {
      if (Date.parse(config.expiresAt) <= Date.now()) return config;
      if (
        config.lastRenewedAt &&
        Date.parse(config.expiresAt) - Date.now() > 14 * DAY
      )
        return config;
      try {
        await this.store.write(
          branch,
          {
            ...config,
            pendingRenewal: { apiKey: randomBytes(48).toString('base64url') },
          },
          config.version,
        );
      } catch (e) {
        if ((e as { status?: number }).status !== 409) throw e;
      }
      config = await this.store.read(branch);
      if (!config?.pendingRenewal) return config;
    }
    const candidate = config.pendingRenewal.apiKey;
    try {
      let response: Record<string, unknown>;
      try {
        response = await ghestirooRequest(config, 'renew', '', candidate);
      } catch (e) {
        if (!(e instanceof Error) || e.message !== 'UPSTREAM_401') throw e;
        // The site may already have committed the candidate before a lost reply
        // or local restart. The same candidate only acknowledges that rotation.
        response = await ghestirooRequest(
          { ...config, apiKey: candidate },
          'renew',
          '',
          candidate,
        );
      }
      if (
        response.contract !== config.contract ||
        response.renewal !== 'rotate.v1' ||
        response.connectionId !== config.connectionId ||
        response.noraOrigin !== config.noraOrigin ||
        typeof response.expiresAt !== 'string' ||
        !Number.isFinite(Date.parse(response.expiresAt)) ||
        Date.parse(response.expiresAt) <= Date.now() ||
        Date.parse(response.expiresAt) > Date.now() + 91 * DAY ||
        !Array.isArray(response.scopes) ||
        response.scopes.some(
          (s) => typeof s !== 'string' || !config!.scopes.includes(s),
        )
      )
        throw Error('INVALID_RENEWAL');
      const renewed: GhestirooConfig = {
        ...config,
        apiKey: candidate,
        expiresAt: response.expiresAt,
        scopes: response.scopes as string[],
        lastRenewedAt: new Date().toISOString(),
      };
      delete renewed.pendingRenewal;
      delete renewed.renewalRetryAt;
      await this.store.write(branch, renewed, config.version);
    } catch {
      // Keep the durable candidate on any ambiguous failure. It is never replaced
      // by a new random key until this rotation has been acknowledged.
      try {
        await this.store.write(
          branch,
          {
            ...config,
            renewalRetryAt: new Date(Date.now() + HOUR).toISOString(),
          },
          config.version,
        );
      } catch {
        /* A concurrent rotation or owner save wins; do not overwrite it. */
      }
    }
    return this.store.read(branch);
  }
}
