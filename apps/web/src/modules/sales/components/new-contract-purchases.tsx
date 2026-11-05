'use client';
import { FloatingPurchaseChoice } from '@/modules/reservations/components/floating-purchase-choice';
import { CONTRACT_TOTAL_PURCHASE_KEY } from '@nora/contracts';
import {
  isFloatingSalesContract,
  reservationHotelStays,
  type SalesContractCreateRequest,
} from '@nora/contracts';
import { ReservationFloatingFlightPurchase } from '@/modules/reservations/components/reservation-floating-flight-purchase';
import { HotelStayPurchase } from '@/modules/reservations/components/hotel-stay-purchase';
import {
  purchaseDraftContext,
  type StagedPurchase,
} from '../model/new-contract-purchases';
export function NewContractPurchases({
  input,
  onStage,
  stagedPurchases = {},
  onReset,
}: {
  input: SalesContractCreateRequest;
  stagedPurchases?: Record<string, StagedPurchase>;
  onReset?: () => void;
  onStage: (id: string, purchase: StagedPurchase) => void;
}) {
  if (!isFloatingSalesContract(input.services)) return null;
  const request = purchaseDraftContext(input, stagedPurchases);
  const purchaseRoot = 'sales/purchase-draft';
  return (
    <section className="grid gap-3 rounded-xl border p-4">
      <h3 className="font-bold">خرید قرارداد شناوری</h3>
      <FloatingPurchaseChoice
        request={request}
        purchaseRoot={purchaseRoot}
        onSaved={() => {}}
        {...(onReset ? { onReset } : {})}
        onStage={(body, details) =>
          onStage(CONTRACT_TOTAL_PURCHASE_KEY, {
            path: 'service-purchases',
            body,
            ...details,
          })
        }
      >
        {input.services
          .filter(
            (s) =>
              s.kind === 'FLIGHT' &&
              (s.metadata?.contractFlightVersion === 1 ||
                s.metadata?.purchaseSupplyType === 'FLOATING'),
          )
          .map((service) => (
            <ReservationFloatingFlightPurchase
              key={service.clientKey}
              request={request}
              purchaseRoot={purchaseRoot}
              serviceClientKey={service.clientKey}
              onSaved={() => {}}
              onStage={(body, details) =>
                onStage(service.clientKey, {
                  path: 'service-purchases',
                  body,
                  ...details,
                })
              }
            />
          ))}
        {reservationHotelStays(request.snapshot).map((stay) => (
          <HotelStayPurchase
            key={stay.key}
            request={request}
            stayKey={stay.key}
            purchaseRoot={purchaseRoot}
            onSaved={() => {}}
            onStage={(body, details) =>
              onStage(stay.key, { path: 'purchase-batches', body, ...details })
            }
          />
        ))}
      </FloatingPurchaseChoice>
    </section>
  );
}
