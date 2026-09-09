'use client';
import { useState } from 'react';
import type { TravelDeliveryAuthorizationV1 } from '@rubi/contracts';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/form-controls';
import { travelRequest } from '@/modules/reservations/components/travel-workflow-form';
type Row = {
  id: string;
  contractNumber: string;
  delivery: TravelDeliveryAuthorizationV1;
};
export function FinanceDeliveryPanel() {
  const [rows, setRows] = useState<Row[]>([]);
  const [search, setSearch] = useState('');
  const [reason, setReason] = useState('');
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState('');
  async function load() {
    setBusy(true);
    setError('');
    try {
      const response = await travelRequest<{ data: Row[] }>(
        `reservations/requests/delivery-queue?contractNumber=${encodeURIComponent(search)}`,
      );
      setRows(response.data);
    } catch (e) {
      setRows([]);
      setError(e instanceof Error ? e.message : 'دریافت نشد');
    } finally {
      setBusy(false);
    }
  }
  async function update(row: Row) {
    setBusy(true);
    setError('');
    try {
      const { data } = await travelRequest<{
        data: TravelDeliveryAuthorizationV1;
      }>(`reservations/requests/${row.id}/delivery`, {
        expectedVersion: row.delivery.version,
        approved: !row.delivery.approved,
        reason,
      });
      setRows((list) =>
        list.map((item) =>
          item.id === row.id ? { ...item, delivery: data } : item,
        ),
      );
    } catch (e) {
      setError(e instanceof Error ? e.message : 'ثبت نشد');
    } finally {
      setBusy(false);
    }
  }
  return (
    <section className="grid gap-3 rounded-xl border border-border bg-surface p-5">
      <h2 className="text-lg font-bold">تحویل مدارک به فروش</h2>
      <p>
        این تأیید دسترسی فروش به مدارک مسافر را باز می‌کند. لغو آن دسترسی بعدی
        را می‌بندد.
      </p>
      <div className="flex gap-2">
        <Input
          aria-label="شماره قرارداد"
          placeholder="شماره قرارداد"
          value={search}
          onChange={(e) => setSearch(e.target.value)}
        />
        <Button disabled={busy} onClick={() => void load()}>
          دریافت قراردادها
        </Button>
      </div>
      <Input
        aria-label="دلیل تصمیم مالی"
        placeholder="دلیل تأیید یا لغو تحویل مدارک"
        value={reason}
        maxLength={500}
        onChange={(e) => setReason(e.target.value)}
      />
      {error && (
        <p role="alert" className="text-destructive">
          {error}
        </p>
      )}
      {rows.map((row) => (
        <div
          key={row.id}
          className="flex flex-wrap items-center justify-between gap-3 border-b border-border py-3"
        >
          <span>
            {row.contractNumber} ·{' '}
            {row.delivery.approved
              ? 'تحویل مدارک تأیید شده'
              : 'دسترسی فروش بسته'}
          </span>
          <Button
            disabled={busy || !reason.trim()}
            onClick={() => void update(row)}
          >
            {row.delivery.approved
              ? 'لغو مجوز تحویل مدارک'
              : 'تأیید تحویل مدارک'}
          </Button>
        </div>
      ))}
    </section>
  );
}
