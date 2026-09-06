'use client';

import { Info, PencilLine, Trash2 } from 'lucide-react';
import { useState, type FormEvent } from 'react';
import { DatePicker } from '@/components/ui/date-picker';
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogTitle,
} from '@/components/ui/overlays';
import styles from './hr-workspace.module.css';
import { RequiredFieldLabel } from './required-field-label';

export type OrganizationCatalogTab =
  | 'branches'
  | 'units'
  | 'positions'
  | 'grades'
  | 'groups';

export function isOrganizationCatalogTab(
  value: string,
): value is OrganizationCatalogTab {
  return ['branches', 'units', 'positions', 'grades', 'groups'].includes(value);
}

type CatalogFieldKey =
  | 'id'
  | 'title'
  | 'company'
  | 'city'
  | 'manager'
  | 'branch'
  | 'parent'
  | 'jobTitle'
  | 'unit'
  | 'grade'
  | 'capacity'
  | 'level'
  | 'rank'
  | 'groupType'
  | 'description'
  | 'effectiveFrom'
  | 'status';

export type OrganizationCatalogFormValue = Record<CatalogFieldKey, string>;
export type OrganizationCatalogRecords = Record<
  OrganizationCatalogTab,
  readonly OrganizationCatalogFormValue[]
>;

type FieldType = 'text' | 'number' | 'date' | 'select' | 'textarea';
type OptionSource =
  | 'managers'
  | 'branches'
  | 'units'
  | 'parentUnits'
  | 'grades';

interface CatalogField {
  key: CatalogFieldKey;
  label: string;
  required?: boolean;
  type: FieldType;
  options?: readonly string[];
  optionSource?: OptionSource;
  full?: boolean;
  placeholder?: string;
}

interface CatalogColumn {
  key: CatalogFieldKey;
  label: string;
}

interface CatalogSchema {
  singular: string;
  plural: string;
  fields: readonly CatalogField[];
  columns: readonly CatalogColumn[];
}

const statusOptions = ['فعال', 'غیرفعال'] as const;

const catalogCodePrefixes: Record<OrganizationCatalogTab, string> = {
  branches: 'BR',
  units: 'UNIT',
  positions: 'POS',
  grades: 'GR',
  groups: 'GROUP',
};

export function nextOrganizationCatalogId(
  tab: OrganizationCatalogTab,
  existingIds: readonly string[],
): string {
  const prefix = catalogCodePrefixes[tab];
  const existing = new Set(
    existingIds.map((id) => id.trim().toLocaleLowerCase('fa-IR')),
  );
  let sequence = 1;
  while (
    existing.has(`${prefix}-${String(sequence).padStart(3, '0')}`.toLowerCase())
  )
    sequence += 1;
  return `${prefix}-${String(sequence).padStart(3, '0')}`;
}

export const organizationCatalogSchemas: Record<
  OrganizationCatalogTab,
  CatalogSchema
