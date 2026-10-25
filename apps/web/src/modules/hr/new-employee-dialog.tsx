'use client';
import { NativeSearchSelect } from '@/components/ui/native-search-select';

import { useEffect, useState, type FormEvent } from 'react';
import { DatePicker } from '@/components/ui/date-picker';
import { Dialog, DialogContent, DialogTitle } from '@/components/ui/overlays';
import styles from './hr-forms.module.css';
import { buttonVariants } from '@/components/ui/button';
import {
  PersonnelIdentityFields,
  defaultPersonnelIdentity,
  personnelIdentityError,
} from './personnel-identity-fields';
import { RequiredFieldLabel } from './required-field-label';
import { HR_GRADE_OPTIONS } from './hr-grade-options';

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
  extension?: string;
  profileRecords?: { id: string; version: number }[];
  identityValues?: string[];
  contactValues?: string[][];
  photoFile?: File | undefined;
  photoValidUntil?: string | undefined;
  groupId?: string;
  userId?: string;
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
  grade: 'کارشناس',
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
  if (value.extension && !/^[0-9۰-۹٠-٩]{1,20}$/.test(value.extension.trim()))
    errors.extension = 'شماره داخلی باید فقط شامل رقم باشد.';

  if (value.photoFile && !value.photoValidUntil)
    errors.photoFile = 'برای این نوع فایل، تاریخ اعتبار بایگانی را مشخص کنید.';

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

  if (!value.branch.trim()) errors.branch = 'شعبه را انتخاب کنید.';
  if (!value.position.trim()) errors.position = 'عنوان شغلی الزامی است.';
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
  personnelMode?: boolean | undefined;
  cityOptions?: readonly { province: string; city: string }[] | undefined;
  groupOptions?:
    readonly { id: string; name: string; branch: string }[] | undefined;
  userOptions?:
    | readonly {
        id: string;
        label: string;
        branches: readonly string[];
        unavailableReason?: 'INACTIVE' | 'LINKED';
      }[]
    | undefined;
  userOptionsError?: string | undefined;
  existingPersonnelCodes: readonly string[];
  initialValue?: NewEmployeeFormValue | undefined;
  managerOptions: readonly string[];
  onCancel: () => void;
  onSubmit: (value: NewEmployeeFormValue) => void | Promise<void>;
  branchOptions?: readonly string[] | undefined;
  unitOptions?: readonly string[] | undefined;
  lockAssignment?: boolean;
  organizationOptions?: readonly {
    branch: string;
    units: readonly string[];
    positions: readonly string[];
    grades: readonly string[];
  }[];
  onAddReference?: (
    kind: 'branches' | 'units' | 'positions',
    branch: string,
  ) => void;
  createdReference?: {
    id: string;
    kind: 'branches' | 'units' | 'positions';
    value: string;
  };
}

