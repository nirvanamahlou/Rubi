import type {
  IntegrationRegistryV1,
  IntegrationRegistryWriteV1,
  IntegrationSiteSetupV1,
  IntegrationSystemConfigV1,
} from '@nora/contracts';
import { registryConfig } from './model';

export const newBrandValue = '__new_brand__';
export interface SiteRegistrationDraft {
  name: string;
  brandId: string;
  brandName: string;
  kind: string;
  businessDomain: IntegrationSystemConfigV1['businessDomain'];
  capabilityCodes: string[];
  websiteUrl: string;
  apiBaseUrl: string;
  documentationUrl: string;
  environment: IntegrationSiteSetupV1['environment'];
  protocol: IntegrationSiteSetupV1['protocol'];
  authentication: IntegrationSiteSetupV1['authentication'];
}

export const protocolLabels = {
  UNDECIDED: 'بعداً مشخص می‌کنم',
  REST: 'رابط API',
  WEBHOOK: 'وب‌هوک',
  MANUAL: 'تبادل دستی',
} as const;
export const authenticationLabels = {
  UNDECIDED: 'بعداً مشخص می‌کنم',
  API_KEY: 'کلید API',
  OAUTH2: 'OAuth 2',
  HMAC: 'امضای HMAC',
  NONE: 'بدون احراز هویت',
} as const;
export const environmentLabels = {
  SANDBOX: 'آزمایشی',
  PRODUCTION: 'عملیاتی',
} as const;

export function siteDraft(
  data: IntegrationRegistryV1,
  system?: IntegrationSystemConfigV1,
): SiteRegistrationDraft {
  return {
    name: system?.name ?? '',
    brandId:
      system?.brandId ??
      data.brands.find((row) => row.lifecycle === 'ENABLED')?.id ??
      newBrandValue,
    brandName: '',
    kind: system?.kind ?? 'وب‌سایت',
    businessDomain: system?.businessDomain ?? 'TRAVEL',
    capabilityCodes: system?.capabilityCodes ?? [],
    websiteUrl: system?.setup?.websiteUrl ?? '',
    apiBaseUrl: system?.setup?.apiBaseUrl ?? '',
    documentationUrl: system?.setup?.documentationUrl ?? '',
    environment: system?.setup?.environment ?? 'SANDBOX',
    protocol: system?.setup?.protocol ?? 'UNDECIDED',
    authentication: system?.setup?.authentication ?? 'UNDECIDED',
  };
}

export function siteRegistration(
  data: IntegrationRegistryV1,
  draft: SiteRegistrationDraft,
  ids: { system: string; brand: string },
  existing?: IntegrationSystemConfigV1,
): IntegrationRegistryWriteV1 {
  const config = registryConfig(data);
  const creatingBrand = draft.brandId === newBrandValue;
  if (
    !draft.name.trim() ||
    !draft.kind.trim() ||
    (creatingBrand && !draft.brandName.trim())
  )
    throw new Error('نام سایت و برند را کامل کنید.');
  if (!creatingBrand && !data.brands.some((row) => row.id === draft.brandId))
    throw new Error('برند را از فهرست انتخاب کنید.');
  if (creatingBrand)
    config.brands = [
      ...config.brands,
      {
        id: ids.brand,
        code: `brand-${ids.brand}`,
        name: draft.brandName.trim(),
        lifecycle: 'ENABLED',
      },
    ];
  const setup: IntegrationSiteSetupV1 = {
    environment: draft.environment,
    protocol: draft.protocol,
    authentication: draft.authentication,
    ...(draft.websiteUrl.trim() ? { websiteUrl: draft.websiteUrl.trim() } : {}),
    ...(draft.apiBaseUrl.trim() ? { apiBaseUrl: draft.apiBaseUrl.trim() } : {}),
    ...(draft.documentationUrl.trim()
      ? { documentationUrl: draft.documentationUrl.trim() }
      : {}),
  };
  const row: IntegrationSystemConfigV1 = {
    ...(existing ?? {}),
    id: existing?.id ?? ids.system,
    code: existing?.code ?? `site-${ids.system}`,
    name: draft.name.trim(),
    brandId: creatingBrand ? ids.brand : draft.brandId,
    kind: draft.kind.trim(),
    businessDomain: draft.businessDomain,
    lifecycle: existing?.lifecycle ?? 'ENABLED',
    capabilityCodes: draft.capabilityCodes,
    setup,
  };
  config.systems = existing
    ? config.systems.map((item) => (item.id === existing.id ? row : item))
    : [...config.systems, row];
  return {
    ...config,
    expectedVersion: data.version,
    reason: existing
      ? 'تکمیل مشخصات راه‌اندازی سایت'
      : 'تعریف سایت یا سامانه جدید',
  };
}
