import type {
  ReservationIntakeV1,
  SalesContractCreateRequest,
  ReservationServicePurchaseInputV1,
  ReservationPurchaseBatchInputV1,
} from '@nora/contracts';
export type StagedPurchase = (
  | { path: 'service-purchases'; body: ReservationServicePurchaseInputV1 }
  | { path: 'purchase-batches'; body: ReservationPurchaseBatchInputV1 }
) & { supplierName?: string; supplierNames?: Record<string, string> };
export function purchaseDraftFingerprint(input: SalesContractCreateRequest) {
  return JSON.stringify([
    input.services.map((service) => ({
      clientKey: service.clientKey,
      kind: service.kind,
      referenceId: service.referenceId,
      metadata: Object.fromEntries(
        Object.entries(service.metadata ?? {}).filter(([key]) =>
          [
            'direction',
            'purchaseSupplyType',
            'contractFlightVersion',
            'flightDepartureAt',
            'flightArrivalAt',
            'flightNumber',
            'flightCarrierName',
            'flightCabinClass',
          ].includes(key),
        ),
      ),
    })),
    input.passengers.map((p) => [
      p.customerId,
      p.birthDate,
      p.childAgeBand,
      p.ageCategory,
      p.serviceClientKeys,
    ]),
    input.ticketSelections?.map((ticket) => ({
      serviceClientKey: ticket.serviceClientKey,
      offerId: ticket.offerId,
      direction: ticket.direction,
      originId: ticket.originId,
      destinationId: ticket.destinationId,
      departureAt: ticket.departureAt,
      arrivalAt: ticket.arrivalAt,
      carrierNameSnapshot: ticket.carrierNameSnapshot,
      serviceNumberSnapshot: ticket.serviceNumberSnapshot,
      cabinClassCode: ticket.cabinClassCode,
    })),
    JSON.parse(
      JSON.stringify(input.hotelSelection ?? null, (key, value) =>
        key === 'agreedPrice' ? undefined : value,
      ),
    ),
  ]);
}
export function purchaseDraftContext(
  input: SalesContractCreateRequest,
  staged: Record<string, StagedPurchase> = {},
): ReservationIntakeV1 {
  return {
    servicePurchases: Object.values(staged).flatMap((purchase) => {
      const rows =
        purchase.path === 'purchase-batches'
          ? purchase.body.purchases
          : [purchase.body];
      return rows.map((row, index) => ({
        id: 'draft:' + row.serviceClientKey + ':' + index,
        version: 0,
        serviceClientKey: row.serviceClientKey,
        serviceKind:
          input.services.find((s) => s.clientKey === row.serviceClientKey)
            ?.kind ?? (row.roomPrices ? 'HOTEL' : 'TRANSFER'),
        serviceTitle: row.serviceClientKey,
        supplierOrganizationId: row.supplierOrganizationId,
        supplierName:
          purchase.supplierNames?.[row.supplierOrganizationId] ??
          purchase.supplierName ??
          row.supplierOrganizationId,
        amount: row.amount,
        currencyCode: row.currencyCode,
        passengerPrices: [],
        ...(row.totalPassengerPrices
          ? { totalPassengerPrices: row.totalPassengerPrices }
          : {}),
        actorUserId: 'draft',
        createdAt: '2000-01-01T00:00:00Z',
        ...(purchase.path === 'purchase-batches' &&
        purchase.body.hotelTransferCounts
          ? { hotelTransferCounts: purchase.body.hotelTransferCounts }
          : {}),
        ...(purchase.path === 'purchase-batches' &&
        purchase.body.hotelTransferRoundTrip !== undefined
          ? { hotelTransferRoundTrip: purchase.body.hotelTransferRoundTrip }
          : {}),
        ...(row.roomPrices ? { roomPrices: row.roomPrices } : {}),
        ...(row.pricingCalculation
          ? {
              pricingCalculation: {
                ...row.pricingCalculation,
                nights: 1,
                totalAmount: row.amount,
              },
            }
          : {}),
        ...(row.coveredServiceClientKeys
          ? { coveredServiceClientKeys: row.coveredServiceClientKeys }
          : {}),
        finance: {
          version: 0,
          status: 'PENDING' as const,
          bankId: null,
          accountId: null,
          accountTitle: null,
          paymentMethodId: null,
          paymentMethodName: null,
          paidAmount: '0',
          remainingAmount: row.amount,
          exchangeRateToIrr: null,
          rialEquivalent: null,
          transferAt: null,
          paymentReference: null,
          reason: '',
          updatedAt: null,
          updatedByUserId: null,
        },
      }));
    }),
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

/** Confirmation commits the durable outbox before its Reservations intake appears. */
export async function waitForPurchaseContext<T>(
  load: () => Promise<T>,
  wait: () => Promise<void> = () =>
    new Promise((resolve) => setTimeout(resolve, 1000)),
): Promise<T> {
  for (let attempt = 0; ; attempt++) {
    try {
      return await load();
    } catch (error) {
      if (
        attempt >= 20 ||
        !error ||
        typeof error !== 'object' ||
        !('status' in error) ||
        error.status !== 404
      )
        throw error;
      await wait();
    }
  }
}
