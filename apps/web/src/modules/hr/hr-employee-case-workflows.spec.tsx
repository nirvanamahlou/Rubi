import { renderToStaticMarkup } from 'react-dom/server';
import { beforeEach, describe, expect, it, vi } from 'vitest';
import type { ComponentProps, MouseEvent } from 'react';
import type { HrEmployeeDto, HrRecordDto } from '@nora/contracts';
import { getHrResource } from '@nora/contracts';
import { HrEmployeeProfile } from './hr-employee-profile';
import type { HrStore } from './hr-store';
import type { HrButton, HrTable } from './hr-controls';
import type * as ControlsModule from './hr-controls';
import type * as AccessModule from '@/modules/iam/access-context';
import { canonicalHrLocation, employeeGroups, hrGroups } from './hr-navigation';
import { hrHubCards } from './hr.model';
import { ContextualHrForm } from './contextual-hr-form';
import { hrReferenceOptions, retiredHrColumns } from './hr-form-model';

const captured = vi.hoisted(() => ({
  buttons: [] as ComponentProps<typeof HrButton>[],
  tables: [] as ComponentProps<typeof HrTable>[],
  records: [] as HrRecordDto[],
  denied: [] as string[],
}));
vi.mock('@/modules/iam/access-context', async (original) => {
  const actual = await original<typeof AccessModule>();
  return {
    ...actual,
    useRouteAccess: () => (href: string) =>
      !captured.denied.some((prefix) => href.startsWith(prefix)),
  };
});
vi.mock('./hr-employee-records', () => ({
  useHrEmployeeRecords: () => ({ records: captured.records, loading: false }),
}));
vi.mock('./hr-reference-data', () => ({
  useHrReferenceData: (store: HrStore) => ({
    data: store.data,
    loading: false,
  }),
}));
vi.mock('./hr-directory-picker', () => ({
  useHrFormReferences: () => ({ data: { users: [] } }),
}));
vi.mock('./hr-controls', async (original) => {
  const actual = await original<typeof ControlsModule>();
  return {
    ...actual,
    HrButton: (props: ComponentProps<typeof HrButton>) => {
      captured.buttons.push(props);
      return <actual.HrButton {...props} />;
    },
    HrTable: (props: ComponentProps<typeof HrTable>) => {
      captured.tables.push(props);
      return <actual.HrTable {...props} />;
    },
  };
});

const employee = {
  id: 'employee-a',
  branchId: 'branch-a',
  personnelCode: '100',
  name: 'Synthetic Employee',
  unit: 'Operations',
  position: 'Analyst',
  startedAtValue: '2026-10-25',
  status: 'فعال',
  version: 1,
} as HrEmployeeDto;
const data = {
  employees: [employee],
  branches: [{ id: employee.branchId, name: 'Branch' }],
  records: [],
  capabilities: { write: true, sensitive: false, audit: false },
};
const store = { data, revision: 0, remember: vi.fn() } as unknown as HrStore;

beforeEach(() => {
  captured.buttons.length = 0;
  captured.tables.length = 0;
  captured.records = [];
  captured.denied = [];
});

