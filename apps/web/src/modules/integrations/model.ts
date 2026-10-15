import type {
  IntegrationRegistryV1,
  IntegrationSystemConfigV1,
} from '@nora/contracts';

export const integrationSections = [
  { id: 'overview', title: 'نمای کلی' },
  { id: 'brands', title: 'برندها و سامانه‌ها' },
  { id: 'connections', title: 'اتصال‌ها و تأمین‌کنندگان' },
  { id: 'events', title: 'رویدادها و وب‌هوک‌ها' },
  { id: 'mapping', title: 'نگاشت و گردش داده' },
  { id: 'sync', title: 'همگام‌سازی‌ها' },
  { id: 'health', title: 'سلامت و خطاها' },
  { id: 'logs', title: 'لاگ‌ها و سوابق' },
  { id: 'settings', title: 'تنظیمات اتصال و دسترسی' },
] as const;
export type IntegrationSection = (typeof integrationSections)[number]['id'];
export const lifecycleLabels = {
  ENABLED: 'در فهرست',
  DISABLED: 'غیرفعال',
  ARCHIVED: 'آرشیو',
} as const;
export const domainLabels = {
  TRAVEL: 'سفر',
  EDUCATION: 'آموزش',
  OTHER: 'سایر',
} as const;

export function catalogueSystems(
  registry: IntegrationRegistryV1,
  brandId?: string,
  listedOnly = false,
) {
  return registry.systems.filter(
    (system) =>
      (!brandId || system.brandId === brandId) &&
      (!listedOnly ||
        (system.lifecycle === 'ENABLED' &&
          registry.brands.some(
            (brand) =>
              brand.id === system.brandId && brand.lifecycle === 'ENABLED',
          ))),
  );
}

export function systemSalesState(system: IntegrationSystemConfigV1) {
  return system.businessDomain === 'TRAVEL' ? 'داده موجود نیست' : 'نامرتبط';
}

export function registryConfig(registry: IntegrationRegistryV1) {
  return {
    schemaVersion: registry.schemaVersion,
    brands: registry.brands,
    systems: registry.systems,
    capabilities: registry.capabilities,
  };
}
