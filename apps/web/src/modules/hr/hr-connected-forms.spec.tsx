import { describe, expect, it } from 'vitest';
import { renderToStaticMarkup } from 'react-dom/server';
import {
  getHrResource,
  type HrBootstrapDto,
  type HrRecordDto,
} from '@nora/contracts';
import { hrReferenceOptions, parentFieldLabel } from './hr-form-model';
import { recordsDataset } from './hr-live-data';
import { selectedHrDataset } from './hr-row-selection';
import {
  ContextualHrForm,
  buildContextualHrFields,
} from './contextual-hr-form';
import { HrTable } from './hr-controls';

function record(
  id: string,
  section: string,
  tab: string,
  values: string[],
  company = 'company-a',
): HrRecordDto {
  return {
    id,
    section,
    tab,
    values,
    columns: [...getHrResource(section, tab)!.columns],
    code: id,
    branchId: 'scope',
    employeeId: null,
    parentId: null,
    version: 1,
    status: 'فعال',
    data: { organizationBranchId: company },
    deletedAt: null,
    appliedAt: null,
    effectiveAt: null,
    createdAt: '2026-09-09T00:00:00Z',
    updatedAt: '2026-09-09T00:00:00Z',
  };
}

describe('connected HR forms and selection exports', () => {
  it('fills recruitment requisition fields from the selected company resources', () => {
    const data = {
      records: [
        record('unit-a', 'organization', 'units', ['واحد عملیات'], 'company-a'),
        record(
          'position-a',
          'organization',
          'positions',
          ['کارشناس عملیات', '', 'واحد عملیات'],
          'company-a',
        ),
        record(
          'unit-b',
          'organization',
          'units',
          ['واحد شرکت دیگر'],
          'company-b',
        ),
        record(
          'position-b',
          'organization',
          'positions',
          ['سمت شرکت دیگر', 'شغل شرکت دیگر'],
          'company-b',
        ),
      ],
      employees: [
        {
          id: 'employee-a',
          name: 'درخواست‌کننده واقعی',
          branchId: 'scope',
          organizationBranchId: 'company-a',
          status: 'فعال',
        },
        {
          id: 'employee-b',
          name: 'کارمند شرکت دیگر',
          branchId: 'scope',
          organizationBranchId: 'company-b',
          status: 'فعال',
        },
      ],
      branches: [],
    } as unknown as HrBootstrapDto;
    const options = hrReferenceOptions(
      data,
      'recruitment',
      'requisitions',
      'scope',
      'company-a',
    );
    expect(options['عنوان شغل']).toEqual(['کارشناس عملیات']);
    expect(options['واحد درخواست‌کننده']).toEqual(['واحد عملیات']);
    expect(options['درخواست‌کننده']).toEqual(['درخواست‌کننده واقعی']);
    const html = renderToStaticMarkup(
      <ContextualHrForm
        context={{
          section: 'recruitment',
          tab: 'requisitions',
          title: 'درخواست جذب',
          description: '',
          mode: 'create',
          columns: [
            'شناسه',
            ...getHrResource('recruitment', 'requisitions')!.columns,
          ],
          optionsByLabel: options,
          peopleOptions: [],
        }}
        onCancel={() => undefined}
        onSubmit={() => undefined}
      />,
    );
    expect(html).toContain('کارشناس عملیات');
    expect(html).toContain('واحد عملیات');
    expect(html).toContain('درخواست‌کننده واقعی');
    expect(html).not.toContain('شغل شرکت دیگر');
    expect(html).not.toContain('واحد شرکت دیگر');
    expect(html).not.toContain('کارمند شرکت دیگر');
  });
  it('uses stored titles, excluding removed entries and other companies', () => {
    const records = [
      record('unit', 'organization', 'units', ['واحد واقعی']),
      record('position', 'organization', 'positions', [
        'سمت واقعی',
        'شغل واقعی',
      ]),
      record('grade', 'organization', 'grades', ['رده واقعی']),
      record('opening', 'recruitment', 'openings', ['فرصت واقعی']),
      record('plan', 'recruitment', 'staffing', ['برنامه واقعی']),
      record('other', 'organization', 'units', ['واحد شرکت دیگر'], 'company-b'),
      {
        ...record('deleted', 'organization', 'positions', ['سمت حذف‌شده']),
        deletedAt: '2026-09-09T00:00:00Z',
      },
    ];
    const data = {
      records,
      employees: [],
      branches: [],
    } as unknown as HrBootstrapDto;
    const options = hrReferenceOptions(
      data,
      'lifecycle',
      'promotion',
      'scope',
      'company-a',
    );
    expect(options['واحد']).toEqual(['واحد واقعی']);
    expect(options['سمت جدید']).toEqual(['سمت واقعی']);
    expect(options['سمت فعلی']).toEqual(['سمت واقعی']);
    expect(options['رده جدید']).toContain('کارشناس ارشد');
    expect(options['رده جدید']).toContain('رده واقعی');
    expect(options['فرصت شغلی']).toEqual(['برنامه واقعی']);
    expect(
      hrReferenceOptions(data, 'organization', 'positions', 'scope')[
        'عنوان شغل'
      ],
    ).toBeUndefined();
  });
  it('keeps persisted positions stable while omitting retired branch/asset columns from reports', () => {
    const branch = record('branch', 'organization', 'branches', [
      'شعبه',
      'شرکت',
      'تهران',
      'مدیر',
      '2026-09-09',
    ]);
    const data = recordsDataset('organization', 'branches', [branch]);
    expect(data.columns).not.toContain('تاریخ اثر');
    expect(data.rows[0]).toEqual([
      'branch',
      'شعبه',
      'شرکت',
      'تهران',
      'مدیر',
      'فعال',
    ]);
    expect(branch.values[4]).toBe('2026-09-09');
    const asset = recordsDataset('assets', 'list', [
      record('asset', 'assets', 'list', [
        'کارمند',
        'لپ‌تاپ',
        'A-1',
        'old-serial',
        '2026-09-09',
        'سالم',
      ]),
    ]);
    expect(asset.columns).not.toContain('شماره سریال');
    expect(asset.rows[0]).not.toContain('old-serial');
    expect(asset.rows[0]?.length).toBe(asset.columns.length);
  });
  it('exports only selected existing IDs, including identical names, and keeps metadata aligned', () => {
    const data = {
      columns: ['کد', 'نام'],
      rows: [
        ['A', 'همنام'],
        ['B', 'همنام'],
      ],
      recordIds: ['id-a', 'id-b'],
      versions: [2, 3],
      totalLabel: '',
    };
    const result = selectedHrDataset(data, new Set(['id-b', 'removed-id']));
    expect(result.rows).toEqual([['B', 'همنام']]);
    expect(result.recordIds).toEqual(['id-b']);
    expect(result.versions).toEqual([3]);
    expect(selectedHrDataset(data, new Set()).rows).toEqual([]);
  });
  it('shows row and page selection without redundant view buttons', () => {
    const html = renderToStaticMarkup(
      <HrTable
        data={{
          columns: ['کد', 'نام'],
          rows: [
            ['A', 'الف'],
            ['B', 'ب'],
          ],
          recordIds: ['a', 'b'],
          totalLabel: '',
        }}
        onOpen={() => undefined}
      />,
    );
    expect(html.match(/type="checkbox"/g)).toHaveLength(3);
    expect(html).toContain('انتخاب همه رکوردهای این صفحه');
    expect(html).not.toContain('>مشاهده ');
  });
  it('hides duplicate employee/company fields while keeping their values in the form model', () => {
    const html = renderToStaticMarkup(
      <ContextualHrForm
        context={{
          section: 'contracts',
          tab: 'active',
          title: 'قرارداد',
          description: '',
          mode: 'create',
          columns: ['شناسه', 'کارمند', 'شرکت', 'نوع قرارداد'],
          hiddenLabels: ['کارمند', 'شرکت'],
          presetValues: { کارمند: 'همکار', شرکت: 'شرکت واقعی' },
        }}
        onCancel={() => undefined}
        onSubmit={() => undefined}
      />,
    );
    expect(html).not.toContain('hr-contracts-active-field-2');
    expect(html).not.toContain('hr-contracts-active-field-3');
    expect(html).toContain('hr-contracts-active-field-4');
  });
  it('makes the expense receipt a real file input and names parent selectors by purpose', () => {
    expect(buildContextualHrFields(['مدرک هزینه'])[0]?.type).toBe('file');
    expect(parentFieldLabel('organization', 'units')).toBe('واحد والد');
    expect(parentFieldLabel('recruitment', 'applicants')).toBe('برنامه جذب');
    expect(getHrResource('recruitment', 'applicants')?.parentResources).toEqual(
      ['recruitment.staffing', 'recruitment.openings'],
    );
  });
});
