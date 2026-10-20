'use client';
import { useRef, useState } from 'react';
import { NativeSearchSelect } from '@/components/ui/native-search-select';
import { DatePicker } from '@/components/ui/date-picker';
import { callCenterRequest } from './client';
import type { Operator, RequestCase } from './workflow-client';
export function RequestReferral({
  branch,
  request,
  operators,
  disabled,
  onChanged,
}: {
  branch: string;
  request: RequestCase;
  operators: Operator[];
  disabled: boolean;
  onChanged: () => void;
}) {
  const [owner, setOwner] = useState(''),
    [destination, setDestination] = useState('SUPPORT'),
    [due, setDue] = useState(''),
    [busy, setBusy] = useState(false),
    [error, setError] = useState(''),
    [message, setMessage] = useState('');
  const retry = useRef<{ body: string; id: string } | null>(null);
  async function save() {
    if (busy || !due || !owner) return;
    const body = JSON.stringify({
      ownerId: owner,
      destination,
      dueAt: new Date(due + '+03:30').toISOString(),
      expectedVersion: request.version,
    });
    if (retry.current?.body !== body)
      retry.current = { body, id: crypto.randomUUID() };
    setBusy(true);
    setError('');
    try {
      await callCenterRequest(`/requests/${request.id}/referrals`, branch, {
        method: 'POST',
        body: JSON.stringify({
          ...JSON.parse(body),
          commandId: retry.current.id,
        }),
      });
      setMessage('ارجاع ثبت شد؛ پرونده فروش یا تعهد مالی ایجاد نشد.');
      onChanged();
    } catch (e) {
      setError(e instanceof Error ? e.message : 'ارجاع انجام نشد.');
    } finally {
      setBusy(false);
    }
  }
  return (
    <details>
      <summary>ارجاع برای بررسی فروش یا پشتیبانی</summary>
      <p>
        گیرنده باید مجوز کال سنتر و ماژول مقصد داشته باشد. ارجاع با مرجع همین
        درخواست ثبت می‌شود.
      </p>
      <NativeSearchSelect
        aria-label="مقصد ارجاع"
        value={destination}
        onChange={(e) => setDestination(e.target.value)}
      >
        <option value="SUPPORT">پشتیبانی</option>
        <option value="SALES">فروش</option>
      </NativeSearchSelect>
      <NativeSearchSelect
        aria-label="گیرنده ارجاع"
        value={owner}
        onChange={(e) => setOwner(e.target.value)}
      >
        <option value="">گیرنده را انتخاب کنید</option>
        {operators.map((o) => (
          <option key={o.id} value={o.id}>
            {o.displayName}
          </option>
        ))}
      </NativeSearchSelect>
      <label>
        موعد ارجاع به وقت تهران
        <DatePicker
          aria-label="موعد ارجاع به وقت تهران"
          includeTime
          withinDialog
          required
          value={due}
          onChange={setDue}
        />
      </label>
      <button
        disabled={
          disabled || busy || !owner || !due || request.status === 'CLOSED'
        }
        onClick={() => void save()}
      >
        ثبت ارجاع
      </button>
      {error && <p role="alert">{error}</p>}
      <p role="status">{message}</p>
    </details>
  );
}
