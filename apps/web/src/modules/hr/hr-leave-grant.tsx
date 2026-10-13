'use client';
import { useRef, useState } from 'react';
import type { HrStore } from './hr-store';
import { hrRequest } from './hr-api';
import { HrButton } from './hr-controls';
import { RequiredFieldLabel } from './required-field-label';
import ui from './hr-unified.module.css';

export function HrLeaveGrant({
  employeeId,
  store,
}: {
  employeeId: string;
  store: HrStore;
}) {
  const [type, setType] = useState('استحقاقی');
  const [days, setDays] = useState('');
  const [year, setYear] = useState(String(new Date().getUTCFullYear()));
  const [reason, setReason] = useState('');
  const [error, setError] = useState('');
  const [notice, setNotice] = useState('');
  const [busy, setBusy] = useState(false);
  const key = useRef(crypto.randomUUID());
  if (!store.data!.capabilities.write || !store.data!.capabilities.approve)
    return null;
  return (
    <details>
      <summary className={ui.detailsSummary}>تخصیص سهمیه مرخصی</summary>
      <form
        className={ui.filters}
        onSubmit={async (event) => {
          event.preventDefault();
          setBusy(true);
          setError('');
          setNotice('');
          try {
            await hrRequest('/leave/grants', {
              method: 'POST',
              headers: {
                'content-type': 'application/json',
                'Idempotency-Key': key.current,
              },
              body: JSON.stringify({
                employeeId,
                type,
                days,
                year: Number(year),
                reason,
              }),
            });
            await store.mutated();
            setNotice('سهمیه به مانده مرخصی اضافه شد.');
            setDays('');
            setReason('');
            key.current = crypto.randomUUID();
          } catch (e) {
            setError(e instanceof Error ? e.message : 'سهمیه ثبت نشد.');
          } finally {
            setBusy(false);
          }
        }}
      >
        <label>
          <RequiredFieldLabel required>نوع مرخصی</RequiredFieldLabel>
          <input
            required
            value={type}
            onChange={(event) => setType(event.target.value)}
          />
        </label>
        <label>
          <RequiredFieldLabel required>
            سهمیه افزوده‌شده (روز)
          </RequiredFieldLabel>
          <input
            required
            type="number"
            min="0.01"
            max="999"
            step="0.01"
            value={days}
            onChange={(event) => setDays(event.target.value)}
          />
        </label>
        <label>
          <RequiredFieldLabel required>سال سهمیه (میلادی)</RequiredFieldLabel>
          <input
            required
            type="number"
            min="2000"
            max="2200"
            value={year}
            onChange={(event) => setYear(event.target.value)}
          />
        </label>
        <label>
          <RequiredFieldLabel required>دلیل تخصیص</RequiredFieldLabel>
          <input
            required
            value={reason}
            onChange={(event) => setReason(event.target.value)}
          />
        </label>
        <HrButton type="submit" disabled={busy} primary>
          ثبت سهمیه
        </HrButton>
        {error ? <p role="alert">{error}</p> : null}
        {notice ? <p role="status">{notice}</p> : null}
      </form>
    </details>
  );
}
