import {
  BadRequestException,
  ForbiddenException,
  Inject,
  Injectable,
  ServiceUnavailableException,
  ConflictException,
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
    payload?: unknown,
    name = '',
  ) {
    await this.authorize(actor, branch);
    const scope =
      operation === 'admin-grants'
        ? 'admin'
        : ['workspace', 'presence'].includes(operation)
          ? 'catalog'
          : operation === 'dashboard'
            ? undefined
            : operation;
    const options = {
      actor: { subject: actor.userId, branch, name },
      ...(payload === undefined ? {} : { payload }),
    };
    if (!canViewIntegrationSection(actor.permissions, 'connections'))
      throw new ForbiddenException();
    let config = await this.store.read(branch);
    if (
      !config ||
      (operation !== 'capabilities' && scope && !config.scopes.includes(scope))
    )
      throw new ForbiddenException('این حساب برای این اتصال مجاز نیست.');
    config = await this.renewal.ensure(branch);
    if (
      !config ||
      (operation !== 'capabilities' && scope && !config.scopes.includes(scope))
    )
      throw new ForbiddenException('این حساب برای این اتصال مجاز نیست.');
    if (Date.parse(config.expiresAt) <= Date.now())
      throw new ServiceUnavailableException('کلید اتصال منقضی شده است.');
    let data: Record<string, unknown>;
    try {
      data = await ghestirooRequest(
        config,
        operation,
        after,
        undefined,
        options,
      );
    } catch (e) {
      const updated =
        e instanceof Error && e.message === 'UPSTREAM_401'
          ? await this.renewal.ensure(branch, true)
          : null;
      if (
        updated &&
        updated.apiKey !== config.apiKey &&
        (operation === 'capabilities' ||
          !scope ||
          updated.scopes.includes(scope))
      ) {
        config = updated;
        try {
          data = await ghestirooRequest(
            updated,
            operation,
            after,
            undefined,
            options,
          );
        } catch {
          throw new ServiceUnavailableException(
            'آزمون ارتباط ناموفق بود؛ آدرس، اعتبار کلید و دسترسی سرور را بررسی کنید.',
          );
        }
      } else if (
        e instanceof Error &&
        /^UPSTREAM_(409|422|400|403)$/.test(e.message)
      ) {
        const message =
          (e as { detail?: string }).detail ??
          'اطلاعات یا نسخه معتبر نیست؛ قالب فایل و پیش‌نمایش را بررسی و دوباره دریافت کنید.';
        if (e.message === 'UPSTREAM_409') throw new ConflictException(message);
        if (e.message === 'UPSTREAM_403') throw new ForbiddenException();
        throw new BadRequestException(message);
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
  async presence(actor: AuthenticatedActor, branch: string, systemId: string) {
    await this.registeredSite(actor, branch, systemId);
    return {
      ...(await this.run(actor, branch, 'presence')),
      registrySystemId: systemId,
    };
  }
  private async registeredSite(
    actor: AuthenticatedActor,
    branch: string,
    systemId: string,
  ) {
    const registry = await this.registry.read(actor, branch, 'brands');
    const system = registry.systems.find((s) => s.id === systemId);
    const brand = registry.brands.find((b) => b.id === system?.brandId);
    if (
      !system ||
      (system.code !== 'ghesti-roo-primary' &&
        brand?.code !== 'ghesti-roo' &&
        !['https://ghestiroo.ir', 'https://ghestiroo.ir/'].includes(
          system.setup?.websiteUrl ?? '',
        ))
    )
      throw new ForbiddenException();
  }
  async dashboard(
    actor: AuthenticatedActor,
    branch: string,
    systemId: string,
    body: unknown,
    name = '',
  ) {
    await this.registeredSite(actor, branch, systemId);
    if (!body || typeof body !== 'object' || Array.isArray(body))
      throw new BadRequestException();
    const data = body as Record<string, unknown>;
    if (
      Object.keys(data).some(
        (key) => !['from', 'to', 'metric', 'after', 'queue'].includes(key),
      ) ||
      !['from', 'to'].every(
        (key) =>
          typeof data[key] === 'string' &&
          /^\d{4}-\d{2}-\d{2}$/.test(data[key] as string),
      ) ||
      (data.metric !== undefined &&
        !['sales', 'orders', 'users', 'pending'].includes(
          String(data.metric),
        )) ||
      (data.queue !== undefined &&
        (data.metric !== 'pending' ||
          !['requests', 'payments', 'activation', 'issuance'].includes(
            String(data.queue),
          ))) ||
      (data.after !== undefined &&
        (typeof data.after !== 'string' ||
          (data.after !== '' &&
            !/^(?:[a-f0-9]{32}|[a-f0-9-]{36})$/.test(data.after))))
    )
      throw new BadRequestException();
    const result = await this.run(actor, branch, 'dashboard', '', data, name);
    if (
      result.from !== data.from ||
      result.to !== data.to ||
      result.schemaVersion !== 1 ||
      (data.metric
        ? result.metric !== data.metric || !Array.isArray(result.items)
        : !result.metrics || !result.visits || !Array.isArray(result.activity))
    )
      throw new ServiceUnavailableException(
        'پاسخ گزارش با سایت یا بازه انتخاب‌شده مطابقت ندارد.',
      );
    return { ...result, registrySystemId: systemId };
  }
}
