'use client';
import { SalesThemedSelect } from './sales-themed-select';
import { PaymentDocuments } from './payment-documents';
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
import { loadPaymentCurrencies } from '../api/payment-currencies';
import {
  defaultSalesCurrency,
  salesCurrencyOptions,
  validateSalesCurrencySelection,
} from './sales-currency-select';

const empty: SalesPaymentInput = {
  amount: '',
  currencyCode: '',
  method: 'BANK_TRANSFER',
  dueAt: '',
};
export function ContractPaymentCurrencySelect({
  currencies,
  value,
  onChange,
}: {
  currencies: readonly MasterDataRecord[];
  value: string;
  onChange: (value: string) => void;
}) {
  const options = salesCurrencyOptions(currencies);
  return (
    <FormField label="ارز" required>
      <SalesThemedSelect
        label="ارز پرداخت"
        required
        disabled={!options.length}
        value={value}
        onValueChange={onChange}
        options={[
          { value: '', label: 'انتخاب ارز' },
          ...options.map((option) => ({
            value: option.id,
            label: option.name,
          })),
        ]}
      />
      {!options.length ? (
        <p role="status" className="text-xs text-muted-foreground">
          فهرست ارزهای فعال در دسترس نیست.
        </p>
      ) : null}
    </FormField>
  );
}
export function ContractPayments({
  id,
  onClose,
  onSaved,
  onSearchContracts,
}: {
  id: string;
  onClose: () => void;
  onSaved: () => void;
  onSearchContracts: (reference: string) => void;
}) {
  const [contract, setContract] = useState<SalesContractDetail | null>(null);
  const [payment, setPayment] = useState(empty);
  const [banks, setBanks] = useState<readonly MasterDataRecord[]>([]);
  const [currencies, setCurrencies] = useState<readonly MasterDataRecord[]>([]);
  const [currencyLoading, setCurrencyLoading] = useState(true);
  const [currencyError, setCurrencyError] = useState('');
  const [currencyRetry, setCurrencyRetry] = useState(0);
  const [error, setError] = useState('');
  const [busy, setBusy] = useState(false);
  const [referenceSearch, setReferenceSearch] = useState('');
  const [receiptPaymentId, setReceiptPaymentId] = useState('');
  const receiptPanel = useRef<HTMLElement>(null);
  const attempt = useRef({ fingerprint: '', key: '' });
  useEffect(() => {
    let active = true;
    void loadPaymentCurrencies()
      .then((records) => {
        if (!active) return;
        setCurrencies(records);
        setPayment((current) => ({
          ...current,
          currencyCode: salesCurrencyOptions(records).some(
            (option) => option.id === current.currencyCode,
          )
            ? current.currencyCode
            : defaultSalesCurrency(records),
        }));
      })
      .catch(() => {
        if (active)
          setCurrencyError('دریافت فهرست ارزها ناموفق بود؛ دوباره تلاش کنید.');
      })
      .finally(() => {
        if (active) setCurrencyLoading(false);
      });
    return () => {
      active = false;
    };
  }, [id, currencyRetry]);
  const validCurrency =
    !currencyLoading &&
    !currencyError &&
    salesCurrencyOptions(currencies).some(
      (option) => option.id === payment.currencyCode,
    );
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
      if (!validCurrency)
        throw new Error('ارز پرداخت را از فهرست ارزهای فعال انتخاب کنید.');
      validateSalesCurrencySelection(
        { priceComponents: [], payments: [payment] },
        currencies,
      );
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
      const previousIds = new Set(contract.payments.map((item) => item.id));
      const added = response.data.payments.find(
        (item) => !previousIds.has(item.id),
      );
      if (added) setReceiptPaymentId(added.id);
      setPayment({ ...empty, currencyCode: defaultSalesCurrency(currencies) });
      receiptPanel.current?.scrollIntoView({
        behavior: 'smooth',
        block: 'center',
      });
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
      <form
        className="flex flex-wrap items-end gap-2"
        onSubmit={(event) => {
          event.preventDefault();
          if (referenceSearch.trim()) onSearchContracts(referenceSearch.trim());
        }}
      >
        <div className="min-w-48 flex-1">
          <FormField label="جست‌وجوی شماره پیگیری در همه قراردادها">
            <Input
              value={referenceSearch}
              maxLength={160}
              onChange={(event) => setReferenceSearch(event.target.value)}
            />
          </FormField>
        </div>
        <Button
          type="submit"
          variant="outline"
          disabled={!referenceSearch.trim()}
        >
          پیدا کردن قرارداد
        </Button>
        <p className="w-full text-xs text-muted-foreground">
          جست‌وجو بین همهٔ قراردادهای مجاز شما انجام می‌شود، نه فقط این قرارداد؛
          نتیجه در فهرست اصلی نمایش داده می‌شود.
        </p>
      </form>
      <section
        ref={receiptPanel}
        aria-label="مدارک پرداخت قرارداد"
        className="space-y-3 rounded-xl border border-primary/25 bg-primary/5 p-4"
      >
        <h3 className="font-bold">آپلود رسید و مدارک پرداخت قرارداد</h3>
        <p className="text-sm text-muted-foreground">
          پرداخت مربوط به رسید را انتخاب کنید؛ فایل به همان پرداخت این قرارداد
          پیوست می‌شود.
        </p>
        {contract?.payments.length ? (
          <>
            <SalesThemedSelect
              label="پرداخت مربوط به مدرک"
              value={receiptPaymentId || contract.payments[0]!.id}
              onValueChange={setReceiptPaymentId}
              options={contract.payments.map((item, index) => ({
                value: item.id,
                label: `پرداخت ${index + 1} · ${item.amount} ${item.currencyCode} · پیگیری: ${item.paymentReference || 'ثبت نشده'}`,
              }))}
            />
            <PaymentDocuments
              key={receiptPaymentId || contract.payments[0]!.id}
              contract={contract}
              paymentId={receiptPaymentId || contract.payments[0]!.id}
              expanded
            />
          </>
        ) : (
          <p role="status" className="text-sm">
            ابتدا یک پرداخت در فرم پایین ثبت کنید؛ سپس همین‌جا رسید PDF یا تصویر
            آن را آپلود کنید.
          </p>
        )}
      </section>
      {contract?.payments.map((item) => (
        <div key={item.id} className="rounded-xl border p-3">
          <strong>
            {item.amount} {item.currencyCode}
          </strong>{' '}
          ·{' '}
          {
            {
              FINANCE_CONFIRMED: 'تأییدشده مالی',
              FINANCE_REJECTED: 'ردشده توسط مالی',
              SCHEDULED: 'برنامه‌ریزی‌شده',
              PENDING_FINANCE_CONFIRMATION: 'در انتظار تأیید مالی',
            }[item.status]
          }
          <p>
            شماره پیگیری: <bdi>{item.paymentReference || 'ثبت نشده'}</bdi>
          </p>
          <p>
            سررسید: {new Date(item.dueAt).toLocaleDateString('fa-IR')}
            {item.check ? ` · تاریخ چک: ${item.check.dueDate}` : ''}
          </p>
          <Button
            type="button"
            variant="outline"
            size="sm"
            className="mt-2"
            onClick={() => {
              setReceiptPaymentId(item.id);
              receiptPanel.current?.scrollIntoView({
                behavior: 'smooth',
                block: 'center',
              });
            }}
          >
            آپلود رسید / مشاهده مدارک
          </Button>
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
        <div>
          {currencyLoading ? (
            <p role="status" className="text-sm text-muted-foreground">
              در حال دریافت فهرست ارزها…
            </p>
          ) : (
            <ContractPaymentCurrencySelect
              currencies={currencies}
              value={payment.currencyCode}
              onChange={(currencyCode) =>
                setPayment({ ...payment, currencyCode })
              }
            />
          )}
          {!currencyLoading &&
          (currencyError || !salesCurrencyOptions(currencies).length) ? (
            <div className="mt-2 space-y-2">
              {currencyError ? (
                <p role="alert" className="text-sm text-destructive">
                  {currencyError}
                </p>
              ) : null}
              <Button
                type="button"
                variant="outline"
                onClick={() => {
                  setCurrencyLoading(true);
                  setCurrencyError('');
                  setCurrencies([]);
                  setCurrencyRetry((value) => value + 1);
                }}
              >
                دریافت دوبارهٔ ارزها
              </Button>
            </div>
          ) : null}
        </div>
        <FormField label="سررسید پرداخت" required>
          <DatePicker
            value={payment.dueAt}
            onChange={(dueAt) => setPayment({ ...payment, dueAt })}
          />
        </FormField>
        <FormField label="شماره پیگیری پرداخت (اختیاری)">
          <Input
            dir="ltr"
            maxLength={160}
            value={payment.paymentReference ?? ''}
            onChange={(event) =>
              setPayment({ ...payment, paymentReference: event.target.value })
            }
          />
        </FormField>
        <p className="text-xs text-muted-foreground md:col-span-2">
          پس از افزودن پرداخت، بخش «مدارک پرداخت قرارداد» برای بارگذاری رسید
          آماده است. شماره پیگیری را در جست‌وجوی داشبورد فروش هم می‌توانید پیدا
          کنید؛ این جست‌وجو استعلام بانکی نیست.
        </p>
        <FormField label="روش پرداخت">
          <SalesThemedSelect
            label="روش پرداخت"
            value={payment.method}
            onValueChange={(method) =>
              setPayment({
                ...payment,
                check: null,
                method: method as SalesPaymentMethod,
              })
            }
            options={[
              { value: 'BANK_TRANSFER', label: 'حواله بانکی' },
              { value: 'CASH', label: 'نقد' },
              { value: 'POS', label: 'کارت‌خوان' },
              { value: 'ONLINE_GATEWAY', label: 'درگاه' },
              { value: 'CHECK', label: 'چک' },
            ]}
          />
        </FormField>
        {payment.method === 'CHECK' ? (
          <>
            <FormField label="بانک" required>
              <SalesThemedSelect
                label="بانک"
                required
                value={payment.check?.bankId ?? ''}
                onValueChange={(bankId) => patchCheck('bankId', bankId)}
                options={[
                  { value: '', label: 'انتخاب بانک' },
                  ...banks.map((bank) => ({
                    value: bank.id,
                    label: bank.name,
                  })),
                ]}
              />
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
        <Button
          type="submit"
          loading={busy}
          disabled={!contract || !validCurrency}
        >
          افزودن پرداخت
        </Button>
      </form>
    </Card>
  );
}
