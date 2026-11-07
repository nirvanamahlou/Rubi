import {
  BadRequestException,
  ConflictException,
  ForbiddenException,
  NotFoundException,
  ServiceUnavailableException,
} from '@nestjs/common';
import type { AuthenticatedActor } from '@nora/contracts';
import type { IntegrationRegistryService } from './integration-registry.service';
import { SiteConnectionStore } from './site-connection.store';
import { siteConnectionInput } from './site-connection.validation';
import {
  JAHAN_CONTRACT,
  JAHAN_RESOURCES,
  jahanRequest,
} from './jahan-bastan.client';
import { JahanRenewal } from './jahan-bastan.renewal';

/** Dedicated contract bound to the selected registry site and existing Nora IAM. */
export class JahanConnectionService {
  readonly store = new SiteConnectionStore();
  readonly renewal = new JahanRenewal(this.store);
  constructor(private readonly registry: IntegrationRegistryService) {}
  async authorize(
    actor: AuthenticatedActor,
    branch: string,
    site: string,
    manage = false,
  ) {
    const registry = await this.registry.read(actor, branch, 'connections');
    const system = registry.systems.find(
      (s) => s.id === site && s.lifecycle === 'ENABLED',
    );
    const brand = registry.brands.find(
      (b) => b.id === system?.brandId && b.lifecycle === 'ENABLED',
    );
    if (!system || brand?.code !== 'jahan-bastan')
      throw new NotFoundException('این قرارداد فقط برای جهان باستان است.');
    if (manage && !this.registry.canManage(actor))
      throw new ForbiddenException();
  }
  async save(
    actor: AuthenticatedActor,
    branch: string,
    site: string,
    input: unknown,
    requestOrigin: string | undefined,
  ) {
    await this.authorize(actor, branch, site, true);
    const value = input as { bundle?: unknown; expectedVersion?: unknown };
    if (
      !value ||
      typeof value !== 'object' ||
      Array.isArray(value) ||
      Object.keys(value).some(
        (k) => !['bundle', 'expectedVersion'].includes(k),
      ) ||
      typeof value.bundle !== 'string' ||
      value.bundle.length > 16000 ||
      !Number.isSafeInteger(value.expectedVersion) ||
      Number(value.expectedVersion) < 0
    )
      throw new BadRequestException();
    let bundle: Record<string, unknown>;
    let syntheticLocal = false;
    try {
      bundle = JSON.parse(value.bundle) as Record<string, unknown>;
      if (
        !bundle ||
        Array.isArray(bundle) ||
        Object.keys(bundle).some(
          (k) =>
            ![
              'contract',
              'siteId',
              'organizationId',
              'environment',
              'connectionId',
              'noraOrigin',
              'resources',
              'expiresAt',
              'version',
              'createdAt',
              'lastRenewedAt',
              'state',
              'origin',
              'apiBase',
              'apiKey',
              'signingKey',
            ].includes(k),
        ) ||
        bundle.contract !== JAHAN_CONTRACT ||
        bundle.siteId !== 'jahan-bastan' ||
        bundle.apiBase !== '/api/v1/integration/nora/v1' ||
        bundle.noraOrigin !== requestOrigin ||
        !requestOrigin ||
        typeof bundle.origin !== 'string' ||
        !/^[a-f\d-]{36}$/i.test(String(bundle.organizationId)) ||
        !/^[a-f\d]{32}$/.test(String(bundle.connectionId)) ||
        !['development', 'test', 'staging', 'production'].includes(
          String(bundle.environment),
        ) ||
        !/^[A-Za-z0-9_-]{64}$/.test(String(bundle.apiKey)) ||
        !/^[A-Za-z0-9_-]{64}$/.test(String(bundle.signingKey)) ||
        !Array.isArray(bundle.resources) ||
        !bundle.resources.length ||
        bundle.resources.some((r) => !JAHAN_RESOURCES.includes(String(r))) ||
        !Number.isSafeInteger(bundle.version) ||
        Number(bundle.version) < 1 ||
        typeof bundle.expiresAt !== 'string' ||
        !Number.isFinite(Date.parse(bundle.expiresAt)) ||
        Date.parse(bundle.expiresAt) <= Date.now() ||
        Date.parse(bundle.expiresAt) > Date.now() + 91 * 86400000 ||
        bundle.state !== 'ACTIVE'
      )
        throw Error();
      const destination = new URL(String(bundle.origin));
      syntheticLocal =
        process.env.NODE_ENV === 'test' &&
        process.env.NORA_JAHAN_SYNTHETIC_CONTRACT === '1' &&
        bundle.environment === 'test' &&
        destination.protocol === 'http:' &&
        destination.hostname === '127.0.0.1' &&
        !destination.username &&
        !destination.password &&
        !destination.search &&
        !destination.hash &&
        destination.pathname === '/';
      siteConnectionInput({
        origin: syntheticLocal
          ? 'https://synthetic.example.test'
          : bundle.origin,
        client: 'nora',
        system: 'jahan-bastan',
        organization: bundle.organizationId,
        environment: bundle.environment,
        keyId: bundle.connectionId,
        secret: bundle.apiKey,
        expectedVersion: value.expectedVersion,
      });
    } catch {
      throw new BadRequestException(
        'بسته اتصال جهان باستان معتبر نیست یا برای این نشانی نورا صادر نشده است.',
      );
    }
    const previous = await this.store.read(branch, site);
    if ((previous?.version ?? 0) !== value.expectedVersion)
      throw new ConflictException();
    const resources = bundle.resources as string[];
    await this.store.write(
      branch,
      site,
      {
        protocol: JAHAN_CONTRACT,
        origin: String(bundle.origin),
        local: syntheticLocal,
        registrySystemId: site,
        client: 'nora',
        system: 'jahan-bastan',
        organization: String(bundle.organizationId),
        environment: String(bundle.environment),
        keyId: String(bundle.connectionId),
        secret: String(bundle.apiKey),
        users: [],
        managedAccess: { branchIds: [branch], resources },
        version: 0,
        updatedAt: new Date().toISOString(),
        jahan: {
          siteId: 'jahan-bastan',
          connectionId: String(bundle.connectionId),
          branchId: branch,
          noraOrigin: String(bundle.noraOrigin),
          expiresAt: String(bundle.expiresAt),
          signingKey: String(bundle.signingKey),
          resources: bundle.resources as string[],
          actorId: actor.userId,
          remoteVersion: Number(bundle.version),
          state: 'ACTIVE',
        },
      },
      Number(value.expectedVersion),
    );
  }
  async test(actor: AuthenticatedActor, branch: string, site: string) {
    await this.authorize(actor, branch, site);
    const config = await this.renewal.ensure(branch, site);
    if (!config?.jahan)
      throw new BadRequestException('بسته اتصال این سایت ثبت نشده است.');
    let result: Record<string, unknown>;
    try {
      result = await jahanRequest(
        config,
        actor.userId,
        '/api/v1/integration/capabilities',
      );
    } catch {
      throw new ServiceUnavailableException(
        'جهان باستان پاسخ معتبر نداد؛ ذخیره تنظیمات به معنی اتصال موفق نیست.',
      );
    }
    if (
      result.contract !== JAHAN_CONTRACT ||
      result.siteId !== 'jahan-bastan' ||
      result.organizationId !== config.organization ||
      result.environment !== config.environment ||
      result.connectionId !== config.jahan.connectionId ||
      result.noraOrigin !== config.jahan.noraOrigin ||
      (result.actor as { subject?: string; branchId?: string })?.subject !==
        actor.userId ||
      (result.actor as { branchId?: string })?.branchId !== branch
    )
      throw new ServiceUnavailableException(
        'هویت سایت، کاربر یا شعبه تطبیق ندارد.',
      );
    return {
      state: 'CONNECTED',
      registrySystemId: site,
      checkedAt: new Date().toISOString(),
      resources: config.jahan.resources.map((code) => ({ code, title: code })),
    };
  }
  async lifecycle(
    actor: AuthenticatedActor,
    branch: string,
    site: string,
    input: unknown,
  ) {
    await this.authorize(actor, branch, site, true);
    const value = input as {
      action?: string;
      operationId?: string;
      expectedVersion?: number;
    };
    if (
      !value ||
      Object.keys(value).some(
        (k) => !['action', 'operationId', 'expectedVersion'].includes(k),
      ) ||
      !['disconnect', 'delete'].includes(value.action ?? '') ||
      !/^[a-f\d-]{36}$/i.test(value.operationId ?? '') ||
      !Number.isSafeInteger(value.expectedVersion)
    )
      throw new BadRequestException();
    const config = await this.store.read(branch, site);
    if (!config?.jahan || config.version !== value.expectedVersion)
      throw new ConflictException();
    if (config.jahan.lifecyclePending) {
      await this.renewal.ensure(branch, site);
      return;
    }
    const jahan = {
      ...config.jahan,
      actorId: actor.userId,
      state:
        value.action === 'delete'
          ? ('DELETED' as const)
          : ('DISCONNECTED' as const),
      lifecyclePending: {
        action: value.action as 'disconnect' | 'delete',
        operationId: value.operationId!,
        expectedVersion: config.jahan.remoteVersion,
      },
    };
    await this.store.write(branch, site, { ...config, jahan }, config.version);
    await this.renewal.ensure(branch, site);
  }
}