> = {
  branches: {
    singular: 'شعبه',
    plural: 'شعبه‌ها',
    fields: [
      { key: 'id', label: 'کد شعبه', required: true, type: 'text', placeholder: 'مانند BR-03' },
      { key: 'title', label: 'نام شعبه', required: true, type: 'text' },
      {
        key: 'company',
        label: 'شرکت / شخصیت حقوقی',
        required: true,
        type: 'select',
        options: ['شرکت نیایش سیر', 'شرکت جهان باستان'],
      },
      { key: 'city', label: 'شهر', required: true, type: 'text' },
      { key: 'manager', label: 'مدیر شعبه', type: 'select', optionSource: 'managers' },
      { key: 'effectiveFrom', label: 'تاریخ اثر', required: true, type: 'date' },
      { key: 'status', label: 'وضعیت', required: true, type: 'select', options: statusOptions },
    ],
    columns: [
      { key: 'id', label: 'کد شعبه' },
      { key: 'title', label: 'نام شعبه' },
      { key: 'company', label: 'شرکت' },
      { key: 'city', label: 'شهر' },
      { key: 'manager', label: 'مدیر شعبه' },
      { key: 'effectiveFrom', label: 'تاریخ اثر' },
      { key: 'status', label: 'وضعیت' },
    ],
  },
  units: {
    singular: 'واحد سازمانی',
    plural: 'واحدها',
    fields: [
      { key: 'id', label: 'کد واحد', required: true, type: 'text', placeholder: 'مانند UNIT-04' },
      { key: 'title', label: 'نام واحد', required: true, type: 'text' },
      { key: 'branch', label: 'شعبه', required: true, type: 'select', optionSource: 'branches' },
      { key: 'parent', label: 'واحد والد', type: 'select', optionSource: 'parentUnits' },
      { key: 'manager', label: 'مدیر واحد', type: 'select', optionSource: 'managers' },
      { key: 'effectiveFrom', label: 'تاریخ اثر', required: true, type: 'date' },
      { key: 'status', label: 'وضعیت', required: true, type: 'select', options: statusOptions },
    ],
    columns: [
      { key: 'id', label: 'کد واحد' },
      { key: 'title', label: 'نام واحد' },
      { key: 'branch', label: 'شعبه' },
      { key: 'parent', label: 'واحد والد' },
      { key: 'manager', label: 'مدیر واحد' },
      { key: 'effectiveFrom', label: 'تاریخ اثر' },
      { key: 'status', label: 'وضعیت' },
    ],
  },
  positions: {
    singular: 'شغل و سمت',
    plural: 'شغل‌ها و سمت‌ها',
    fields: [
      { key: 'id', label: 'کد سمت', required: true, type: 'text', placeholder: 'مانند POS-06' },
      { key: 'jobTitle', label: 'عنوان شغل', required: true, type: 'text' },
      { key: 'title', label: 'عنوان سمت', required: true, type: 'text' },
      { key: 'unit', label: 'واحد سازمانی', required: true, type: 'select', optionSource: 'units' },
      { key: 'grade', label: 'رده شغلی', required: true, type: 'select', optionSource: 'grades' },
      { key: 'capacity', label: 'ظرفیت', required: true, type: 'number' },
      { key: 'effectiveFrom', label: 'تاریخ اثر', required: true, type: 'date' },
      { key: 'status', label: 'وضعیت', required: true, type: 'select', options: statusOptions },
    ],
    columns: [
      { key: 'id', label: 'کد سمت' },
      { key: 'jobTitle', label: 'عنوان شغل' },
      { key: 'title', label: 'عنوان سمت' },
      { key: 'unit', label: 'واحد سازمانی' },
      { key: 'grade', label: 'رده شغلی' },
      { key: 'capacity', label: 'ظرفیت' },
      { key: 'status', label: 'وضعیت' },
    ],
  },
  grades: {
    singular: 'رده شغلی',
    plural: 'رده‌های شغلی',
    fields: [
      { key: 'id', label: 'کد رده', required: true, type: 'text', placeholder: 'مانند GR-04' },
      { key: 'title', label: 'عنوان رده', required: true, type: 'text' },
      {
        key: 'level',
        label: 'سطح سازمانی',
        required: true,
        type: 'select',
        options: ['کارشناسی', 'کارشناس ارشد', 'سرپرستی', 'مدیریت'],
      },
      { key: 'rank', label: 'ترتیب نمایش', required: true, type: 'number' },
      { key: 'description', label: 'شرح رده', type: 'textarea', full: true },
      { key: 'effectiveFrom', label: 'تاریخ اثر', required: true, type: 'date' },
      { key: 'status', label: 'وضعیت', required: true, type: 'select', options: statusOptions },
    ],
    columns: [
      { key: 'id', label: 'کد رده' },
      { key: 'title', label: 'عنوان رده' },
      { key: 'level', label: 'سطح سازمانی' },
      { key: 'rank', label: 'ترتیب نمایش' },
      { key: 'effectiveFrom', label: 'تاریخ اثر' },
      { key: 'status', label: 'وضعیت' },
    ],
  },
  groups: {
    singular: 'نوع کارکنان',
    plural: 'انواع کارکنان',
    fields: [
      { key: 'id', label: 'کد نوع کارکنان', required: true, type: 'text' },
      { key: 'title', label: 'نام نوع کارکنان', required: true, type: 'text' },
    ],
    columns: [
      { key: 'id', label: 'کد نوع کارکنان' },
      { key: 'title', label: 'نام نوع کارکنان' },
    ],
  },
};

