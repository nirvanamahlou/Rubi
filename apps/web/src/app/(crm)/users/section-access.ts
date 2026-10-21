import {
  USER_ACCESS_SCREENS,
  USER_ACCESS_DENY_CONTROLS,
  manualSectionForScreen,
  type ManualAccessSelection,
} from '@nora/contracts';
import { permissionInSection } from './access-permissions';

export function sectionAccess(
  id: string,
  options: {
    permissions: Array<{ code: string }>;
    assignableScreenIds: string[];
    assignableControlIds: string[];
    canAssignAll: boolean;
  },
): ManualAccessSelection {
  return {
    screenIds: USER_ACCESS_SCREENS.filter(
      (s) =>
        manualSectionForScreen(s) === id &&
        (options.canAssignAll || options.assignableScreenIds.includes(s.id)),
    ).map((s) => s.id),
    permissionCodes: options.permissions
      .filter((p) => permissionInSection(p.code, id))
      .map((p) => p.code),
    allowedControlIds: USER_ACCESS_DENY_CONTROLS.filter(
      (c) =>
        (USER_ACCESS_SCREENS.some((s) => s.id === c.id)
          ? manualSectionForScreen(
              USER_ACCESS_SCREENS.find((s) => s.id === c.id)!,
            ) === id
          : c.group === id) &&
        (options.canAssignAll || options.assignableControlIds.includes(c.id)),
    ).map((c) => c.id),
  };
}

export function changeSectionAccess(
  current: ManualAccessSelection,
  section: ManualAccessSelection,
  checked: boolean,
): ManualAccessSelection {
  const change = (key: keyof ManualAccessSelection) =>
    checked
      ? [...new Set([...current[key], ...section[key]])]
      : current[key].filter((id) => !section[key].includes(id));
  return {
    screenIds: change('screenIds'),
    permissionCodes: change('permissionCodes'),
    allowedControlIds: change('allowedControlIds'),
  };
}
