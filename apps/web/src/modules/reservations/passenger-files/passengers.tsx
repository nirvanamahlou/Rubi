'use client';
import { useEffect, useState } from 'react';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/form-controls';
import {
  passengerFilesRequest,
  type PassengerName,
  type PassengersResponse,
} from './client';
import styles from './passengers.module.css';

const value = (input: string | null, masked = false) =>
  input ? `${input}${masked ? ' (ماسک‌شده)' : ''}` : 'ثبت نشده';

export function ReservationPassengers({ id }: { id: string }) {
  const [rows, setRows] = useState<PassengerName[]>([]);
  const [canEdit, setCanEdit] = useState(false);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');
  const [message, setMessage] = useState('');
  const [busy, setBusy] = useState('');
  const [revision, setRevision] = useState(0);
  useEffect(() => {
    let active = true;
    passengerFilesRequest<PassengersResponse>(id, 'passengers')
      .then((r) => {
        if (active) {
          setRows(r.data);
          setCanEdit(r.canEdit);
          setError('');
        }
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
  const change = (
    customerId: string,
    field: 'firstName' | 'lastName',
    value: string,
  ) =>
    setRows((old) =>
      old.map((r) => (r.id === customerId ? { ...r, [field]: value } : r)),
    );
  async function save(row: PassengerName) {
    setBusy(row.id);
    setError('');
    setMessage('');
    try {
      const result = await passengerFilesRequest<{ data: PassengerName }>(
        id,
        `passengers/${encodeURIComponent(row.id)}`,
        {
          method: 'PATCH',
          headers: { 'content-type': 'application/json' },
          body: JSON.stringify({
            firstName: row.firstName.trim(),
            lastName: row.lastName.trim(),
            version: row.version,
          }),
        },
      );
      setRows((old) =>
        old.map((r) =>
          r.id === row.id
            ? {
                ...r,
                firstName: result.data.firstName,
                lastName: result.data.lastName,
                displayName: result.data.displayName,
                version: result.data.version,
              }
            : r,
        ),
      );
      setMessage('نام مسافر در پروندهٔ اصلی ذخیره شد.');
    } catch (e) {
      setError(e instanceof Error ? e.message : 'ذخیره انجام نشد.');
    } finally {
      setBusy('');
    }
  }
  if (loading) return <p>در حال دریافت اطلاعات مسافران…</p>;
  return (
    <div className="space-y-4">
      <p className="text-sm text-muted-foreground">
        نام‌ها از پروندهٔ اصلی مسافران خوانده می‌شوند. اصلاح نام در همان پرونده
        ذخیره می‌شود؛ نسخهٔ قرارداد و مدارک صادرشده برای حفظ سابقه بازنویسی
        نمی‌شوند.
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
              <th>رده سنی</th>
              <th>جنسیت</th>
              <th>تاریخ تولد</th>
              <th>شماره ملی</th>
              <th>شماره پاسپورت</th>
              <th>انقضای پاسپورت</th>
              <th>محل صدور پاسپورت</th>
              <th>عملیات</th>
            </tr>
          </thead>
          <tbody>
            {rows.map((row, i) => (
              <tr key={row.id}>
                <td>
                  <Input
                    aria-label={`نام مسافر ${i + 1}`}
                    value={row.firstName}
                    onChange={(e) =>
                      change(row.id, 'firstName', e.target.value)
                    }
                    required
                    maxLength={100}
                    disabled={!canEdit || Boolean(busy)}
                    form={`passenger-${row.id}`}
                  />
                </td>
                <td>
                  <Input
                    aria-label={`نام خانوادگی مسافر ${i + 1}`}
                    value={row.lastName}
                    onChange={(e) => change(row.id, 'lastName', e.target.value)}
                    required
                    maxLength={100}
                    disabled={!canEdit || Boolean(busy)}
                    form={`passenger-${row.id}`}
                  />
                </td>
                <td>{row.ageCategory ?? 'ثبت نشده'}</td>
                <td>{value(row.gender)}</td>
                <td>
                  {row.birthDateMasked
                    ? 'ثبت شده؛ نیازمند مجوز نمایش'
                    : value(row.birthDate)}
                </td>
                <td>{value(row.nationalId, row.nationalIdMasked)}</td>
                <td>{value(row.passportNumber, row.passportNumberMasked)}</td>
                <td>{value(row.passportExpiryDate)}</td>
                <td>{value(row.passportIssuePlace)}</td>
                <td>
                  <form
                    id={`passenger-${row.id}`}
                    onSubmit={(e) => {
                      e.preventDefault();
                      void save(row);
                    }}
                  >
                    <Button type="submit" disabled={!canEdit || Boolean(busy)}>
                      {busy === row.id ? 'در حال ذخیره…' : 'ذخیره نام'}
                    </Button>
                  </form>
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
      {!rows.length && !error && <p>مسافری به این قرارداد متصل نشده است.</p>}
      {!canEdit && rows.length > 0 && (
        <p className="text-sm text-muted-foreground">
          مجوز ویرایش نام مسافران برای حساب شما فعال نیست.
        </p>
      )}
      <Button
        variant="outline"
        disabled={Boolean(busy)}
        onClick={() => {
          setLoading(true);
          setRevision((r) => r + 1);
        }}
      >
        دریافت دوباره اطلاعات
      </Button>
    </div>
  );
}