const blankRecord = (): OrganizationCatalogFormValue => ({
  id: '',
  title: '',
  company: '',
  city: '',
  manager: 'تعیین نشده',
  branch: '',
  parent: '',
  jobTitle: '',
  unit: '',
  grade: '',
  capacity: '1',
  level: '',
  rank: '1',
  groupType: '',
  description: '',
  effectiveFrom: '',
  status: 'فعال',
});

const record = (
  value: Partial<OrganizationCatalogFormValue>,
): OrganizationCatalogFormValue => ({ ...blankRecord(), ...value });

export const initialOrganizationCatalogRecords: OrganizationCatalogRecords = {
  branches: [
    record({
      id: 'preview-branch-niyayesh-seir',
      title: 'نیایش سیر',
      company: 'شرکت نیایش سیر',
      city: 'تهران',
      manager: 'همکار نمایشی الف',
      effectiveFrom: '2026-03-21',
    }),
    record({
      id: 'preview-branch-jahan-bastan',
      title: 'جهان باستان',
      company: 'شرکت جهان باستان',
      city: 'تهران',
      manager: 'همکار نمایشی ت',
      effectiveFrom: '2026-03-21',
    }),
  ],
  units: [
    record({
      id: 'preview-unit-travel',
      title: 'عملیات سفر',
      branch: 'نیایش سیر',
      manager: 'همکار نمایشی الف',
      effectiveFrom: '2026-03-21',
    }),
    record({
      id: 'preview-unit-sales',
      title: 'فروش',
      branch: 'نیایش سیر',
      parent: 'عملیات سفر',
      manager: 'همکار نمایشی ب',
      effectiveFrom: '2026-03-21',
    }),
    record({
      id: 'preview-unit-finance',
      title: 'مالی',
      branch: 'جهان باستان',
      manager: 'همکار نمایشی پ',
      effectiveFrom: '2026-03-21',
    }),
  ],
  positions: [
    record({
      id: 'preview-position-operations',
      jobTitle: 'کارشناس عملیات',
      title: 'کارشناس ارشد عملیات',
      unit: 'عملیات سفر',
      grade: 'رده ارشد',
      capacity: '2',
      effectiveFrom: '2026-03-21',
    }),
    record({
      id: 'preview-position-sales',
      jobTitle: 'کارشناس فروش',
      title: 'سرپرست فروش سازمانی',
      unit: 'فروش',
      grade: 'رده سرپرستی',
      capacity: '1',
      effectiveFrom: '2026-03-21',
    }),
  ],
  grades: [
    record({
      id: 'preview-grade-senior',
      title: 'رده ارشد',
      level: 'کارشناس ارشد',
      rank: '2',
      description: 'کارشناسان ارشد و متخصصان حوزه',
      effectiveFrom: '2026-03-21',
    }),
    record({
      id: 'preview-grade-lead',
      title: 'رده سرپرستی',
      level: 'سرپرستی',
      rank: '3',
      description: 'مسئولان تیم و سرپرستان واحد',
      effectiveFrom: '2026-03-21',
    }),
  ],
  groups: [
    record({
      id: 'preview-group-fulltime',
      title: 'کارکنان تمام‌وقت',
      groupType: 'نوع همکاری',
      description: 'همکاری فعال با نوع تمام‌وقت',
      effectiveFrom: '2026-03-21',
    }),
    record({
      id: 'preview-group-operations',
      title: 'تیم عملیات',
      groupType: 'سازمانی',
      description: 'کارکنان واحدهای عملیاتی سفر و فرودگاه',
      effectiveFrom: '2026-03-21',
    }),
  ],
};

