'use client';
import { useRef, useState } from 'react';
import { moneyUnits, type ReservationIntakeV1 } from '@nora/contracts';
import { Lookup, type Option } from '../hotel-rates/controls';
import { Button } from '@/components/ui/button';
import { FormField } from '@/components/ui/form-controls';
import { MoneyInput } from '@/components/ui/money-input';
import { getPublicApiBaseUrl } from '@/lib/environment';
import { refreshAuthenticatedSession } from '@/lib/auth-session';

export function ReservationInsurancePurchase({
  request,
  onSaved,
  serviceClientKey,
}: {
  request: ReservationIntakeV1;
  onSaved: () => void;
  serviceClientKey?: string | undefined;
}) {
  const service = request.snapshot.serviceSelections.find(
    (s) =>
      s.kind === 'INSURANCE' &&
      (!serviceClientKey || s.clientKey === serviceClientKey),
  );
  const current = request.servicePurchases?.find(
    (p) => p.serviceClientKey === service?.clientKey,
  );
  const [supplier, setSupplier] = useState<Option | null>(
    current
      ? { id: current.supplierOrganizationId, name: current.supplierName }
      : null,
  );
  const [currency, setCurrency] = useState<Option | null>(
    current ? { id: current.currencyCode, name: current.currencyCode } : null,
  );
  const [amount, setAmount] = useState(current?.amount ?? '');
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState('');
  const attempt = useRef<{ payload: string; key: string } | null>(null);
  if (!service) return null;
  async function save() {
    if (busy || !service) return;
    setBusy(true);
    setError('');
    try {
      const base = getPublicApiBaseUrl();
      if (!base || !supplier || !currency || moneyUnits(amount) <= 0n)
        throw new Error('کارگزار، ارز و هزینه کل خرید بیمه را کامل کنید.');
      const payload = JSON.stringify({
        version: 1,
        expectedVersion: request.purchaseVersion ?? 0,
        serviceClientKey: service.clientKey,
        supplierOrganizationId: supplier.id,
        amount,
        currencyCode: currency.id,
      });
      if (attempt.current?.payload !== payload)
        attempt.current = { payload, key: crypto.randomUUID() };
      const send = () =>
        fetch(
          `${base}/reservations/requests/${encodeURIComponent(request.id)}/service-purchases`,
          {
            method: 'POST',
            credentials: 'include',
            headers: {
              'Content-Type': 'application/json',
              'Idempotency-Key': attempt.current!.key,
            },
            body: payload,
          },
        );
      let response = await send();
      if (response.status === 401 && (await refreshAuthenticatedSession(base)))
        response = await send();
      const result = await response.json().catch(() => null);
      if (!response.ok)
        throw new Error(
          result?.error?.message ??
            result?.message ??
            'ثبت هزینه بیمه ناموفق بود.',
        );
      onSaved();
    } catch (reason) {
      setError(reason instanceof Error ? reason.message : 'ثبت ناموفق بود.');
    } finally {
      setBusy(false);
    }
  }
  return (
    <section className="space-y-3 rounded-xl border p-4">
      <h4 className="font-bold">هزینه خرید بیمه — {service.titleSnapshot}</h4>
      <div className="grid gap-3 sm:grid-cols-3">
        <FormField label="کارگزار بیمه">
          <Lookup
            kind="brokers"
            label="کارگزار بیمه"
            value={supplier}
            onChange={setSupplier}
          />
        </FormField>
        <FormField label="ارز خرید بیمه">
          <Lookup
            kind="currencies"
            label="ارز خرید بیمه"
            value={currency}
            onChange={setCurrency}
          />
        </FormField>
        <FormField label="هزینه کل بیمه">
          <MoneyInput
            aria-label="هزینه کل خرید بیمه"
            value={amount}
            onValueChange={setAmount}
          />
        </FormField>
      </div>
      <p className="text-xs text-muted-foreground">
        هزینه کل همه بیمه‌شدگان این قرارداد؛ برای محاسبه سود و ثبت در کارتابل
        مالی.
      </p>
      <Button type="button" disabled={busy} onClick={() => void save()}>
        ثبت خرید بیمه
      </Button>
      {error && <p role="alert">{error}</p>}
    </section>
  );
}
