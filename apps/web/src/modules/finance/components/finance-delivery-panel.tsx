'use client';
import { useEffect, useState } from 'react';
import type {
  ReservationServicePurchaseV1,
  SupplierPurchaseGateV1,
  TravelDeliveryAuthorizationV1,
} from '@rubi/contracts';
import { Button } from '@/components/ui/button';
import {
  Input,
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/form-controls';
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogTitle,
} from '@/components/ui/overlays';
import { formatSalesMoney } from '@/components/ui/money-input';
import { masterDataApi } from '@/modules/master-data/api/client';
import { travelRequest } from '@/modules/reservations/components/travel-workflow-form';

type Row = {
  id: string;
  contractNumber: string;
  delivery: TravelDeliveryAuthorizationV1;
  supplierPurchases: SupplierPurchaseGateV1;
};
type Bank = { id: string; name: string };

export function FinanceDeliveryPanel() {
  const [rows, setRows] = useState<Row[]>([]);
  const [banks, setBanks] = useState<Bank[]>([]);
  const [search, setSearch] = useState('');
  const [reason, setReason] = useState('');
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState('');
  const [selected, setSelected] = useState<Row | null>(null);
  const [payment, setPayment] = useState<{
    row: Row;
    purchase: ReservationServicePurchaseV1;
  } | null>(null);
  const [decisionError, setDecisionError] = useState('');
  const [notice, setNotice] = useState('');
  const [loaded, setLoaded] = useState(false);
  const [bankId, setBankId] = useState('');
  const [transferAt, setTransferAt] = useState('');
  const [reference, setReference] = useState('');

  useEffect(() => {
    let live = true;
    void masterDataApi
      .list('banks', {
        search: '',
        status: 'active',
        sortBy: 'name',
        sortDirection: 'asc',
        page: 1,
        pageSize: 100,
      })
      .then((response) => {
        if (live)
          setBanks(
            response.data.map((record) => ({ id: record.id, name: record.name })),
          );
      })
      .catch(() => {
        if (live) setError('فهرست بانک‌ها دریافت نشد.');
      });
    return () => {
      live = false;
    };
  }, []);
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
  async function savePayment() {
    if (!payment || busy) return;
    if (!bankId || !transferAt || !reference.trim() || !reason.trim()) {
      setDecisionError(
        'بانک، تاریخ انتقال، شماره پیگیری و توضیح پرداخت الزامی است.',
      );
      return;
    }
    setBusy(true);
    setDecisionError('');
    try {
      await travelRequest(
        `reservations/requests/${payment.row.id}/service-purchases/${payment.purchase.id}/payment`,
        {
          expectedVersion: payment.purchase.finance.version,
          status: 'PAID',
          bankId,
          transferAt: new Date(transferAt).toISOString(),
          paymentReference: reference.trim(),
          reason: reason.trim(),
        },
      );
      setNotice(
        `${payment.row.contractNumber} · پرداخت ${payment.purchase.serviceTitle} ثبت شد.`,
      );
      setPayment(null);
      setReason('');
      setBankId('');
      setTransferAt('');
      setReference('');
      await load();
    } catch (e) {
      setDecisionError(e instanceof Error ? e.message : 'پرداخت ثبت نشد.');
    } finally {
      setBusy(false);
    }
  }
  async function updateDelivery(row: Row) {
    if (busy) return;
    if (!reason.trim()) {
      setDecisionError('دلیل تأیید یا لغو تحویل مدارک را وارد کنید.');
      return;
    }
    setBusy(true);
    setDecisionError('');
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
      <h2 className="text-lg font-bold">
        پرداخت کارگزاران و تحویل مدارک به فروش
      </h2>
      <p>
        مالی ابتدا خرید هر خدمت را پرداخت می‌کند؛ پس از پرداخت همه خدمات، تأیید
        تحویل مدارک برای فروش باز می‌شود.
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
        <article
          key={row.id}
          className="grid gap-3 border-b border-border py-4"
        >
          <div className="flex flex-wrap items-center justify-between gap-3">
            <strong dir="ltr">{row.contractNumber}</strong>
            <span>
              {row.delivery.approved
                ? 'تحویل مدارک تأیید شده'
                : row.supplierPurchases.complete
                  ? 'آماده تأیید تحویل مدارک'
                  : 'تحویل مدارک تا تسویه خریدها بسته'}
            </span>
          </div>
          <div className="grid gap-2 md:grid-cols-2">
            {row.supplierPurchases.purchases.map((purchase) => (
              <div
                key={purchase.id}
                className="flex flex-wrap items-center justify-between gap-2 rounded-lg border p-3 text-sm"
              >
                <span>
                  <b>{purchase.serviceTitle}</b> · {purchase.supplierName}
                  <br />
                  {formatSalesMoney(purchase.amount)} {purchase.currencyCode} ·{' '}
                  {purchase.finance.status === 'PAID'
                    ? 'پرداخت‌شده'
                    : purchase.finance.status === 'REJECTED'
                      ? 'برگشت‌خورده'
                      : 'در انتظار پرداخت'}
                </span>
                {purchase.finance.status !== 'PAID' && (
                  <Button
                    size="sm"
                    onClick={() => {
                      setPayment({ row, purchase });
                      setReason('');
                      setDecisionError('');
                    }}
                  >
                    ثبت پرداخت کارگزار
                  </Button>
                )}
              </div>
            ))}
          </div>
          {!!row.supplierPurchases.missingServiceTitles.length && (
            <p className="text-sm text-destructive">
              خرید ثبت‌نشده:{' '}
              {row.supplierPurchases.missingServiceTitles.join('، ')}
            </p>
          )}
          {!!row.supplierPurchases.unpaidServiceTitles.length && (
            <p className="text-sm text-amber-700 dark:text-amber-300">
              پرداخت‌نشده:{' '}
              {row.supplierPurchases.unpaidServiceTitles.join('، ')}
            </p>
          )}
          <Button
            className="justify-self-end"
            disabled={
              busy ||
              (!row.delivery.approved && !row.supplierPurchases.complete)
            }
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
        </article>
      ))}

      <Dialog
        open={payment !== null}
        onOpenChange={(open) => {
          if (!open && !busy) setPayment(null);
        }}
      >
        <DialogContent dir="rtl">
          <DialogTitle>ثبت پرداخت کارگزار</DialogTitle>
          <DialogDescription>
            {payment?.purchase.serviceTitle} · {payment?.purchase.supplierName}{' '}
            · {payment && formatSalesMoney(payment.purchase.amount)}{' '}
            {payment?.purchase.currencyCode}
          </DialogDescription>
          <form
            className="mt-4 grid gap-3"
            onSubmit={(event) => {
              event.preventDefault();
              void savePayment();
            }}
          >
            <label className="grid gap-2">
              <span>بانک پرداخت‌کننده</span>
              <Select value={bankId} onValueChange={setBankId}>
                <SelectTrigger>
                  <SelectValue placeholder="انتخاب بانک" />
                </SelectTrigger>
                <SelectContent>
                  {banks.map((bank) => (
                    <SelectItem key={bank.id} value={bank.id}>
                      {bank.name}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </label>
            <label className="grid gap-2">
              <span>تاریخ و ساعت انتقال</span>
              <Input
                type="datetime-local"
                value={transferAt}
                onChange={(e) => setTransferAt(e.target.value)}
              />
            </label>
            <label className="grid gap-2">
              <span>شماره پیگیری</span>
              <Input
                dir="ltr"
                value={reference}
                maxLength={160}
                onChange={(e) => setReference(e.target.value)}
              />
            </label>
            <label className="grid gap-2">
              <span>توضیح پرداخت</span>
              <Input
                value={reason}
                maxLength={500}
                onChange={(e) => setReason(e.target.value)}
              />
            </label>
            {decisionError && (
              <p role="alert" className="text-destructive">
                {decisionError}
              </p>
            )}
            <div className="flex gap-2">
              <Button type="submit" disabled={busy}>
                {busy ? 'در حال ثبت…' : 'ثبت پرداخت'}
              </Button>
              <Button
                type="button"
                variant="outline"
                disabled={busy}
                onClick={() => setPayment(null)}
              >
                انصراف
              </Button>
            </div>
          </form>
        </DialogContent>
      </Dialog>

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
            قرارداد <b dir="ltr">{selected?.contractNumber}</b>
          </DialogDescription>
          <form
            className="mt-4 grid gap-4"
            onSubmit={(event) => {
              event.preventDefault();
              if (selected) void updateDelivery(selected);
            }}
          >
            <label className="grid gap-2">
              <span>دلیل تصمیم مالی (الزامی)</span>
              <Input
                value={reason}
                maxLength={500}
                required
                disabled={busy}
                onChange={(event) => setReason(event.target.value)}
              />
            </label>
            {decisionError && (
              <p role="alert" className="text-destructive">
                {decisionError}
              </p>
            )}
            <div className="flex gap-2">
              <Button type="submit" disabled={busy}>
                ثبت تصمیم
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
