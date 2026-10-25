'use client';
import { useEffect, useRef, useState } from 'react';
import {
  canViewRoute,
  canWriteOwnFloatingPurchase,
  type ReservationIntakeV1,
  type ReservationServicePurchaseInputV1,
  type SalesServiceInput,
} from '@nora/contracts';
import { useAccessActor } from '@/modules/iam/access-context';
import { Button } from '@/components/ui/button';
import { FormField, Input } from '@/components/ui/form-controls';
import { Alert, Card, PageHeader } from '@/components/ui/surfaces';
import { MoneyInput, formatSalesMoney } from '@/components/ui/money-input';
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogTitle,
} from '@/components/ui/overlays';
import { SearchCombobox } from '@/components/ui/search-combobox';
import { floatingRequest } from './api';
import { floatingPurchaseService } from './model';
type Kind = 'HOTEL' | 'FLIGHT';
type Row = { id: string; clientKey: string; status: string };
type Inbox = {
  data: ReservationIntakeV1[];
  meta: { page: number; hasMore: boolean; services: Row[] };
};
type Option = { id: string; name: string };
function FloatingOptions({
  id,
  kind,
  resource,
  value,
  onChange,
}: {
  id: string;
  kind: Kind;
  resource: 'brokers' | 'currencies';
  value: string;
  onChange: (value: string) => void;
}) {
  const [search, setSearch] = useState('');
  const [page, setPage] = useState(1);
  const [options, setOptions] = useState<Option[]>([]);
  const [more, setMore] = useState(false);
  const [error, setError] = useState('');
  useEffect(() => {
    const controller = new AbortController();
    floatingRequest<{ data: Option[]; meta: { total: number } }>(
      `/${id}/options?kind=${kind}&resource=${resource}&search=${encodeURIComponent(search)}&page=${page}`,
      { signal: controller.signal },
    )
      .then((result) => {
        if (!controller.signal.aborted) {
          setOptions((old) =>
            page === 1 ? result.data : [...old, ...result.data],
          );
          setMore(page * 50 < result.meta.total);
          setError('');
        }
      })
      .catch((reason) => {
        if (!controller.signal.aborted)
          setError(
            reason instanceof Error ? reason.message : 'ثبت ناموفق بود.',
          );
      });
    return () => controller.abort();
  }, [id, kind, resource, search, page]);
  return (
    <div>
      <SearchCombobox
        label={resource === 'brokers' ? 'کارگزار' : 'ارز'}
        value={value}
        options={options.map((option) => ({
          value: option.id,
          label: option.name,
        }))}
        onValueChange={onChange}
        remote
        onSearchChange={(value) => {
          setSearch(value);
          setPage(1);
        }}
      />
      {more && (
        <Button
          type="button"
          variant="outline"
          onClick={() => setPage((p) => p + 1)}
        >
          بیشتر
        </Button>
      )}
      {error && <p role="alert">{error}</p>}
    </div>
  );
}
function PurchaseEditor({
  request,
  service,
  kind,
  onSaved,
}: {
  request: ReservationIntakeV1;
  service: SalesServiceInput;
  kind: Kind;
  onSaved: () => void;
}) {
  const current = request.servicePurchases?.find(
    (p) => p.serviceClientKey === service.clientKey,
  );
  const [supplier, setSupplier] = useState(
    current?.supplierOrganizationId ?? '',
  );
  const [currency, setCurrency] = useState(current?.currencyCode ?? 'IRR');
  const [amount, setAmount] = useState(current?.amount ?? '');
  const [rate, setRate] = useState('');
  const [error, setError] = useState('');
  const [busy, setBusy] = useState(false);
  const attempt = useRef<{ body: string; key: string } | null>(null);
  async function save() {
    if (busy) return;
    setBusy(true);
    setError('');
    try {
      const input: ReservationServicePurchaseInputV1 = {
        version: 1,
        expectedVersion: request.purchaseVersion ?? 0,
        serviceClientKey: service.clientKey,
        supplierOrganizationId: supplier,
        amount,
        currencyCode: currency,
        ...(rate ? { purchaseRateToIrr: rate } : {}),
      };
      const body = JSON.stringify(input);
      if (attempt.current?.body !== body)
        attempt.current = { body, key: crypto.randomUUID() };
      await floatingRequest(`/${request.id}`, {
        method: 'POST',
        headers: { 'Idempotency-Key': attempt.current.key },
        body,
      });
      onSaved();
    } catch (reason) {
      setError(reason instanceof Error ? reason.message : 'ثبت ناموفق بود.');
    } finally {
      setBusy(false);
    }
  }
  return (
    <div className="space-y-4">
      <p>
        {request.snapshot.contractNumber} · {service.titleSnapshot}
      </p>
      <FormField label="کارگزار" required>
        <FloatingOptions
          id={request.id}
          kind={kind}
          resource="brokers"
          value={supplier}
          onChange={setSupplier}
        />
      </FormField>
      <FormField label="ارز" required>
        <FloatingOptions
          id={request.id}
          kind={kind}
          resource="currencies"
          value={currency}
          onChange={setCurrency}
        />
      </FormField>
      <FormField label="مبلغ کل خرید" required>
        <MoneyInput value={amount} onValueChange={setAmount} />
      </FormField>
      {currency !== 'IRR' && (
        <FormField label="نرخ خرید به ریال" required>
          <MoneyInput value={rate} onValueChange={setRate} />
        </FormField>
      )}
      {error && <Alert tone="error" title={error} />}
      <Button
        type="button"
        disabled={busy || !supplier || !currency || !amount}
        onClick={() => void save()}
      >
        ثبت خرید
      </Button>
    </div>
  );
}
export function FloatingPurchasesWorkspace({ kind }: { kind: Kind }) {
  const actor = useAccessActor();
  const path = `/ticket-purchases/floating-${kind === 'HOTEL' ? 'hotels' : 'flights'}`;
  const allowed = !!actor && canViewRoute(actor.permissions, path);
  const [page, setPage] = useState(1);
  const [search, setSearch] = useState('');
  const [filter, setFilter] = useState('');
  const [revision, setRevision] = useState(0);
  const [loaded, setLoaded] = useState<{
    key: string;
    result?: Inbox;
    error?: string;
  }>();
  const scopeKey = JSON.stringify([
    actor?.userId,
    actor?.sessionId,
    actor?.branchIds,
    actor?.permissions,
  ]);
  const [selection, setSelection] = useState<{
    request: ReservationIntakeV1;
    service: SalesServiceInput;
    scopeKey: string;
  } | null>(null);
  const activeSelection = selection?.scopeKey === scopeKey ? selection : null;
  const key = JSON.stringify([kind, page, filter, revision, scopeKey]);
  const result = loaded?.key === key ? loaded.result : undefined;
  useEffect(() => {
    if (!allowed) return;
    const controller = new AbortController();
    floatingRequest<Inbox>(
      `?kind=${kind}&page=${page}&contractNumber=${encodeURIComponent(filter)}`,
      { signal: controller.signal },
    )
      .then((result) => {
        if (!controller.signal.aborted) setLoaded({ key, result });
      })
      .catch((reason) => {
        if (!controller.signal.aborted)
          setLoaded({
            key,
            error: reason instanceof Error ? reason.message : 'ثبت ناموفق بود.',
          });
      });
    return () => controller.abort();
  }, [allowed, key, kind, page, filter]);
  const title = kind === 'HOTEL' ? 'خرید هتل شناور' : 'خرید بلیط شناور';
  if (!allowed)
    return (
      <Alert title="دسترسی این بخش برای حساب شما فعال نیست." tone="warning" />
    );
  return (
    <div className="space-y-5">
      <PageHeader title={title} description="ثبت قیمت خرید قراردادهای شناور" />
      <Card className="p-4">
        <form
          className="flex gap-3"
          onSubmit={(e) => {
            e.preventDefault();
            setPage(1);
            setFilter(search);
          }}
        >
          <Input
            aria-label="شماره قرارداد"
            placeholder="شماره قرارداد"
            value={search}
            onChange={(e) => setSearch(e.target.value)}
          />
          <Button type="submit">جست‌وجو</Button>
        </form>
      </Card>
      {loaded?.key === key && loaded.error && (
        <Alert tone="error" title={loaded.error} />
      )}
      <Card className="overflow-x-auto">
        <table className="w-full">
          <thead>
            <tr>
              {['شماره قرارداد', 'خدمت', 'کارگزار', 'مبلغ خرید', 'عملیات'].map(
                (label) => (
                  <th key={label} className="p-3 text-start">
                    {label}
                  </th>
                ),
              )}
            </tr>
          </thead>
          <tbody>
            {result?.meta.services.map((row) => {
              const request = result.data.find((r) => r.id === row.id);
              const service = request
                ? floatingPurchaseService(request, row.clientKey)
                : undefined;
              if (!request || !service) return null;
              const cost = request.servicePurchases?.find(
                (p) => p.serviceClientKey === row.clientKey,
              );
              const editable = canWriteOwnFloatingPurchase(
                actor!.permissions,
                actor!.userId,
                request.salesOwnerUserId,
              );
              return (
                <tr key={`${row.id}:${row.clientKey}`} className="border-t">
                  <td className="p-3">{request.snapshot.contractNumber}</td>
                  <td className="p-3">{service.titleSnapshot}</td>
                  <td className="p-3">{cost?.supplierName ?? '—'}</td>
                  <td className="p-3">
                    {cost
                      ? `${formatSalesMoney(cost.amount)} ${cost.currencyCode}`
                      : '—'}
                  </td>
                  <td className="p-3">
                    {editable && (
                      <Button
                        type="button"
                        onClick={() =>
                          setSelection({ request, service, scopeKey })
                        }
                      >
                        ثبت خرید
                      </Button>
                    )}
                  </td>
                </tr>
              );
            })}
          </tbody>
        </table>
        {!result && <p className="p-4">در حال دریافت خریدها…</p>}
        {result && !result.meta.services.length && (
          <p className="p-4">موردی یافت نشد.</p>
        )}
      </Card>
      <div className="flex gap-3">
        <Button
          type="button"
          disabled={page === 1}
          onClick={() => setPage((p) => p - 1)}
        >
          قبلی
        </Button>
        <Button
          type="button"
          disabled={!result?.meta.hasMore}
          onClick={() => setPage((p) => p + 1)}
        >
          بعدی
        </Button>
        <Button
          type="button"
          variant="outline"
          onClick={() => setRevision((v) => v + 1)}
        >
          به‌روزرسانی
        </Button>
      </div>
      <Dialog
        open={!!activeSelection}
        onOpenChange={(open) => {
          if (!open) setSelection(null);
        }}
      >
        <DialogContent>
          <DialogTitle>{title}</DialogTitle>
          <DialogDescription>ثبت قیمت خرید قراردادهای شناور</DialogDescription>
          {activeSelection && (
            <PurchaseEditor
              key={`${activeSelection.request.id}:${activeSelection.service.clientKey}`}
              request={activeSelection.request}
              service={activeSelection.service}
              kind={kind}
              onSaved={() => {
                setSelection(null);
                setRevision((v) => v + 1);
              }}
            />
          )}
        </DialogContent>
      </Dialog>
    </div>
  );
}
