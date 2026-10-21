import {
  CALL_CENTER_ACCESS_OPERATIONS,
  CALL_CENTER_SCOPED_ACCESS,
  manualSectionForPermission,
} from '@nora/contracts';

/** Both sections edit the same native permission; no extra grant is created. */
export function permissionInSection(code: string, section: string) {
  if (code === CALL_CENTER_SCOPED_ACCESS) return false;
  return (
    manualSectionForPermission(code) === section ||
    (section === 'integrations' && code === 'system.settings.manage')
  );
}

export function permissionLabel(
  permission: { code: string; name: string },
  section: string,
) {
  const callCenterLabel = CALL_CENTER_ACCESS_OPERATIONS.find(
    ([code]) => code === permission.code,
  )?.[1];
  if (callCenterLabel) return callCenterLabel;
  return section === 'integrations' &&
    permission.code === 'system.settings.manage'
    ? 'ایجاد و ویرایش برندها، سامانه‌ها و سایت‌ها (مدیریت تنظیمات)'
    : permission.name;
}