function optionsFor(
  source: OptionSource | undefined,
  records: OrganizationCatalogRecords,
  managers: readonly string[],
) {
  if (source === 'managers') return ['تعیین نشده', ...managers];
  if (source === 'branches') return records.branches.map((item) => item.title);
  if (source === 'units') return records.units.map((item) => item.title);
  if (source === 'parentUnits')
    return ['بدون والد', ...records.units.map((item) => item.title)];
  if (source === 'grades') return records.grades.map((item) => item.title);
  return [];
}

function blockedUnitParentTitles(
  units: readonly OrganizationCatalogFormValue[],
  currentTitle?: string,
) {
  const blocked = new Set<string>();
  if (!currentTitle) return blocked;
  blocked.add(currentTitle);
  let changed = true;
  while (changed) {
    changed = false;
    for (const unit of units) {
      if (blocked.has(unit.parent) && !blocked.has(unit.title)) {
        blocked.add(unit.title);
        changed = true;
      }
    }
  }
  return blocked;
}

export function validateOrganizationCatalogForm(
  tab: OrganizationCatalogTab,
  value: OrganizationCatalogFormValue,
  existingIds: readonly string[],
  currentId?: string,
) {
  const errors: Partial<Record<CatalogFieldKey, string>> = {};
  const schema = organizationCatalogSchemas[tab];
  for (const field of schema.fields) {
    if (field.required && !value[field.key].trim())
      errors[field.key] = `${field.label} الزامی است.`;
    if (
      field.type === 'number' &&
      (!Number.isInteger(Number(value[field.key])) ||
        Number(value[field.key]) < 0 ||
        Number(value[field.key]) > 9999)
    )
      errors[field.key] = `${field.label} باید عددی بین صفر تا ۹۹۹۹ باشد.`;
  }
  const normalizedId = value.id.trim().toLocaleLowerCase('fa-IR');
  if (
    normalizedId &&
    existingIds.some(
      (id) =>
        id.trim().toLocaleLowerCase('fa-IR') === normalizedId &&
        id.trim().toLocaleLowerCase('fa-IR') !==
          (currentId ?? '').trim().toLocaleLowerCase('fa-IR'),
    )
  )
    errors.id = 'این شناسه قبلاً استفاده شده است.';
  if (value.id.length > 50) errors.id = 'شناسه باید حداکثر ۵۰ نویسه باشد.';
  if (value.title.length > 100)
    errors.title = 'عنوان باید حداکثر ۱۰۰ نویسه باشد.';
  return errors;
}

interface CatalogFormProps {
  tab: OrganizationCatalogTab;
  records: OrganizationCatalogRecords;
  managers: readonly string[];
  initialRecord?: OrganizationCatalogFormValue | undefined;
  onCancel: () => void;
  onSubmit: (value: OrganizationCatalogFormValue) => void;
}

