import { readFileSync } from 'node:fs';
import { renderToStaticMarkup } from 'react-dom/server';
import { describe, expect, it } from 'vitest';
import {
  appendAutomaticHrHistory,
  HrState,
  HrWorkspace,
  isAutomaticHrHistoryTab,
  parseHrPreviewDatasetOverrides,
  parsePreviewEmployees,
  removeHrPreviewRow,
  saveHrPreviewRow,
} from './hr-workspace';
import {
  NewEmployeeForm,
  nextEmployeePersonnelCode,
  validateNewEmployeeForm,
  type NewEmployeeFormValue,
} from './new-employee-dialog';
import {
  getOrganizationRelationships,
  initialOrganizationNodes,
  nextOrganizationNodeId,
  OrganizationChart,
  OrganizationNodeForm,
  synchronizeOrganizationChartWithCatalog,
  validateOrganizationNodeForm,
  type OrganizationNodeFormValue,
} from './organization-chart';
import {
  initialOrganizationCatalogRecords,
  nextOrganizationCatalogId,
  OrganizationCatalogForm,
  organizationCatalogSchemas,
  OrganizationCatalogTable,
  validateOrganizationCatalogForm,
  type OrganizationCatalogFormValue,
  type OrganizationCatalogRecords,
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
import { getHrPreviewDataset } from './hr-preview-data';

describe('HR reference implementation', () => {
  it('renders the eighteen capability hub cards as deep links', () => {
    const html = renderToStaticMarkup(<HrWorkspace sectionId="home" />);
    expect(hrHubCards).toHaveLength(16);
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
    expect(html).not.toContain('انتخاب ماه و سال به‌صورت گردشی');
  });

  it('provides the complete employee profile and section tab sets', () => {
    expect(employeeTabs).toHaveLength(15);
    expect(sectionTabs.organization).toHaveLength(5);
    expect(sectionTabs.organization?.map((tab) => tab.label)).not.toContain(
      'نوع کارکنان',
    );
    expect(sectionTabs.recruitment).toHaveLength(7);
    expect(sectionTabs.recruitment?.map((tab) => tab.label)).not.toContain(
      'معرفی کارکنان',
    );
    expect(sectionTabs.lifecycle).toHaveLength(6);
    expect(sectionTabs.contracts).toHaveLength(5);
    expect(sectionTabs.time).toHaveLength(10);
    expect(sectionTabs.development).toHaveLength(6);
    expect(sectionTabs.expenses).toHaveLength(4);
    expect(sectionTabs.benefits).toHaveLength(6);
    expect(sectionTabs.fleet).toHaveLength(2);
    expect(sectionTabs.requests).toHaveLength(1);
    expect(sectionTabs.finance).toHaveLength(5);
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
    expect(employees.match(/<b>همکار نمایشی/g)?.length ?? 0).toBe(4);
    expect(employees).not.toContain('ورود گروهی');
    expect(employees).not.toMatch(/EMP-\d|EMPLOY-\d/);
    expect(employees).toContain('ویرایش');
    expect(employees).toContain('حذف');
    expect(employees).toContain('خروجی اکسل');
    expect(employees).toContain('پرونده ۳۶۰');
  });

  it('restores only structurally valid session employees', () => {
    const valid = {
      id: 'HR-1001',
      name: 'سارا محمدی',
      initial: 'س',
      employment: 'preview-employment-HR-1001',
      kind: 'تمام‌وقت',
      unit: 'نیایش سیر / فروش',
      position: 'کارشناس فروش',
      grade: 'G4',
      manager: 'مدیر فروش',
      startedAt: '۱۴۰۵/۰۶/۱۶',
      startedAtValue: '2026-09-07',
      status: 'فعال',
      tone: 'success',
    };
    expect(parsePreviewEmployees(JSON.stringify([valid, { id: 1 }]))).toEqual([
      valid,
    ]);
    expect(parsePreviewEmployees('{invalid')).toEqual([]);
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
      'نام',
      'نام خانوادگی',
      'کد پرسنلی',
      'نوع همکاری',
      'شعبه',
      'واحد',
      'سمت',
      'رده شغلی',
      'مدیر مستقیم',
      'تاریخ شروع',
      'وضعیت',
    ])
      expect(html).toContain(label);
    expect(html.match(/data-required-indicator="true"/g)?.length ?? 0).toBe(10);
    expect(html).not.toContain('عنوان نمایشی');
    expect(html).toContain('name="firstName"');
    expect(html).toContain('name="lastName"');
    expect(html).toContain('id="hr-new-employee-started-at"');
    expect(html).toContain('value="HR-1001"');
    expect(html).toContain('readOnly');
  });

  it('prefills the employee form when editing an existing record', () => {
    const initialValue: NewEmployeeFormValue = {
      firstName: 'سارا',
      lastName: 'محمدی',
      personnelCode: 'HR-1002',
      employmentType: 'تمام‌وقت',
      branch: 'نیایش سیر',
      unit: 'عملیات سفر',
      position: 'کارشناس عملیات',
      grade: 'G4',
      manager: 'مدیر نمایشی الف',
      startedAt: '2026-09-06',
      status: 'فعال',
    };
    const html = renderToStaticMarkup(
      <NewEmployeeForm
        existingPersonnelCodes={[]}
        initialValue={initialValue}
        managerOptions={['مدیر نمایشی الف']}
        onCancel={() => undefined}
        onSubmit={() => undefined}
      />,
    );
    expect(html).toContain('value="سارا"');
    expect(html).toContain('value="HR-1002"');
    expect(html).toContain('ذخیره ویرایش');
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
      grade: 'G4',
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

  it('increments employee and organization codes from existing records', () => {
    expect(nextEmployeePersonnelCode(['HR-1001', 'HR-1002'])).toBe('HR-1003');
    expect(nextOrganizationNodeId([{ id: 'HR-ORG-001' }])).toBe('HR-ORG-002');
    expect(nextOrganizationCatalogId('branches', ['BR-001'])).toBe('BR-002');
  });

  it('renders an editable organization chart and a structure-aware form', () => {
    const chart = renderToStaticMarkup(
      <OrganizationChart
        nodes={initialOrganizationNodes}
        onDelete={() => undefined}
        onEdit={() => undefined}
      />,
    );
    expect(chart).toContain('نیایش سیر');
    expect(chart).toContain('عملیات سفر');
    expect(chart.match(/ویرایش /g)?.length ?? 0).toBe(5);
    expect(chart.match(/حذف /g)?.length ?? 0).toBe(5);
    expect(chart).toContain('۲ سمت');
    expect(chart).toContain('data-edge-count="3"');

    const form = renderToStaticMarkup(
      <OrganizationNodeForm
        branchOptions={['نیایش سیر', 'جهان باستان']}
        initialNode={initialOrganizationNodes.find(
          (node) => node.id === 'preview-unit-travel',
        )}
        managerOptions={['همکار نمایشی الف', 'همکار نمایشی ب']}
        nodes={initialOrganizationNodes}
        onCancel={() => undefined}
        onSubmit={() => undefined}
      />,
    );
    for (const label of [
      'شناسه ساختاری',
      'عنوان',
      'نوع گره',
      'وضعیت',
      'شعبه',
      'واحد والد',
      'مسئول / مدیر',
      'ظرفیت سمت‌ها',
      'تاریخ اثر',
    ])
      expect(form).toContain(label);
    expect(form.match(/data-required-indicator="true"/g)?.length ?? 0).toBe(8);
    expect(form).toContain('value="preview-unit-travel"');
    expect(form).toContain('ذخیره ویرایش');
  });

  it('synchronizes new organization catalog data with chart hierarchy and capacity', () => {
    const records: OrganizationCatalogRecords = {
      ...initialOrganizationCatalogRecords,
      branches: [
        ...initialOrganizationCatalogRecords.branches,
        {
          ...initialOrganizationCatalogRecords.branches[0]!,
          id: 'BR-001',
          title: 'شعبه جدید',
          manager: 'مدیر جدید',
        },
      ],
      units: [
        ...initialOrganizationCatalogRecords.units,
        {
          ...initialOrganizationCatalogRecords.units[0]!,
          id: 'UNIT-001',
          title: 'واحد جدید',
          branch: 'شعبه جدید',
          parent: '',
        },
      ],
      positions: [
        ...initialOrganizationCatalogRecords.positions,
        {
          ...initialOrganizationCatalogRecords.positions[0]!,
          id: 'POS-001',
          title: 'سمت جدید',
          unit: 'واحد جدید',
          capacity: '4',
        },
      ],
    };
    const nodes = synchronizeOrganizationChartWithCatalog(
      initialOrganizationNodes,
      records,
    );
    const branch = nodes.find((node) => node.id === 'BR-001');
    const unit = nodes.find((node) => node.id === 'UNIT-001');

    expect(branch).toMatchObject({
      name: 'شعبه جدید',
      kind: 'MANAGEMENT',
      positionCapacity: 4,
    });
    expect(unit).toMatchObject({
      name: 'واحد جدید',
      parentId: 'BR-001',
      positionCapacity: 4,
    });
    expect(getOrganizationRelationships(nodes)).toContainEqual({
      id: 'BR-001-UNIT-001',
      parentId: 'BR-001',
      childId: 'UNIT-001',
    });
  });

  it('validates organization identity, hierarchy and position capacity', () => {
    const value: OrganizationNodeFormValue = {
      id: ' PREVIEW-UNIT-TRAVEL ',
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
    ['branches', 'کد شعبه', 'نام شعبه', 'افزودن شعبه', 'BR-001'],
    ['units', 'کد واحد', 'نام واحد', 'افزودن واحد سازمانی', 'UNIT-001'],
    ['positions', 'کد سمت', 'عنوان شغل', 'افزودن شغل و سمت', 'POS-001'],
    ['grades', 'کد رده', 'سطح سازمانی', 'افزودن رده شغلی', 'GR-001'],
  ] as const)(
    'renders the %s catalog with its own create form',
    (tab, firstLabel, secondLabel, submitLabel, generatedCode) => {
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
      expect(form).toContain(`value="${generatedCode}"`);
      expect(form).toContain('readOnly');
      expect(form.match(/data-required-indicator="true"/g)?.length ?? 0).toBe(
        organizationCatalogSchemas[tab].fields.filter((field) => field.required)
          .length,
      );
      const table = renderToStaticMarkup(
        <OrganizationCatalogTable
          onDelete={() => undefined}
          onEdit={() => undefined}
          records={initialOrganizationCatalogRecords[tab]}
          tab={tab}
        />,
      );
      expect(table).toContain('ویرایش');
      expect(table).toContain('حذف');
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
    expect(fields.find((field) => field.label === 'مبلغ')?.type).toBe('number');
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
    expect(html.match(/data-required-indicator="true"/g)?.length ?? 0).toBe(
      fields.filter((field) => field.required).length,
    );
    expect(html).toContain('افزودن بازپرداخت هزینه');
    expect(html).toContain('HR-EXPENSES-CLAIMS-');
    expect(html).toContain('readOnly');
    expect(html).not.toContain('عنوان نمایشی');
  });

  it('uses people, recruiting units, job boards and resume fields in recruitment forms', () => {
    const fields = buildContextualHrFields(
      [
        'واحد درخواست‌کننده',
        'منبع جذب',
        'ارزیاب',
        'لینک پروفایل در منبع',
        'رزومه',
      ],
      ['نگار بهرامی'],
    );
    expect(fields[0]?.options).toContain('خدمات فرودگاهی');
    expect(fields[1]?.options).toEqual(
      expect.arrayContaining(['جابینجا', 'جاب‌ویژن']),
    );
    expect(fields[2]).toMatchObject({ type: 'combobox' });
    expect(fields[2]?.options).toContain('نگار بهرامی');
    expect(fields[2]?.options).not.toContain('IRR');
    expect(fields[3]?.type).toBe('url');
    expect(fields[4]?.type).toBe('file');
  });

  it('uses the new-hire record as the source of a future employee', () => {
    const dataset = getHrPreviewDataset('lifecycle', 'onboarding');
    expect(dataset.columns).toEqual(
      expect.arrayContaining([
        'نام و نام خانوادگی',
        'شرکت یا شعبه',
        'واحد',
        'سمت',
        'رده شغلی',
      ]),
    );
    expect(dataset.columns).not.toEqual(
      expect.arrayContaining(['کارمند', 'الگوی ورود', 'پیشرفت']),
    );
    expect(
      buildContextualHrFields(dataset.columns).find(
        (field) => field.label === 'نام و نام خانوادگی',
      )?.type,
    ).toBe('text');
  });

  it('prefills promotion and contract alert values from employee records', () => {
    const promotion = renderToStaticMarkup(
      <ContextualHrForm
        context={{
          section: 'lifecycle',
          tab: 'promotion',
          title: 'ارتقا',
          description: 'ارتقای کارمند',
          columns: getHrPreviewDataset('lifecycle', 'promotion').columns,
          mode: 'create',
          peopleOptions: ['سارا محمدی'],
          employeeDetails: [
            { name: 'سارا محمدی', position: 'کارشناس فروش', grade: 'G4' },
          ],
        }}
        onCancel={() => undefined}
        onSubmit={() => undefined}
      />,
    );
    expect(promotion).toContain('value="کارشناس فروش"');
    expect(promotion).toContain('<option selected="">G4</option>');
    expect(promotion).toContain('disabled');

    const alert = renderToStaticMarkup(
      <ContextualHrForm
        context={{
          section: 'contracts',
          tab: 'alerts',
          title: 'هشدار پایان',
          description: 'هشدار قرارداد',
          columns: getHrPreviewDataset('contracts', 'alerts').columns,
          mode: 'create',
          peopleOptions: ['سارا محمدی'],
          contractNumbersByEmployee: {
            'سارا محمدی': 'HR-CON-1405-101',
          },
        }}
        onCancel={() => undefined}
        onSubmit={() => undefined}
      />,
    );
    expect(alert).toContain('value="HR-CON-1405-101"');
    expect(alert).toContain('readOnly');
  });

  it('uses calendar, yes-no, document upload and public access fields', () => {
    const fields = buildContextualHrFields([
      'آخرین روز کاری',
      'تحویل دارایی',
      'قطع دسترسی',
      'نوع مدرک',
      'سطح دسترسی',
      'فایل',
      'تاریخ ثبت',
    ]);
    expect(fields[0]?.type).toBe('date');
    expect(fields[1]?.options).toEqual(['بله', 'خیر']);
    expect(fields[2]?.options).toEqual(['بله', 'خیر']);
    expect(fields[3]?.options).toContain('گواهی سلامت و طب کار');
    expect(fields[4]?.options).toContain('عمومی');
    expect(fields[5]?.type).toBe('file');
    expect(fields[6]?.type).toBe('date');
  });

  it('updates and removes rows from the active preview dataset', () => {
    const rows = [
      ['preview-row-1', 'عنوان قدیمی', { label: 'پیش‌نویس', tone: 'neutral' }],
      ['preview-row-2', 'عنوان دوم', { label: 'فعال', tone: 'success' }],
    ] as const;
    const updated = saveHrPreviewRow(
      rows,
      ['شناسه', 'عنوان', 'وضعیت'],
      ['preview-row-1', 'عنوان ویرایش‌شده', 'تکمیل‌شده'],
      0,
    );
    expect(updated[0]).toEqual([
      'preview-row-1',
      'عنوان ویرایش‌شده',
      { label: 'تکمیل‌شده', tone: 'success' },
    ]);
    expect(removeHrPreviewRow(updated, 0)).toEqual([rows[1]]);
  });

  it('keeps automatic history sections read-only', () => {
    expect(isAutomaticHrHistoryTab('employee', 'audit')).toBe(true);
    expect(isAutomaticHrHistoryTab('fleet', 'logs')).toBe(true);
    expect(isAutomaticHrHistoryTab('reports', 'audit')).toBe(true);
    expect(isAutomaticHrHistoryTab('contracts', 'amendments')).toBe(false);

    for (const [section, tab, title] of [
      ['employee', 'audit', 'تاریخچه'],
      ['assets', 'logs', 'سوابق خودرو'],
      ['reports', 'audit', 'Audit اختصاصی'],
    ] as const) {
      const html = renderToStaticMarkup(
        <HrWorkspace sectionId={section} tabId={tab} />,
      );
      expect(html).toContain(title);
      expect(html).not.toContain(
        'رکوردهای این بخش از عملیات مرتبط به‌صورت خودکار ثبت می‌شوند',
      );
      expect(html).not.toContain(`افزودن ${title}`);
      expect(html).not.toContain('>ویرایش<');
      expect(html).not.toContain('>حذف<');
    }
  });

  it('appends mutations to automatic audit and related history feeds', () => {
    const employeeHistory = appendAutomaticHrHistory(
      {},
      {
        action: 'create',
        section: 'employees',
        tab: 'list',
        title: 'کارمند',
        subject: 'نگار بهرامی',
        occurredAt: '۱۴۰۵/۰۶/۱۵، ۱۰:۳۰',
        eventId: 'HR-AUDIT-TEST-EMP',
      },
    );
    expect(employeeHistory['reports:audit']?.[0]).toContain('ایجاد کارمند');
    expect(employeeHistory['employee:audit']?.[0]).toContain(
      'ایجاد کارمند: نگار بهرامی',
    );

    const fleetHistory = appendAutomaticHrHistory(employeeHistory, {
      action: 'edit',
      section: 'fleet',
      tab: 'vehicles',
      title: 'خودروها',
      subject: 'خودروی عملیات ۲',
      occurredAt: '۱۴۰۵/۰۶/۱۵، ۱۰:۳۵',
      eventId: 'HR-AUDIT-TEST-FLEET',
    });
    expect(fleetHistory['fleet:logs']?.[0]).toContain('خودروی عملیات ۲');
    expect(fleetHistory['reports:audit']?.[0]).toContain('ویرایش خودروها');
  });

  it('restores valid recruitment rows from session storage data', () => {
    const stored = {
      'recruitment:staffing': [
        [
          'HR-RECRUITMENT-STAFFING-123456',
          '۱۴۰۶',
          'نیایش سیر',
          { label: 'فعال', tone: 'success' },
        ],
      ],
    };
    expect(parseHrPreviewDatasetOverrides(JSON.stringify(stored))).toEqual(
      stored,
    );
    expect(parseHrPreviewDatasetOverrides('{invalid')).toEqual({});
    expect(
      parseHrPreviewDatasetOverrides(
        JSON.stringify({ 'recruitment:staffing': [['ok', { unsafe: true }]] }),
      ),
    ).toEqual({});
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
    ['expenses', 'مأموریت و هزینه‌ها', 'preview-time-mission-1'],
    ['assets', 'تجهیزات تحویلی', 'preview-assets-list-1'],
    ['hrSettings', 'تنظیمات و یکپارچگی', 'preview-settings-workflow-1'],
  ] as const)('renders the %s capability preview', (section, title, id) => {
    const html = renderToStaticMarkup(<HrWorkspace sectionId={section} />);
    expect(html).toContain(title);
    expect(html).toContain(id);
    expect(html).toContain('فقط شناسه‌ها و ردیف‌های صریحاً نمایشی');
    expect(html).toContain('ویرایش');
    expect(html).toContain('حذف');
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
