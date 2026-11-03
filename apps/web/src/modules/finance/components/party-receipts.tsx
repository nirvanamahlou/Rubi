'use client';
import { useRef, useState } from 'react';
import { useQuery, useQueryClient } from '@tanstack/react-query';
import {
  planPartyReceipt,
  type FinanceContractPartyV1,
  type FinancePartyBalanceV1,
  type FinancePartyReceiptCommandV1,
  type FinancePartyReceiptResultV1,
} from '@nora/contracts';
import { useAccessPermissions } from '@/modules/iam/access-context';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/form-controls';
import { MoneyInput, formatSalesMoney } from '@/components/ui/money-input';
import {
  apiRequest,
  financeInboxApi,
  FinanceInboxApiError,
} from '../api/finance-inbox-api';
import { receiptAccountLabel } from '../model/receipt-account';

export function PartyReceipts({ onChanged }: { onChanged: () => void }) {
  const permissions = useAccessPermissions();
  const [open, setOpen] = useState(false),
    [text, setText] = useState(''),
    [search, setSearch] = useState('');
  const [locked, setLocked] = useState(false);
  const [party, setParty] = useState<FinanceContractPartyV1 | null>(null);
  const parties = useQuery({
    queryKey: ['finance', 'contract-parties', search],
    enabled:
      !!permissions?.includes('finance.read') && open && search.length >= 2,
    queryFn: async () =>
      (
        await apiRequest<{ data: FinanceContractPartyV1[] }>(
          `/finance/party-receipts/parties?${new URLSearchParams({ search })}`,
        )
      ).data,
  });
  const branches = useQuery({
    queryKey: ['finance', 'party-receipt-branches'],
    enabled: !!permissions?.includes('finance.read') && open,
    queryFn: () =>
      apiRequest<{ id: string; name: string }[]>('/finance/followup/branches'),
  });
  if (!permissions?.includes('finance.read')) return null;
  return (
    <section
      className="mb-4 rounded-xl border p-4"
      aria-label="حساب و دریافت طرف قرارداد"
    >
      <Button
        variant="outline"
        disabled={locked}
        onClick={() => setOpen(!open)}
      >
        حساب مشتری / آژانس و ثبت واریزی
      </Button>
      {open && (
        <div className="mt-4 space-y-4">
          <form
            className="flex flex-wrap gap-2"
            onSubmit={(e) => {
              e.preventDefault();
              if (locked) return;
              setSearch(text.trim());
              setParty(null);
            }}
          >
            <Input
              aria-label="نام طرف حساب یا شماره قرارداد"
              placeholder="نام مشتری، آژانس یا شماره قرارداد"
              value={text}
              onChange={(e) => setText(e.target.value)}
            />
            <Button
              type="submit"
              disabled={locked || text.trim().length < 2 || parties.isFetching}
            >
              جست‌وجوی طرف حساب
            </Button>
          </form>
          {parties.isFetching && <p role="status">در حال دریافت حساب‌ها…</p>}
          {parties.error && <p role="alert">{parties.error.message}</p>}
          {parties.data && !parties.data.length && (
            <p>طرف حساب دارای قرارداد یافت نشد.</p>
          )}
          <div className="flex flex-wrap gap-2">
            {parties.data?.map((p) => (
              <Button
                key={`${p.branchId}:${p.payerId}`}
                variant="outline"
                disabled={locked}
                onClick={() => setParty(p)}
              >
                {p.name} ·{' '}
                {branches.data?.find((b) => b.id === p.branchId)?.name ??
                  'شعبه مجاز'}
              </Button>
            ))}
          </div>
          {party && (
            <PartyReceiptForm
              key={`${party.branchId}:${party.payerId}`}
              party={party}
              onPendingChange={setLocked}
              canWrite={permissions.includes('finance.receipt.approve')}
              onChanged={onChanged}
            />
          )}
        </div>
      )}
    </section>
  );
}

