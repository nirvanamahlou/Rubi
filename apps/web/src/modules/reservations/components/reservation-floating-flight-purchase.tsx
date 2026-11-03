'use client';
import type { ReservationServicePurchaseInputV1 } from '@nora/contracts';
import { purchaseApiRoot } from './purchase-api-root';
import { PurchaseCurrencyLookup } from './purchase-currency-lookup';
import { ReservationPurchaseBrokerLookup } from './reservation-purchase-broker-lookup';
import { PurchaseFxRate } from '@/modules/finance/purchase-fx/purchase-fx';
import { useCallback, useRef, useState } from 'react';
import { moneyUnits, type ReservationIntakeV1 } from '@nora/contracts';
import { Lookup, type Option } from '../hotel-rates/controls';
import { Button } from '@/components/ui/button';
import { FormField } from '@/components/ui/form-controls';
import { MoneyInput } from '@/components/ui/money-input';
import { getPublicApiBaseUrl } from '@/lib/environment';
import { refreshAuthenticatedSession } from '@/lib/auth-session';

export function ReservationFloatingFlightPurchase({
  onStage,
  request,
  purchaseRoot,
  onSaved,
  serviceClientKey,
}: {
  onStage?: (body: ReservationServicePurchaseInputV1) => void;
  request: ReservationIntakeV1;
  purchaseRoot?: string | undefined;
  onSaved: () => void;
  serviceClientKey?: string | undefined;
}) {
  const service = request.snapshot.serviceSelections.find(
    (s) =>
      s.kind === 'FLIGHT' &&
      (s.metadata?.purchaseSupplyType === 'FLOATING' ||
        s.metadata?.contractFlightVersion === 1) &&
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
  const [fxRates, setFxRates] = useState<Record<string, string>>({});
  const updateFx = useCallback(
    (code: string, rate: string, suggested = false) =>
      setFxRates((old) =>
        suggested && old[code] ? old : { ...old, [code]: rate },
      ),
    [],
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
        throw new Error('کارگزار، ارز و هزینه کل خرید بلیط را کامل کنید.');
      const payload = JSON.stringify({
        version: 1,
        expectedVersion: request.purchaseVersion ?? 0,
        serviceClientKey: service.clientKey,
        supplierOrganizationId: supplier.id,
        amount,
        currencyCode: currency.id,
        ...(fxRates[currency.id]
          ? { purchaseRateToIrr: fxRates[currency.id] }
          : {}),
      });
      if (onStage) {
        onStage(JSON.parse(payload));
        onSaved();
        return;
      }
      if (attempt.current?.payload !== payload)
        attempt.current = { payload, key: crypto.randomUUID() };
      const send = () =>
        fetch(
          `${base}/${purchaseApiRoot(request.id, purchaseRoot)}/service-purchases`,
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
            'ثبت هزینه بلیط ناموفق بود.',
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
      <h4 className="font-bold">هزینه خرید بلیط — {service.titleSnapshot}</h4>
      <div className="grid gap-3 sm:grid-cols-3">
        <FormField label={purchaseRoot ? 'آژانس بلیط' : 'کارگزار بلیط'}>
          <ReservationPurchaseBrokerLookup
            purchaseRoot={purchaseRoot}
            requestId={request.id}
            label={purchaseRoot ? 'آژانس بلیط' : 'کارگزار بلیط'}
            value={supplier}
            onChange={setSupplier}
          />
        </FormField>
        <FormField label="ارز خرید بلیط">
          {purchaseRoot ? (
            <PurchaseCurrencyLookup
              requestId={request.id}
              purchaseRoot={purchaseRoot}
              label="ارز خرید بلیط"
              value={currency}
              onChange={setCurrency}
            />
          ) : (
            <Lookup
              kind="currencies"
              label="ارز خرید بلیط"
              value={currency}
              onChange={setCurrency}
            />
          )}
        </FormField>
        <FormField label="هزینه کل بلیط">
          <MoneyInput
            aria-label="هزینه کل خرید بلیط"
            value={amount}
            onValueChange={setAmount}
          />
        </FormField>
      </div>
      <p className="text-xs text-muted-foreground">
        هزینه خرید پرواز برای مسافران همین قرارداد.
      </p>
      <PurchaseFxRate
        purchaseRoot={purchaseRoot}
        currencyCode={currency?.id ?? ''}
        value={fxRates[currency?.id ?? ''] ?? ''}
        onChange={updateFx}
      />
      <Button type="button" disabled={busy} onClick={() => void save()}>
        ثبت خرید بلیط
      </Button>
      {error && <p role="alert">{error}</p>}
    </section>
  );
}
