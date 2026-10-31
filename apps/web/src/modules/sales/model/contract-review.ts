import {
  moneyDecimal,
  moneyUnits,
  type SalesContractOutputV1,
} from '@nora/contracts';
import {
  salesPayload,
  salesPassengerAgeLabel,
  type SalesFormState,
} from './sales-form';

/** Read-only projection of the exact submit payload; never allocates a contract number. */
export function contractReviewOutput(
  state: SalesFormState,
  company: SalesContractOutputV1['company'],
  now: string,
): SalesContractOutputV1 {
  const payload = salesPayload(state);
  const totals = new Map<string, bigint>();
  for (const price of payload.priceComponents)
    totals.set(
      price.currencyCode,
      (totals.get(price.currencyCode) ?? 0n) +
        moneyUnits(price.amount) * (price.type === 'DISCOUNT' ? -1n : 1n),
    );
  return {
    version: 1,
    generatedAt: now,
    company,
    ownerName: null,
    customer: {
      kind: state.customerKind ?? 'person',
      address: payload.buyerContact?.address ?? null,
      phone: payload.buyerContact?.phone ?? null,
      landline: payload.buyerContact?.landline ?? null,
      postalCode: payload.buyerContact?.postalCode ?? null,
    },
    contract: {
      id: '',
      contractNumber: 'پیش‌نمایش؛ ثبت نشده',
      customerId: payload.customerId,
      customerNameSnapshot: payload.buyerContact?.name || state.customerName,
      passengerNames: payload.passengers.map((p) => p.displayNameSnapshot),
      ownerUserId: '',
      assignedUserId: payload.assignedUserId ?? null,
      branchId: '',
      originId: payload.originId,
      destinationId: payload.destinationId,
      departureDate: payload.departureDate,
      returnNotBefore: payload.returnNotBefore ?? null,
      services: [...new Set(payload.services.map((s) => s.kind))],
      status: 'DRAFT',
      settlementStatus: 'UNPAID',
      reservationStatus: 'NOT_SENT',
      balances: [...totals].map(([currencyCode, amount]) => ({
        currencyCode,
        amount: moneyDecimal(amount),
        confirmedPaid: '0',
        pendingFinance: '0',
        outstanding: moneyDecimal(amount),
      })),
      version: 0,
      createdAt: now,
      updatedAt: now,
      tripType: payload.tripType,
      payerCustomerId: payload.payerCustomerId ?? payload.customerId,
      servicesDetail: payload.services,
      passengersDetail: payload.passengers.map((p, i) => ({
        ...p,
        id: 'preview-' + i,
        ageCategory:
          p.ageCategory ??
          (salesPassengerAgeLabel(p.birthDate ?? '', payload.departureDate) ===
          'نوزاد'
            ? 'INF'
            : salesPassengerAgeLabel(
                  p.birthDate ?? '',
                  payload.departureDate,
                ) === 'کودک'
              ? 'CHD'
              : 'ADT'),
      })),
      ticketSelections: payload.ticketSelections ?? [],
      hotelSelection: payload.hotelSelection ?? null,
      priceComponents: payload.priceComponents,
      payments: [],
      fxSnapshot: payload.fxSnapshot,
      pricingNotes: payload.pricingNotes ?? null,
      buyerContact: payload.buyerContact ?? null,
      paymentTerms: payload.paymentTerms ?? null,
    },
  };
}
