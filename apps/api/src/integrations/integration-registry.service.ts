import {
  ConflictException,
  ForbiddenException,
  Inject,
  Injectable,
} from '@nestjs/common';
import { randomUUID } from 'node:crypto';
import {
  canViewScreen,
  hasAccessControl,
  systemSettingControlId,
  type AuthenticatedActor,
  type IntegrationCatalogueConfigV1,
  type IntegrationExistingAdapterV1,
  type IntegrationRegistryV1,
  type SystemSettingV1,
} from '@nora/contracts';
import { SystemManagementService } from '../system-management/system-management.service';
import {
  integrationBranchId,
  safeIntegrationReason,
  retainIntegrationIdentities,
  validateIntegrationCatalogue,
  validateIntegrationWrite,
} from './integration-registry.validation';

const empty: IntegrationCatalogueConfigV1 = {
  schemaVersion: 1,
  brands: [],
  systems: [],
  capabilities: [],
};

@Injectable()
export class IntegrationRegistryService {
  constructor(
    @Inject(SystemManagementService)
    private readonly settings: SystemManagementService,
  ) {}

  canManage(actor: AuthenticatedActor) {
    return (
      canViewScreen(actor.permissions, 'integrations.home') &&
      actor.permissions.includes('system.settings.manage') &&
      hasAccessControl(actor.permissions, 'system.module.integrations') &&
      hasAccessControl(
        actor.permissions,
        systemSettingControlId('integrations', 'registry'),
      )
    );
  }

  private authorize(actor: AuthenticatedActor, branch: unknown, write = false) {
    const branchId = integrationBranchId(branch);
    if (
      !canViewScreen(actor.permissions, 'integrations.home') ||
      !actor.branchIds.includes(branchId) ||
      (write && !this.canManage(actor))
    )
      throw new ForbiddenException(
        'مجوز سامانه یا شعبه برای این عملیات وجود ندارد.',
      );
    return branchId;
  }

  private async setting(branchId: string) {
    const setting = await this.settings.resolveSetting({
      namespace: 'integrations',
      key: 'registry',
      branchId,
    });
    // A global or issuer fallback must never expose another branch's catalogue.
    return setting?.scope === 'BRANCH' && setting.scopeId === branchId
      ? setting
      : null;
  }

  private present(
    setting: SystemSettingV1 | null,
    actor: AuthenticatedActor,
    branchId: string,
  ): IntegrationRegistryV1 {
    const config = setting
      ? validateIntegrationCatalogue(setting.value)
      : empty;
    const systems = config.systems.filter(
      (system) =>
        system.lifecycle === 'ENABLED' &&
        config.brands.some(
          (brand) =>
            brand.id === system.brandId && brand.lifecycle === 'ENABLED',
        ),
    );
    return {
      ...config,
      contract: 'integrations.registry.v1',
      branchId,
      initialized: !!setting,
      version: setting?.version ?? 0,
      canManage: this.canManage(actor),
      connectionState: 'NOT_CONFIGURED',
      counts: setting
        ? {
            brands: config.brands.filter(
              (brand) => brand.lifecycle === 'ENABLED',
            ).length,
            systems: systems.length,
            awaitingConnection: systems.length,
          }
        : null,
      lastChange: setting
        ? {
            occurredAt: setting.updatedAt,
            actorUserId: setting.updatedByUserId,
            reason: safeIntegrationReason(setting.reason),
          }
        : null,
    };
  }

  async read(actor: AuthenticatedActor, branch: unknown) {
    const branchId = this.authorize(actor, branch);
    return this.present(await this.setting(branchId), actor, branchId);
  }

  async write(
    actor: AuthenticatedActor,
    branch: unknown,
    value: unknown,
    requestId?: string,
  ) {
    const branchId = this.authorize(actor, branch, true);
    const { expectedVersion, reason, ...config } =
      validateIntegrationWrite(value);
    const current = await this.setting(branchId);
    if ((current?.version ?? 0) !== expectedVersion)
      throw new ConflictException(
        'فهرست هم‌زمان تغییر کرده است؛ دوباره بارگذاری کنید.',
      );
    if (current) {
      const previous = validateIntegrationCatalogue(current.value);
      retainIntegrationIdentities(previous, config);
      // Older v1 consumers do not know setup metadata; omission preserves it.
      config.systems = config.systems.map((system) => {
        const prior = previous.systems.find((row) => row.id === system.id);
        return system.setup === undefined && prior?.setup
          ? { ...system, setup: prior.setup }
          : system;
      });
      validateIntegrationCatalogue(config);
    }
    const setting = await this.settings.writeSetting(
      {
        namespace: 'integrations',
        key: 'registry',
        valueType: 'JSON',
        value: config,
        scope: 'BRANCH',
        scopeId: branchId,
        status: 'ACTIVE',
        reason,
        ...(expectedVersion ? { expectedVersion } : {}),
      },
      actor,
      requestId ? { requestId } : {},
    );
    return this.present(setting, actor, branchId);
  }

  async initialize(
    actor: AuthenticatedActor,
    branch: unknown,
    requestId?: string,
  ) {
    const branchId = this.authorize(actor, branch, true);
    const existing = await this.setting(branchId);
    if (existing) return this.present(existing, actor, branchId);
    const presets = [
      ['jahan-bastan', 'جهان باستان', 'TRAVEL'],
      ['niayesh-seir', 'نیایش سیر', 'TRAVEL'],
      ['ghesti-roo', 'قسطی روو', 'TRAVEL'],
      ['jahan-academy', 'جهان آکادمی', 'EDUCATION'],
    ] as const;
    const brands = presets.map(([code, name]) => ({
      id: randomUUID(),
      code,
      name,
      lifecycle: 'ENABLED' as const,
    }));
    try {
      return await this.write(
        actor,
        branchId,
        {
          schemaVersion: 1,
          brands,
          capabilities: [],
          systems: brands.map((brand, index) => ({
            id: randomUUID(),
            code: `${brand.code}-primary`,
            name: brand.name,
            brandId: brand.id,
            kind: presets[index]![2] === 'EDUCATION' ? 'آموزشی' : 'وب‌سایت',
            businessDomain: presets[index]![2],
            lifecycle: 'ENABLED',
            capabilityCodes: [],
          })),
          expectedVersion: 0,
          reason: 'ایجاد فهرست اولیه برندها و سامانه‌ها',
        },
        requestId,
      );
    } catch (error) {
      // A concurrent initialization cannot replace the winner's IDs or metadata.
      if (!(error instanceof ConflictException)) throw error;
      const winner = await this.setting(branchId);
      if (!winner) throw error;
      return this.present(winner, actor, branchId);
    }
  }

  adapters(actor: AuthenticatedActor): IntegrationExistingAdapterV1[] {
    if (!canViewScreen(actor.permissions, 'integrations.home'))
      throw new ForbiddenException();
    return [
      {
        code: 'procurement-supplier-v1',
        title: 'پیام‌های تأمین‌کننده خرید',
        owner: 'Integrations',
        operations: ['supplier.order.dispatch', 'supplier.event.receive'],
        verification: 'NOT_VERIFIED',
      },
      {
        code: 'customer-affairs-sites-v1',
        title: 'پل تیکت سایت‌ها',
        owner: 'Customer Affairs',
        operations: ['ticket.create', 'ticket.status.read'],
        verification: 'NOT_VERIFIED',
      },
    ];
  }
}
