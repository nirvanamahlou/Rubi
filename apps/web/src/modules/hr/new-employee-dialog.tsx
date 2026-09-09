'use client';

import { Info } from 'lucide-react';
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

const employmentTypes = [
  'تمام‌وقت',
  'پاره‌وقت',
  'قراردادی',
  'کارآموز',
  'مشاور',
] as const;

const previewBranches = ['نیایش سیر', 'جهان باستان'] as const;

const previewUnits = [
  'عملیات سفر',
  'فروش',
  'مالی',
  'عملیات فرودگاهی',
  'منابع انسانی',
] as const;

export const employeeStatuses = ['فعال', 'در حال تکمیل', 'تعلیق‌شده'] as const;

export type NewEmployeeStatus = (typeof employeeStatuses)[number];

export interface NewEmployeeFormValue {
  firstName: string;
  lastName: string;
  personnelCode: string;
  employmentType: string;
  branch: string;
  unit: string;
  position: string;
  grade: string;
  manager: string;
  startedAt: string;
  status: NewEmployeeStatus;
}

type FormField = keyof NewEmployeeFormValue;
export type NewEmployeeFormErrors = Partial<Record<FormField, string>>;

const defaultEmployeeValue: NewEmployeeFormValue = {
  firstName: '',
  lastName: '',
  personnelCode: '',
  employmentType: employmentTypes[0],
  branch: previewBranches[0],
  unit: previewUnits[0],
  position: '',
  grade: 'G4',
  manager: 'بدون مدیر مستقیم',
  startedAt: '',
  status: employeeStatuses[0],
};

const normalizePersonnelCode = (value: string) =>
  value.trim().toLocaleLowerCase('fa-IR');

export function nextEmployeePersonnelCode(
  existingPersonnelCodes: readonly string[],
): string {
  const existing = new Set(existingPersonnelCodes.map(normalizePersonnelCode));
  let sequence = 1001;
  while (existing.has(`hr-${sequence}`)) sequence += 1;
  return `HR-${sequence}`;
}

export function validateNewEmployeeForm(
  value: NewEmployeeFormValue,
  existingPersonnelCodes: readonly string[],
): NewEmployeeFormErrors {
  const errors: NewEmployeeFormErrors = {};
  const firstName = value.firstName.trim();
  const lastName = value.lastName.trim();
  const personnelCode = value.personnelCode.trim();

  if (!firstName) errors.firstName = 'نام الزامی است.';
  else if (firstName.length > 80)
    errors.firstName = 'نام باید حداکثر ۸۰ نویسه باشد.';

  if (!lastName) errors.lastName = 'نام خانوادگی الزامی است.';
  else if (lastName.length > 100)
    errors.lastName = 'نام خانوادگی باید حداکثر ۱۰۰ نویسه باشد.';

  if (!personnelCode) errors.personnelCode = 'کد پرسنلی الزامی است.';
  else if (personnelCode.length > 50)
    errors.personnelCode = 'کد پرسنلی باید حداکثر ۵۰ نویسه باشد.';
  else if (
    existingPersonnelCodes.some(
      (code) =>
        normalizePersonnelCode(code) === normalizePersonnelCode(personnelCode),
    )
  )
    errors.personnelCode = 'این کد پرسنلی قبلاً استفاده شده است.';

  if (!value.position.trim()) errors.position = 'سمت الزامی است.';
  if (!value.grade.trim()) errors.grade = 'رده شغلی الزامی است.';
  if (!value.startedAt) errors.startedAt = 'تاریخ شروع همکاری الزامی است.';

  return errors;
}

function FieldError({
  errors,
  field,
}: {
  errors: NewEmployeeFormErrors;
  field: FormField;
}) {
  const message = errors[field];
  return message ? (
    <small className={styles.fieldError} id={`hr-new-employee-${field}-error`}>
      {message}
    </small>
  ) : null;
}

interface NewEmployeeFormProps {
  existingPersonnelCodes: readonly string[];
  initialValue?: NewEmployeeFormValue | undefined;
  managerOptions: readonly string[];
  onCancel: () => void;
  onSubmit: (value: NewEmployeeFormValue) => void;
}

