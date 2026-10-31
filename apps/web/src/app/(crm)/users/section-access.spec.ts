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
    expect([...section.screenIds].sort()).toEqual(
      [
        'integrations.home',
        'system.module.integrations',
        ...[
          'brands',
          'overview',
          'connections',
          'events',
          'mapping',
          'sync',
          'health',
          'logs',
        ].map((id) => `integrations.section.${id}`),
        ...['login', 'provision', 'analytics', 'publish'].map(
          (id) => `integrations.niyayesh.${id}`,
        ),
        ...[
          'tours',
          'hotels',
          'service-offers',
          'visas',
          'destinations',
          'countries',
          'airlines',
          'categories',
          'editorial-content',
        ].map((id) => `integrations.niyayesh.manage.${id}`),
        ...['hotels', 'tour-prices', 'tickets'].map(
          (id) => `integrations.niyayesh.import.${id}`,
        ),
      ].sort(),
    );
    expect(section.permissionCodes).not.toContain('iam.users.manage');
    expect(section.allowedControlIds).toContain(
      'field.system-settings.integrations.registry',
    );
    expect(section.allowedControlIds).not.toContain(
      'field.system-settings.sales.discount',
    );
  });
  it('isolates Call Center bulk selection from every Customer Affairs permission', () => {
    const current = {
      screenIds: ['customer-affairs.home'],
      permissionCodes: [
        'customer_affairs.ticket.read',
        'customer_affairs.ticket.update',
      ],
      allowedControlIds: ['customer-affairs.home'],
    };
    const options = {
      canAssignAll: true,
      assignableScreenIds: [],
      assignableControlIds: [],
      permissions: [
        { code: 'customer_affairs.call_center.read' },
        { code: 'customer_affairs.call_center.notes.create' },
        { code: 'customer_affairs.ticket.read' },
        { code: 'customer_affairs.ticket.update' },
      ],
    };
    const section = sectionAccess('call-center', options);
    expect(section.screenIds).toEqual(['customer-affairs.call-center']);
    expect(section.permissionCodes).toEqual([
      'customer_affairs.call_center.read',
      'customer_affairs.call_center.notes.create',
    ]);
    const selected = changeSectionAccess(current, section, true);
    expect(selected.permissionCodes).toEqual([
      ...current.permissionCodes,
      ...section.permissionCodes,
    ]);
    expect(changeSectionAccess(selected, section, false)).toEqual(current);
    const affairs = sectionAccess('customer-affairs', options);
    expect(affairs.screenIds).not.toContain('customer-affairs.call-center');
    expect(
      affairs.permissionCodes.every(
        (p) => !p.startsWith('customer_affairs.call_center.'),
      ),
    ).toBe(true);
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
