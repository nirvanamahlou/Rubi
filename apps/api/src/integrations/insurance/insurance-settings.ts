import {
  BadRequestException,
  ForbiddenException,
  Inject,
  Injectable,
} from '@nestjs/common';
import Joi from 'joi';
import {
  hasAccessControl,
  systemSettingControlId,
  type AuthenticatedActor,
  type InsuranceConfigurationV1,
} from '@nora/contracts';
import { MasterDataService } from '../../master-data/master-data.service';
import { SystemManagementService } from '../../system-management/system-management.service';

const code = Joi.string()
  .trim()
  .pattern(/^[a-zA-Z0-9._-]+$/)
  .max(40)
  .required();
const rate = Joi.object({
  minDays: Joi.number().integer().min(1).max(365).required(),
  maxDays: Joi.number().integer().min(Joi.ref('minDays')).max(365).required(),
  minAge: Joi.number().integer().min(0).max(120).required(),
  maxAge: Joi.number().integer().min(Joi.ref('minAge')).max(120).required(),
  amount: Joi.string()
    .pattern(/^\d{1,15}(\.\d{1,4})?$/)
    .required(),
  currencyCode: Joi.string()
    .pattern(/^[A-Z]{3}$/)
    .required(),
});
const configSchema = Joi.object({
  schemaVersion: Joi.valid(1).required(),
  countries: Joi.array()
    .max(300)
    .unique('countryId')
    .unique('providerCountryCode')
    .items(
      Joi.object({
        countryId: Joi.string().uuid().required(),
        providerCountryCode: code,
        providerCountryName: Joi.string().trim().max(160).required(),
        englishName: Joi.string().trim().max(160).allow('').required(),
        active: Joi.boolean().required(),
        plans: Joi.array()
          .max(50)
          .unique('providerPlanCode')
          .items(
            Joi.object({
              masterPlanId: Joi.string().uuid().required(),
              providerPlanCode: code,
              title: Joi.string().trim().max(160).required(),
              rates: Joi.array().max(200).items(rate).required(),
            }),
          )
          .required(),
      }),
    )
    .required(),
});

export function insuranceConfiguration(raw: unknown): InsuranceConfigurationV1 {
  const parsed = configSchema.validate(raw, { convert: false });
  if (parsed.error) throw new BadRequestException('تنظیمات بیمه معتبر نیست.');
  const config = parsed.value as InsuranceConfigurationV1;
  for (const country of config.countries) {
    for (const plan of country.plans) {
      for (let i = 0; i < plan.rates.length; i++) {
        const a = plan.rates[i]!;
        if (
          plan.rates
            .slice(i + 1)
            .some(
              (b) =>
                a.minAge <= b.maxAge &&
                b.minAge <= a.maxAge &&
                a.minDays <= b.maxDays &&
                b.minDays <= a.maxDays,
            )
        )
          throw new BadRequestException(
            'بازه‌های سن و مدت سفر نباید هم‌پوشانی داشته باشند.',
          );
      }
    }
  }
  return config;
}

@Injectable()
export class InsuranceSettingsService {
  constructor(
    @Inject(SystemManagementService)
    private readonly settings: SystemManagementService,
    @Inject(MasterDataService) private readonly master: MasterDataService,
  ) {}

  authorize(actor: AuthenticatedActor, branchId: string, write = false) {
    if (
      !actor.branchIds.includes(branchId) ||
      !actor.permissions.includes('reservations.read') ||
      (write && !this.canManage(actor))
    )
      throw new ForbiddenException();
  }
  canManage(actor: AuthenticatedActor) {
    return (
      actor.permissions.includes('system.settings.manage') &&
      hasAccessControl(actor.permissions, 'system.module.operations') &&
      hasAccessControl(
        actor.permissions,
        systemSettingControlId('operations', 'insurance-issuance'),
      )
    );
  }
  async read(branchId: string, actor: AuthenticatedActor) {
    this.authorize(actor, branchId);
    const row = await this.settings.resolveSetting({
      namespace: 'operations',
      key: 'insurance-issuance',
      branchId,
    });
    const scoped =
      row?.scope === 'BRANCH' && row.scopeId === branchId ? row : null;
    return {
      config: scoped
        ? insuranceConfiguration(scoped.value)
        : { schemaVersion: 1 as const, countries: [] },
      version: scoped?.version ?? 0,
      canManage: this.canManage(actor),
      providerStatus: 'NOT_CONFIGURED' as const,
    };
  }
  async save(branchId: string, raw: unknown, actor: AuthenticatedActor) {
    this.authorize(actor, branchId, true);
    const result = Joi.object({
      config: Joi.required(),
      expectedVersion: Joi.number().integer().min(0).required(),
    }).validate(raw, { convert: false });
    if (result.error)
      throw new BadRequestException('نسخه و تنظیمات معتبر لازم است.');
    const input = result.value as { config: unknown; expectedVersion: number };
    const config = insuranceConfiguration(input.config);
    for (const country of config.countries) {
      await this.master.detail('countries', country.countryId);
      for (const plan of country.plans) {
        await this.master.detail('insurance-plans', plan.masterPlanId);
      }
    }
    const currencyCodes = new Set(
      config.countries.flatMap((c) =>
        c.plans.flatMap((p) => p.rates.map((r) => r.currencyCode)),
      ),
    );
    for (const currencyCode of currencyCodes) {
      const rows = await this.master.list('currencies', {
        search: currencyCode,
        page: 1,
        pageSize: 100,
        status: 'active',
        sortBy: 'name',
        sortDirection: 'asc',
      });
      if (
        !rows.data.some((r) => r.code === currencyCode && r.status === 'active')
      )
        throw new BadRequestException('ارز فعال اطلاعات پایه را انتخاب کنید.');
    }
    await this.settings.writeSetting(
      {
        namespace: 'operations',
        key: 'insurance-issuance',
        scope: 'BRANCH',
        scopeId: branchId,
        valueType: 'JSON',
        status: 'ACTIVE',
        value: config,
        expectedVersion: input.expectedVersion,
        reason: 'Insurance issuance settings',
      },
      actor,
      {},
    );
    return this.read(branchId, actor);
  }
  async references(
    branchId: string,
    actor: AuthenticatedActor,
    resource: string,
    page: number,
  ) {
    this.authorize(actor, branchId);
    if (
      !['countries', 'insurance-plans', 'currencies'].includes(resource) ||
      !Number.isSafeInteger(page) ||
      page < 1 ||
      page > 100
    )
      throw new BadRequestException();
    return this.master.list(
      resource as 'countries' | 'insurance-plans' | 'currencies',
      {
        search: '',
        page,
        pageSize: 100,
        status: 'active',
        sortBy: 'name',
        sortDirection: 'asc',
      },
    );
  }
}
