'use client';
import { useRef, useState } from 'react';
import { AttendanceStatusControl } from './hr-attendance-activation-form';
import type { HrRecordDto } from '@nora/contracts';
import { Dialog, DialogContent, DialogTitle } from '@/components/ui/overlays';
import { TimePicker } from '@/components/ui/time-picker';
import { HrButton } from './hr-controls';
import { hrRequest } from './hr-api';
import { hrDisplayDate } from './hr-dates';
import ui from './hr-unified.module.css';
export function HrAttendanceEditor({
  record,
  onClose,
  onSaved,
}: {
  record: HrRecordDto;
  onClose: () => void;
  onSaved: () => Promise<void>;
}) {
  const clock = (v?: string | null) =>
    v
      ? new Intl.DateTimeFormat('en-GB', {
          timeZone: 'Asia/Tehran',
          hour: '2-digit',
          minute: '2-digit',
          hourCycle: 'h23',
        }).format(new Date(v))
      : '';
  const [arrival, setArrival] = useState(clock(record.data.firstIn)),
    [departure, setDeparture] = useState(clock(record.data.lastOut)),
    [reason, setReason] = useState(''),
    [busy, setBusy] = useState(false),
    [error, setError] = useState('');
  const [deviceError, setDeviceError] = useState(false);
  const retry = useRef({ body: '', key: crypto.randomUUID() });
  return (
    <Dialog
      open
      onOpenChange={(v) => {
        if (!v && !busy) onClose();
      }}
    >
      <DialogContent dir="rtl" aria-describedby={undefined}>
        <DialogTitle>
          ویرایش تردد · {hrDisplayDate(record.values[1] ?? '')}
        </DialogTitle>
        <AttendanceStatusControl
          record={record}
          onSaved={async () => {
            await onSaved();
            onClose();
          }}
        />
        <form
          className="grid gap-4"
          onSubmit={async (e) => {
            e.preventDefault();
            if (busy) return;
            setBusy(true);
            setError('');
            try {
              const body = JSON.stringify({
                version: record.version,
                arrival,
                departure,
                reason,
                deviceError,
              });
              if (retry.current.body !== body)
                retry.current = { body, key: crypto.randomUUID() };
              await hrRequest(`/attendance/${record.id}/manual`, {
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
          <label className={ui.field}>
            ورود
            <TimePicker
              value={arrival}
              onChange={(e) => setArrival(e.target.value)}
            />
          </label>
          <label className={ui.field}>
            خروج
            <TimePicker
              value={departure}
              onChange={(e) => setDeparture(e.target.value)}
            />
          </label>
          <label className={ui.field}>
            دلیل اصلاح
            <textarea
              value={reason}
              onChange={(e) => setReason(e.target.value)}
            />
          </label>
          <label className={ui.field}>
            <span>
              <input
                type="checkbox"
                checked={deviceError}
                onChange={(event) => setDeviceError(event.target.checked)}
              />{' '}
              تأیید خطای دستگاه
            </span>
          </label>
          {error ? <p role="alert">{error}</p> : null}
          <HrButton type="submit" primary disabled={busy}>
            ثبت تغییرات
          </HrButton>
        </form>
      </DialogContent>
    </Dialog>
  );
}
