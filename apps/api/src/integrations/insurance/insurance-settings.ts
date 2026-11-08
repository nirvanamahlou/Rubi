import type { MasterDataRecord } from '@nora/contracts';
import { Optional } from '@nestjs/common';
import { TravisSandboxService } from './travis-sandbox.service';
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
    @Optional()
    @Inject(TravisSandboxService)
    private readonly provider?: TravisSandboxService,
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
      (actor.permissions.includes('system.settings.manage') ||
        actor.permissions.includes('reservations.insurance.manage')) &&
      (actor.permissions.includes('reservations.insurance.manage') ||
        hasAccessControl(actor.permissions, 'system.module.operations')) &&
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
      providerStatus: this.provider?.configured()
        ? ('SANDBOX_CONFIGURED' as const)
        : ('NOT_CONFIGURED' as const),
    };
  }
  /** Internal worker port: branch identity comes from the persisted intake. */
  async automationConfig(branchId: string) {
    const row = await this.settings.resolveSetting({
      namespace: 'operations',
      key: 'insurance-issuance',
      branchId,
    });
    return row?.scope === 'BRANCH' && row.scopeId === branchId
      ? insuranceConfiguration(row.value)
      : { schemaVersion: 1 as const, countries: [] };
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
        ...(input.expectedVersion > 0
          ? { expectedVersion: input.expectedVersion }
          : {}),
        reason: 'Insurance issuance settings',
      },
      actor,
      {},
    );
    return this.read(branchId, actor);
  }
  async testProviderIssuance(branchId: string, actor: AuthenticatedActor) {
    this.authorize(actor, branchId, true);
    if (!this.provider)
      throw new BadRequestException('اتصال آزمایشی بیمه تنظیم نشده است.');
    return this.provider.testIssuance();
  }

  async importFestival(
    branchId: string,
    expectedVersion: number,
    actor: AuthenticatedActor,
  ) {
    this.authorize(actor, branchId, true);
    const current = await this.read(branchId, actor);
    if (
      !Number.isSafeInteger(expectedVersion) ||
      current.version !== expectedVersion
    )
      throw new BadRequestException('نسخه و تنظیمات معتبر لازم است.');
    if (!this.provider)
      throw new BadRequestException('اتصال آزمایشی بیمه تنظیم نشده است.');
    const incoming = await this.provider.festivalRates();
    const all = async (
      resource: 'countries' | 'insurance-plans' | 'insurers',
    ) => {
      const rows: MasterDataRecord[] = [];
      for (let page = 1; page <= 100; page++) {
        const result = await this.master.list(resource, {
          page,
          pageSize: 100,
          status: 'active',
          sortBy: 'name',
          sortDirection: 'asc',
          search: '',
        });
        rows.push(...result.data);
        if (rows.length >= result.meta.total) return rows;
      }
      throw new BadRequestException('فهرست اطلاعات پایه بیش از حد مجاز است.');
    };
    const [countries, plans] = await Promise.all([
      all('countries'),
      all('insurance-plans'),
    ]);
    const title = incoming[0]!.title;
    let plan = plans.find((p) => p.code === '76' || p.name === title);
    if (!plan) {
      const insurers = await all('insurers');
      let insurer = insurers.find(
        (p) =>
          p.code === 'SAMAN' || p.name.replace(/\s/g, '').includes('سامان'),
      );
      if (!insurer)
        insurer = (
          await this.master.create(
            'insurers',
            {
              code: 'SAMAN',
              name: 'بیمه سامان',
              englishName: 'Saman Insurance',
            },
            actor,
            branchId,
          )
        ).data;
      plan = (
        await this.master.create(
          'insurance-plans',
          {
            code: '76',
            name: title,
            englishName: 'Festival plan with COVID-19 coverage',
            insurerId: insurer.id,
            destinationRegion: 'TR, CN, GE, MY',
            minimumAge: 0,
            maximumAge: 120,
            validFrom: new Date().toISOString(),
          },
          actor,
          branchId,
        )
      ).data;
    }
    const config = structuredClone(current.config);
    for (const item of incoming) {
      let country = countries.find((c) => c.code === item.code);
      const englishName = (
        { TR: 'TURKEY', CN: 'CHINA', GE: 'GEORGIA', MY: 'MALAYSIA' } as Record<
          string,
          string
        >
      )[item.code]!;
      if (!country)
        country = (
          await this.master.create(
            'countries',
            { code: item.code, name: item.name, englishName },
            actor,
            branchId,
          )
        ).data;
      const saved = config.countries.find((c) => c.countryId === country.id);
      if (
        config.countries.some(
          (c) =>
            c.providerCountryCode === String(item.id) &&
            c.countryId !== country.id,
        )
      )
        throw new BadRequestException('تنظیمات بیمه معتبر نیست.');
      const imported = {
        masterPlanId: plan.id,
        providerPlanCode: '76',
        title: item.title,
        rates: item.rates,
      };
      if (saved) {
        saved.providerCountryCode = String(item.id);
        saved.providerCountryName = item.name;
        saved.englishName = englishName;
        saved.active = true;
        saved.plans = [
          ...saved.plans.filter((p) => p.providerPlanCode !== '76'),
          imported,
        ];
      } else
        config.countries.push({
          countryId: country.id,
          providerCountryCode: String(item.id),
          providerCountryName: item.name,
          englishName,
          active: true,
          plans: [imported],
        });
    }
    const result = await this.save(
      branchId,
      { config, expectedVersion },
      actor,
    );
    return {
      ...result,
      unsupportedBands: incoming.reduce((n, c) => n + c.unsupported, 0),
    };
  }

  async providerCatalog(branchId: string, actor: AuthenticatedActor) {
    this.authorize(actor, branchId, true);
    if (!this.provider)
      throw new BadRequestException('اتصال آزمایشی بیمه تنظیم نشده است.');
    return this.provider.catalog();
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
