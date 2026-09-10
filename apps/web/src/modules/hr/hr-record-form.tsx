'use client';
import { useRef, useState, type ReactNode } from 'react';
import {
  getHrResource,
  type HrRecordCreate,
  type HrRecordDto,
  type HrWorkflowData,
} from '@rubi/contracts';
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogTitle,
} from '@/components/ui/overlays';
import { ContextualHrForm, persianDateToIso } from './contextual-hr-form';
import type { HrSource } from './hr-navigation';
import type { HrStore } from './hr-store';
import { employeeLabel, hrCompanies } from './hr-live-data';
import { prepareHrCommand } from './hr-commands';
import { DatePicker } from '@/components/ui/date-picker';
import { RequiredFieldLabel } from './required-field-label';
import {
  hrReferenceOptions,
  parentFieldLabel,
  retiredHrColumns,
} from './hr-form-model';
import { useHrReferenceData } from './hr-reference-data';
import { useHrFormReferences } from './hr-directory-picker';
import {
  expenseMissionOptions,
  isMissionExpense,
  missionOptionLabel,
} from './hr-mission-reference';

import ui from './hr-unified.module.css';

export interface HrFormTarget {
  source: HrSource;
  record?: HrRecordDto;
  parent?: HrRecordDto;
  employeeId?: string;
  organizationNode?: boolean;
}
const valueOf = (record: HrRecordDto | undefined, label: string) =>
  record?.values[record.columns.indexOf(label)] ?? '';
export function commandValues(
  section: string,
  tab: string,
  raw: readonly string[],
) {
  const definition = getHrResource(section, tab);
  if (!definition) throw new Error('فرم این بخش تعریف نشده است.');
  return definition.columns.map((column, index) => {
    const value = raw[index] ?? '';
    return /تاریخ|روز کاری/.test(column) && value
      ? persianDateToIso(value)
      : value;
  });
}
interface HrRecordFormProps {
  target: HrFormTarget;
  store: HrStore;
  onClose: () => void;
  onSaved: (record: HrRecordDto) => void;
}

export function HrRecordForm(props: HrRecordFormProps) {
  return props.target.organizationNode ? (
    <HrNodePicker {...props} />
  ) : (
    <HrRecordFormFields {...props} />
  );
}

function HrNodePicker(props: HrRecordFormProps) {
  const references = useHrReferenceData(props.store);
  const [unitId, setUnitId] = useState(props.target.record?.id ?? '');
  const units = references.data.records.filter(
    (r) => r.section === 'organization' && r.tab === 'units' && !r.deletedAt,
  );
  const record = units.find((r) => r.id === unitId);
  const picker = (
    <label className={ui.field}>
      <RequiredFieldLabel required>واحد سازمانی</RequiredFieldLabel>
      <select value={unitId} onChange={(e) => setUnitId(e.target.value)}>
        <option value="">انتخاب واحد ثبت‌شده</option>
        {units.map((r) => (
          <option key={r.id} value={r.id}>
            {r.values[0]} · {valueOf(r, 'شعبه')}
          </option>
        ))}
      </select>
    </label>
  );
  if (record)
    return (
      <HrRecordFormFields
        key={record.id}
        {...props}
        target={{ ...props.target, record }}
        nodePicker={picker}
      />
    );
  return (
    <Dialog
      open
      onOpenChange={(open) => {
        if (!open) props.onClose();
      }}
    >
      <DialogContent dir="rtl" className={ui.detail}>
        <DialogTitle>افزودن گره سازمانی</DialogTitle>
        <DialogDescription>
          واحد را انتخاب کنید و جایگاه آن را در چارت تنظیم کنید.
        </DialogDescription>
        {picker}
        {references.error ? (
          <p role="alert">{references.error}</p>
        ) : !units.length && !references.loading ? (
          <p>ابتدا یک واحد در بخش واحدها ثبت کنید.</p>
        ) : null}
      </DialogContent>
    </Dialog>
  );
}