export function NewEmployeeForm({
  personnelMode = false,
  cityOptions,
  groupOptions,
  userOptions,
  userOptionsError,
  existingPersonnelCodes,
  initialValue,
  managerOptions,
  branchOptions = previewBranches,
  unitOptions = previewUnits,
  lockAssignment = false,
  organizationOptions,
  onAddReference,
  createdReference,
  onCancel,
  onSubmit,
}: NewEmployeeFormProps) {
  const [value, setValue] = useState<NewEmployeeFormValue>(
    () =>
      initialValue ?? {
        ...defaultEmployeeValue,
        ...(personnelMode
          ? { identityValues: [...defaultPersonnelIdentity], contactValues: [] }
          : {}),
        branch: branchOptions[0] ?? '',
        unit: unitOptions[0] ?? '',
        ...(organizationOptions ? { unit: '', position: '', grade: '' } : {}),
        personnelCode: nextEmployeePersonnelCode(existingPersonnelCodes),
      },
  );
  useEffect(() => {
    if (!createdReference) return;
    const timer = window.setTimeout(
      () =>
        setValue((current) =>
          createdReference.kind === 'branches'
            ? {
                ...current,
                branch: createdReference.value,
                userId: '',
                unit: '',
                position: '',
                grade: '',
              }
            : {
                ...current,
                [createdReference.kind === 'units' ? 'unit' : 'position']:
                  createdReference.value,
              },
        ),
      0,
    );
    return () => window.clearTimeout(timer);
  }, [createdReference]);
  const [step, setStep] = useState(0);
  const [identityError, setIdentityError] = useState('');
  const [saving, setSaving] = useState(false);
  const [saveError, setSaveError] = useState('');
  const [errors, setErrors] = useState<NewEmployeeFormErrors>({});

  const update = (field: FormField, nextValue: string) => {
    setValue((current) => ({
      ...current,
      [field]: nextValue,
      ...(field === 'branch' ? { userId: '', groupId: '' } : {}),
      ...(field === 'branch' && organizationOptions
        ? { unit: '', position: '', grade: '' }
        : {}),
    }));
    setErrors((current) => {
      if (!current[field]) return current;
      const next = { ...current };
      delete next[field];
      return next;
    });
  };

  const submit = async (event: FormEvent<HTMLFormElement>) => {
    event.preventDefault();
    const nextErrors = validateNewEmployeeForm(value, existingPersonnelCodes);
    if (personnelMode) {
      const identityError = personnelIdentityError(
        value.identityValues ?? defaultPersonnelIdentity,
      );
      setIdentityError(identityError);
      if (step === 0) {
        const nameErrors = Object.fromEntries(
          Object.entries(nextErrors).filter(([key]) =>
            ['firstName', 'lastName', 'photoFile', 'extension'].includes(key),
          ),
        );
        setErrors(nameErrors);
        if (!identityError && !Object.keys(nameErrors).length) setStep(1);
        return;
      }
      if (identityError) {
        setStep(0);
        return;
      }
    }
    if (Object.keys(nextErrors).length) {
      setErrors(nextErrors);
      return;
    }
    if (personnelMode && step === 1) {
      setStep(2);
      return;
    }
    if (saving) return;
    setSaving(true);
    setSaveError('');
    try {
      await onSubmit({
        ...value,
        ...(personnelMode
          ? {
              identityValues: [
                value.firstName.trim(),
                value.lastName.trim(),
                ...(value.identityValues ?? defaultPersonnelIdentity).slice(2),
              ],
            }
          : {}),
        firstName: value.firstName.trim(),
        lastName: value.lastName.trim(),
        personnelCode: value.personnelCode.trim(),
        position: value.position.trim(),
      });
    } catch (error) {
      setSaveError(error instanceof Error ? error.message : 'ذخیره انجام نشد.');
    } finally {
      setSaving(false);
    }
  };

  const errorProps = (field: FormField) => ({
    'aria-describedby': errors[field]
      ? `hr-new-employee-${field}-error`
      : undefined,
    'aria-invalid': Boolean(errors[field]),
  });

  const managers = Array.from(new Set(managerOptions));
  const organization = organizationOptions?.find(
    (o) => o.branch === value.branch,
  );
  const currentOptions = (options: readonly string[], current: string) =>
    Array.from(new Set([...options, ...(current ? [current] : [])]));

  const groupControl = groupOptions ? (
    <label className={styles.fieldLabel}>
      گروه
      <NativeSearchSelect
        value={value.groupId ?? ''}
        onChange={(event) => update('groupId', event.target.value)}
      >
        <option value="">بدون گروه</option>
        {groupOptions
          .filter((group) => group.branch === value.branch)
          .map((group) => (
            <option key={group.id} value={group.id}>
              {group.name}
            </option>
          ))}
      </NativeSearchSelect>
    </label>
  ) : null;

  return (
    <form noValidate onSubmit={submit}>
      {personnelMode && step === 2 ? (
        <fieldset className={styles.formFieldset}>
          <dl>
            <dt>نام و نام خانوادگی</dt>
            <dd>
              {value.firstName} {value.lastName}
            </dd>
            <dt>کد ملی</dt>
            <dd>{value.identityValues?.[2]}</dd>
            <dt>شماره‌های تماس</dt>
            <dd>{value.contactValues?.length ?? 0}</dd>
            <dt>شعبه</dt>
            <dd>{value.branch}</dd>
            <dt>عنوان شغلی</dt>
            <dd>{value.position}</dd>
            <dt>تاریخ شروع</dt>
            <dd>{value.startedAt}</dd>
          </dl>
        </fieldset>
      ) : null}
      {saveError ? (
        <p role="alert" className={styles.fieldError}>
          {saveError}
        </p>
      ) : null}

      <fieldset
        className={styles.formFieldset}
        hidden={personnelMode && step === 2}
      >
        {!personnelMode || step === 1 ? (
          <legend className={styles.formLegend}>
            {personnelMode ? 'اطلاعات پرسنلی' : 'مشخصات پایه'}
          </legend>
        ) : null}
        <div className={styles.formGrid}>
          <label
            className={styles.fieldLabel}
            htmlFor="hr-new-employee-first-name"
            style={
              personnelMode && step !== 0 ? { display: 'none' } : undefined
            }
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
            style={
              personnelMode && step !== 0 ? { display: 'none' } : undefined
            }
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

          {!personnelMode ? groupControl : null}
          {personnelMode && step === 0 ? (
            <PersonnelIdentityFields
              cityOptions={cityOptions}
              values={value.identityValues ?? [...defaultPersonnelIdentity]}
              onChange={(identityValues) =>
                setValue((current) => ({ ...current, identityValues }))
              }
              groupControl={groupControl}
              contacts={value.contactValues ?? []}
              onContacts={(contactValues) =>
                setValue((current) => ({ ...current, contactValues }))
              }
              photo={value.photoFile}
              photoValidUntil={value.photoValidUntil}
              onPhotoValidUntil={(photoValidUntil) =>
                setValue((current) => ({ ...current, photoValidUntil }))
              }
              onPhoto={(photoFile) =>
                setValue((current) => ({ ...current, photoFile }))
              }
              photoValidityError={errors.photoFile ?? ''}
              error={identityError}
            />
          ) : null}
          <label
            className={styles.fieldLabel}
            style={
              personnelMode && step !== 0 ? { display: 'none' } : undefined
            }
            htmlFor="hr-employee-extension"
          >
            شماره داخلی
            <input
              id="hr-employee-extension"
              name="extension"
              className={styles.control}
              dir="ltr"
              inputMode="numeric"
              maxLength={20}
              value={value.extension ?? ''}
              onChange={(event) => update('extension', event.target.value)}
              {...errorProps('extension')}
            />
            <FieldError errors={errors} field="extension" />
          </label>
          <label
            className={styles.fieldLabel}
            htmlFor="hr-new-employee-code"
            style={
              personnelMode && step !== 1 ? { display: 'none' } : undefined
            }
          >
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
          <label
            className={styles.fieldLabel}
            htmlFor="hr-new-employee-type"
            style={
              personnelMode && step !== 1 ? { display: 'none' } : undefined
            }
          >
            <RequiredFieldLabel required>نوع همکاری</RequiredFieldLabel>
            <NativeSearchSelect
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
            </NativeSearchSelect>
          </label>
        </div>
      </fieldset>

      <fieldset
        className={styles.formFieldset}
        hidden={personnelMode && step !== 1}
      >
        <legend className={styles.formLegend}>جایگاه سازمانی</legend>
        <div className={styles.formGrid}>
          <label className={styles.fieldLabel} htmlFor="hr-new-employee-branch">
            <RequiredFieldLabel required>شعبه</RequiredFieldLabel>
            {onAddReference && !lockAssignment ? (
              <button
                type="button"
                onClick={() => onAddReference('branches', value.branch)}
              >
                افزودن شعبه
              </button>
            ) : null}
            <NativeSearchSelect
              className={styles.control}
              id="hr-new-employee-branch"
              {...errorProps('branch')}
              disabled={lockAssignment}
              name="branch"
              onChange={(event) => update('branch', event.target.value)}
              required
              value={value.branch}
            >
              {branchOptions.map((option) => (
                <option key={option} value={option}>
                  {option}
                </option>
              ))}
            </NativeSearchSelect>
            <FieldError errors={errors} field="branch" />
          </label>
          <label className={styles.fieldLabel} htmlFor="hr-new-employee-unit">
            <RequiredFieldLabel>واحد</RequiredFieldLabel>
            {onAddReference ? (
              <button
                type="button"
                onClick={() => onAddReference('units', value.branch)}
              >
                افزودن واحد
              </button>
            ) : null}
            <NativeSearchSelect
              className={styles.control}
              id="hr-new-employee-unit"
              {...errorProps('unit')}
              name="unit"
              onChange={(event) => update('unit', event.target.value)}
              value={value.unit}
            >
              <option value="">انتخاب واحد</option>
              {currentOptions(
                organizationOptions ? (organization?.units ?? []) : unitOptions,
                value.unit,
              ).map((option) => (
                <option key={option} value={option}>
                  {option}
                </option>
              ))}
            </NativeSearchSelect>
            <FieldError errors={errors} field="unit" />
          </label>
          <label
            className={styles.fieldLabel}
            htmlFor="hr-new-employee-position"
          >
            <RequiredFieldLabel required>عنوان شغلی</RequiredFieldLabel>
            {onAddReference ? (
              <button
                type="button"
                onClick={() => onAddReference('positions', value.branch)}
              >
                افزودن عنوان شغلی
              </button>
            ) : null}
            {organizationOptions ? (
              <NativeSearchSelect
                {...errorProps('position')}
                className={styles.control}
                id="hr-new-employee-position"
                name="position"
                required
                value={value.position}
                onChange={(event) => update('position', event.target.value)}
              >
                <option value="">انتخاب عنوان شغلی</option>
                {currentOptions(
                  organization?.positions ?? [],
                  value.position,
                ).map((option) => (
                  <option key={option} value={option}>
                    {option}
                  </option>
                ))}
              </NativeSearchSelect>
            ) : (
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
            )}
            <FieldError errors={errors} field="position" />
          </label>
          <label className={styles.fieldLabel} htmlFor="hr-new-employee-grade">
            <RequiredFieldLabel required>رده شغلی</RequiredFieldLabel>
            <NativeSearchSelect
              {...errorProps('grade')}
              className={styles.control}
              id="hr-new-employee-grade"
              name="grade"
              onChange={(event) => update('grade', event.target.value)}
              required
              value={value.grade}
            >
              <option value="">انتخاب رده شغلی</option>
              {currentOptions(
                [...HR_GRADE_OPTIONS, ...(organization?.grades ?? [])],
                value.grade,
              ).map((option) => (
                <option key={option} value={option}>
                  {option}
                </option>
              ))}
            </NativeSearchSelect>
            <FieldError errors={errors} field="grade" />
          </label>
          <label
            className={styles.fieldLabel}
            htmlFor="hr-new-employee-manager"
          >
            <RequiredFieldLabel>مدیر مستقیم</RequiredFieldLabel>
            <NativeSearchSelect
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
            </NativeSearchSelect>
          </label>
        </div>
      </fieldset>

      <fieldset
        className={styles.formFieldset}
        hidden={personnelMode && step !== 1}
      >
        <legend className={styles.formLegend}>
          حساب کاربری و وضعیت همکاری
        </legend>
        <label className={styles.fieldLabel} htmlFor="hr-employee-user">
          حساب کاربری سامانه
          <NativeSearchSelect
            className={styles.control}
            id="hr-employee-user"
            optionLimit={(userOptions?.length ?? 0) + 2}
            disabled={!userOptions}
            value={value.userId ?? ''}
            onChange={(e) => update('userId', e.target.value)}
          >
            <option value="">بدون حساب کاربری مرتبط</option>
            {value.userId &&
            !userOptions?.some((u) => u.id === value.userId) ? (
              <option value={value.userId} disabled>
                حساب فعلی · {value.userId}
              </option>
            ) : null}
            {userOptions?.map((u) => (
              <option
                key={u.id}
                value={u.id}
                disabled={
                  Boolean(u.unavailableReason) ||
                  !u.branches.includes(value.branch)
                }
              >
                {u.label}
                {u.unavailableReason === 'LINKED'
                  ? ' · مرتبط با کارمند دیگر'
                  : u.unavailableReason === 'INACTIVE'
                    ? ' · غیرفعال'
                    : !u.branches.includes(value.branch)
                      ? ' · خارج از شعبه انتخاب‌شده'
                      : ''}
              </option>
            ))}
          </NativeSearchSelect>
          {userOptionsError ? (
            <small role="alert">{userOptionsError}</small>
          ) : null}
        </label>
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
            <NativeSearchSelect
              className={styles.control}
              id="hr-new-employee-status"
              disabled={lockAssignment}
              name="status"
              onChange={(event) => update('status', event.target.value)}
              required
              value={value.status}
            >
              {currentOptions(employeeStatuses, value.status).map((option) => (
                <option key={option} value={option}>
                  {option}
                </option>
              ))}
            </NativeSearchSelect>
          </label>
        </div>
      </fieldset>

      <div className={styles.modalFooter}>
        {personnelMode && step > 0 ? (
          <button
            className={buttonVariants({ variant: 'outline' })}
            type="button"
            disabled={saving}
            onClick={() => setStep(step - 1)}
          >
            قبلی
          </button>
        ) : null}
        <button
          className={buttonVariants({ variant: 'outline' })}
          onClick={onCancel}
          type="button"
        >
          انصراف
        </button>
        <button
          className={buttonVariants({ variant: 'primary' })}
          type="submit"
          disabled={saving}
        >
          {personnelMode && step < 2
            ? 'بعدی'
            : saving
              ? 'در حال ذخیره…'
              : initialValue
                ? 'ذخیره ویرایش'
                : 'ثبت کارمند'}
        </button>
      </div>
    </form>
  );
}