describe('optional employee case workflows', () => {
  it.each([
    ['promotion', 'lifecycle', 'promotion'],
    ['transfer', 'lifecycle', 'transfer'],
    ['separation', 'lifecycle', 'separation'],
    ['leave', 'time', 'leave'],
    ['active', 'contracts', 'active'],
    ['amendments', 'contracts', 'amendments'],
  ])(
    'opens the existing %s form bound to this employee',
    (initialTab, section, tab) => {
      const onForm = vi.fn();
      renderToStaticMarkup(
        <HrEmployeeProfile
          employee={employee}
          initialTab={initialTab}
          store={store}
          onForm={onForm}
          onSelect={() => {}}
        />,
      );
      captured.buttons
        .find((button) => button.primary)
        ?.onClick?.({} as MouseEvent<HTMLButtonElement>);
      expect(onForm).toHaveBeenCalledWith(
        expect.objectContaining({
          employeeId: employee.id,
          source: expect.objectContaining({ section, tab }),
        }),
      );
    },
  );

  it('keeps edits bound to the employee and the existing record version', () => {
    const record = {
      id: 'promotion-a',
      employeeId: employee.id,
      section: 'lifecycle',
      tab: 'promotion',
      columns: getHrResource('lifecycle', 'promotion')!.columns,
      values: [
        employee.name,
        'Analyst',
        'G4',
        'Engineer',
        'G5',
        '2026-10-25',
        '',
      ],
      data: {},
      code: 'JOB-1',
      version: 4,
      status: 'پیش‌نویس',
    } as HrRecordDto;
    captured.records = [record];
    const onForm = vi.fn();
    renderToStaticMarkup(
      <HrEmployeeProfile
        employee={employee}
        initialTab="promotion"
        store={store}
        onForm={onForm}
        onSelect={() => {}}
      />,
    );
    captured.tables.find((table) => table.onEdit)?.onEdit?.(0);
    expect(onForm).toHaveBeenCalledWith(
      expect.objectContaining({ employeeId: employee.id, record }),
    );
  });

  it('shows profile editing but does not require or open any optional form on entry', () => {
    const onForm = vi.fn();
    const html = renderToStaticMarkup(
      <HrEmployeeProfile
        employee={employee}
        store={store}
        onForm={onForm}
        onSelect={() => {}}
      />,
    );
    expect(html).toContain('ویرایش مشخصات');
    expect(html).toContain(employee.name);
    expect(html).toContain('عنوان شغلی');
    expect(onForm).not.toHaveBeenCalled();
    expect(captured.buttons.some((button) => button.primary)).toBe(false);
  });

  it('retains read-only permissions for an employee viewer', () => {
    const viewer = {
      ...store,
      data: { ...data, capabilities: { ...data.capabilities, write: false } },
    } as unknown as HrStore;
    const html = renderToStaticMarkup(
      <HrEmployeeProfile
        employee={employee}
        initialTab="active"
        store={viewer}
        onForm={vi.fn()}
        onSelect={() => {}}
      />,
    );
    expect(html).not.toContain('ویرایش مشخصات');
    expect(captured.buttons.some((button) => button.primary)).toBe(false);
  });

  it('does not re-expose a restricted source after moving it into the employee case', () => {
    captured.denied = ['/hr?section=contracts'];
    const html = renderToStaticMarkup(
      <HrEmployeeProfile
        employee={employee}
        initialTab="active"
        store={store}
        onForm={vi.fn()}
        onSelect={() => {}}
      />,
    );
    expect(html).not.toContain('>قراردادها</button>');
    expect(html).not.toContain('ثبت قرارداد');
    expect(captured.buttons.some((button) => button.primary)).toBe(false);
  });

  it('moves workflows out of the hub/time menu and keeps legacy links employee-centred', () => {
    expect(
      hrHubCards.some((card) => ['lifecycle', 'contracts'].includes(card.id)),
    ).toBe(false);
    expect(hrGroups.time?.some((group) => group.id === 'leaves')).toBe(false);
    for (const id of ['changes', 'exit', 'contracts', 'leaves'])
      expect(employeeGroups.some((group) => group.id === id)).toBe(true);
    expect(canonicalHrLocation('contracts', 'active')).toEqual({
      section: 'employees',
      tab: 'active',
    });
    expect(canonicalHrLocation('lifecycle', 'promotion', employee.id)).toEqual({
      section: 'employee',
      tab: 'promotion',
    });
    expect(canonicalHrLocation('time', 'leave', employee.id)).toEqual({
      section: 'employee',
      tab: 'leave',
    });
  });

  it('labels historical position inputs as job titles and uses the shared catalogue', () => {
    const definition = getHrResource('lifecycle', 'promotion')!;
    const references = {
      ...data,
      jobTitles: [{ id: 'title-a', name: 'Engineer', status: 'فعال' }],
    } as unknown as NonNullable<HrStore['data']>;
    const html = renderToStaticMarkup(
      <ContextualHrForm
        context={{
          section: 'lifecycle',
          tab: 'promotion',
          title: 'ارتقا',
          description: '',
          columns: ['شناسه', ...definition.columns],
          mode: 'create',
          hiddenLabels: retiredHrColumns('lifecycle', 'promotion'),
          optionsByLabel: hrReferenceOptions(
            references,
            'lifecycle',
            'promotion',
            employee.branchId,
          ),
        }}
        onCancel={() => {}}
        onSubmit={() => {}}
      />,
    );
    expect(html).toContain('عنوان شغلی جدید');
    expect(html).toContain('value="Engineer"');
    expect(html).not.toContain('ورود سمت');
    expect(definition.columns[3]).toBe('سمت جدید');
  });
});
