import {
  BadRequestException,
  ConflictException,
  ForbiddenException,
  Inject,
  Injectable,
  NotFoundException,
} from '@nestjs/common';
import type {
  AuthenticatedActor,
  SiteConnectionStatusV1,
} from '@nora/contracts';
import { IntegrationRegistryService } from './integration-registry.service';
import { NiyayeshService, NIYAYESH_RESOURCES } from './niyayesh.service';
import { SiteConnectionStore } from './site-connection.store';
import {
  siteConnectionInput,
  siteIdentityFields,
} from './site-connection.validation';
import { JahanConnectionService } from './jahan-bastan.service';

@Injectable()
export class SiteConnectionService {
  readonly jahan: JahanConnectionService;
  readonly store = new SiteConnectionStore();
  constructor(
    @Inject(IntegrationRegistryService)
    private readonly registry: IntegrationRegistryService,
    @Inject(NiyayeshService) private readonly site: NiyayeshService,
  ) {
    this.jahan = new JahanConnectionService(registry);
  }
  onModuleInit() {
    this.jahan.renewal.start();
  }
  onModuleDestroy() {
    this.jahan.renewal.stop();
  }
  async saveBundle(
    actor: AuthenticatedActor,
    branch: string,
    systemId: string,
    input: unknown,
    origin: string | undefined,
  ) {
    await this.jahan.save(actor, branch, systemId, input, origin);
    return this.status(actor, branch, systemId);
  }
  async lifecycle(
    actor: AuthenticatedActor,
    branch: string,
    systemId: string,
    input: unknown,
  ) {
    await this.jahan.lifecycle(actor, branch, systemId, input);
    return this.status(actor, branch, systemId);
  }
  private async authorize(
    actor: AuthenticatedActor,
    branch: string,
    systemId: string,
    manage = false,
  ) {
    const catalogue = await this.registry.read(actor, branch, 'connections');
    const system = catalogue.systems.find(
      (item) => item.id === systemId && item.lifecycle === 'ENABLED',
    );
    const brand = catalogue.brands.find(
      (item) => item.id === system?.brandId && item.lifecycle === 'ENABLED',
    );
    if (!system || !brand)
      throw new NotFoundException('سایت در این شعبه فعال نیست.');
    if (brand.code === 'ghesti-roo' || system.code === 'ghesti-roo-primary')
      throw new BadRequestException(
        'برای قسطی‌رو از بسته اتصال اختصاصی استفاده کنید.',
      );
    if (manage && !this.registry.canManage(actor))
      throw new ForbiddenException('مجوز تنظیم اتصال سایت را ندارید.');
  }
  private async existing(branch: string, systemId: string) {
    const saved = this.store.ready()
      ? await this.store.read(branch, systemId)
      : null;
    if (saved)
      return {
        config: saved,
        version: saved.version,
        source: 'PANEL' as const,
      };
    try {
      const config = await this.site.configuration(systemId);
      // A legacy source bound only to another branch must not expose metadata here.
      if (
        config &&
        (config.users.some((user) => user.branchId === branch) ||
          config.managedAccess?.branchIds.includes(branch))
      )
        return { config, version: 0, source: 'SERVER' as const };
    } catch (error) {
      if (!(error instanceof NotFoundException)) throw error;
    }
    return { config: null, version: 0, source: 'NONE' as const };
  }
  async status(
    actor: AuthenticatedActor,
    branch: string,
    systemId: string,
  ): Promise<SiteConnectionStatusV1> {
    await this.authorize(actor, branch, systemId);
    const { config, version, source } = await this.existing(branch, systemId);
    const canManage = this.registry.canManage(actor);
    return {
      contract: 'integrations.site-connection.v1',
      systemId,
      configured: !!config,
      storageReady: this.store.ready(),
      canManage,
      version,
      source,
      connection: config
        ? {
            origin: config.origin,
            client: config.client,
            system: config.system,
            organization: config.organization,
            environment: config.environment,
            keyId: config.keyId,
          }
        : null,
      secretConfigured: !!config?.secret,
      ...(config?.protocol === 'jahan-bastan.nora.v1' && config.jahan
        ? {
            protocol: config.protocol,
            lifecycle: config.jahan.state,
            expiresAt: config.jahan.expiresAt,
            renewalState:
              Date.parse(config.jahan.expiresAt) <= Date.now()
                ? 'expired'
                : config.jahan.pendingRenewal
                  ? 'pending'
                  : 'active',
            remoteControlPending: !!config.jahan.lifecyclePending,
          }
        : {}),
      ...('updatedAt' in (config ?? {})
        ? { updatedAt: (config as { updatedAt: string }).updatedAt }
        : {}),
    };
  }
  async save(
    actor: AuthenticatedActor,
    branch: string,
    systemId: string,
    input: unknown,
  ) {
    await this.authorize(actor, branch, systemId, true);
    const value = siteConnectionInput(input);
    const { config, version } = await this.existing(branch, systemId);
    if (config?.protocol === 'jahan-bastan.nora.v1')
      throw new BadRequestException(
        'برای این اتصال، بسته جهان باستان را وارد کنید.',
      );
    if (version !== value.expectedVersion)
      throw new ConflictException(
        'اتصال تغییر کرده است؛ دوباره بارگذاری کنید.',
      );
    const unchanged =
      config &&
      siteIdentityFields.every(
        (field) =>
          (field === 'origin'
            ? config.origin.replace(/\/$/, '')
            : config[field]) === value[field],
      );
    if (!value.secret && (!config || !unchanged))
      throw new BadRequestException(
        'برای اتصال جدید یا تغییر نشانی و شناسه‌ها، کلید محرمانه را دوباره وارد کنید.',
      );
    const previous = unchanged ? config : null;
    const resources = [...Object.keys(NIYAYESH_RESOURCES), 'site-analytics'];
    await this.store.write(
      branch,
      systemId,
      {
        ...value,
        secret: value.secret || config!.secret,
        local: false,
        registrySystemId: systemId,
        users: previous?.users ?? [
          {
            userId: actor.userId,
            branchId: branch,
            subject: actor.userId,
            resources,
          },
        ],
        ...(previous
          ? previous.managedAccess
            ? { managedAccess: previous.managedAccess }
            : {}
          : { managedAccess: { branchIds: [branch], resources } }),
        version: 0,
        updatedAt: new Date().toISOString(),
      },
      value.expectedVersion,
    );
    return this.status(actor, branch, systemId);
  }
  async test(actor: AuthenticatedActor, branch: string, systemId: string) {
    await this.authorize(actor, branch, systemId);
    const { config } = await this.existing(branch, systemId);
    if (config?.protocol === 'jahan-bastan.nora.v1')
      return this.jahan.test(actor, branch, systemId);
    return this.site.status(actor, branch, systemId);
  }
}