function HrRecordFormFields({
  target,
  store,
  onClose,
  onSaved,
  nodePicker,
}: HrRecordFormProps & { nodePicker?: ReactNode }) {
  const definition = getHrResource(target.source.section, target.source.tab)!;
  const external = useHrFormReferences();
  const references = useHrReferenceData(store);
  const data = references.data;
  const companies = hrCompanies(data);
  const missionExpense = isMissionExpense(
    target.source.section,
    target.source.tab,
  );
  const [companyId, setCompanyId] = useState(
    () =>
      (missionExpense
        ? (target.record?.data.organizationBranchId ??
          target.parent?.data.organizationBranchId)
        : undefined) ??
      data.employees.find(
        (item) =>
          item.id ===
          (target.employeeId ??
            target.record?.employeeId ??
            target.parent?.employeeId),
      )?.organizationBranchId ??
      target.record?.data.organizationBranchId ??
      target.parent?.data.organizationBranchId ??
      companies.find((item) => item.name === valueOf(target.record, 'شرکت'))
        ?.id ??
      companies[0]?.id ??
      '',
  );
  const company = companies.find((item) => item.id === companyId);
  const [branchId, setBranchId] = useState(
    target.record?.branchId ??
      target.parent?.branchId ??
      companies.find((item) => item.id === companyId)?.branchId ??
      data.branches[0]?.id ??
      '',
  );
  const [employeeId, setEmployeeId] = useState(
    target.employeeId ??
      target.record?.employeeId ??
      target.parent?.employeeId ??
      '',
  );
  const [parentId, setParentId] = useState(
    target.parent?.id ??
      target.record?.parentId ??
      (target.source.section === 'recruitment' &&
      target.source.tab === 'applicants'
        ? data.records.find(
            (r) =>
              r.section === 'recruitment' &&
              r.tab === 'openings' &&
              r.values[0] === valueOf(target.record, 'فرصت شغلی'),
          )?.id
        : undefined) ??
      '',
  );
  const [fileExpiry, setFileExpiry] = useState('');
  const correction =
    target.source.section === 'time' && target.source.tab === 'corrections';
  const localTime = (value: string | undefined) =>
    value
      ? new Date(value).toLocaleTimeString('en-GB', {
          timeZone: 'Asia/Tehran',
          hour: '2-digit',
          minute: '2-digit',
        })
      : '';
  const [correctionStart, setCorrectionStart] = useState(
    localTime(target.record?.data.startsAt),
  );
  const [correctionEnd, setCorrectionEnd] = useState(
    localTime(target.record?.data.endsAt),
  );
  const key = useRef(crypto.randomUUID());
  const archivedFiles = useRef(new Map<string, string>());
  const employee = data.employees.find((item) => item.id === employeeId);
  const employees = data.employees.filter(
    (item) =>
      item.branchId === branchId &&
      (!company?.organizationBranchId ||
        item.organizationBranchId === company.organizationBranchId ||
        item.id === employeeId),
  );
  const parents = missionExpense
    ? expenseMissionOptions(
        data,
        branchId,
        company?.organizationBranchId,
        employeeId,
      )
    : data.records.filter(
        (item) =>
          item.branchId === branchId &&
          item.id !== target.record?.id &&
          (!company?.organizationBranchId ||
            !item.data.organizationBranchId ||
            item.data.organizationBranchId === company.organizationBranchId) &&
          (!definition.employeeRequired ||
            !employeeId ||
            !item.employeeId ||
            item.employeeId === employeeId) &&
          definition.parentResources.includes(`${item.section}.${item.tab}`) &&
          !item.deletedAt,
      );
  const parent = missionExpense
    ? parents.find((item) => item.id === parentId)
    : (target.parent ?? data.records.find((item) => item.id === parentId));
  const unitNames = data.records
    .filter(
      (item) =>
        item.section === 'organization' &&
        item.tab === 'units' &&
        item.branchId === branchId &&
        (!company?.organizationBranchId ||
          item.data.organizationBranchId === company.organizationBranchId),
    )
    .map((item) => item.values[0]!)
    .filter(Boolean);
  const units = Array.from(
    new Set([...unitNames, ...employees.map((item) => item.unit)]),
  );
  const optionsByLabel: Record<string, readonly string[]> = {
    ...Object.fromEntries(
      ['ارز', 'کد ارز', 'ارز پرداخت', 'ارز هزینه', 'ارز مبنا'].map((label) => [
        label,
        external.data?.currencies.map((c) => c.code) ?? [],
      ]),
    ),
    وضعیت: ['فعال', 'غیرفعال', 'پیش‌نویس', 'در حال بررسی', 'تکمیل‌شده'],
    کارمند: employees.map((item) => item.name),
    'واحد درخواست‌کننده': units,
    'واحد درخواست کننده': units,
    واحد: units,
    'واحد مقصد': units,
    'شعبه مقصد': companies.map((item) => item.name),
    'شرکت مقصد': companies.map((item) => item.name),
    'سطح سازمانی': [
      'مدیریت کل',
      'معاونت',
      'مدیریت',
      'دپارتمان',
      'اداره',
      'واحد',
      'گروه',
      'تیم',
    ],
    مدیر: employees.map((item) => item.name),
    'مدیر جدید': employees.map((item) => item.name),
    'مدیر مستقیم': employees.map((item) => item.name),
    ...hrReferenceOptions(
      data,
      target.source.section,
      target.source.tab,
      branchId,
      company?.organizationBranchId,
    ),
  };
  const isUnit =
    target.source.section === 'organization' && target.source.tab === 'units';
  const isApplicant =
    target.source.section === 'recruitment' &&
    target.source.tab === 'applicants';
  const hiddenLabels = [
    ...retiredHrColumns(target.source.section, target.source.tab),
    ...(target.organizationNode ? ['نام واحد'] : []),
    'شرکت',
    'شرکت یا شعبه',
    'شعبه',
    ...(definition.employeeRequired ? ['کارمند'] : []),
    ...(definition.parentResources.length
      ? [
          'واحد والد',
          'فرصت شغلی',
          'متقاضی',
          'نام متقاضی',
          'قرارداد مرجع',
          'قرارداد',
          'دوره ارزیابی',
          'دوره حقوق',
          'مأموریت مرجع',
          'خودرو',
        ]
      : []),
  ];
  const columns = [
    'شناسه',
    ...definition.columns,
    ...(definition.approval ? [] : ['وضعیت']),
  ];
  const employeeRequired = definition.employeeRequired;
  const approvalRequired = definition.approval;
  const presets = (() => {
    const result: Record<string, string> = {
      شناسه: target.record?.code ?? 'پس از ثبت ایجاد می‌شود',
    };
    if (employeeRequired) result['کارمند'] = employee?.name ?? '';
    if (approvalRequired) result['تأییدکننده'] = 'تعیین در گردش تأیید';
    if (missionExpense) result['مأموریت مرجع'] = parent?.code ?? '';
    if (correction)
      result['مقدار درخواستی'] = `${correctionStart} تا ${correctionEnd}`;
    if (
      target.source.section === 'organization' &&
      target.source.tab === 'units'
    )
      result['واحد والد'] = parent?.values[0] || 'بدون والد';
    if (parent) {
      if (isApplicant) result['فرصت شغلی'] = valueOf(parent, 'عنوان فرصت');
      if (
        target.source.section === 'recruitment' &&
        target.source.tab === 'interviews'
      )
        result['عنوان شغل'] = valueOf(parent, 'فرصت شغلی');
      if (target.source.section === 'expenses')
        result['مأموریت مرجع'] = parent.code;
      if (target.source.tab === 'logs')
        result['خودرو'] = parent.values[0] ?? '';
      for (const label of ['متقاضی', 'نام متقاضی'])
        result[label] =
          valueOf(parent, 'نام و نام خانوادگی') ||
          valueOf(parent, 'نام متقاضی') ||
          valueOf(parent, 'متقاضی');
      for (const label of ['قرارداد مرجع', 'شماره قرارداد', 'قرارداد'])
        if (parent.section === 'contracts')
          result[label] = valueOf(parent, 'شماره قرارداد') || parent.code;
      for (const label of ['دوره ارزیابی', 'دوره', 'دوره حقوق'])
        if (parent.tab === 'cycles' || parent.tab === 'runs')
          result[label] =
            valueOf(parent, 'عنوان دوره') ||
            valueOf(parent, 'دوره') ||
            parent.code;
      if (parent.section === 'organization')
        result['واحد والد'] = parent.values[0] ?? '';
      if (parent.section === 'lifecycle')
        result['کارمند'] = employee?.name ?? valueOf(parent, 'کارمند');
    }
    const branch = data.branches.find((item) => item.id === branchId);
    if (branch)
      for (const label of ['شرکت', 'شرکت یا شعبه', 'شعبه'])
        result[label] = employee?.companyName || company?.name || branch.name;
    return result;
  })();
  return (
    <Dialog
      open
      onOpenChange={(open) => {
        if (!open) onClose();
      }}
    >
      <DialogContent dir="rtl" className={ui.detail}>
        <DialogTitle>
          {target.organizationNode
            ? 'تنظیم گره سازمانی'
            : target.record
              ? 'ویرایش'
              : target.source.action}{' '}
          {target.record && !target.organizationNode ? target.source.label : ''}
        </DialogTitle>
        <DialogDescription>
          اطلاعات را تکمیل کنید؛ موارد ستاره‌دار الزامی‌اند.
        </DialogDescription>
        <div className={ui.selectorRow}>
          {nodePicker}
          <label className={ui.field}>
            <RequiredFieldLabel required>شرکت / شعبه</RequiredFieldLabel>
            <select
              disabled={Boolean(target.parent || (target.record && !isUnit))}
              value={companyId || branchId}
              onChange={(event) => {
                const selectedCompany = companies.find(
                  (item) => item.id === event.target.value,
                );
                setCompanyId(event.target.value);
                setBranchId(selectedCompany?.branchId ?? event.target.value);
                setEmployeeId('');
                setParentId('');
              }}
            >
              {companies.map((branch) => (
                <option key={branch.id} value={branch.id}>
                  {branch.name}
                </option>
              ))}
            </select>
          </label>
          {definition.employeeRequired ? (
            <label className={ui.field}>
              <RequiredFieldLabel required>کارمند</RequiredFieldLabel>
              <select
                value={employeeId}
                disabled={Boolean(
                  target.record ||
                  target.employeeId ||
                  target.parent?.employeeId,
                )}
                onChange={(event) => {
                  setEmployeeId(event.target.value);
                  if (missionExpense) setParentId('');
                }}
              >
                <option value="">انتخاب کارمند</option>
                {employees.map((item) => (
                  <option key={item.id} value={item.id}>
                    {employeeLabel(item)}
                  </option>
                ))}
              </select>
            </label>
          ) : null}
          {definition.parentResources.length ? (
            <label className={ui.field}>
              <RequiredFieldLabel
                required={!definition.parentOptional || isApplicant}
              >
                {parentFieldLabel(target.source.section, target.source.tab)}
              </RequiredFieldLabel>
              <select
                disabled={Boolean(
                  target.parent ||
                  (target.record &&
                    !(isUnit || isApplicant || missionExpense)) ||
                  references.loading,
                )}
                value={parentId}
                onChange={(event) => {
                  setParentId(event.target.value);
                  const item = parents.find((p) => p.id === event.target.value);
                  if (item?.employeeId) setEmployeeId(item.employeeId);
                }}
              >
                <option value="">
                  {isApplicant
                    ? 'انتخاب فرصت شغلی ثبت‌شده'
                    : missionExpense
                      ? 'بدون مأموریت (هزینه مستقل)'
                      : definition.parentOptional
                        ? 'بدون والد'
                        : 'انتخاب پرونده'}
                </option>
                {missionExpense && parentId && !parent ? (
                  <option value={parentId} disabled>
                    مأموریت انتخاب‌شده در این شرکت یا برای این کارمند در دسترس
                    نیست
                  </option>
                ) : null}
                {parents.map((item) => (
                  <option key={item.id} value={item.id}>
                    {missionExpense
                      ? missionOptionLabel(item)
                      : `${item.values[0]} · ${item.code}`}
                  </option>
                ))}
              </select>
              {missionExpense && !references.loading && !parents.length ? (
                <span className={ui.muted}>
                  برای شرکت و کارمند انتخاب‌شده مأموریتی ثبت نشده است. شرکت یا
                  کارمند را بررسی کنید یا از بخش مأموریت‌ها درخواست مأموریت ثبت
                  کنید.
                </span>
              ) : null}
            </label>
          ) : null}
        </div>
        {correction ? (
          <div className={ui.selectorRow}>
            <label className={ui.field}>
              <RequiredFieldLabel required>
                ورود اصلاح‌شده (زمان تهران)
              </RequiredFieldLabel>
              <input
                type="time"
                value={correctionStart}
                onChange={(event) => setCorrectionStart(event.target.value)}
              />
            </label>
            <label className={ui.field}>
              <RequiredFieldLabel required>
                خروج اصلاح‌شده (زمان تهران)
              </RequiredFieldLabel>
              <input
                type="time"
                value={correctionEnd}
                onChange={(event) => setCorrectionEnd(event.target.value)}
              />
            </label>
          </div>
        ) : null}
        {definition.columns.some((label) =>
          /رزومه|فایل پیوست|^فایل$|^مدرک هزینه$/.test(label),
        ) ? (
          <label className={ui.field}>
            اعتبار فایل در بایگانی
            <DatePicker
              value={fileExpiry}
              onChange={setFileExpiry}
              aria-label="اعتبار فایل در بایگانی"
            />
          </label>
        ) : null}
        {references.error ? (
          <p role="alert">{references.error}</p>
        ) : references.loading ? (
          <p role="status">در حال دریافت گزینه‌ها…</p>
        ) : (
          <ContextualHrForm
            key={`${companyId}:${branchId}:${employeeId}:${parentId}`}
            context={{
              branchId,
              section: target.source.section,
              tab: target.source.tab,
              title: target.source.label,
              description: '',
              columns,
              optionsByLabel,
              hiddenLabels,
              editableLabels: ['سمت فعلی'],
              fieldTypes: {
                'نام واحد': 'text',
                'نام شعبه': 'text',
                ...(target.source.section === 'organization'
                  ? { 'عنوان شغل': 'text' as const }
                  : {}),
                'نام سمت': 'text',
                ...(target.source.section === 'time' &&
                target.source.tab === 'leavePolicies'
                  ? { 'نوع مرخصی': 'text' as const }
                  : {}),
                ارزیاب: 'combobox',
                تأییدکننده: 'combobox',
              },
              mode: target.record ? 'edit' : 'create',
              peopleOptions: employees.map((item) => item.name),
              employeeDetails: employees.map((item) => ({
                name: item.name,
                position: item.position,
                grade: item.grade,
              })),
              presetValues: presets,
              ...(target.record
                ? {
                    initialValues: [
                      target.record.code,
                      ...target.record.values,
                      ...(definition.approval ? [] : [target.record.status]),
                    ],
                  }
                : {}),
              holidayOptions: data.records
                .filter(
                  (item) =>
                    item.section === 'time' &&
                    item.tab === 'holidays' &&
                    item.branchId === branchId,
                )
                .map((item) => valueOf(item, 'تقویم'))
                .filter(Boolean),
              attendance: data.records
                .filter(
                  (item) =>
                    item.section === 'time' && item.tab === 'attendance',
                )
                .map((item) => ({
                  employee: valueOf(item, 'کارمند'),
                  date: valueOf(item, 'تاریخ کارکرد'),
                  value: valueOf(item, 'ساعت کارکرد'),
                })),
            }}
            onCancel={onClose}
            onSubmit={async (raw) => {
              if (
                definition.fields.some((f) => f.type === 'money') &&
                !external.data
              )
                throw new Error(
                  external.error ||
                    'ابتدا دریافت ارزها از اطلاعات پایه تکمیل شود.',
                );
              if (!branchId) throw new Error('شرکت مجاز را انتخاب کنید.');
              if (definition.employeeRequired && !employee)
                throw new Error('کارمند را از فهرست انتخاب کنید.');
              if (missionExpense && parentId && !parent)
                throw new Error(
                  'مأموریت را از فهرست مأموریت‌های همین شرکت و کارمند انتخاب کنید.',
                );
              if (
                definition.parentResources.length &&
                !parentId &&
                (!definition.parentOptional || isApplicant)
              )
                throw new Error('پرونده مرتبط را انتخاب کنید.');
              if (
                target.source.section === 'lifecycle' &&
                target.source.tab === 'promotion'
              ) {
                const currentPosition =
                  raw[1 + definition.columns.indexOf('سمت فعلی')];
                if (employee && currentPosition !== employee.position)
                  throw new Error(
                    'سمت فعلی انتخاب‌شده باید با پرونده کارمند مطابقت داشته باشد.',
                  );
              }
              let values = commandValues(
                target.source.section,
                target.source.tab,
                raw.slice(1, 1 + definition.columns.length),
              );
              const field = (...labels: string[]) => {
                for (const label of labels) {
                  const i = definition.columns.indexOf(label);
                  if (i >= 0 && values[i]) return values[i]!;
                }
                return '';
              };
              const extra: HrWorkflowData = {
                ...Object.fromEntries(
                  Object.entries(target.record?.data ?? {}).filter(([field]) =>
                    [
                      'managerId',
                      'targetBranchId',
                      'organizationBranchId',
                      'documentId',
                      'startsAt',
                      'endsAt',
                      'minutes',
                      'allowanceDays',
                      'currency',
                      'reason',
                    ].includes(field),
                  ),
                ),
                ...(company?.organizationBranchId
                  ? { organizationBranchId: company.organizationBranchId }
                  : {}),
              };
              if (
                target.source.section === 'time' &&
                target.source.tab === 'checkins'
              )
                delete extra.startsAt;
              const start = field(
                'از تاریخ',
                'تاریخ شروع',
                'تاریخ رفت',
                'آخرین روز کاری',
                'تاریخ اثر',
                'تاریخ شروع همکاری',
              );
              const end = field('تا تاریخ', 'تاریخ پایان', 'تاریخ برگشت');
              if (start) extra.startsAt = start;
              if (end) extra.endsAt = end;
              if (field('ارز')) extra.currency = field('ارز');
              if (
                !extra.currency &&
                definition.fields.some((item) => item.type === 'money')
              )
                extra.currency = 'IRR';
              if (field('مدیر مستقیم', 'مدیر جدید')) {
                const managers = employees.filter(
                  (item) => item.name === field('مدیر مستقیم', 'مدیر جدید'),
                );
                if (managers.length !== 1)
                  throw new Error(
                    'مدیر را از کارکنان شرکت با نام یکتا انتخاب کنید.',
                  );
                extra.managerId = managers[0]!.id;
              }
              if (
                target.source.section === 'lifecycle' &&
                target.source.tab === 'transfer'
              ) {
                const destination = companies.find(
                  (item) => item.name === field('شعبه مقصد', 'شرکت مقصد'),
                );
                if (!destination)
                  throw new Error('شعبه مقصد مجاز را انتخاب کنید.');
                extra.targetBranchId = destination.branchId;
                if (destination.organizationBranchId)
                  extra.organizationBranchId = destination.organizationBranchId;
              }
              for (let index = 0; index < values.length; index++) {
                if (!values[index]?.startsWith('hr-attachment://')) continue;
                const { archiveHrFile } = await import('./hr-file-archive');
                const reference = values[index]!;
                let archivedId = archivedFiles.current.get(reference);
                if (!archivedId) {
                  const archived = await archiveHrFile({
                    reference: values[index]!,
                    branchId,
                    employeeId: employeeId || undefined,
                    entityId: target.record?.id ?? (parentId || key.current),
                    title: `${target.source.label} - ${employee?.name ?? values[0]}`,
                    validUntil: fileExpiry || end || undefined,
                  });
                  archivedId = archived.id;
                  archivedFiles.current.set(reference, archivedId);
                }
                extra.documentId = archivedId;
                values = values.map((value, i) =>
                  i === index ? `document://${archivedId}` : value,
                );
              }
              const status = definition.approval
                ? (target.record?.status ?? 'پیش‌نویس')
                : raw.at(-1) || 'فعال';
              const input: HrRecordCreate = prepareHrCommand(
                {
                  branchId,
                  section: target.source.section,
                  tab: target.source.tab,
                  values,
                  status,
                  data: extra,
                  ...(employeeId ? { employeeId } : {}),
                  ...(parentId ? { parentId } : {}),
                  ...(start ? { effectiveAt: start } : {}),
                },
                data,
              );
              const record = target.record
                ? await store.update(target.record, {
                    values: input.values,
                    ...(input.status ? { status: input.status } : {}),
                    ...(input.data ? { data: input.data } : {}),
                    ...(isUnit || isApplicant || missionExpense
                      ? { parentId: parentId || null }
                      : {}),
                    ...(input.effectiveAt
                      ? { effectiveAt: input.effectiveAt }
                      : {}),
                  })
                : await store.create(input, key.current);
              onSaved(record);
              onClose();
            }}
          />
        )}
      </DialogContent>
    </Dialog>
  );
}
