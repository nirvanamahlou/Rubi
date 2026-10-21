import { describe, expect, it } from 'vitest';
import {
  USER_ACCESS_DENY_CONTROLS,
  USER_ACCESS_SCREENS,
  manualSectionForScreen,
} from '@nora/contracts';
import { sectionAccess, changeSectionAccess } from './section-access';
const empty = { screenIds: [], permissionCodes: [], allowedControlIds: [] };
describe('complete section selection', () => {
  it('includes every Integrations page without granting IAM or other settings fields', () => {
    const section = sectionAccess('integrations', {
      canAssignAll: true,
      assignableScreenIds: [],
      assignableControlIds: [],
      permissions: [
        { code: 'system.settings.manage' },
        { code: 'iam.users.manage' },
      ],
    });
    expect(section.screenIds).toContain('integrations.home');
    expect(section.screenIds).toContain('system.module.integrations');
    expect(section.screenIds).toContain('integrations.section.connections');
    expect(section.screenIds).toHaveLength(10);
    expect(section.permissionCodes).not.toContain('iam.users.manage');
    expect(section.allowedControlIds).toContain(
      'field.system-settings.integrations.registry',
    );
    expect(section.allowedControlIds).not.toContain(
      'field.system-settings.sales.discount',
    );
  });
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
