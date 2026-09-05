'use client';
import { useEffect, useRef, useState, type FormEvent } from 'react';
import type {
  MasterDataRecord,
  SalesContractDetail,
  SalesPaymentInput,
  SalesPaymentMethod,
} from '@rubi/contracts';
import { Button } from '@/components/ui/button';
import { SalesDatePicker as DatePicker } from './sales-date-picker';
import { FormField, Input } from '@/components/ui/form-controls';
import { Alert, Card } from '@/components/ui/surfaces';
import { masterDataApi } from '@/modules/master-data/api/client';
import { salesApi } from '../api/client';

const empty: SalesPaymentInput = {
  amount: '',
  currencyCode: 'IRR',
  method: 'BANK_TRANSFER',
  dueAt: '',
};
export function ContractPayments({
  id,
  onClose,
  onSaved,
}: {
  id: string;
  onClose: () => void;
  onSaved: () => void;
}) {
  const [contract, setContract] = useState<SalesContractDetail | null>(null);
  const [payment, setPayment] = useState(empty);
  const [banks, setBanks] = useState<readonly MasterDataRecord[]>([]);
  const [error, setError] = useState('');
  const [busy, setBusy] = useState(false);
  const attempt = useRef({ fingerprint: '', key: '' });
  useEffect(() => {
    let active = true;
    void salesApi
      .detail(id)
      .then((response) => {
        if (active) setContract(response.data);
      })
      .catch(() => {
        if (active) setError('دریافت پرداخت‌ها ناموفق بود.');
      });
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
        if (active) setBanks(response.data);
      })
      .catch(() => {
        if (active) setError('دریافت بانک‌ها ناموفق بود.');
      });
    return () => {
      active = false;
    };
  }, [id]);
  const submit = async (event: FormEvent) => {
    event.preventDefault();
    if (!contract) return;
    setBusy(true);
    setError('');
    try {
      const input = {
        ...payment,
        dueAt: new Date(payment.dueAt).toISOString(),
        version: contract.version,
      };
      const fingerprint = JSON.stringify(input);
      if (fingerprint !== attempt.current.fingerprint)
        attempt.current = { fingerprint, key: crypto.randomUUID() };
      const response = await salesApi.addPayment(
        id,
        input,
        attempt.current.key,
      );
      setContract(response.data);
      setPayment(empty);
      onSaved();
    } catch (reason) {
      setError(
        reason instanceof Error ? reason.message : 'ثبت پرداخت ناموفق بود.',
      );
    } finally {
      setBusy(false);
    }
  };
  const patchCheck = (
    field: 'bankId' | 'secureIdentifier' | 'ownerName' | 'dueDate',
    value: string,
  ) =>
    setPayment({
      ...payment,
      check: {
        bankId: '',
        secureIdentifier: '',
        ownerName: '',
        dueDate: '',
        ...payment.check,
        [field]: value,
      },
    });
  return (
    <Card className="grid gap-4 p-5">
      <div className="flex items-center justify-between">
        <h2 className="font-bold">
          پرداخت‌های قرارداد {contract?.contractNumber}
        </h2>
        <Button variant="ghost" onClick={onClose}>
          بستن
        </Button>
      </div>
      {error ? <Alert tone="error" title={error} /> : null}
      {contract?.balances.map((balance) => (
        <p key={balance.currencyCode}>
          مانده {balance.currencyCode}: {balance.outstanding} · پرداخت تأییدشده:{' '}
          {balance.confirmedPaid}
        </p>
      ))}
      {contract?.payments.map((item) => (
        <div key={item.id} className="rounded-xl border p-3">
          <strong>
            {item.amount} {item.currencyCode}
          </strong>{' '}
          ·{' '}
          {item.status === 'FINANCE_CONFIRMED'
            ? 'تأییدشده مالی'
            : 'در انتظار تأیید مالی'}
          <p>
            سررسید: {new Date(item.dueAt).toLocaleDateString('fa-IR')}
            {item.check ? ` · تاریخ چک: ${item.check.dueDate}` : ''}
          </p>
        </div>
      ))}
      <p className="text-sm text-muted-foreground">
        افزودن ردیف پرداخت به‌تنهایی مانده را کم نمی‌کند؛ تأیید مالی لازم است.
      </p>
      <form
        className="grid gap-4 md:grid-cols-2"
        onSubmit={(event) => void submit(event)}
      >
        <FormField label="مبلغ" required>
          <Input
            required
            value={payment.amount}
            onChange={(event) =>
              setPayment({ ...payment, amount: event.target.value })
            }
          />
        </FormField>
        <FormField label="ارز" required>
          <Input
            required
            maxLength={3}
            value={payment.currencyCode}
            onChange={(event) =>
              setPayment({
                ...payment,
                currencyCode: event.target.value.toUpperCase(),
              })
            }
          />
        </FormField>
        <FormField label="سررسید پرداخت" required>
          <DatePicker
            value={payment.dueAt}
            onChange={(dueAt) => setPayment({ ...payment, dueAt })}
          />
        </FormField>
        <FormField label="روش پرداخت">
          <select
            className="h-11 rounded-xl border bg-surface px-3"
            value={payment.method}
            onChange={(event) =>
              setPayment({
                ...payment,
                check: null,
                method: event.target.value as SalesPaymentMethod,
              })
            }
          >
            <option value="BANK_TRANSFER">حواله بانکی</option>
            <option value="CASH">نقد</option>
            <option value="POS">کارت‌خوان</option>
            <option value="ONLINE_GATEWAY">درگاه</option>
            <option value="CHECK">چک</option>
          </select>
        </FormField>
        {payment.method === 'CHECK' ? (
          <>
            <FormField label="بانک" required>
              <select
                required
                value={payment.check?.bankId ?? ''}
                onChange={(event) => patchCheck('bankId', event.target.value)}
              >
                <option value="">انتخاب بانک</option>
                {banks.map((bank) => (
                  <option key={bank.id} value={bank.id}>
                    {bank.name}
                  </option>
                ))}
              </select>
            </FormField>
            <FormField label="شناسه چک" required>
              <Input
                required
                value={payment.check?.secureIdentifier ?? ''}
                onChange={(event) =>
                  patchCheck('secureIdentifier', event.target.value)
                }
              />
            </FormField>
            <FormField label="صاحب چک" required>
              <Input
                required
                value={payment.check?.ownerName ?? ''}
                onChange={(event) =>
                  patchCheck('ownerName', event.target.value)
                }
              />
            </FormField>
            <FormField label="تاریخ چک" required>
              <DatePicker
                value={payment.check?.dueDate ?? ''}
                onChange={(value) => patchCheck('dueDate', value)}
              />
            </FormField>
          </>
        ) : null}
        <Button type="submit" loading={busy} disabled={!contract}>
          افزودن پرداخت
        </Button>
      </form>
    </Card>
  );
}
