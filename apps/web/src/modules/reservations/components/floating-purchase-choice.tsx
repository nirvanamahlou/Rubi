'use client';
import { useState, type ReactNode } from 'react';
import {
  CONTRACT_TOTAL_PURCHASE_KEY,
  type ReservationIntakeV1,
  type ReservationServicePurchaseInputV1,
} from '@nora/contracts';
import { ReservationFloatingFlightPurchase } from './reservation-floating-flight-purchase';
export function FloatingPurchaseChoice({
  request,
  purchaseRoot,
  onSaved,
  onStage,
  onReset,
  children,
}: {
  request: ReservationIntakeV1;
  purchaseRoot: string;
  onSaved: () => void;
  onStage?: (
    body: ReservationServicePurchaseInputV1,
    details?: { supplierName: string },
  ) => void;
  onReset?: () => void;
  children: ReactNode;
}) {
  const savedTotal =
    request.servicePurchases?.some(
      (p) => p.serviceClientKey === CONTRACT_TOTAL_PURCHASE_KEY,
    ) ?? false;
  const locked =
    request.id !== 'draft' &&
    Boolean(request.servicePurchases?.length || request.hotelPurchases?.length);
  const [total, setTotal] = useState(savedTotal);
  const effective = locked ? savedTotal : total;
  return (
    <section className="space-y-3">
      <fieldset
        className="flex flex-wrap gap-4 rounded-xl border p-3"
        disabled={locked}
      >
        <legend>روش ثبت خرید</legend>
        <label>
          <input
            type="radio"
            name={'purchase-mode-' + request.id}
            checked={!effective}
            onChange={() => {
              onReset?.();
              setTotal(false);
            }}
          />{' '}
          به تفکیک خدمات
        </label>
        <label>
          <input
            type="radio"
            name={'purchase-mode-' + request.id}
            checked={effective}
            onChange={() => {
              onReset?.();
              setTotal(true);
            }}
          />{' '}
          قیمت کل
        </label>
      </fieldset>
      {locked && (
        <p className="text-xs text-muted-foreground">
          قیمت کل و خرید تفکیکی هم‌زمان ثبت نمی‌شوند.
        </p>
      )}
      {effective ? (
        <ReservationFloatingFlightPurchase
          key={
            CONTRACT_TOTAL_PURCHASE_KEY + ':' + (request.purchaseVersion ?? 0)
          }
          wholeContract
          request={request}
          purchaseRoot={purchaseRoot}
          onSaved={onSaved}
          {...(onStage ? { onStage } : {})}
        />
      ) : (
        children
      )}
    </section>
  );
}
