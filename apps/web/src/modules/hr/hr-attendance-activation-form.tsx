'use client';
import { useRef, useState } from 'react';
import {
  HR_ATTENDANCE_STATUSES,
  type HrEmployeeDto,
  type HrRecordDto,
} from '@nora/contracts';
import { Dialog, DialogContent, DialogTitle } from '@/components/ui/overlays';
import { DatePicker } from '@/components/ui/date-picker';
import { HrButton } from './hr-controls';
import { hrRequest } from './hr-api';
import ui from './hr-unified.module.css';

export function AttendanceStatusControl({
  record,
  onSaved,
}: {
  record: HrRecordDto;
  onSaved: () => Promise<void>;
}) {
  const [status, setStatus] = useState<string>(
    record.data.attendanceActive === false || record.status === 'غیرفعال'
      ? 'inactive'
      : (record.data.attendanceStatusOverride ?? 'auto'),
  );
  const [busy, setBusy] = useState(false),
    [error, setError] = useState('');
  const retry = useRef({ body: '', key: crypto.randomUUID() });
  return (
    <div className="grid gap-3 rounded-xl border p-4">
      <label className={ui.field}>
        وضعیت
        <select
          value={status}
          onChange={(e) => setStatus(e.target.value)}
          disabled={busy}
        >
          <option value="auto">وضعیت خودکار</option>
          {HR_ATTENDANCE_STATUSES.map((option) => (
            <option key={option} value={option}>
              {option}
            </option>
          ))}
          <option value="inactive">غیرفعال</option>
        </select>
      </label>
      <HrButton
        disabled={busy}
        onClick={async () => {
          setBusy(true);
          setError('');
          try {
            const body = JSON.stringify({
              employeeIds: [record.employeeId],
              from: record.values[1],
              to: record.values[1],
              active: status !== 'inactive',
              ...(status === 'inactive'
                ? {}
                : { status: status === 'auto' ? null : status }),
              recordId: record.id,
              version: record.version,
            });
            if (retry.current.body !== body)
              retry.current = { body, key: crypto.randomUUID() };
            await hrRequest('/attendance/activation', {
              method: 'POST',
              headers: {
                'content-type': 'application/json',
                'idempotency-key': retry.current.key,
              },
              body,
            });
            await onSaved();
          } catch (e) {
            setError(e instanceof Error ? e.message : 'ثبت انجام نشد.');
          } finally {
            setBusy(false);
          }
        }}
      >
        ثبت وضعیت
      </HrButton>
      {error && <p role="alert">{error}</p>}
    </div>
  );
}

export function HrAttendanceActivationForm({
  employees,
  onClose,
  onSaved,
}: {
  employees: readonly HrEmployeeDto[];
  onClose: () => void;
  onSaved: () => Promise<void>;
}) {
  const [from, setFrom] = useState(''),
    [to, setTo] = useState(''),
    [active, setActive] = useState(false);
  const [ids, setIds] = useState<string[]>([]),
    [query, setQuery] = useState('');
  const [busy, setBusy] = useState(false),
    [error, setError] = useState('');
  const retry = useRef({ body: '', key: crypto.randomUUID() });
  return (
    <Dialog
      open
      onOpenChange={(open) => {
        if (!open && !busy) onClose();
      }}
    >
      <DialogContent
        dir="rtl"
        aria-describedby={undefined}
        className="max-h-[85dvh] overflow-auto"
      >
        <DialogTitle>غیرفعال‌سازی کارکرد</DialogTitle>
        <form
          className="grid gap-4"
          onSubmit={async (e) => {
            e.preventDefault();
            if (busy) return;
            if (!from || !to || !ids.length) {
              setError('بازه تاریخ و کارکنان را انتخاب کنید.');
              return;
            }
            setBusy(true);
            setError('');
            try {
              const body = JSON.stringify({
                employeeIds: ids,
                from,
                to,
                active,
              });
              if (retry.current.body !== body)
                retry.current = { body, key: crypto.randomUUID() };
              await hrRequest('/attendance/activation', {
                method: 'POST',
                headers: {
                  'content-type': 'application/json',
                  'idempotency-key': retry.current.key,
                },
                body,
              });
              await onSaved();
              onClose();
            } catch (e) {
              setError(e instanceof Error ? e.message : 'ثبت انجام نشد.');
            } finally {
              setBusy(false);
            }
          }}
        >
          <div className="grid gap-4 sm:grid-cols-2">
            <label className={ui.field}>
              از تاریخ
              <DatePicker value={from} onChange={setFrom} />
            </label>
            <label className={ui.field}>
              تا تاریخ
              <DatePicker value={to} onChange={setTo} />
            </label>
          </div>
          <label className={ui.field}>
            وضعیت
            <select
              value={String(active)}
              onChange={(e) => setActive(e.target.value === 'true')}
              disabled={busy}
            >
              <option value="true">فعال</option>
              <option value="false">غیرفعال</option>
            </select>
          </label>
          <fieldset className="grid gap-2">
            <legend>کارکنان</legend>
            <input
              aria-label="جست‌وجوی کارکنان"
              placeholder="نام یا کد پرسنلی"
              value={query}
              onChange={(e) => setQuery(e.target.value)}
            />
            <div className="grid max-h-60 gap-2 overflow-auto rounded-xl border p-3">
              {employees
                .filter((e) => `${e.name} ${e.personnelCode}`.includes(query))
                .map((employee) => (
                  <label
                    key={employee.id}
                    className="flex items-center gap-2 rounded-lg p-2"
                  >
                    <input
                      type="checkbox"
                      disabled={busy}
                      checked={ids.includes(employee.id)}
                      onChange={(event) =>
                        setIds((old) =>
                          event.target.checked
                            ? [...old, employee.id]
                            : old.filter((id) => id !== employee.id),
                        )
                      }
                    />
                    {employee.name} · {employee.personnelCode}
                  </label>
                ))}
            </div>
          </fieldset>
          {error && <p role="alert">{error}</p>}
          <HrButton type="submit" primary disabled={busy}>
            ثبت تغییرات
          </HrButton>
        </form>
      </DialogContent>
    </Dialog>
  );
}