export function NewEmployeeForm({
  existingPersonnelCodes,
  initialValue,
  managerOptions,
  onCancel,
  onSubmit,
}: NewEmployeeFormProps) {
  const [value, setValue] = useState<NewEmployeeFormValue>(
    () =>
      initialValue ?? {
        ...defaultEmployeeValue,
        personnelCode: nextEmployeePersonnelCode(existingPersonnelCodes),
      },
  );
  const [errors, setErrors] = useState<NewEmployeeFormErrors>({});

  const update = (field: FormField, nextValue: string) => {
    setValue((current) => ({ ...current, [field]: nextValue }));
    setErrors((current) => {
      if (!current[field]) return current;
      const next = { ...current };
      delete next[field];
      return next;
    });
  };

  const submit = (event: FormEvent<HTMLFormElement>) => {
    event.preventDefault();
    const nextErrors = validateNewEmployeeForm(value, existingPersonnelCodes);
    if (Object.keys(nextErrors).length) {
      setErrors(nextErrors);
      return;
    }
    onSubmit({
      ...value,
      firstName: value.firstName.trim(),
      lastName: value.lastName.trim(),
      personnelCode: value.personnelCode.trim(),
      position: value.position.trim(),
    });
  };

  const errorProps = (field: FormField) => ({
    'aria-describedby': errors[field]
      ? `hr-new-employee-${field}-error`
      : undefined,
    'aria-invalid': Boolean(errors[field]),
  });

  const managers = Array.from(new Set(managerOptions));

  return (
    <form noValidate onSubmit={submit}>
      <div className={styles.previewNote}>
        <Info aria-hidden="true" size={16} />
        اطلاعات این فرم فقط به فهرست موقت همین نشست اضافه می‌شود و پس از
        تازه‌سازی صفحه باقی نمی‌ماند.
      </div>

      <fieldset className={styles.formFieldset}>
        <legend className={styles.formLegend}>مشخصات پایه</legend>
        <div className={styles.formGrid}>
          <label
            className={styles.fieldLabel}
            htmlFor="hr-new-employee-first-name"
          >
            <RequiredFieldLabel required>نام</RequiredFieldLabel>
            <input
              {...errorProps('firstName')}
              autoComplete="given-name"
              autoFocus
              className={styles.control}
              id="hr-new-employee-first-name"
              maxLength={80}
              name="firstName"
              onChange={(event) => update('firstName', event.target.value)}
              required
              value={value.firstName}
            />
            <FieldError errors={errors} field="firstName" />
          </label>
          <label
            className={styles.fieldLabel}
            htmlFor="hr-new-employee-last-name"
          >
            <RequiredFieldLabel required>نام خانوادگی</RequiredFieldLabel>
            <input
              {...errorProps('lastName')}
              autoComplete="family-name"
              className={styles.control}
              id="hr-new-employee-last-name"
              maxLength={100}
              name="lastName"
              onChange={(event) => update('lastName', event.target.value)}
              required
              value={value.lastName}
            />
            <FieldError errors={errors} field="lastName" />
          </label>
          <label className={styles.fieldLabel} htmlFor="hr-new-employee-code">
            <RequiredFieldLabel required>کد پرسنلی</RequiredFieldLabel>
            <input
              {...errorProps('personnelCode')}
              className={styles.control}
              dir="ltr"
              id="hr-new-employee-code"
              maxLength={50}
              name="personnelCode"
              placeholder="برای نمونه HR-1001"
              readOnly
              required
              value={value.personnelCode}
            />
            <small className={styles.fieldHint}>
              این کد به‌صورت خودکار تخصیص داده می‌شود.
            </small>
            <FieldError errors={errors} field="personnelCode" />
          </label>
          <label className={styles.fieldLabel} htmlFor="hr-new-employee-type">
            <RequiredFieldLabel required>نوع همکاری</RequiredFieldLabel>
            <select
              className={styles.control}
              id="hr-new-employee-type"
              name="employmentType"
              onChange={(event) => update('employmentType', event.target.value)}
              required
              value={value.employmentType}
            >
              {employmentTypes.map((option) => (
                <option key={option} value={option}>
                  {option}
                </option>
              ))}
            </select>
          </label>
        </div>
      </fieldset>

      <fieldset className={styles.formFieldset}>
        <legend className={styles.formLegend}>جایگاه سازمانی</legend>
        <div className={styles.formGrid}>
          <label className={styles.fieldLabel} htmlFor="hr-new-employee-branch">
            <RequiredFieldLabel required>شعبه</RequiredFieldLabel>
            <select
              className={styles.control}
              id="hr-new-employee-branch"
              name="branch"
              onChange={(event) => update('branch', event.target.value)}
              required
              value={value.branch}
            >
              {previewBranches.map((option) => (
                <option key={option} value={option}>
                  {option}
                </option>
              ))}
            </select>
          </label>
          <label className={styles.fieldLabel} htmlFor="hr-new-employee-unit">
            <RequiredFieldLabel required>واحد</RequiredFieldLabel>
            <select
              className={styles.control}
              id="hr-new-employee-unit"
              name="unit"
              onChange={(event) => update('unit', event.target.value)}
              required
              value={value.unit}
            >
              {previewUnits.map((option) => (
                <option key={option} value={option}>
                  {option}
                </option>
              ))}
            </select>
          </label>
          <label
            className={styles.fieldLabel}
            htmlFor="hr-new-employee-position"
          >
            <RequiredFieldLabel required>سمت</RequiredFieldLabel>
            <input
              {...errorProps('position')}
              className={styles.control}
              id="hr-new-employee-position"
              maxLength={120}
              name="position"
              onChange={(event) => update('position', event.target.value)}
              placeholder="برای نمونه کارشناس عملیات"
              required
              value={value.position}
            />
            <FieldError errors={errors} field="position" />
          </label>
          <label className={styles.fieldLabel} htmlFor="hr-new-employee-grade">
            <RequiredFieldLabel required>رده شغلی</RequiredFieldLabel>
            <select
              {...errorProps('grade')}
              className={styles.control}
              id="hr-new-employee-grade"
              name="grade"
              onChange={(event) => update('grade', event.target.value)}
              required
              value={value.grade}
            >
              {['G1', 'G2', 'G3', 'G4', 'G5', 'G6', 'G7', 'مدیریتی'].map(
                (option) => (
                  <option key={option} value={option}>
                    {option}
                  </option>
                ),
              )}
            </select>
            <FieldError errors={errors} field="grade" />
          </label>
          <label
            className={styles.fieldLabel}
            htmlFor="hr-new-employee-manager"
          >
            <RequiredFieldLabel>مدیر مستقیم</RequiredFieldLabel>
            <select
              className={styles.control}
              id="hr-new-employee-manager"
              name="manager"
              onChange={(event) => update('manager', event.target.value)}
              value={value.manager}
            >
              <option value="بدون مدیر مستقیم">بدون مدیر مستقیم</option>
              {managers.map((manager) => (
                <option key={manager} value={manager}>
                  {manager}
                </option>
              ))}
            </select>
          </label>
        </div>
      </fieldset>

      <fieldset className={styles.formFieldset}>
        <legend className={styles.formLegend}>وضعیت همکاری</legend>
        <div className={styles.formGrid}>
          <label
            className={styles.fieldLabel}
            htmlFor="hr-new-employee-started-at"
          >
            <RequiredFieldLabel required>تاریخ شروع</RequiredFieldLabel>
            <DatePicker
              {...errorProps('startedAt')}
              id="hr-new-employee-started-at"
              name="startedAt"
              onChange={(nextValue) => update('startedAt', nextValue)}
              placeholder="انتخاب تاریخ شروع"
              required
              value={value.startedAt}
            />
            <FieldError errors={errors} field="startedAt" />
          </label>
          <label className={styles.fieldLabel} htmlFor="hr-new-employee-status">
            <RequiredFieldLabel required>وضعیت</RequiredFieldLabel>
            <select
              className={styles.control}
              id="hr-new-employee-status"
              name="status"
              onChange={(event) => update('status', event.target.value)}
              required
              value={value.status}
            >
              {employeeStatuses.map((option) => (
                <option key={option} value={option}>
                  {option}
                </option>
              ))}
            </select>
          </label>
        </div>
      </fieldset>

      <div className={styles.modalFooter}>
        <button className={styles.button} onClick={onCancel} type="button">
          انصراف
        </button>
        <button
          className={`${styles.button} ${styles.buttonPrimary}`}
          type="submit"
        >
          {initialValue ? 'ذخیره ویرایش' : 'افزودن به فهرست'}
        </button>
      </div>
    </form>
  );
}

interface NewEmployeeDialogProps {
  existingPersonnelCodes: readonly string[];
  initialValue?: NewEmployeeFormValue | undefined;
  managerOptions: readonly string[];
  onClose: () => void;
  onSubmit: (value: NewEmployeeFormValue) => void;
}

export function NewEmployeeDialog({
  existingPersonnelCodes,
  initialValue,
  managerOptions,
  onClose,
  onSubmit,
}: NewEmployeeDialogProps) {
  return (
    <Dialog onOpenChange={(open) => !open && onClose()} open>
      <DialogContent
        className={`${styles.modal} ${styles.employeeModal}`}
        dir="rtl"
      >
        <DialogTitle>
          {initialValue ? 'ویرایش کارمند' : 'افزودن کارمند جدید'}
        </DialogTitle>
        <DialogDescription>
          مشخصات پایه و جایگاه سازمانی کارمند را مطابق فهرست کارکنان تکمیل کنید.
        </DialogDescription>
        <NewEmployeeForm
          existingPersonnelCodes={existingPersonnelCodes}
          initialValue={initialValue}
          managerOptions={managerOptions}
          onCancel={onClose}
          onSubmit={onSubmit}
        />
      </DialogContent>
    </Dialog>
  );
}
