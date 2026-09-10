'use client';
import { useState } from 'react';
import type { TravelDeliveryAuthorizationV1 } from '@rubi/contracts';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/form-controls';
import {
  Dialog,
  DialogContent,
  DialogTitle,
  DialogDescription,
} from '@/components/ui/overlays';
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
  const [selected, setSelected] = useState<Row | null>(null);
  const [decisionError, setDecisionError] = useState('');
  const [notice, setNotice] = useState('');
  const [loaded, setLoaded] = useState(false);
  async function load() {
    setBusy(true);
    setError('');
    try {
      const response = await travelRequest<{ data: Row[] }>(
        `reservations/requests/delivery-queue?contractNumber=${encodeURIComponent(search)}`,
      );
      setRows(response.data);
      setLoaded(true);
    } catch (e) {
      setRows([]);
      setError(e instanceof Error ? e.message : 'دریافت نشد');
    } finally {
      setBusy(false);
    }
  }
  async function update(row: Row) {
    if (busy) return;
    if (!reason.trim()) {
      setDecisionError('دلیل تأیید یا لغو تحویل مدارک را وارد کنید.');
      return;
    }
    setBusy(true);
    setDecisionError('');
    setNotice('');
    try {
      const { data } = await travelRequest<{
        data: TravelDeliveryAuthorizationV1;
      }>(`reservations/requests/${row.id}/delivery`, {
        expectedVersion: row.delivery.version,
        approved: !row.delivery.approved,
        reason: reason.trim(),
      });
      setRows((list) =>
        list.map((item) =>
          item.id === row.id ? { ...item, delivery: data } : item,
        ),
      );
      setSelected(null);
      setReason('');
      setNotice(
        `${row.contractNumber} · ${data.approved ? 'تحویل مدارک به فروش تأیید شد.' : 'مجوز تحویل مدارک لغو شد.'}`,
      );
    } catch (e) {
      setDecisionError(e instanceof Error ? e.message : 'ثبت نشد');
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
      {notice && <p role="status">{notice}</p>}
      {loaded && !busy && !error && rows.length === 0 && (
        <p>قراردادی با این شماره پیدا نشد.</p>
      )}
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
            disabled={busy}
            onClick={() => {
              setSelected(row);
              setReason('');
              setDecisionError('');
            }}
          >
            {row.delivery.approved
              ? 'لغو مجوز تحویل مدارک'
              : 'تأیید تحویل مدارک'}
          </Button>
        </div>
      ))}
      <Dialog
        open={selected !== null}
        onOpenChange={(open) => {
          if (!open && !busy) setSelected(null);
        }}
      >
        <DialogContent dir="rtl">
          <DialogTitle>
            {selected?.delivery.approved
              ? 'لغو مجوز تحویل مدارک'
              : 'تأیید تحویل مدارک'}
          </DialogTitle>
          <DialogDescription>
            قرارداد <b dir="ltr">{selected?.contractNumber}</b> ·{' '}
            {selected?.delivery.approved
              ? 'دسترسی بعدی فروش به مدارک این قرارداد بسته می‌شود.'
              : 'فروش پس از تأیید شما به مدارک مسافر این قرارداد دسترسی خواهد داشت.'}
          </DialogDescription>
          <form
            className="mt-4 grid gap-4"
            onSubmit={(event) => {
              event.preventDefault();
              if (selected) void update(selected);
            }}
          >
            <label className="grid gap-2">
              <span>دلیل تصمیم مالی (الزامی)</span>
              <Input
                value={reason}
                maxLength={500}
                required
                disabled={busy}
                placeholder="دلیل تأیید یا لغو تحویل مدارک را بنویسید"
                onChange={(event) => setReason(event.target.value)}
              />
            </label>
            {decisionError && (
              <p role="alert" className="text-destructive">
                {decisionError}
              </p>
            )}
            <div className="flex flex-wrap gap-2">
              <Button type="submit" disabled={busy}>
                {busy
                  ? 'در حال ثبت…'
                  : selected?.delivery.approved
                    ? 'ثبت لغو مجوز'
                    : 'ثبت تأیید تحویل مدارک'}
              </Button>
              <Button
                type="button"
                variant="outline"
                disabled={busy}
                onClick={() => setSelected(null)}
              >
                انصراف
              </Button>
            </div>
          </form>
        </DialogContent>
      </Dialog>
    </section>
  );
}
