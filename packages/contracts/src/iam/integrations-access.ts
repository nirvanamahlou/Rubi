import { canViewScreen } from './user-access';

/** Shared by the native IAM editor, Integrations API and Web navigation. */
export const INTEGRATION_ACCESS_SECTIONS = [
  ['brands', 'برندها و سامانه‌ها'],
  ['overview', 'نمای کلی'],
  ['connections', 'اتصال‌ها و تأمین‌کنندگان'],
  ['events', 'رویدادها و وب‌هوک‌ها'],
  ['mapping', 'نگاشت و گردش داده'],
  ['sync', 'همگام‌سازی‌ها'],
  ['health', 'سلامت و خطاها'],
  ['logs', 'لاگ‌ها و سوابق'],
  ['settings', 'تنظیمات اتصال و دسترسی'],
] as const;

export type IntegrationAccessSection =
  (typeof INTEGRATION_ACCESS_SECTIONS)[number][0];

export function integrationScreenId(section: IntegrationAccessSection) {
  return section === 'settings'
    ? 'system.module.integrations'
    : `integrations.section.${section}`;
}

export function canViewIntegrationSection(
  permissions: readonly string[],
  section: IntegrationAccessSection,
) {
  return (
    canViewScreen(permissions, 'integrations.home') &&
    canViewScreen(permissions, integrationScreenId(section))
  );
}

export function visibleIntegrationSections(permissions: readonly string[]) {
  return INTEGRATION_ACCESS_SECTIONS.map(([id]) => id).filter((id) =>
    canViewIntegrationSection(permissions, id),
  );
}
