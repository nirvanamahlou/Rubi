import { renderToStaticMarkup } from 'react-dom/server';
import { describe, expect, it } from 'vitest';
import { getHrResource, type HrRecordDto } from '@nora/contracts';
import { OrganizationChart } from './organization-chart';
import {
  buildLiveOrganizationNodes,
  chartNodeFormTarget,
} from './hr-organization';
import { sourceForRecord } from './hr-record-source';
import { hrCompanies } from './hr-live-data';
import type { HrBootstrapDto } from '@nora/contracts';
import { parentFieldLabel } from './hr-form-model';
const record = (
  id: string,
  tab: string,
  extra: Partial<HrRecordDto> = {},
): HrRecordDto => ({
  id,
  code: id,
  branchId: 'b',
  section: 'organization',
  tab,
  parentId: null,
  employeeId: null,
  columns: [...getHrResource('organization', tab)!.columns],
  values: ['مالی', '', ''],
  status: 'فعال',
  version: 1,
  effectiveAt: null,
  appliedAt: null,
  deletedAt: null,
  createdAt: '',
  updatedAt: '',
  data: {},
  ...extra,
});
const unit = record('department', 'units', {
  data: { chartX: 120, chartY: -35 },
});
const member = record('member', 'chartEmployees', {
  parentId: unit.id,
  employeeId: 'e',
  values: ['همکار', ''],
  data: { chartX: 25, chartY: 45 },
});
const employee = {
  id: 'e',
  name: 'همکار',
  personnelCode: '001',
  branchId: 'b',
  position: 'کارشناس',
  unit: 'مالی',
};
const build = (records = [unit, member]) =>
  buildLiveOrganizationNodes(records, [{ id: 'b', name: 'شرکت' }], [employee]);
