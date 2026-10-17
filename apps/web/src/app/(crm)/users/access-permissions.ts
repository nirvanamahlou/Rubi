import { manualSectionForPermission } from '@nora/contracts';

/** Both sections edit the same native permission; no extra grant is created. */
export function permissionInSection(code: string, section: string) {
  return (
    manualSectionForPermission(code) === section ||
    (section === 'integrations' && code === 'system.settings.manage')
  );
}

export function permissionLabel(
  permission: { code: string; name: string },
  section: string,
) {
  return section === 'integrations' &&
    permission.code === 'system.settings.manage'
    ? 'ایجاد و ویرایش برندها، سامانه‌ها و سایت‌ها (مدیریت تنظیمات)'
    : permission.name;
}
