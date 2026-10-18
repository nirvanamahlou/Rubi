import { describe, expect, it } from 'vitest';
import {
  USER_ACCESS_DENY_CONTROLS,
  USER_ACCESS_SCREENS,
  manualSectionForScreen,
} from '@nora/contracts';
import { sectionAccess, changeSectionAccess } from './section-access';
const empty = { screenIds: [], permissionCodes: [], allowedControlIds: [] };
describe('complete section selection', () => {
  it('selects all screens, operations, resources and fields, independent of search', () => {
    const section = sectionAccess('master-data', {
      canAssignAll: true,
      assignableScreenIds: [],
      assignableControlIds: [],
      permissions: [
        { code: 'master_data.read' },
        { code: 'master_data.update' },
        { code: 'finance.read' },
      ],
    });
    expect(section.screenIds).toEqual(
      USER_ACCESS_SCREENS.filter(
        (s) => manualSectionForScreen(s) === 'master-data',
      ).map((s) => s.id),
    );
    expect(section.allowedControlIds).toEqual(
      USER_ACCESS_DENY_CONTROLS.filter((c) => c.group === 'master-data').map(
        (c) => c.id,
      ),
    );
    expect(section.permissionCodes).toEqual([
      'master_data.read',
      'master_data.update',
    ]);
    expect(
      section.allowedControlIds.some((id) => id.startsWith('field.')),
    ).toBe(true);
    const selected = changeSectionAccess(empty, section, true);
    expect(selected).toEqual(section);
    expect(changeSectionAccess(selected, section, true)).toEqual(section);
    expect(changeSectionAccess(selected, section, false)).toEqual(empty);
  });
  it('never changes nondelegable or unrelated existing access', () => {
    const current = {
      screenIds: ['other'],
      permissionCodes: ['finance.read'],
      allowedControlIds: ['protected'],
    };
    const section = sectionAccess('master-data', {
      canAssignAll: false,
      assignableScreenIds: [],
      assignableControlIds: [],
      permissions: [{ code: 'master_data.read' }],
    });
    expect(section.screenIds).toEqual([]);
    expect(section.allowedControlIds).toEqual([]);
    expect(
      changeSectionAccess(
        changeSectionAccess(current, section, true),
        section,
        false,
      ),
    ).toEqual(current);
  });
});
