import { randomBytes } from 'node:crypto';
import {
  SiteConnectionStore,
  type SiteStoredConnection,
} from './site-connection.store';
import { jahanRequest, JAHAN_CONTRACT } from './jahan-bastan.client';

/** One durable candidate per rotation; CAS coordinates independent API processes. */
export class JahanRenewal {
  private timer: ReturnType<typeof setInterval> | undefined;
  private sweeping = false;
  constructor(private readonly store = new SiteConnectionStore()) {}
  start() {
    this.timer ??= setInterval(() => void this.sweep(), 3600000);
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
      for (const scope of await this.store.scopes()) {
        try {
          await this.ensure(scope.branch, scope.site);
        } catch {
          /* Isolate failures; no credential logs. */
        }
      }
    } catch {
      /* A temporarily unavailable storage directory must not crash the API. */
    } finally {
      this.sweeping = false;
    }
  }
  async ensure(
    branch: string,
    site: string,
    forceRetry = false,
    controlAttempt = 0,
  ): Promise<SiteStoredConnection | null> {
    let config = await this.store.read(branch, site);
    if (config?.jahan?.lifecyclePending) {
      const actorId = config.jahan.actorId;
      const control = config.jahan.lifecyclePending;
      try {
        let remote = {
          ...config,
          jahan: { ...config.jahan, state: 'ACTIVE' as const },
        };
        const send = () =>
          jahanRequest(remote, actorId, '/api/v1/integration/lifecycle', {
            method: 'POST',
            body: JSON.stringify(control),
          });
        const recoverKey = async () => {
          try {
            return await send();
          } catch (error) {
            if (
              !(error instanceof Error) ||
              error.message !== 'UPSTREAM_401' ||
              !config!.jahan!.pendingRenewal
            )
              throw error;
            remote = { ...remote, secret: config!.jahan!.pendingRenewal };
            return send();
          }
        };
        let result: Record<string, unknown>;
        try {
          result = await recoverKey();
        } catch (error) {
          if (
            !(error instanceof Error) ||
            error.message !== 'UPSTREAM_409' ||
            controlAttempt !== 0
          )
            throw error;
          const current = await jahanRequest(
            remote,
            config.jahan.actorId,
            '/api/v1/integration/capabilities',
          );
          if (
            current.contract !== JAHAN_CONTRACT ||
            current.connectionId !== config.jahan.connectionId ||
            !Number.isSafeInteger(current.version)
          )
            throw Error('INVALID_IDENTITY');
          await this.store.write(
            branch,
            site,
            {
              ...config,
              jahan: {
                ...config.jahan,
                lifecyclePending: {
                  ...config.jahan.lifecyclePending,
                  expectedVersion: Number(current.version),
                },
              },
            },
            config.version,
          );
          return this.ensure(branch, site, true, 1);
        }
        if (
          result.contract !== JAHAN_CONTRACT ||
          result.connectionId !== config.jahan.connectionId ||
          result.siteId !== 'jahan-bastan' ||
          (result.state !==
            (config.jahan.lifecyclePending.action === 'delete'
              ? 'DELETED'
              : 'DISCONNECTED') &&
            !(
              config.jahan.lifecyclePending.action === 'disconnect' &&
              result.state === 'DELETED'
            ))
        )
          throw Error('INVALID_LIFECYCLE');
        const jahan = {
          ...config.jahan,
          state: result.state as 'DELETED' | 'DISCONNECTED',
          remoteVersion: Number(result.version),
        };
        delete jahan.lifecyclePending;
        delete jahan.pendingRenewal;
        await this.store.write(
          branch,
          site,
          { ...config, secret: remote.secret, jahan },
          config.version,
        );
      } catch {
        /* Durable pending control operation is retried without claiming remote completion. */
      }
      return this.store.read(branch, site);
    }
    if (
      config?.protocol !== JAHAN_CONTRACT ||
      !config.jahan ||
      config.jahan.state !== 'ACTIVE'
    )
      return config;
    if (!config.jahan.pendingRenewal) {
      if (
        Date.parse(config.jahan.expiresAt) <= Date.now() ||
        Date.parse(config.jahan.expiresAt) - Date.now() > 14 * 86400000
      )
        return config;
      try {
        await this.store.write(
          branch,
          site,
          {
            ...config,
            jahan: {
              ...config.jahan,
              pendingRenewal: randomBytes(48).toString('base64url'),
            },
          },
          config.version,
        );
      } catch (error) {
        if ((error as { status?: number }).status !== 409) throw error;
      }
      config = await this.store.read(branch, site);
    }
    if (!config?.jahan?.pendingRenewal || config.jahan.state !== 'ACTIVE')
      return config;
    if (
      !forceRetry &&
      config.jahan.renewalRetryAt &&
      Date.parse(config.jahan.renewalRetryAt) > Date.now()
    )
      return config;
    const candidate = config.jahan.pendingRenewal;
    try {
      let result: Record<string, unknown>;
      const options = {
        method: 'POST',
        body: JSON.stringify({ nextApiKey: candidate }),
      };
      try {
        result = await jahanRequest(
          config,
          config.jahan.actorId,
          '/api/v1/integration/renew',
          options,
        );
      } catch (error) {
        if (!(error instanceof Error) || error.message !== 'UPSTREAM_401')
          throw error;
        result = await jahanRequest(
          { ...config, secret: candidate },
          config.jahan.actorId,
          '/api/v1/integration/renew',
          options,
        );
      }
      if (
        result.contract !== JAHAN_CONTRACT ||
        result.siteId !== 'jahan-bastan' ||
        result.organizationId !== config.organization ||
        result.environment !== config.environment ||
        result.connectionId !== config.jahan.connectionId ||
        result.noraOrigin !== config.jahan.noraOrigin ||
        result.renewal !== 'rotate.v1' ||
        typeof result.expiresAt !== 'string' ||
        !Number.isFinite(Date.parse(result.expiresAt)) ||
        Date.parse(result.expiresAt) <= Date.now() ||
        Date.parse(result.expiresAt) > Date.now() + 91 * 86400000 ||
        !Number.isSafeInteger(result.version) ||
        !Array.isArray(result.resources) ||
        result.resources.some(
          (r) => !config!.jahan!.resources.includes(String(r)),
        )
      )
        throw Error('INVALID_RENEWAL');
      const jahan = {
        ...config.jahan,
        expiresAt: result.expiresAt,
        remoteVersion: Number(result.version),
        resources: result.resources as string[],
        lastRenewedAt: new Date().toISOString(),
      };
      delete jahan.pendingRenewal;
      delete jahan.renewalRetryAt;
      await this.store.write(
        branch,
        site,
        { ...config, secret: candidate, jahan },
        config.version,
      );
    } catch {
      try {
        await this.store.write(
          branch,
          site,
          {
            ...config,
            jahan: {
              ...config.jahan,
              renewalRetryAt: new Date(Date.now() + 3600000).toISOString(),
            },
          },
          config.version,
        );
      } catch {
        /* Concurrent save wins. */
      }
    }
    return this.store.read(branch, site);
  }
}