export function OrganizationCatalogForm({
  tab,
  records,
  managers,
  initialRecord,
  onCancel,
  onSubmit,
}: CatalogFormProps) {
  const schema = organizationCatalogSchemas[tab];
  const blockedParents = blockedUnitParentTitles(
    records.units,
    initialRecord?.title,
  );
  const [value, setValue] = useState<OrganizationCatalogFormValue>(() => {
    if (initialRecord) return initialRecord;
    const next = blankRecord();
    next.id = nextOrganizationCatalogId(
      tab,
      records[tab].map((record) => record.id),
    );
    for (const field of schema.fields) {
      const options = field.options ?? optionsFor(field.optionSource, records, managers);
      if (field.type === 'select' && options[0]) next[field.key] = options[0];
    }
    if (tab === 'units' && next.parent === 'بدون والد') next.parent = '';
    return next;
  });
  const [errors, setErrors] = useState<
    Partial<Record<CatalogFieldKey, string>>
  >({});

  const update = (key: CatalogFieldKey, nextValue: string) => {
    setValue((current) => ({ ...current, [key]: nextValue }));
    setErrors((current) => {
      if (!current[key]) return current;
      const next = { ...current };
      delete next[key];
      return next;
    });
  };
  const submit = (event: FormEvent<HTMLFormElement>) => {
    event.preventDefault();
    const nextErrors = validateOrganizationCatalogForm(
      tab,
      value,
      records[tab].map((item) => item.id),
      initialRecord?.id,
    );
    if (Object.keys(nextErrors).length) {
      setErrors(nextErrors);
      return;
    }
    onSubmit(
      Object.fromEntries(
        Object.entries(value).map(([key, item]) => [key, item.trim()]),
      ) as OrganizationCatalogFormValue,
    );
  };

  return (
    <form noValidate onSubmit={submit}>
      <div className={styles.previewNote}>
        <Info aria-hidden="true" size={16} />
        این اطلاعات فقط در فهرست موقت همین نشست نگه‌داری می‌شوند.
      </div>
      <fieldset className={styles.formFieldset}>
        <legend className={styles.formLegend}>مشخصات {schema.singular}</legend>
        <div className={styles.formGrid}>
          {schema.fields.map((field, index) => {
            const id = `hr-catalog-${tab}-${field.key}`;
            const errorId = `${id}-error`;
            const commonProps = {
              'aria-describedby': errors[field.key] ? errorId : undefined,
              'aria-invalid': Boolean(errors[field.key]),
              'aria-required': Boolean(field.required),
              className: styles.control ?? '',
              id,
              name: field.key,
              required: Boolean(field.required),
            };
            const sourceOptions =
              field.options ?? optionsFor(field.optionSource, records, managers);
            const options =
              field.key === 'parent'
                ? sourceOptions.filter(
                    (option) =>
                      option === 'بدون والد' || !blockedParents.has(option),
                  )
                : sourceOptions;
            return (
              <label
                className={`${styles.fieldLabel} ${field.full ? styles.full : ''}`}
                htmlFor={id}
                key={field.key}
              >
                <RequiredFieldLabel required={Boolean(field.required)}>
                  {field.label}
                </RequiredFieldLabel>
                {field.type === 'select' ? (
                  <select
                    {...commonProps}
                    onChange={(event) => update(field.key, event.target.value)}
                    value={value[field.key]}
                  >
                    {!field.required && field.key !== 'parent' ? <option value="">انتخاب نشده</option> : null}
                    {options.map((option) => (
                      <option key={option} value={option === 'بدون والد' ? '' : option}>
                        {option}
                      </option>
                    ))}
                  </select>
                ) : field.type === 'date' ? (
                  <DatePicker
                    {...commonProps}
                    onChange={(nextValue) => update(field.key, nextValue)}
                    placeholder={`انتخاب ${field.label}`}
                    value={value[field.key]}
                  />
                ) : field.type === 'textarea' ? (
                  <textarea
                    {...commonProps}
                    className={`${styles.control} ${styles.textArea}`}
                    onChange={(event) => update(field.key, event.target.value)}
                    rows={3}
                    value={value[field.key]}
                  />
                ) : (
                  <input
                    {...commonProps}
                    autoFocus={index === 1}
                    min={field.type === 'number' ? '0' : undefined}
                    onChange={(event) => update(field.key, event.target.value)}
                    placeholder={field.placeholder}
                    readOnly={field.key === 'id'}
                    type={field.type}
                    value={value[field.key]}
                  />
                )}
                {field.key === 'id' ? (
                  <small className={styles.fieldHint}>
                    این کد به‌صورت خودکار تخصیص داده می‌شود.
                  </small>
                ) : null}
                {errors[field.key] ? (
                  <small className={styles.fieldError} id={errorId}>
                    {errors[field.key]}
                  </small>
                ) : null}
              </label>
            );
          })}
        </div>
      </fieldset>
      <div className={styles.modalFooter}>
        <button className={styles.button} onClick={onCancel} type="button">انصراف</button>
        <button className={`${styles.button} ${styles.buttonPrimary}`} type="submit">
          {initialRecord ? 'ذخیره ویرایش' : `افزودن ${schema.singular}`}
        </button>
      </div>
    </form>
  );
}

