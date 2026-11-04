'use client';
import { useRef, useState } from 'react';
import {
  HR_WEEKDAYS,
  hrShiftWeekdays,
  type HrRecordDto,
} from '@nora/contracts';
import {
  Dialog,
  DialogContent,
  DialogTitle,
  DialogDescription,
} from '@/components/ui/overlays';
import { DatePicker } from '@/components/ui/date-picker';
import { TimePicker } from '@/components/ui/time-picker';
import { NativeSearchSelect } from '@/components/ui/native-search-select';
import { HrButton } from './hr-controls';
import { hrRequest } from './hr-api';
import { persianDateToIso } from './hr-dates';
import type { HrFormTarget } from './hr-record-form';
import type { HrStore } from './hr-store';
import ui from './hr-unified.module.css';

export function WeeklyShiftForm({
  target,
  store,
  onClose,
  onSaved,
}: {
  target: HrFormTarget;
  store: HrStore;
  onClose: () => void;
  onSaved: (record: HrRecordDto) => void;
}) {
  const record = target.record;
  const [branchId, setBranchId] = useState(
    record?.branchId ??
      store.data!.employees.find((e) => e.id === target.employeeId)?.branchId ??
      store.data!.branches[0]?.id ??
      '',
  );
  const [title, setTitle] = useState(record?.values[0] ?? '');
  const [weekdays, setWeekdays] = useState(() =>
    hrShiftWeekdays(record?.values[9] ?? 'شنبه'),
  );
  const [start, setStart] = useState(record?.values[1] ?? '');
  const [end, setEnd] = useState(record?.values[2] ?? '');
  const [from, setFrom] = useState(record?.values[7] ?? '');
  const [to, setTo] = useState(record?.values[8] ?? '');
  const [employeeIds, setEmployeeIds] = useState<string[]>(
    record?.employeeId
      ? [record.employeeId]
      : target.employeeId
        ? [target.employeeId]
        : [],
  );
  const [search, setSearch] = useState('');
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState('');
  const retry = useRef({ body: '', key: '' });
  const employees = store.data!.employees.filter(
    (e) =>
      e.branchId === branchId &&
      (e.status === 'فعال' || e.id === record?.employeeId),
  );
  return (
    <Dialog
      open
      onOpenChange={(open) => {
        if (!open && !busy) onClose();
      }}
    >
      <DialogContent dir="rtl" className={ui.detail}>
        <DialogTitle>{record ? 'ویرایش شیفت' : 'ثبت شیفت'}</DialogTitle>
        <DialogDescription>
          {record ? record.values[6] : 'برنامه هفتگی کارکنان'}
        </DialogDescription>
        <form
          className={ui.spaced}
          onSubmit={async (e) => {
            e.preventDefault();
            if (busy) return;
            setBusy(true);
            setError('');
            try {
              if (!employeeIds.length)
                throw new Error('حداقل یک کارمند انتخاب کنید.');
              if (!weekdays.length)
                throw new Error('حداقل یک روز هفته انتخاب کنید.');
              const weekday = [HR_WEEKDAYS[6], ...HR_WEEKDAYS.slice(0, 6)]
                .filter((day) => weekdays.includes(day))
                .join('، ');
              const input = {
                branchId,
                title,
                weekday,
                start,
                end,
                from: persianDateToIso(from),
                to: persianDateToIso(to),
                employeeIds,
              };
              if (record) {
                const values = [...record.values];
                values[0] = title;
                values[1] = start;
                values[2] = end;
                values[7] = input.from;
                values[8] = input.to;
                values[9] = weekday;
                onSaved(await store.update(record, { values }));
              } else {
                const body = JSON.stringify(input);
                if (retry.current.body !== body)
                  retry.current = { body, key: crypto.randomUUID() };
                const records = await hrRequest<HrRecordDto[]>(
                  '/shifts/weekly',
                  {
                    method: 'POST',
                    headers: {
                      'content-type': 'application/json',
                      'Idempotency-Key': retry.current.key,
                    },
                    body,
                  },
                );
                store.remember(records);
                await store.mutated();
                onSaved(records[0]!);
              }
              onClose();
            } catch (cause) {
              setError(
                cause instanceof Error ? cause.message : 'ثبت انجام نشد.',
              );
            } finally {
              setBusy(false);
            }
          }}
        >
          <fieldset disabled={busy} className={ui.spaced}>
            <label className={ui.field}>
              شعبه
              <NativeSearchSelect
                value={branchId}
                disabled={Boolean(record)}
                onChange={(e) => {
                  setBranchId(e.target.value);
                  setEmployeeIds([]);
                }}
              >
                {store.data!.branches.map((b) => (
                  <option key={b.id} value={b.id}>
                    {b.name}
                  </option>
                ))}
              </NativeSearchSelect>
            </label>
            <label className={ui.field}>
              عنوان شیفت
              <input
                required
                maxLength={160}
                value={title}
                onChange={(e) => setTitle(e.target.value)}
              />
            </label>
            <fieldset className="min-w-0 space-y-2">
              <legend>روزهای هفته</legend>
              <div className="grid grid-cols-2 gap-2 sm:grid-cols-4">
                {[HR_WEEKDAYS[6], ...HR_WEEKDAYS.slice(0, 6)].map((day) => (
                  <label
                    key={day}
                    className="flex min-h-11 cursor-pointer items-center gap-2 rounded-lg border border-slate-200 px-3 py-2"
                  >
                    <input
                      type="checkbox"
                      checked={weekdays.includes(day)}
                      onChange={(e) =>
                        setWeekdays((days) =>
                          e.target.checked
                            ? [...days, day]
                            : days.filter((d) => d !== day),
                        )
                      }
                    />
                    {day}
                  </label>
                ))}
              </div>
            </fieldset>
            <div className="grid gap-4 sm:grid-cols-2">
              <label className={ui.field}>
                ساعت شروع
                <TimePicker
                  required
                  value={start}
                  onChange={(e) => setStart(e.target.value)}
                />
              </label>
              <label className={ui.field}>
                ساعت پایان
                <TimePicker
                  required
                  value={end}
                  onChange={(e) => setEnd(e.target.value)}
                />
              </label>
              <label className={ui.field}>
                از تاریخ
                <DatePicker required value={from} onChange={setFrom} />
              </label>
              <label className={ui.field}>
                تا تاریخ
                <DatePicker required value={to} onChange={setTo} />
              </label>
            </div>
            <fieldset className={ui.spaced}>
              <legend>کارکنان</legend>
              {!record && (
                <input
                  aria-label="جستجوی کارکنان"
                  placeholder="جستجوی کارکنان"
                  value={search}
                  onChange={(e) => setSearch(e.target.value)}
                />
              )}
              <div className="max-h-52 overflow-y-auto space-y-2">
                {employees
                  .filter((e) =>
                    record
                      ? employeeIds.includes(e.id)
                      : `${e.name} ${e.personnelCode}`.includes(search),
                  )
                  .map((e) => (
                    <label key={e.id} className="flex items-center gap-2">
                      <input
                        type="checkbox"
                        disabled={Boolean(record)}
                        checked={employeeIds.includes(e.id)}
                        onChange={(event) =>
                          setEmployeeIds((ids) =>
                            event.target.checked
                              ? [...ids, e.id]
                              : ids.filter((id) => id !== e.id),
                          )
                        }
                      />
                      {e.name} · {e.personnelCode}
                    </label>
                  ))}
              </div>
            </fieldset>
            {error && <p role="alert">{error}</p>}
            <HrButton primary type="submit" disabled={busy}>
              {busy ? 'در حال ثبت…' : 'ذخیره'}
            </HrButton>
          </fieldset>
        </form>
      </DialogContent>
    </Dialog>
  );
}
