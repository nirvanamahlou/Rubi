import type {
  ReservationServicePurchaseV1,
  ReservationHotelPurchaseV1,
} from './travel';
import type { SalesReservationRequestV1 } from './sales';
export const FLOATING_PURCHASE_OWN = 'floating_purchases.write.own';
export const FLOATING_PURCHASE_ALL = 'floating_purchases.read.all';
/** Server-owned Sales/Inventory facts; one floating leg also makes the hotel floating. */
export function isFloatingContract(
  snapshot:
    | Partial<
        Pick<
          SalesReservationRequestV1,
          'serviceSelections' | 'ticketSelections'
        >
      >
    | null
    | undefined,
  trustedInventoryProjection = true,
): boolean {
  return (
    snapshot?.ticketSelections?.some(
      (t) => 'source' in t && t.source === 'CONTRACT_ONLY',
    ) === true ||
    (snapshot?.serviceSelections ?? []).some(
      (s) =>
        s.kind === 'FLIGHT' &&
        ((s.metadata?.contractFlightVersion === 1 &&
          !snapshot?.ticketSelections?.some(
            (t) =>
              t.serviceClientKey === s.clientKey &&
              (!('source' in t) || t.source !== 'CONTRACT_ONLY'),
          )) ||
          (trustedInventoryProjection &&
            s.metadata?.purchaseSupplyType === 'FLOATING')),
    )
  );
}
export function canWriteOwnFloatingPurchase(
  permissions: readonly string[],
  userId: string,
  ownerId: string | null | undefined,
): boolean {
  return (
    permissions.includes(FLOATING_PURCHASE_OWN) &&
    !!ownerId &&
    ownerId === userId
  );
}

/** Bounded purchase workspace projection; no passenger identity or Finance payment details. */
export interface FloatingPurchaseRequestV1 {
  id: string;
  salesOwnerUserId?: string | null;
  purchaseVersion?: number;
  snapshot: {
    contractNumber: string;
    serviceSelections: readonly {
      clientKey: string;
      kind: 'HOTEL' | 'FLIGHT';
      titleSnapshot: string;
    }[];
    hotelSelection?: { serviceClientKey: string; hotelNameSnapshot: string };
    ticketSelections?: readonly {
      serviceClientKey: string;
      carrierNameSnapshot: string;
    }[];
  };
  servicePurchases?: readonly Pick<
    ReservationServicePurchaseV1,
    | 'serviceClientKey'
    | 'supplierOrganizationId'
    | 'supplierName'
    | 'amount'
    | 'currencyCode'
  >[];
  hotelPurchases?: readonly Pick<
    ReservationHotelPurchaseV1,
    'amount' | 'currencyCode'
  >[];
}