const noop = () => undefined;
describe('live organization chart nodes', () => {
  it('projects real employee links, department hierarchy and saved positions after reload', () => {
    const nodes = build();
    expect(nodes.find((n) => n.id === 'member')).toMatchObject({
      kind: 'EMPLOYEE',
      parentId: 'department',
      name: 'همکار',
      manager: 'کارشناس · 001',
      offsetX: 25,
      offsetY: 45,
    });
    expect(nodes.find((n) => n.id === 'department')).toMatchObject({
      kind: 'UNIT',
      offsetX: 120,
      offsetY: -35,
    });
    const html = renderToStaticMarkup(
      <OrganizationChart
        nodes={nodes}
        onEdit={noop}
        onDelete={noop}
        onAddDepartment={noop}
        onAddEmployee={noop}
        onPositionChange={async () => undefined}
      />,
    );
    for (const label of [
      'افزودن دپارتمان زیر مالی',
      'افزودن کارکن زیر مالی',
      'ویرایش همکار',
      'حذف همکار',
      'جابه‌جایی همکار',
    ])
      expect(html).toContain(`aria-label="${label}"`);
    expect(html).toContain('translate(25px, 45px)');
    expect(html).toContain('data-edge-count="2"');
    expect(html).not.toContain('افزودن دپارتمان زیر همکار');
  });
  it('opens real creation forms under the selected node with a valid root company, without the old existing-unit picker', () => {
    const nodes = build();
    const target = chartNodeFormTarget(
      'UNIT',
      nodes.find((n) => n.id === unit.id),
      [unit, member],
      nodes,
    );
    expect(target).toMatchObject({
      source: { tab: 'units' },
      parent: { id: unit.id },
      preferredCompanyId: 'b',
    });
    expect(target.organizationNode).toBeUndefined();
    const employeeTarget = chartNodeFormTarget(
      'EMPLOYEE',
      nodes.find((n) => n.id === member.id),
      [unit, member],
      nodes,
    );
    expect(employeeTarget).toMatchObject({
      source: { tab: 'chartEmployees' },
      parent: { id: member.id },
      preferredCompanyId: 'b',
    });
    expect(employeeTarget.employeeId).toBeUndefined();
    const rootTarget = chartNodeFormTarget(
      'UNIT',
      nodes.find((n) => n.id === 'b'),
      [unit, member],
      nodes,
    );
    expect(rootTarget.parent).toBeUndefined();
    expect(rootTarget.preferredCompanyId).toBe('b');
  });
  it('keeps read-only charts free of mutation and movement controls', () => {
    const html = renderToStaticMarkup(
      <OrganizationChart
        nodes={build()}
        editable={false}
        onEdit={noop}
        onDelete={noop}
        onAddEmployee={noop}
        onPositionChange={async () => undefined}
      />,
    );
    expect(html).not.toContain('<button');
    expect(html).toContain('همکار');
  });
  it('keeps system roots immutable and skips deleted/missing employee nodes', () => {
    const nodes = build([
      unit,
      { ...member, employeeId: 'missing' },
      { ...member, id: 'deleted', deletedAt: '2026-10-25' },
    ]);
    expect(nodes.some((n) => n.kind === 'EMPLOYEE')).toBe(false);
    expect(nodes.find((n) => n.id === 'b')?.mutable).toBe(false);
    const html = renderToStaticMarkup(
      <OrganizationChart
        nodes={nodes}
        onEdit={noop}
        onDelete={noop}
        onAddDepartment={noop}
        onAddEmployee={noop}
        onPositionChange={async () => undefined}
      />,
    );
    expect(html).not.toContain('aria-label="ویرایش شرکت"');
    expect(html).toContain('aria-label="افزودن کارکن زیر شرکت"');
  });
  it('preserves each authorized legacy branch root and form option when other branches have companies', () => {
    const company = record('company-a', 'branches');
    const branches = [
      { id: 'b', name: 'اول' },
      { id: 'legacy', name: 'دوم' },
    ];
    const nodes = buildLiveOrganizationNodes([company], branches, []);
    expect(
      nodes.filter((n) => n.kind === 'MANAGEMENT').map((n) => n.id),
    ).toEqual(['company-a', 'legacy']);
    const options = hrCompanies({
      records: [company],
      branches,
    } as unknown as HrBootstrapDto);
    expect(
      options.map((o) => [o.id, o.branchId, o.organizationBranchId]),
    ).toEqual([
      ['company-a', 'b', 'company-a'],
      ['legacy', 'legacy', ''],
      ['hr-headquarters', 'b', ''],
    ]);
    const target = chartNodeFormTarget(
      'EMPLOYEE',
      nodes.find((n) => n.id === 'legacy'),
      [company],
      nodes,
    );
    expect(target.preferredCompanyId).toBe('legacy');
    expect(target.parent).toBeUndefined();
  });
  it('does not project stale membership after personnel move to another company or branch', () => {
    const branches = [{ id: 'b', name: 'شرکت' }];
    expect(
      buildLiveOrganizationNodes([unit, member], branches, [
        { ...employee, branchId: 'other' },
      ]).some((n) => n.kind === 'EMPLOYEE'),
    ).toBe(false);
    expect(
      buildLiveOrganizationNodes(
        [unit, { ...member, data: { organizationBranchId: 'old-company' } }],
        branches,
        [{ ...employee, organizationBranchId: 'current-company' }],
      ).some((n) => n.kind === 'EMPLOYEE'),
    ).toBe(false);
  });
  it('renders custom employee node titles and retains orphan visibility without broken recursion', () => {
    const nodes = build([
      unit,
      { ...member, parentId: 'unavailable', values: ['همکار', 'مسئول مالی'] },
    ]);
    expect(nodes.find((n) => n.id === 'member')).toMatchObject({
      name: 'مسئول مالی',
      parentId: 'b',
    });
    expect(sourceForRecord(member).label).toBe('کارکن چارت');
    expect(parentFieldLabel('organization', 'chartEmployees')).toBe('گره والد');
  });
});
