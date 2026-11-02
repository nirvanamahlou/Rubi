import {
  BadRequestException,
  ForbiddenException,
  Inject,
  Injectable,
  ServiceUnavailableException,
  type OnModuleInit,
  type OnModuleDestroy,
} from '@nestjs/common';
import {
  canViewIntegrationSection,
  type AuthenticatedActor,
} from '@nora/contracts';
import { IntegrationRegistryService } from './integration-registry.service';
import { GhestirooStore, type GhestirooConfig } from './ghestiroo.store';
import { ghestirooOrigin, ghestirooRequest } from './ghestiroo.client';
import { GhestirooRenewal } from './ghestiroo.renewal';

@Injectable()
export class GhestirooService implements OnModuleInit, OnModuleDestroy {
  readonly store = new GhestirooStore();
  readonly renewal = new GhestirooRenewal(this.store);
  onModuleInit() {
    this.renewal.start();
  }
  onModuleDestroy() {
    this.renewal.stop();
  }
  constructor(
    @Inject(IntegrationRegistryService)
    private readonly registry: IntegrationRegistryService,
  ) {}
  private async authorize(
    actor: AuthenticatedActor,
    branch: string,
    manage = false,
  ) {
    await this.registry.read(
      actor,
      branch,
      manage ? 'settings' : 'connections',
    );
    if (manage && !this.registry.canManage(actor))
      throw new ForbiddenException();
  }
  async status(actor: AuthenticatedActor, branch: string) {
    await this.authorize(actor, branch);
    const config = this.store.ready() ? await this.store.read(branch) : null;
    return {
      configured: !!config,
      storageReady: this.store.ready(),
      canManage: this.registry.canManage(actor),
      version: config?.version ?? 0,
      ...(config
        ? {
            origin: config.origin,
            connectionId: config.connectionId,
            expiresAt: config.expiresAt,
            scopes: config.scopes,
            autoRenewal: true,
            lastRenewedAt: config.lastRenewedAt,
            renewalState:
              Date.parse(config.expiresAt) <= Date.now()
                ? 'expired'
                : config.renewalRetryAt
                  ? 'retrying'
                  : config.pendingRenewal
                    ? 'pending'
                    : 'active',
            allowedUserIds: this.registry.canManage(actor)
              ? config.allowedUserIds
              : undefined,
          }
        : {}),
    };
  }
  async save(
    actor: AuthenticatedActor,
    branch: string,
    input: unknown,
    requestOrigin: string | undefined,
  ) {
    await this.authorize(actor, branch, true);
    try {
      if (!input || typeof input !== 'object') throw Error();
      const value = input as Record<string, unknown>;
      if (
        Object.keys(value).some(
          (k) => !['bundle', 'allowedUserIds', 'expectedVersion'].includes(k),
        ) ||
        typeof value.bundle !== 'string' ||
        value.bundle.length > 8000 ||
        !Number.isSafeInteger(value.expectedVersion) ||
        Number(value.expectedVersion) < 0 ||
        !Array.isArray(value.allowedUserIds) ||
        !value.allowedUserIds.length ||
        value.allowedUserIds.length > 100 ||
        value.allowedUserIds.some(
          (v) => typeof v !== 'string' || !/^[a-f0-9-]{36}$/i.test(v),
        )
      )
        throw Error();
      const config = JSON.parse(value.bundle) as GhestirooConfig;
      if (
        Object.keys(config).some(
          (k) =>
            ![
              'contract',
              'origin',
              'noraOrigin',
              'connectionId',
              'apiKey',
              'expiresAt',
              'scopes',
            ].includes(k),
        ) ||
        config.contract !== 'ghestiroo.nora.v1' ||
        !requestOrigin ||
        config.noraOrigin !== requestOrigin ||
        !/^[a-f0-9]{32}$/.test(config.connectionId) ||
        !/^[A-Za-z0-9_-]{64}$/.test(config.apiKey) ||
        !Array.isArray(config.scopes) ||
        !config.scopes.length ||
        config.scopes.some(
          (s) =>
            !['catalog', 'customers', 'requests', 'cases', 'admin'].includes(s),
        ) ||
        !Number.isFinite(Date.parse(config.expiresAt)) ||
        Date.parse(config.expiresAt) <= Date.now()
      )
        throw Error();
      ghestirooOrigin(config.origin);
      ghestirooOrigin(config.noraOrigin);
      await this.store.write(
        branch,
        {
          ...config,
          allowedUserIds: [...new Set(value.allowedUserIds as string[])],
          version: 0,
        },
        value.expectedVersion as number,
      );
    } catch (e) {
      if (
        e instanceof ServiceUnavailableException ||
        (e as { status?: number }).status === 409
      )
        throw e;
      throw new BadRequestException('بسته اتصال یا فهرست کاربران معتبر نیست.');
    }
    return this.status(actor, branch);
  }
  async run(
    actor: AuthenticatedActor,
    branch: string,
    operation: string,
    after = '',
  ) {
    await this.authorize(actor, branch);
    if (operation === 'admin-grants' && !this.registry.canManage(actor))
      throw new ForbiddenException(
        'ورود مدیریت به مجوز تنظیمات اتصال نیاز دارد.',
      );
    if (!canViewIntegrationSection(actor.permissions, 'connections'))
      throw new ForbiddenException();
    let config = await this.store.read(branch);
    if (
      !config ||
      !config.allowedUserIds.includes(actor.userId) ||
      (operation !== 'capabilities' &&
        !config.scopes.includes(
          operation === 'admin-grants' ? 'admin' : operation,
        ))
    )
      throw new ForbiddenException('این حساب برای این اتصال مجاز نیست.');
    config = await this.renewal.ensure(branch);
    if (
      !config ||
      !config.allowedUserIds.includes(actor.userId) ||
      (operation !== 'capabilities' &&
        !config.scopes.includes(
          operation === 'admin-grants' ? 'admin' : operation,
        ))
    )
      throw new ForbiddenException('این حساب برای این اتصال مجاز نیست.');
    if (Date.parse(config.expiresAt) <= Date.now())
      throw new ServiceUnavailableException('کلید اتصال منقضی شده است.');
    let data: Record<string, unknown>;
    try {
      data = await ghestirooRequest(config, operation, after);
    } catch (e) {
      const updated =
        e instanceof Error && e.message === 'UPSTREAM_401'
          ? await this.renewal.ensure(branch, true)
          : null;
      if (
        updated &&
        updated.allowedUserIds.includes(actor.userId) &&
        updated.apiKey !== config.apiKey &&
        (operation === 'capabilities' ||
          updated.scopes.includes(
            operation === 'admin-grants' ? 'admin' : operation,
          ))
      ) {
        config = updated;
        try {
          data = await ghestirooRequest(updated, operation, after);
        } catch {
          throw new ServiceUnavailableException(
            'آزمون ارتباط ناموفق بود؛ آدرس، اعتبار کلید و دسترسی سرور را بررسی کنید.',
          );
        }
      } else
        throw new ServiceUnavailableException(
          'آزمون ارتباط ناموفق بود؛ آدرس، اعتبار کلید و دسترسی سرور را بررسی کنید.',
        );
    }
    if (operation === 'admin-grants') {
      if (
        typeof data.token !== 'string' ||
        !/^[A-Za-z0-9_-]{64}$/.test(data.token) ||
        data.expiresIn !== 60
      )
        throw new ServiceUnavailableException('پاسخ ورود معتبر نیست.');
      return {
        action: `${config.origin}/admin/nora-sso`,
        token: data.token,
        expiresIn: 60,
      };
    }
    if (
      operation === 'capabilities' &&
      data.connectionId !== config.connectionId
    )
      throw new ServiceUnavailableException('هویت اتصال تطبیق ندارد.');
    return data;
  }
}
