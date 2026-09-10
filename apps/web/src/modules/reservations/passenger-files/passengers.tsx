'use client';
import { useEffect, useState } from 'react';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/form-controls';
import {
  passengerFilesRequest,
  type PassengerName,
  type PassengersResponse,
} from './client';
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
      setRows((old) => old.map((r) => (r.id === row.id ? result.data : r)));
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
      <div className="space-y-3">
        {rows.map((row, i) => (
          <form
            key={row.id}
            className="grid gap-3 rounded-xl border p-3 sm:grid-cols-[1fr_1fr_auto]"
            onSubmit={(e) => {
              e.preventDefault();
              void save(row);
            }}
          >
            <label className="space-y-1 text-sm">
              نام مسافر {i + 1}
              <Input
                aria-label={`نام مسافر ${i + 1}`}
                value={row.firstName}
                onChange={(e) => change(row.id, 'firstName', e.target.value)}
                required
                maxLength={100}
                disabled={!canEdit || Boolean(busy)}
              />
            </label>
            <label className="space-y-1 text-sm">
              نام خانوادگی
              <Input
                aria-label={`نام خانوادگی مسافر ${i + 1}`}
                value={row.lastName}
                onChange={(e) => change(row.id, 'lastName', e.target.value)}
                required
                maxLength={100}
                disabled={!canEdit || Boolean(busy)}
              />
            </label>
            <Button
              type="submit"
              className="self-end"
              disabled={!canEdit || Boolean(busy)}
            >
              {busy === row.id ? 'در حال ذخیره…' : 'ذخیره نام'}
            </Button>
          </form>
        ))}
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
