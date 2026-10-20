'use client';
import { useRef, useState } from 'react';
import { useQuery, useQueryClient } from '@tanstack/react-query';
import type {
  FinanceReceiptAllocationContextV1,
  FinanceReceiptAllocationTargetV1,
  FinanceReceiptAllocationResultV1,
} from '@nora/contracts';
import { useAccessPermissions } from '@/modules/iam/access-context';
import { Input, Textarea } from '@/components/ui/form-controls';
import { MoneyInput } from '@/components/ui/money-input';
import { SearchCombobox } from '@/components/ui/search-combobox';
import { AccountingButton as Button } from './accounting-operations';
import { apiRequest, FinanceInboxApiError } from '../api/finance-inbox-api';

export function ReceiptAllocationPanel({
  eventId,
  onChanged,
  onClose,
}: {
  eventId: string;
  onChanged: () => void;
  onClose: () => void;
}) {
  const client = useQueryClient(),
    permissions = useAccessPermissions();
  const canWrite =
    !!permissions?.includes('finance.receipt.approve') &&
    permissions.includes('finance.journal.create');
  const [cursor, setCursor] = useState(''),
    [searchInput, setSearchInput] = useState(''),
    [search, setSearch] = useState('');
  const [targetId, setTargetId] = useState(''),
    [amount, setAmount] = useState(''),
    [reason, setReason] = useState('');
  const [reverse, setReverse] = useState<
    FinanceReceiptAllocationContextV1['allocations'][number] | null
  >(null);
  const [busy, setBusy] = useState(false),
    [uncertain, setUncertain] = useState(false),
    [message, setMessage] = useState('');
  const lock = useRef(false),
    attempt = useRef<{ path: string; body: string } | null>(null);
  const context = useQuery({
    queryKey: ['finance', 'receipt-allocation', eventId, cursor],
    queryFn: () =>
      apiRequest<FinanceReceiptAllocationContextV1>(
        `/finance/receipt-allocations/${eventId}${cursor ? `?before=${cursor}` : ''}`,
      ),
    refetchInterval: 30000,
  });
  const targets = useQuery({
    queryKey: ['finance', 'receipt-allocation-targets', eventId, search],
    queryFn: () =>
      apiRequest<FinanceReceiptAllocationTargetV1[]>(
        `/finance/receipt-allocations/${eventId}/targets?${new URLSearchParams({ search })}`,
      ),
    enabled: !!context.data?.accountingReady && canWrite,
  });
  const denied = [context.error, targets.error].some(
    (error) =>
      error instanceof FinanceInboxApiError &&
      [401, 403, 404].includes(error.status),
  );
  const refresh = async () => {
    await Promise.all([
      client.invalidateQueries({
        queryKey: ['finance', 'receipt-allocation', eventId],
      }),
      client.invalidateQueries({
        queryKey: ['finance', 'receipt-allocation-targets', eventId],
      }),
      client.invalidateQueries({ queryKey: ['sales'] }),
    ]);
    onChanged();
  };
  const submit = async () => {
    if (lock.current || !context.data || !canWrite) return;
    if (!attempt.current) {
      const target = reverse
        ? { id: reverse.targetContractId, version: reverse.targetVersion }
        : targets.data?.find((row) => row.id === targetId);
      if (!target || reason.trim().length < 10) {
        setMessage('قرارداد مقصد و علت حداقل ده‌حرفی را وارد کنید.');
        return;
      }
      attempt.current = {
        path: `/finance/receipt-allocations/${eventId}${reverse ? `/${reverse.id}/reverse` : ''}`,
        body: JSON.stringify({
          operationId: crypto.randomUUID(),
          reason: reason.trim(),
          expectedSourceVersion: context.data.sourceVersion,
          expectedTargetVersion: target.version,
          ...(!reverse ? { targetContractId: target.id, amount } : {}),
        }),
      };
    }
    lock.current = true;
    setBusy(true);
    setUncertain(true);
    setMessage('');
    try {
      const result = await apiRequest<FinanceReceiptAllocationResultV1>(
        attempt.current.path,
        { method: 'POST', body: attempt.current.body },
      );
      attempt.current = null;
      setUncertain(false);
      setTargetId('');
      setAmount('');
      setReason('');
      setReverse(null);
      setMessage(
        result.status === 'REVERSED'
          ? 'برگشت تخصیص ثبت شد؛ سند آن از مسیر حسابداری پیگیری می‌شود.'
          : 'تخصیص ثبت شد؛ سند آن از مسیر حسابداری پیگیری می‌شود.',
      );
      await refresh();
    } catch (error) {
      if (
        error instanceof FinanceInboxApiError &&
        error.status >= 400 &&
        error.status < 500
      ) {
        attempt.current = null;
        setUncertain(false);
        await refresh();
      }
      setMessage(
        error instanceof Error
          ? error.message
          : 'ثبت انجام نشد؛ همان عملیات را دوباره ارسال کنید.',
      );
    } finally {
      lock.current = false;
      setBusy(false);
    }
  };
  if (denied)
    return <section role="alert">دسترسی به اطلاعات تخصیص وجود ندارد.</section>;
  if (context.isPending) return <p role="status">در حال بارگذاری تخصیص‌ها…</p>;
  if (!context.data)
    return (
      <p role="alert">
        {context.error?.message ?? 'اطلاعات تخصیص در دسترس نیست.'}
      </p>
    );
  const data = context.data,
    disabled = busy || uncertain;
  return (
    <section
      className="space-y-4 rounded-xl border p-4"
      aria-label="تخصیص دریافت به قراردادها"
    >
      <div className="flex items-center justify-between gap-3">
        <h4 className="font-bold">
          تخصیص دریافت قرارداد {data.sourceContractNumber}
        </h4>
        <Button disabled={disabled} onClick={onClose}>
          بستن تخصیص
        </Button>
      </div>
      <p>
        وجه قابل تخصیص:{' '}
        <b dir="ltr">
          {data.availableAmount} {data.currency}
        </b>{' '}
        · رزرو استرداد:{' '}
        <span dir="ltr">
          {data.reservedRefunds} {data.currency}
        </span>
      </p>
      <p className="text-sm">
        تخصیص، مانده همان دریافت را بین قراردادهای یک مشتری و شعبه منتقل می‌کند.
        اصل رسید حفظ می‌شود و سند تخصیص با حساب، تفصیلی و نرخ حمل‌شده دریافت
        اصلی ساخته می‌شود.
      </p>
      {!data.accountingReady && <p role="status">{data.accountingIssue}</p>}
      {message && <p role="status">{message}</p>}
      {uncertain && !busy && (
        <p role="alert">
          نتیجه قطعی عملیات دریافت نشد؛ همین عملیات را دوباره ارسال کنید.
        </p>
      )}
      {canWrite && (data.accountingReady || uncertain) && (
        <form
          className="space-y-3 rounded-xl bg-muted/30 p-3"
          onSubmit={(event) => {
            event.preventDefault();
            void submit();
          }}
        >
          {reverse ? (
            <p>
              برگشت کامل تخصیص به قرارداد {reverse.targetContractNumber} ·{' '}
              {reverse.amount} {data.currency}
            </p>
          ) : (
            <>
              <div className="flex gap-2">
                <label className="flex-1">
                  شماره قرارداد مقصد
                  <Input
                    value={searchInput}
                    disabled={disabled}
                    maxLength={80}
                    onChange={(event) => setSearchInput(event.target.value)}
                  />
                </label>
                <Button
                  type="button"
                  disabled={disabled}
                  onClick={() => setSearch(searchInput.trim())}
                >
                  جست‌وجوی مقصد
                </Button>
              </div>
              <SearchCombobox
                label="قرارداد مقصد تخصیص"
                value={targetId}
                disabled={disabled}
                onValueChange={setTargetId}
                options={(targets.data ?? []).map((target) => ({
                  value: target.id,
                  label: `${target.contractNumber} · ${target.outstanding} ${data.currency}`,
                }))}
              />
              {targets.error && <p role="alert">{targets.error.message}</p>}
              <label className="block">
                مبلغ تخصیص
                <MoneyInput
                  value={amount}
                  onValueChange={setAmount}
                  disabled={disabled}
                  required
                />
              </label>
            </>
          )}
          <label className="block">
            علت تخصیص یا برگشت
            <Textarea
              value={reason}
              onChange={(event) => setReason(event.target.value)}
              minLength={10}
              maxLength={500}
              disabled={disabled}
              required
            />
          </label>
          <div className="flex gap-2">
            <Button
              type="submit"
              permission="finance.receipt.approve"
              disabled={busy}
            >
              {uncertain
                ? 'تکرار همان عملیات تخصیص'
                : reverse
                  ? 'ثبت برگشت تخصیص'
                  : 'ثبت تخصیص دریافت'}
            </Button>
            {reverse && (
              <Button
                type="button"
                disabled={disabled}
                onClick={() => {
                  setReverse(null);
                  setReason('');
                }}
              >
                انصراف از برگشت
              </Button>
            )}
          </div>
        </form>
      )}
      <div className="overflow-x-auto">
        <table className="w-full text-sm">
          <thead>
            <tr>
              {['قرارداد مقصد', 'مبلغ', 'علت', 'وضعیت', 'اقدام'].map(
                (label) => (
                  <th className="p-2 text-start" key={label}>
                    {label}
                  </th>
                ),
              )}
            </tr>
          </thead>
          <tbody>
            {data.allocations.map((row) => (
              <tr key={row.id} className="border-t">
                <td className="p-2">{row.targetContractNumber}</td>
                <td className="p-2" dir="ltr">
                  {row.amount} {data.currency}
                </td>
                <td className="p-2">{row.reason}</td>
                <td className="p-2">{row.reversed ? 'برگشت‌شده' : 'فعال'}</td>
                <td className="p-2">
                  {!row.reversed && canWrite && (
                    <Button
                      permission="finance.receipt.approve"
                      disabled={disabled || !data.accountingReady}
                      onClick={() => {
                        setReverse(row);
                        setReason('');
                        attempt.current = null;
                        setMessage('');
                      }}
                    >
                      برگشت تخصیص
                    </Button>
                  )}
                </td>
              </tr>
            ))}
          </tbody>
        </table>
        {!data.allocations.length && (
          <p>تخصیصی برای این دریافت ثبت نشده است.</p>
        )}
      </div>
      <div className="flex gap-2">
        <Button disabled={!cursor || disabled} onClick={() => setCursor('')}>
          ابتدای تخصیص‌ها
        </Button>
        <Button
          disabled={!data.nextCursor || disabled}
          onClick={() => setCursor(data.nextCursor ?? '')}
        >
          تخصیص‌های بعدی
        </Button>
      </div>
    </section>
  );
}
