import { readFileSync } from 'node:fs';
import { renderToStaticMarkup } from 'react-dom/server';
import { describe, expect, it } from 'vitest';
import { HrState, HrWorkspace } from './hr-workspace';
import {
  NewEmployeeForm,
  validateNewEmployeeForm,
  type NewEmployeeFormValue,
} from './new-employee-dialog';
import {
  initialOrganizationNodes,
  OrganizationChart,
  OrganizationNodeForm,
  validateOrganizationNodeForm,
  type OrganizationNodeFormValue,
} from './organization-chart';
import {
  initialOrganizationCatalogRecords,
  OrganizationCatalogForm,
  organizationCatalogSchemas,
  OrganizationCatalogTable,
  validateOrganizationCatalogForm,
  type OrganizationCatalogFormValue,
  type OrganizationCatalogTab,
} from './organization-catalog';
import {
  buildContextualHrFields,
  ContextualHrForm,
  type ContextualHrFormContext,
} from './contextual-hr-form';
import {
  employeeTabs,
  hrHubCards,
  iranLocalizationStatus,
  normalizeSection,
  sectionTabs,
} from './hr.model';

describe('HR reference implementation', () => {
  it('renders the eighteen capability hub cards as deep links', () => {
    const html = renderToStaticMarkup(<HrWorkspace sectionId="home" />);
    expect(hrHubCards).toHaveLength(18);
    expect(html).toContain('dir="rtl"');
    expect(html).toContain('data-hr-mode="preview"');
    for (const card of hrHubCards) {
      expect(html).toContain(card.title);
      expect(html).toContain(`/hr?section=${card.id}`);
    }
  });

  it('fills the overview with explicit preview metrics and working filters', () => {
    const html = renderToStaticMarkup(<HrWorkspace sectionId="dashboard" />);
    for (const value of ['۸۶', '۷۳', '۹', '۱۴', '۷', '۲۳', '۲۸۶ ساعت', '۹۴٪']) {
      expect(html).toContain(value);
    }
    expect(html).toContain('امروز — ۱۴ شهریور ۱۴۰۵');
    expect(html).toContain('همه شعب');
    expect(html).toContain('همه واحدها');
    expect(html).toContain('اعمال فیلتر');
    expect(html).toContain('داده آزمایشی');
    expect(html).not.toContain('داده متصل موجود نیست');
    expect(html).not.toContain('منبع عملیاتی متصل نیست');
    expect(html).not.toContain('خروجی داشبورد');
    expect(html).not.toContain('ورود کارمند');
  });

  it('provides the complete employee profile and section tab sets', () => {
    expect(employeeTabs).toHaveLength(15);
    expect(sectionTabs.organization).toHaveLength(6);
    expect(sectionTabs.recruitment).toHaveLength(7);
    expect(sectionTabs.recruitment?.map((tab) => tab.label)).not.toContain(
      'معرفی کارکنان',
    );
    expect(sectionTabs.lifecycle).toHaveLength(7);
    expect(sectionTabs.contracts).toHaveLength(5);
    expect(sectionTabs.time).toHaveLength(13);
    expect(sectionTabs.development).toHaveLength(8);
    expect(sectionTabs.expenses).toHaveLength(4);
    expect(sectionTabs.benefits).toHaveLength(6);
    expect(sectionTabs.fleet).toHaveLength(2);
    expect(sectionTabs.requests).toHaveLength(9);
    expect(sectionTabs.finance).toHaveLength(4);
    expect(sectionTabs.reports).toHaveLength(3);
    expect(sectionTabs.payroll).toHaveLength(10);
    expect(sectionTabs.hrSettings).toHaveLength(6);
    const html = renderToStaticMarkup(<HrWorkspace sectionId="employee" />);
    for (const tab of employeeTabs) expect(html).toContain(tab.label);
    expect(html).toContain('••••••••');
  });

  it('uses explicit preview identifiers and no reference personal data', () => {
    const employees = renderToStaticMarkup(
      <HrWorkspace sectionId="employees" />,
    );
    expect(employees).toContain('preview-employee-1');
    expect(employees).toContain('همکار نمایشی الف');
    expect(employees.match(/همکار نمایشی/g)?.length ?? 0).toBe(4);
    expect(employees).not.toContain('ورود گروهی');
    expect(employees).not.toMatch(/EMP-\d|EMPLOY-\d/);
  });

  it('uses first and last name in the new employee form and covers list fields', () => {
    const html = renderToStaticMarkup(
      <NewEmployeeForm
        existingPersonnelCodes={['preview-employee-1']}
        managerOptions={['مدیر نمایشی الف']}
        onCancel={() => undefined}
        onSubmit={() => undefined}
      />,
    );
    for (const label of [
      'نام *',
      'نام خانوادگی *',
      'کد پرسنلی *',
      'نوع همکاری *',
      'شعبه *',
      'واحد *',
      'سمت *',
      'مدیر مستقیم',
      'تاریخ شروع *',
      'وضعیت *',
    ])
      expect(html).toContain(label);
    expect(html).not.toContain('عنوان نمایشی');
    expect(html).toContain('name="firstName"');
    expect(html).toContain('name="lastName"');
    expect(html).toContain('id="hr-new-employee-started-at"');
  });

  it('rejects incomplete and duplicate employee identity fields', () => {
    const value: NewEmployeeFormValue = {
      firstName: '',
      lastName: '',
      personnelCode: ' PREVIEW-EMPLOYEE-1 ',
      employmentType: 'تمام‌وقت',
      branch: 'نیایش سیر',
      unit: 'عملیات سفر',
      position: '',
      manager: 'بدون مدیر مستقیم',
      startedAt: '',
      status: 'فعال',
    };
    expect(validateNewEmployeeForm(value, ['preview-employee-1'])).toEqual({
      firstName: 'نام الزامی است.',
      lastName: 'نام خانوادگی الزامی است.',
      personnelCode: 'این کد پرسنلی قبلاً استفاده شده است.',
      position: 'سمت الزامی است.',
      startedAt: 'تاریخ شروع همکاری الزامی است.',
    });
    expect(
      validateNewEmployeeForm(
        {
          ...value,
          firstName: 'نگار',
          lastName: 'زمانی',
          personnelCode: 'HR-1001',
          position: 'کارشناس عملیات',
          startedAt: '2026-09-06',
        },
        ['preview-employee-1'],
      ),
    ).toEqual({});
  });

  it('renders an editable organization chart and a structure-aware form', () => {
    const chart = renderToStaticMarkup(
      <OrganizationChart
        nodes={initialOrganizationNodes}
        onEdit={() => undefined}
      />,
    );
    expect(chart).toContain('مدیریت نمایشی');
    expect(chart).toContain('واحد عملیات سفر');
    expect(chart.match(/ویرایش /g)?.length ?? 0).toBe(4);
    expect(chart).toContain('۲ سمت');

    const form = renderToStaticMarkup(
      <OrganizationNodeForm
        branchOptions={['نیایش سیر', 'جهان باستان']}
        initialNode={initialOrganizationNodes[1]}
        managerOptions={['همکار نمایشی الف', 'همکار نمایشی ب']}
        nodes={initialOrganizationNodes}
        onCancel={() => undefined}
        onSubmit={() => undefined}
      />,
    );
    for (const label of [
      'شناسه ساختاری *',
      'عنوان *',
      'نوع گره *',
      'وضعیت *',
      'شعبه *',
      'واحد والد *',
      'مسئول / مدیر',
      'ظرفیت سمت‌ها *',
      'تاریخ اثر *',
    ])
      expect(form).toContain(label);
    expect(form).toContain('value="preview-org-travel"');
    expect(form).toContain('ذخیره ویرایش');
  });

  it('validates organization identity, hierarchy and position capacity', () => {
    const value: OrganizationNodeFormValue = {
      id: ' PREVIEW-ORG-TRAVEL ',
      name: '',
      kind: 'UNIT',
      branch: '',
      parentId: '',
      manager: 'تعیین نشده',
      positionCapacity: '-1',
      effectiveFrom: '',
      status: 'فعال',
    };
    expect(
      validateOrganizationNodeForm(
        value,
        initialOrganizationNodes.map((node) => node.id),
      ),
    ).toEqual({
      id: 'این شناسه ساختاری قبلاً استفاده شده است.',
      name: 'عنوان ساختار الزامی است.',
      branch: 'شعبه الزامی است.',
      parentId: 'واحد سازمانی باید یک والد داشته باشد.',
      positionCapacity: 'ظرفیت سمت باید عددی بین صفر تا ۹۹۹۹ باشد.',
      effectiveFrom: 'تاریخ اثر الزامی است.',
    });
  });

  it.each([
    ['branches', 'کد شعبه', 'نام شعبه', 'افزودن شعبه'],
    ['units', 'کد واحد', 'نام واحد', 'افزودن واحد سازمانی'],
    ['positions', 'کد سمت', 'عنوان شغل', 'افزودن شغل و سمت'],
    ['grades', 'کد رده', 'سطح سازمانی', 'افزودن رده شغلی'],
    ['groups', 'کد گروه', 'معیار عضویت', 'افزودن گروه کارکنان'],
  ] as const)(
    'renders the %s catalog with its own create form',
    (tab, firstLabel, secondLabel, submitLabel) => {
      const form = renderToStaticMarkup(
        <OrganizationCatalogForm
          managers={['همکار نمایشی الف']}
          onCancel={() => undefined}
          onSubmit={() => undefined}
          records={initialOrganizationCatalogRecords}
          tab={tab}
        />,
      );
      expect(form).toContain(firstLabel);
      expect(form).toContain(secondLabel);
      expect(form).toContain(submitLabel);
      const table = renderToStaticMarkup(
        <OrganizationCatalogTable
          onEdit={() => undefined}
          records={initialOrganizationCatalogRecords[tab]}
          tab={tab}
        />,
      );
      expect(table).toContain('ویرایش');
      expect(table).toContain(
        organizationCatalogSchemas[tab].columns[0]?.label,
      );
    },
  );

  it('connects the branch tab to its specific add action and populated list', () => {
    const html = renderToStaticMarkup(
      <HrWorkspace sectionId="organization" tabId="branches" />,
    );
    expect(html).toContain('افزودن شعبه');
    expect(html).toContain('نیایش سیر');
    expect(html).toContain('جهان باستان');
    expect(html).toContain('ویرایش');
  });

  it('validates required fields and duplicate identifiers in organization catalogs', () => {
    const value = Object.fromEntries(
      [
        'id',
        'title',
        'company',
        'city',
        'manager',
        'branch',
        'parent',
        'jobTitle',
        'unit',
        'grade',
        'capacity',
        'level',
        'rank',
        'groupType',
        'description',
        'effectiveFrom',
        'status',
      ].map((key) => [key, '']),
    ) as OrganizationCatalogFormValue;
    value.id = ' PREVIEW-BRANCH-NIYAYESH-SEIR ';
    const errors = validateOrganizationCatalogForm(
      'branches' satisfies OrganizationCatalogTab,
      value,
      initialOrganizationCatalogRecords.branches.map((item) => item.id),
    );
    expect(errors.id).toBe('این شناسه قبلاً استفاده شده است.');
    expect(errors.title).toBe('نام شعبه الزامی است.');
    expect(errors.company).toBe('شرکت / شخصیت حقوقی الزامی است.');
    expect(errors.city).toBe('شهر الزامی است.');
    expect(errors.effectiveFrom).toBe('تاریخ اثر الزامی است.');
    expect(errors.status).toBe('وضعیت الزامی است.');
  });

  it('builds contextual HR forms from each section data columns', () => {
    const columns = [
      'شناسه',
      'کارمند',
      'نوع',
      'ارز',
      'مبلغ',
      'مرحله تأیید',
      'وضعیت مالی',
      'عملیات',
    ] as const;
    const fields = buildContextualHrFields(columns);
    expect(fields.map((field) => field.label)).toEqual(columns.slice(0, -1));
    expect(fields.find((field) => field.label === 'کارمند')?.type).toBe(
      'select',
    );
    expect(fields.find((field) => field.label === 'مبلغ')?.type).toBe(
      'number',
    );
    expect(fields.find((field) => field.label === 'وضعیت مالی')?.type).toBe(
      'select',
    );

    const context: ContextualHrFormContext = {
      section: 'expenses',
      tab: 'claims',
      title: 'بازپرداخت هزینه',
      description: 'ثبت بازپرداخت هزینه کارکنان',
      columns,
      mode: 'create',
    };
    const html = renderToStaticMarkup(
      <ContextualHrForm
        context={context}
        onCancel={() => undefined}
        onSubmit={() => undefined}
      />,
    );
    for (const column of columns.slice(0, -1)) expect(html).toContain(column);
    expect(html).toContain('افزودن بازپرداخت هزینه');
    expect(html).not.toContain('عنوان نمایشی');
  });

  it('keeps payroll and exports in a truthful preview state', () => {
    const html = renderToStaticMarkup(<HrWorkspace sectionId="payroll" />);
    expect(html).toContain('اجرای حقوق غیرفعال است');
    expect(html).toContain('preview-payrun-v1');
    expect(html).toContain('محاسبه قانونی');
    expect(html.match(/disabled/g)?.length ?? 0).toBeGreaterThanOrEqual(2);
    expect(html).not.toContain('میلیارد');
  });

  it.each([
    ['recruitment', 'جذب و استخدام', 'preview-recruitment-staffing-1'],
    ['lifecycle', 'چرخه همکاری', 'preview-lifecycle-onboarding-1'],
    ['expenses', 'مأموریت و هزینه‌ها', 'preview-expenses-travel-1'],
    ['benefits', 'مالیات و مزایا', 'preview-benefits-tax-slab-1'],
    ['fleet', 'خودروهای سازمانی', 'preview-fleet-vehicle-1'],
    ['hrSettings', 'تنظیمات و یکپارچگی', 'preview-settings-workflow-1'],
  ] as const)('renders the %s capability preview', (section, title, id) => {
    const html = renderToStaticMarkup(<HrWorkspace sectionId={section} />);
    expect(html).toContain(title);
    expect(html).toContain(id);
    expect(html).toContain('فقط شناسه‌ها و ردیف‌های صریحاً نمایشی');
  });

  it('states the exact Iran localization boundary', () => {
    const html = renderToStaticMarkup(
      <HrWorkspace sectionId="hrSettings" tabId="companies" />,
    );
    expect(html).toContain('چندشرکتی و بومی‌سازی');
    expect(html).toContain('در انتظار تأیید قانونی');
    expect(html).toContain('BLOCKED_FOR_APPROVED_RULES');
    expect(iranLocalizationStatus).toEqual([
      {
        id: 'persian-calendar',
        label: 'تقویم شمسی رابط',
        status: 'IMPLEMENTED_IN_UI',
      },
      {
        id: 'insurance-export',
        label: 'خروجی بیمه ایران',
        status: 'BLOCKED_FOR_APPROVED_RULES',
      },
      {
        id: 'tax-export',
        label: 'خروجی مالیات ایران',
        status: 'BLOCKED_FOR_APPROVED_RULES',
      },
      {
        id: 'bank-export',
        label: 'خروجی بانکی ایران',
        status: 'BLOCKED_FOR_PUBLIC_CONTRACT',
      },
    ]);
  });

  it('uses the shared calendar picker and responsive internal scrolling', () => {
    const html = renderToStaticMarkup(<HrWorkspace sectionId="contracts" />);
    expect(html).toContain('id="hr-from-date"');
    expect(html).not.toMatch(/type="date"|type="datetime-local"/);
    const css = readFileSync(
      new URL('./hr-workspace.module.css', import.meta.url),
      'utf8',
    );
    expect(css).toContain('overflow-x: auto');
    expect(css).toContain('@media (max-width: 760px)');
    expect(css).toContain('grid-template-columns: 1fr');
  });

  it('normalizes unsupported routes to the hub', () => {
    expect(normalizeSection()).toBe('home');
    expect(normalizeSection('unknown')).toBe('home');
    expect(normalizeSection('finance')).toBe('finance');
  });

  it.each(['loading', 'empty', 'error', 'unauthorized', 'forbidden'] as const)(
    'renders the %s fallback without leaking private values',
    (state) => {
      const html = renderToStaticMarkup(<HrState state={state} />);
      expect(html).not.toContain('undefined');
      expect(html).not.toContain('preview-employee');
    },
  );
});
