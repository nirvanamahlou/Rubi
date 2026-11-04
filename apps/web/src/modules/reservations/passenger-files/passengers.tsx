'use client';
import { NativeSearchSelect } from '@/components/ui/native-search-select';

import {
  useEffect,
  useImperativeHandle,
  useState,
  type ReactNode,
  type Ref,
} from 'react';
import { Button } from '@/components/ui/button';
import { DatePicker } from '@/components/ui/date-picker';
import { Input } from '@/components/ui/form-controls';
import {
  passengerFilesRequest,
  type PassengerName,
  type PassengersResponse,
} from './client';
import styles from './passengers.module.css';

type EditableField =
  | 'firstName'
  | 'lastName'
  | 'passportFirstName'
  | 'passportLastName'
  | 'gender'
  | 'birthDate'
  | 'nationalId'
  | 'passportNumber'
  | 'passportExpiryDate'
  | 'passportIssuePlace'
  | 'nationalityCode'
  | 'birthCountryCode';

const nullable = (value: string | null) => value?.trim() || '';

export interface ReservationPassengerEditor {
  savePending: () => Promise<boolean>;
}

export function ReservationPassengers({
  id,
  readOnly = false,
  ageEditor,
  serviceEditor,
  rowActions,
  saveRef,
  onDirty,
  customerIds,
  pendingRows = [],
}: {
  id: string;
  readOnly?: boolean;
  ageEditor?: (customerId: string) => ReactNode;
  serviceEditor?: (customerId: string) => ReactNode;
  rowActions?: (customerId: string) => ReactNode;
  saveRef?: Ref<ReservationPassengerEditor>;
  onDirty?: () => void;
  /** Unsaved contract-membership edits can hide removed links without deleting identities. */
  customerIds?: readonly string[];
  /** Customer-registered additions awaiting the contract amendment; identity is read-only. */
  pendingRows?: readonly PassengerName[];
}) {
  const [rows, setRows] = useState<PassengerName[]>([]);
  const [dirty, setDirty] = useState<string[]>([]);
  const [canEdit, setCanEdit] = useState(false);
  const [canEditIdentity, setCanEditIdentity] = useState(false);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');
  const [message, setMessage] = useState('');
  const [busy, setBusy] = useState('');
  const [revision, setRevision] = useState(0);
  useEffect(() => {
    const refresh = () => setRevision((value) => value + 1);
    window.addEventListener('reservation-workflow-changed', refresh);
    return () =>
      window.removeEventListener('reservation-workflow-changed', refresh);
  }, []);

  useEffect(() => {
    let active = true;
    passengerFilesRequest<PassengersResponse>(id, 'passengers')
      .then((r) => {
        if (!active) return;
        setRows(r.data);
        setDirty([]);
        setCanEdit(r.canEdit);
        setCanEditIdentity(r.canEditIdentity);
        setError('');
      })
      .catch((e) => {
        if (active) setError(e.message);
      })
      .finally(() => {
        if (active) setLoading(false);
      });
    return () => {
      active = false;
    };
  }, [id, revision]);

  function change(customerId: string, field: EditableField, value: string) {
    onDirty?.();
    setDirty((old) => [...new Set([...old, customerId])]);
    setRows((old) =>
      old.map((row) =>
        row.id === customerId ? { ...row, [field]: value } : row,
      ),
    );
  }

  async function saveRows(targets: PassengerName[]) {
    if (loading || busy) return false;
    if (!targets.length) return true;
    if (readOnly || !canEdit) return false;
    setBusy(targets[0]!.id);
    setError('');
    setMessage('');
    try {
      for (const row of targets) {
        const path = `passengers/${encodeURIComponent(row.id)}${
          canEditIdentity ? '/identity' : ''
        }`;
        const body = canEditIdentity
          ? {
              firstName: row.firstName.trim(),
              lastName: row.lastName.trim(),
              passportFirstName: nullable(row.passportFirstName),
              passportLastName: nullable(row.passportLastName),
              gender: row.gender ?? '',
              birthDate: nullable(row.birthDate),
              nationalId: nullable(row.nationalId),
              passportNumber: nullable(row.passportNumber),
              passportExpiryDate: nullable(row.passportExpiryDate),
              passportIssuingCountryCode: nullable(row.passportIssuePlace),
              nationalityCode: nullable(row.nationalityCode),
              birthCountryCode: nullable(row.birthCountryCode),
              version: row.version,
            }
          : {
              firstName: row.firstName.trim(),
              lastName: row.lastName.trim(),
              version: row.version,
            };
        const result = await passengerFilesRequest<{ data: PassengerName }>(
          id,
          path,
          {
            method: 'PATCH',
            headers: { 'content-type': 'application/json' },
            body: JSON.stringify(body),
          },
        );
        setDirty((old) => old.filter((id) => id !== row.id));
        setRows((old) =>
          old.map((p) =>
            p.id === row.id ? { ...p, version: result.data.version } : p,
          ),
        );
      }
      setMessage(
        canEditIdentity
          ? 'مشخصات مسافر در پروندهٔ اصلی فروش ذخیره شد.'
          : 'نام مسافر در پروندهٔ اصلی ذخیره شد.',
      );
      if (!dirty.some((id) => !targets.some((row) => row.id === id))) {
        setLoading(true);
        setRevision((value) => value + 1);
        window.dispatchEvent(new Event('reservation-workflow-changed'));
      }
      return true;
    } catch (e) {
      setError(e instanceof Error ? e.message : 'ذخیره انجام نشد.');
      return false;
    } finally {
      setBusy('');
    }
  }

  useImperativeHandle(saveRef, () => ({
    savePending: () =>
      saveRows(
        rows.filter(
          (row) =>
            dirty.includes(row.id) &&
            (!customerIds || customerIds.includes(row.id)),
        ),
      ),
  }));

  if (loading) return <p>در حال دریافت اطلاعات مسافران…</p>;
  const displayedRows = [
    ...rows,
    ...pendingRows.filter((p) => !rows.some((row) => row.id === p.id)),
  ].filter((row) => !customerIds || customerIds.includes(row.id));

  if (readOnly)
    return (
      <div className="space-y-3">
        {error && (
          <p role="alert" className="text-destructive">
            {error}
          </p>
        )}
        <div className={styles.tableWrap}>
          <table className={styles.table}>
            <thead>
              <tr>
                {[
                  'نام',
                  'نام خانوادگی',
                  'نام لاتین پاسپورت',
                  'نام خانوادگی لاتین پاسپورت',
                  'رده سنی',
                  'جنسیت',
                  'تاریخ تولد',
                  'شماره ملی',
                  'شماره پاسپورت',
                  'انقضای پاسپورت',
                  'ملیت',
                  'محل صدور پاسپورت',
                  'کشور تولد',
                ].map((label) => (
                  <th key={label}>{label}</th>
                ))}
                <th>شماره بیمه‌نامه</th>
              </tr>
            </thead>
            <tbody>
              {displayedRows.map((row) => (
                <tr key={row.id}>
                  {[
                    row.firstName,
                    row.lastName,
                    row.passportFirstName,
                    row.passportLastName,
                    row.ageCategory,
                    row.gender,
                    row.birthDate,
                    row.nationalId,
                    row.passportNumber,
                    row.passportExpiryDate,
                    row.nationalityCode,
                    row.passportIssuePlace,
                    row.birthCountryCode,
                  ].map((value, i) => (
                    <td key={i}>{value || '—'}</td>
                  ))}
                  <td dir="ltr">{row.insurancePolicyNumber ?? ''}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
        {!displayedRows.length && !error && (
          <p>مسافری به این قرارداد متصل نشده است.</p>
        )}
      </div>
    );

  return (
    <div className="space-y-4">
      <p className="text-sm text-muted-foreground">
        مشخصات از پروندهٔ اصلی مسافر خوانده می‌شود. ذخیرهٔ اصلاحات در همان
        پروندهٔ فروش انجام می‌شود و نسخهٔ قرارداد و مدارک صادرشده برای حفظ سابقه
        بازنویسی نمی‌شوند.
      </p>
      {error && (
        <p role="alert" className="text-destructive">
          {error}
        </p>
      )}
      {message && <p role="status">{message}</p>}
      <div className={styles.tableWrap}>
        <table className={styles.table}>
          <thead>
            <tr>
              <th>نام</th>
              <th>نام خانوادگی</th>
              <th>نام لاتین پاسپورت</th>
              <th>نام خانوادگی لاتین پاسپورت</th>
              <th className={styles.ageColumn}>رده سنی</th>
              <th className={styles.genderColumn}>جنسیت</th>
              <th>تاریخ تولد</th>
              <th>شماره ملی</th>
              <th>شماره پاسپورت</th>
              <th>انقضای پاسپورت</th>
              <th>محل صدور پاسپورت</th>
              <th>ملیت</th>
              <th>کشور محل تولد</th>
              <th>شماره بیمه‌نامه</th>
              <th>عملیات</th>
              {serviceEditor && <th>خدمات مسافر</th>}
            </tr>
          </thead>
          <tbody>
            {displayedRows.map((row, index) => {
              const pending = !rows.some((p) => p.id === row.id);
              const disabled = pending || !canEdit || Boolean(busy);
              const identityDisabled =
                pending || !canEditIdentity || Boolean(busy);
              return (
                <tr key={row.id}>
                  <td>
                    <Input
                      aria-label={`نام مسافر ${index + 1}`}
                      value={row.firstName}
                      onChange={(event) =>
                        change(row.id, 'firstName', event.target.value)
                      }
                      required
                      maxLength={100}
                      disabled={disabled}
                      form={`passenger-${row.id}`}
                    />
                  </td>
                  <td>
                    <Input
                      aria-label={`نام خانوادگی مسافر ${index + 1}`}
                      value={row.lastName}
                      onChange={(event) =>
                        change(row.id, 'lastName', event.target.value)
                      }
                      required
                      maxLength={100}
                      disabled={disabled}
                      form={`passenger-${row.id}`}
                    />
                  </td>
                  <td>
                    <Input
                      aria-label={`نام لاتین پاسپورت مسافر ${index + 1}`}
                      value={nullable(row.passportFirstName)}
                      onChange={(event) =>
                        change(row.id, 'passportFirstName', event.target.value)
                      }
                      maxLength={120}
                      disabled={identityDisabled}
                      form={`passenger-${row.id}`}
                    />
                  </td>
                  <td>
                    <Input
                      aria-label={`نام خانوادگی لاتین پاسپورت مسافر ${index + 1}`}
                      value={nullable(row.passportLastName)}
                      onChange={(event) =>
                        change(row.id, 'passportLastName', event.target.value)
                      }
                      maxLength={120}
                      disabled={identityDisabled}
                      form={`passenger-${row.id}`}
                    />
                  </td>
                  <td className={styles.ageColumn}>
                    {ageEditor
                      ? ageEditor(row.id)
                      : (row.ageCategory ?? 'ثبت نشده')}
                  </td>
                  <td className={styles.genderColumn}>
                    <NativeSearchSelect
                      aria-label={`جنسیت مسافر ${index + 1}`}
                      value={row.gender ?? ''}
                      onChange={(event) =>
                        change(row.id, 'gender', event.target.value)
                      }
                      disabled={identityDisabled}
                    >
                      <option value="">انتخاب نشده</option>
                      <option value="M">مرد</option>
                      <option value="F">زن</option>
                    </NativeSearchSelect>
                  </td>
                  <td>
                    <DatePicker
                      aria-label={`تاریخ تولد مسافر ${index + 1}`}
                      defaultCalendarSystem="gregorian"
                      gregorianEnglish
                      value={nullable(row.birthDate)}
                      onChange={(value) => change(row.id, 'birthDate', value)}
                      disabled={identityDisabled}
                    />
                  </td>
                  <td>
                    <Input
                      aria-label={`شماره ملی مسافر ${index + 1}`}
                      value={nullable(row.nationalId)}
                      onChange={(event) =>
                        change(row.id, 'nationalId', event.target.value)
                      }
                      inputMode="numeric"
                      maxLength={10}
                      disabled={identityDisabled}
                    />
                  </td>
                  <td>
                    <Input
                      aria-label={`شماره پاسپورت مسافر ${index + 1}`}
                      value={nullable(row.passportNumber)}
                      onChange={(event) =>
                        change(row.id, 'passportNumber', event.target.value)
                      }
                      maxLength={24}
                      disabled={identityDisabled}
                    />
                  </td>
                  <td>
                    <DatePicker
                      aria-label={`انقضای پاسپورت مسافر ${index + 1}`}
                      defaultCalendarSystem="gregorian"
                      gregorianEnglish
                      value={nullable(row.passportExpiryDate)}
                      onChange={(value) =>
                        change(row.id, 'passportExpiryDate', value)
                      }
                      disabled={identityDisabled}
                    />
                  </td>
                  <td>
                    <Input
                      aria-label={`محل صدور پاسپورت مسافر ${index + 1}`}
                      value={nullable(row.passportIssuePlace)}
                      onChange={(event) =>
                        change(row.id, 'passportIssuePlace', event.target.value)
                      }
                      maxLength={3}
                      disabled={identityDisabled}
                    />
                  </td>
                  <td>
                    <Input
                      aria-label={`ملیت مسافر ${index + 1}`}
                      value={nullable(row.nationalityCode)}
                      onChange={(event) =>
                        change(row.id, 'nationalityCode', event.target.value)
                      }
                      maxLength={3}
                      disabled={identityDisabled}
                    />
                  </td>
                  <td>
                    <Input
                      aria-label={`کشور محل تولد مسافر ${index + 1}`}
                      value={nullable(row.birthCountryCode)}
                      onChange={(event) =>
                        change(row.id, 'birthCountryCode', event.target.value)
                      }
                      maxLength={3}
                      disabled={identityDisabled}
                    />
                  </td>
                  <td dir="ltr">{row.insurancePolicyNumber ?? ''}</td>
                  <td>
                    <form
                      id={`passenger-${row.id}`}
                      onSubmit={(event) => {
                        event.preventDefault();
                        void saveRows([row]);
                      }}
                    >
                      <Button type="submit" disabled={disabled}>
                        {busy === row.id
                          ? 'در حال ذخیره…'
                          : canEditIdentity
                            ? 'ذخیره مشخصات'
                            : 'ذخیره نام'}
                      </Button>
                    </form>
                    {rowActions?.(row.id)}
                  </td>
                  {serviceEditor && <td>{serviceEditor(row.id)}</td>}
                </tr>
              );
            })}
          </tbody>
        </table>
      </div>
      {!displayedRows.length && !error && (
        <p>مسافری به این قرارداد متصل نشده است.</p>
      )}
      {!canEdit && rows.length > 0 && (
        <p className="text-sm text-muted-foreground">
          مجوز ویرایش نام مسافران برای حساب شما فعال نیست.
        </p>
      )}
      {canEdit && !canEditIdentity && rows.length > 0 && (
        <p className="text-sm text-muted-foreground">
          برای ویرایش شماره پاسپورت و مشخصات هویتی، مجوز مشاهدهٔ اطلاعات حساس
          لازم است.
        </p>
      )}
      <Button
        variant="outline"
        disabled={Boolean(busy)}
        onClick={() => {
          setLoading(true);
          setRevision((value) => value + 1);
        }}
      >
        دریافت دوباره اطلاعات
      </Button>
    </div>
  );
}