export function PartyReceiptForm({
  party,
  canWrite,
  onChanged,
  onPendingChange,
}: {
  party: FinanceContractPartyV1;
  canWrite: boolean;
  onPendingChange?: (pending: boolean) => void;
  onChanged: () => void;
}) {
  const client = useQueryClient();
  const [currency, setCurrency] = useState(''),
    [amount, setAmount] = useState(''),
    [accountId, setAccountId] = useState(''),
    [reference, setReference] = useState('');
  const [busy, setBusy] = useState(false),
    [message, setMessage] = useState('');
  const [result, setResult] = useState<FinancePartyReceiptResultV1 | null>(
    null,
  );
  const attempt = useRef<FinancePartyReceiptCommandV1 | null>(null),
    lock = useRef(false);
  const [uncertain, setUncertain] = useState(false);
  const queryKey = ['finance', 'party-balance', party.branchId, party.payerId];
  const context = useQuery({
    queryKey,
    queryFn: async () =>
      (
        await apiRequest<{ data: FinancePartyBalanceV1 }>(
          `/finance/party-receipts/balance?${new URLSearchParams({ branchId: party.branchId, payerId: party.payerId })}`,
        )
      ).data,
  });
  const accounts = useQuery({
    queryKey: ['finance', 'settlement-accounts'],
    queryFn: financeInboxApi.accounts,
    enabled: canWrite,
  });
  const code = currency || context.data?.totals[0]?.currencyCode || '';
  const validAccounts =
    (!accounts.error ? accounts.data : undefined)?.filter(
      (a) =>
        a.isActive && a.branchId === party.branchId && a.currencyCode === code,
    ) ?? [];
  let preview: ReturnType<typeof planPartyReceipt> = [];
  if (context.data && /^\d+(?:\.\d{1,4})?$/.test(amount)) {
    try {
      preview = planPartyReceipt(context.data, code, amount);
    } catch {
      /* incomplete amount */
    }
  }
  const disabled = busy || uncertain;
  async function submit() {
    if (
      lock.current ||
      !canWrite ||
      !context.data ||
      (!attempt.current &&
        (!preview.length || !validAccounts.some((a) => a.id === accountId)))
    )
      return;
    attempt.current ??= {
      operationId: crypto.randomUUID(),
      branchId: party.branchId,
      payerId: party.payerId,
      revision: context.data.revision,
      currencyCode: code,
      amount,
      accountId,
      reference,
    };
    lock.current = true;
    setBusy(true);
    setUncertain(true);
    onPendingChange?.(true);
    setMessage('');
    try {
      const response = await apiRequest<{ data: FinancePartyReceiptResultV1 }>(
        '/finance/party-receipts',
        { method: 'POST', body: JSON.stringify(attempt.current) },
      );
      setResult(response.data);
      attempt.current = null;
      setUncertain(false);
      onPendingChange?.(false);
      setAmount('');
      setReference('');
      setMessage('واریزی ثبت و به ترتیب قدیمی‌ترین قرارداد تخصیص داده شد.');
      await client.invalidateQueries({ queryKey });
      await client.invalidateQueries({ queryKey: ['sales'] });
      onChanged();
    } catch (error) {
      if (
        error instanceof FinanceInboxApiError &&
        error.status >= 400 &&
        error.status < 500
      ) {
        attempt.current = null;
        setUncertain(false);
        onPendingChange?.(false);
        await client.invalidateQueries({ queryKey });
      }
      setMessage(
        error instanceof Error ? error.message : 'ثبت دریافت ناموفق بود.',
      );
    } finally {
      lock.current = false;
      setBusy(false);
    }
  }
  if (
    context.error instanceof FinanceInboxApiError &&
    [401, 403, 404].includes(context.error.status)
  )
    return <p role="alert">دسترسی به حساب طرف قرارداد وجود ندارد.</p>;
  if (context.isPending)
    return <p role="status">در حال دریافت مانده قراردادها…</p>;
  if (!context.data)
    return (
      <p role="alert">{context.error?.message ?? 'حساب در دسترس نیست.'}</p>
    );
  const data = context.data;
  return (
    <div className="space-y-4">
      <div className="flex flex-wrap items-center justify-between gap-2">
        <h3 className="font-bold">حساب {data.party.name}</h3>
        <Button
          variant="outline"
          disabled={disabled || context.isFetching}
          onClick={() => void context.refetch()}
        >
          دریافت اطلاعات حساب
        </Button>
      </div>
      {context.error && <p role="alert">{context.error.message}</p>}
      <div className="grid gap-3 md:grid-cols-3">
        {data.totals.map((t) => (
          <div className="rounded-lg border p-3" key={t.currencyCode}>
            <b>{t.currencyCode}</b>
            <p>کل قراردادها: {formatSalesMoney(t.total)}</p>
            <p>دریافت تأییدشده: {formatSalesMoney(t.confirmedPaid)}</p>
            <p>
              مانده خالص (منفی: بستانکار):{' '}
              <b dir="ltr">{formatSalesMoney(t.outstanding)}</b>
            </p>
          </div>
        ))}
      </div>
      <p className="text-xs text-muted-foreground">
        قراردادهای قطعی همین طرف حساب و شعبه؛ هر ارز جداگانه. واریزی از
        قدیمی‌ترین بدهی کم می‌شود؛ مبلغ اضافه به‌عنوان بستانکاری در جدیدترین
        قرارداد می‌ماند. اصلاح دریافت تأییدشده از مسیر استرداد مالی انجام
        می‌شود.
      </p>
      <div className="max-h-72 overflow-auto">
        <table className="w-full text-sm">
          <thead>
            <tr>
              <th>قرارداد</th>
              <th>تاریخ ثبت</th>
              <th>ارز</th>
              <th>مانده</th>
              <th>دریافت در انتظار تأیید</th>
            </tr>
          </thead>
          <tbody>
            {data.contracts.flatMap((c) =>
              c.balances.map((b) => (
                <tr key={`${c.id}:${b.currencyCode}`}>
                  <td>{c.number}</td>
                  <td dir="ltr">{c.createdAt.slice(0, 10)}</td>
                  <td>{b.currencyCode}</td>
                  <td dir="ltr">{formatSalesMoney(b.outstanding)}</td>
                  <td dir="ltr">{formatSalesMoney(b.pendingFinance)}</td>
                </tr>
              )),
            )}
          </tbody>
        </table>
      </div>
      {canWrite && (
        <div className="grid gap-3 md:grid-cols-2">
          <label>
            ارز
            <select
              className="block w-full rounded-lg border p-2"
              aria-label="ارز واریزی"
              disabled={disabled}
              value={code}
              onChange={(e) => {
                setCurrency(e.target.value);
                setAccountId('');
                setResult(null);
              }}
            >
              {data.totals.map((t) => (
                <option key={t.currencyCode} value={t.currencyCode}>
                  {t.currencyCode}
                </option>
              ))}
            </select>
          </label>
          <label>
            مبلغ واریزی
            <MoneyInput
              aria-label="مبلغ واریزی"
              disabled={disabled}
              value={amount}
              onValueChange={setAmount}
            />
          </label>
          <label>
            حساب دریافت
            <select
              className="block w-full rounded-lg border p-2"
              aria-label="حساب دریافت واریزی"
              disabled={disabled}
              value={accountId}
              onChange={(e) => setAccountId(e.target.value)}
            >
              <option value="">انتخاب حساب</option>
              {validAccounts.map((a) => (
                <option key={a.id} value={a.id}>
                  {receiptAccountLabel(a)}
                </option>
              ))}
            </select>
          </label>
          <label>
            شماره پیگیری (اختیاری)
            <Input
              disabled={disabled}
              value={reference}
              maxLength={160}
              onChange={(e) => setReference(e.target.value)}
            />
          </label>
          {accounts.error && <p role="alert">{accounts.error.message}</p>}
          {!!preview.length && (
            <div className="md:col-span-2">
              <b>پیش‌نمایش تخصیص</b>
              {preview.map((p) => (
                <p key={p.contractId}>
                  قرارداد {p.contractNumber}:{' '}
                  <bdi>
                    {formatSalesMoney(p.amount)} {code}
                  </bdi>
                </p>
              ))}
            </div>
          )}
          <Button
            disabled={
              busy ||
              (!uncertain &&
                (!preview.length ||
                  !validAccounts.some((a) => a.id === accountId)))
            }
            onClick={() => void submit()}
          >
            {uncertain && !busy
              ? 'بررسی و ارسال مجدد همان واریزی'
              : 'ثبت واریزی و تخصیص به قراردادها'}
          </Button>
        </div>
      )}
      {message && <p role="status">{message}</p>}
      {result && (
        <div>
          <b>رسید تخصیص ثبت‌شده</b>
          {result.allocations.map((p) => (
            <p key={p.paymentId}>
              قرارداد {p.contractNumber}:{' '}
              <bdi>{formatSalesMoney(p.amount)}</bdi>
            </p>
          ))}
        </div>
      )}
    </div>
  );
}
