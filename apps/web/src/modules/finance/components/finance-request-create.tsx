'use client';
import { useEffect, useRef, useState } from 'react';
import { useAccessPermissions } from '@/modules/iam/access-context';
import { Input, Textarea } from '@/components/ui/form-controls';
import { MoneyInput } from '@/components/ui/money-input';
import { DatePicker } from '@/components/ui/date-picker';
import { Button } from '@/components/ui/button';
import { apiRequest, FinanceInboxApiError } from '../api/finance-inbox-api';

export function FinanceRequestCreate({ onCreated }: { onCreated: () => void }) {
  const permissions = useAccessPermissions();
  const [open, setOpen] = useState(false);
  const [branches, setBranches] = useState<{ id: string; name: string }[]>([]);
  const [branchId, setBranchId] = useState('');
  const [kind, setKind] = useState('COMMISSION');
  const [title, setTitle] = useState('');
  const [party, setParty] = useState('');
  const [description, setDescription] = useState('');
  const [reference, setReference] = useState('');
  const [amount, setAmount] = useState('');
  const [currencyCode, setCurrencyCode] = useState('IRR');
  const [dueAt, setDueAt] = useState('');
  const [refundReceiptId, setRefundReceiptId] = useState('');
  const [documentId, setDocumentId] = useState('');
  const [busy, setBusy] = useState(false);
  const [uncertain, setUncertain] = useState(false);
  const [message, setMessage] = useState('');
  const lock = useRef(false);
  const attempt = useRef<string | null>(null);
  useEffect(() => {
    if (!open) return;
    let active = true;
    void apiRequest<{ id: string; name: string }[]>(
      '/finance/followup/branches',
    )
      .then((value) => {
        if (active) setBranches(value);
      })
      .catch((error) => {
        if (active)
          setMessage(
            error instanceof Error
              ? error.message
              : 'دریافت شعبه‌ها ناموفق بود.',
          );
      });
    return () => {
      active = false;
    };
  }, [open]);
  async function submit() {
    if (lock.current) return;
    const payload =
      attempt.current ??
      JSON.stringify({
        operationId: crypto.randomUUID(),
        branchId,
        kind,
        title,
        party,
        description,
        reference,
        amount,
        currencyCode,
        dueAt,
        ...(kind === 'REFUND' ? { refundReceiptId } : {}),
        ...(documentId ? { documentId } : {}),
      });
    attempt.current = payload;
    lock.current = true;
    setBusy(true);
    setUncertain(true);
    setMessage('');
    try {
      const result = await apiRequest<{ requestId: string }>(
        '/finance/requests',
        { method: 'POST', body: payload },
      );
      attempt.current = null;
      setUncertain(false);
      setMessage(`درخواست ${result.requestId} ثبت شد.`);
      setAmount('');
      setTitle('');
      onCreated();
    } catch (error) {
      if (
        error instanceof FinanceInboxApiError &&
        [400, 403].includes(error.status)
      ) {
        attempt.current = null;
        setUncertain(false);
      }
      setMessage(
        error instanceof Error
          ? error.message
          : 'ثبت انجام نشد؛ همان درخواست را دوباره ارسال کنید.',
      );
    } finally {
      lock.current = false;
      setBusy(false);
    }
  }
  if (!permissions?.includes('finance.request.manage')) return null;
  const disabled = busy || uncertain;
  return (
    <section className="rounded-xl border p-3" aria-label="درخواست مستقیم مالی">
      <Button variant="outline" onClick={() => setOpen((value) => !value)}>
        ثبت درخواست مالی جدید
      </Button>
      {open ? (
        <div className="mt-3 space-y-3">
          <p>
            درخواست حقوق از جدول منابع انسانی ارسال می‌شود. این فرم محاسبه
            کمیسیون، سند حسابداری یا تأیید وصول چک نیست؛ فقط درخواست پرداخت و
            سوابق رسیدگی را ثبت می‌کند.
          </p>
          <div className="grid gap-3 md:grid-cols-2">
            <label>
              نوع درخواست
              <select
                value={kind}
                className="block w-full rounded border p-2"
                disabled={disabled}
                onChange={(event) => setKind(event.target.value)}
              >
                <option value="COMMISSION">کمیسیون</option>
                <option value="REFUND">استرداد</option>
                <option value="CHECK">پرداخت چک</option>
                <option value="ADJUSTMENT">پرداخت اصلاح مالی</option>
              </select>
            </label>
            <label>
              شعبه
              <select
                value={branchId}
                className="block w-full rounded border p-2"
                disabled={disabled}
                onChange={(event) => setBranchId(event.target.value)}
              >
                <option value="">انتخاب شعبه</option>
                {branches.map((branch) => (
                  <option key={branch.id} value={branch.id}>
                    {branch.name}
                  </option>
                ))}
              </select>
            </label>
            <label>
              عنوان
              <Input
                value={title}
                disabled={disabled}
                maxLength={200}
                onChange={(event) => setTitle(event.target.value)}
              />
            </label>
            <label>
              ذی‌نفع
              <Input
                value={party}
                disabled={disabled}
                maxLength={200}
                onChange={(event) => setParty(event.target.value)}
              />
            </label>
            <label>
              قرارداد / فاکتور / چک مرجع
              <Input
                value={reference}
                disabled={disabled}
                maxLength={160}
                onChange={(event) => setReference(event.target.value)}
              />
            </label>
            <label>
              مبلغ
              <MoneyInput
                value={amount}
                disabled={disabled}
                onValueChange={setAmount}
              />
            </label>
            <label>
              ارز
              <Input
                value={currencyCode}
                disabled={disabled}
                maxLength={3}
                onChange={(event) =>
                  setCurrencyCode(event.target.value.toUpperCase())
                }
                dir="ltr"
              />
            </label>
            <label>
              سررسید
              <DatePicker
                value={dueAt}
                disabled={disabled}
                onChange={setDueAt}
              />
            </label>
            {kind === 'REFUND' ? (
              <label>
                شناسه دریافت تأییدشده مبنا
                <Input
                  value={refundReceiptId}
                  disabled={disabled}
                  onChange={(event) => setRefundReceiptId(event.target.value)}
                  dir="ltr"
                />
              </label>
            ) : null}
            <label>
              شناسه سند پیوست (اختیاری، از بایگانی مجاز)
              <Input
                value={documentId}
                disabled={disabled}
                onChange={(event) => setDocumentId(event.target.value)}
                dir="ltr"
              />
            </label>
          </div>
          <label>
            توضیحات
            <Textarea
              value={description}
              disabled={disabled}
              maxLength={2000}
              onChange={(event) => setDescription(event.target.value)}
            />
          </label>
          <Button
            disabled={
              busy ||
              !branchId ||
              !title.trim() ||
              !party.trim() ||
              !reference.trim() ||
              !amount ||
              !dueAt ||
              !description.trim() ||
              (kind === 'REFUND' && !refundReceiptId)
            }
            onClick={() => void submit()}
          >
            {busy
              ? 'در حال ثبت…'
              : uncertain
                ? 'تکرار امن همان درخواست'
                : 'ثبت و ارسال درخواست'}
          </Button>
        </div>
      ) : null}
      {message ? <p role="status">{message}</p> : null}
    </section>
  );
}