interface NewEmployeeDialogProps {
  personnelMode?: boolean | undefined;
  cityOptions?: readonly { province: string; city: string }[] | undefined;
  groupOptions?: NewEmployeeFormProps['groupOptions'];
  userOptions?: NewEmployeeFormProps['userOptions'];
  userOptionsError?: string | undefined;
  existingPersonnelCodes: readonly string[];
  initialValue?: NewEmployeeFormValue | undefined;
  managerOptions: readonly string[];
  onClose: () => void;
  onSubmit: (value: NewEmployeeFormValue) => void | Promise<void>;
  branchOptions?: readonly string[] | undefined;
  unitOptions?: readonly string[] | undefined;
  lockAssignment?: boolean;
  organizationOptions?: NewEmployeeFormProps['organizationOptions'];
  onAddReference?: NewEmployeeFormProps['onAddReference'];
  createdReference?: NewEmployeeFormProps['createdReference'];
  referenceLoading?: boolean;
  referenceError?: string;
  onRetryReferences?: () => void;
}

export function NewEmployeeDialog({
  personnelMode,
  cityOptions,
  groupOptions,
  userOptions,
  userOptionsError,
  existingPersonnelCodes,
  initialValue,
  managerOptions,
  branchOptions,
  unitOptions,
  organizationOptions,
  onAddReference,
  createdReference,
  referenceLoading = false,
  referenceError,
  onRetryReferences,
  lockAssignment = false,
  onClose,
  onSubmit,
}: NewEmployeeDialogProps) {
  const [catalogReady, setCatalogReady] = useState(
    !referenceLoading && !referenceError,
  );
  useEffect(() => {
    if (referenceLoading || referenceError) return;
    const timer = window.setTimeout(() => setCatalogReady(true), 0);
    return () => window.clearTimeout(timer);
  }, [referenceLoading, referenceError]);
  const waitingForInitialCatalog =
    !catalogReady && (referenceLoading || referenceError);
  return (
    <Dialog onOpenChange={(open) => !open && onClose()} open>
      <DialogContent
        aria-describedby={undefined}
        className={`${styles.modal} ${styles.employeeModal}`}
        dir="rtl"
      >
        <DialogTitle>
          {personnelMode
            ? 'فرم پرسنلی'
            : initialValue
              ? 'ویرایش کارمند'
              : 'افزودن کارمند جدید'}
        </DialogTitle>
        {waitingForInitialCatalog ? (
          <div role={referenceError ? 'alert' : 'status'}>
            <p>{referenceError || 'دریافت واحدها و عنوان‌های شغلی…'}</p>
            {referenceError && onRetryReferences ? (
              <button type="button" onClick={onRetryReferences}>
                تلاش دوباره
              </button>
            ) : null}
          </div>
        ) : (
          <NewEmployeeForm
            personnelMode={personnelMode}
            cityOptions={cityOptions}
            groupOptions={groupOptions}
            userOptions={userOptions}
            userOptionsError={userOptionsError}
            existingPersonnelCodes={existingPersonnelCodes}
            initialValue={initialValue}
            managerOptions={managerOptions}
            {...(onAddReference ? { onAddReference } : {})}
            {...(createdReference ? { createdReference } : {})}
            branchOptions={branchOptions}
            unitOptions={unitOptions}
            {...(organizationOptions ? { organizationOptions } : {})}
            lockAssignment={lockAssignment}
            onCancel={onClose}
            onSubmit={onSubmit}
          />
        )}
      </DialogContent>
    </Dialog>
  );
}