export function OrganizationCatalogDialog({
  open,
  onClose,
  ...formProps
}: Omit<CatalogFormProps, 'onCancel'> & { open: boolean; onClose: () => void }) {
  if (!open) return null;
  const schema = organizationCatalogSchemas[formProps.tab];
  return (
    <Dialog onOpenChange={(nextOpen) => !nextOpen && onClose()} open>
      <DialogContent className={`${styles.modal} ${styles.employeeModal}`} dir="rtl">
        <DialogTitle>
          {formProps.initialRecord ? `ویرایش ${schema.singular}` : `افزودن ${schema.singular}`}
        </DialogTitle>
        <DialogDescription>
          فیلدهای {schema.singular} را مطابق ارتباط آن با ساختار سازمانی تکمیل کنید.
        </DialogDescription>
        <OrganizationCatalogForm {...formProps} onCancel={onClose} />
      </DialogContent>
    </Dialog>
  );
}

export function OrganizationCatalogTable({
  tab,
  records,
  onEdit,
  onDelete,
}: {
  tab: OrganizationCatalogTab;
  records: readonly OrganizationCatalogFormValue[];
  onEdit: (record: OrganizationCatalogFormValue) => void;
  onDelete: (record: OrganizationCatalogFormValue) => void;
}) {
  const schema = organizationCatalogSchemas[tab];
  const displayValue = (key: CatalogFieldKey, value: string) => {
    if (key !== 'effectiveFrom' || !/^\d{4}-\d{2}-\d{2}$/.test(value))
      return value || '—';
    const date = new Date(`${value}T12:00:00.000Z`);
    return new Intl.DateTimeFormat('fa-IR-u-ca-persian', {
      day: '2-digit',
      month: '2-digit',
      year: 'numeric',
    }).format(date);
  };
  return (
    <>
      <div className={styles.tableWrap} tabIndex={0}>
        <table className={styles.table}>
          <thead>
            <tr>
              {schema.columns.map((column) => <th key={column.key}>{column.label}</th>)}
              <th>عملیات</th>
            </tr>
          </thead>
          <tbody>
            {records.map((item) => (
              <tr key={item.id}>
                {schema.columns.map((column) => (
                  <td key={column.key}>
                    {column.key === 'status' ? (
                      <span className={`${styles.badge} ${item.status === 'فعال' ? styles.badgeSuccess : styles.badgeNeutral}`}>
                        {item.status}
                      </span>
                    ) : displayValue(column.key, item[column.key])}
                  </td>
                ))}
                <td>
                  <div className={styles.rowActions}>
                    <button
                      aria-label={`ویرایش ${schema.singular} ${item.title}`}
                      className={`${styles.button} ${styles.buttonSmall}`}
                      onClick={() => onEdit(item)}
                      type="button"
                    >
                      <PencilLine aria-hidden="true" size={13} /> ویرایش
                    </button>
                    <button
                      aria-label={`حذف ${schema.singular} ${item.title}`}
                      className={`${styles.button} ${styles.buttonSmall} ${styles.buttonDanger}`}
                      onClick={() => {
                        if (
                          window.confirm(
                            `«${item.title}» از داده‌های موقت این نشست حذف شود؟`,
                          )
                        )
                          onDelete(item);
                      }}
                      type="button"
                    >
                      <Trash2 aria-hidden="true" size={13} /> حذف
                    </button>
                  </div>
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
      <div className={styles.panelBody}>
        <span className={styles.source}>
          {records.length.toLocaleString('fa-IR')} {schema.singular} نمایشی
        </span>
      </div>
    </>
  );
}
