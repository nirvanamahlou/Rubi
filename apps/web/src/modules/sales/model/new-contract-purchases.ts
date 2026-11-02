import type {
  ReservationIntakeV1,
  SalesContractCreateRequest,
  ReservationServicePurchaseInputV1,
  ReservationPurchaseBatchInputV1,
} from '@nora/contracts';
export type StagedPurchase =
  | { path: 'service-purchases'; body: ReservationServicePurchaseInputV1 }
  | { path: 'purchase-batches'; body: ReservationPurchaseBatchInputV1 };
export function purchaseDraftFingerprint(input: SalesContractCreateRequest) {
  return JSON.stringify([
    input.services,
    input.passengers.map((p) => [
      p.customerId,
      p.ageCategory,
      p.serviceClientKeys,
    ]),
    input.ticketSelections,
    input.hotelSelection,
  ]);
}
export function purchaseDraftContext(
  input: SalesContractCreateRequest,
): ReservationIntakeV1 {
  return {
    id: 'draft',
    requestId: 'draft',
    contractId: 'draft',
    contractVersion: 0,
    branchId: '',
    status: 'QUEUED',
    receivedAt: '2000-01-01T00:00:00Z',
    arrangement: null,
    purchaseVersion: 0,
    snapshot: {
      version: 1,
      requestId: 'draft',
      contractId: 'draft',
      contractNumber: '',
      contractVersion: 0,
      customerId: input.customerId,
      passengerIds: input.passengers.map((p) => p.customerId),
      passengerAssignments: input.passengers.map((p) => ({
        ...p,
        ageCategory: p.ageCategory ?? 'ADT',
        serviceClientKeys: p.serviceClientKeys ?? [],
      })),
      ticketSelections: input.ticketSelections ?? [],
      selectedTicketOfferIds: (input.ticketSelections ?? []).map(
        (t) => t.offerId,
      ),
      serviceSelections: input.services,
      hotelSelection: input.hotelSelection ?? null,
      createdAt: '2000-01-01T00:00:00Z',
    },
  };
}
/** A retry must send the identical version/body/key, even after a lost success response. */
export async function submitStagedPurchases(
  pending: Record<string, StagedPurchase>,
  attempts: Record<string, { key: string; purchase: StagedPurchase }>,
  context: () => Promise<{
    purchaseVersion?: number;
    workflow?: { version: number };
  }>,
  post: (purchase: StagedPurchase, key: string) => Promise<void>,
  uuid: () => string,
) {
  for (const [id, purchase] of Object.entries(pending)) {
    if (!attempts[id]) {
      const current = await context();
      const body = {
        ...purchase.body,
        expectedVersion: current.purchaseVersion ?? 0,
      };
      if ('hotelStayKey' in body)
        body.supplierFormVersion = current.workflow?.version ?? 0;
      attempts[id] = {
        key: uuid(),
        purchase: { ...purchase, body } as StagedPurchase,
      };
    }
    await post(attempts[id]!.purchase, attempts[id]!.key);
    delete pending[id];
    delete attempts[id];
  }
}
