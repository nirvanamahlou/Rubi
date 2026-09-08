import type { B2bAgreementTermsV1 } from '@rubi/contracts';
/** Synthetic terms for isolated tests only. */
export function agreementTestTerms(): B2bAgreementTermsV1 {
  return {
    title: 'قرارداد آزمایشی',
    agreementType: 'FRAMEWORK',
    startsAt: '2026-01-01',
    endsAt: '2099-12-31',
    currencyCodes: ['IRR', 'USD'],
    services: ['FLIGHT', 'HOTEL'],
    paymentMethod: 'CREDIT',
    settlementCycle: 'MONTHLY',
    settlementDays: 15,
    cutoffDay: 25,
    slaHours: 24,
    cancellationTerms: 'شرایط لغو',
    refundTerms: 'شرایط استرداد',
    notes: 'Synthetic only',
    changeReason: 'ثبت اولیه',
    documentId: null,
    creditPolicies: [
      {
        currencyCode: 'IRR',
        creditLimit: '9007199254740993.25',
        limitType: 'HARD',
        dueDays: 30,
        overdueAction: 'BLOCK',
        effectiveFrom: '2026-01-01',
        expiresAt: '2099-12-31',
      },
      {
        currencyCode: 'USD',
        creditLimit: '12500.50',
        limitType: 'SOFT',
        dueDays: 14,
        overdueAction: 'WARN',
        effectiveFrom: '2026-01-01',
        expiresAt: '2099-12-31',
      },
    ],
    guarantees: [
      {
        kind: 'DEPOSIT_REQUIREMENT',
        reference: 'TEST-DEPOSIT',
        amount: '500.25',
        currencyCode: 'USD',
        issuer: 'Synthetic guarantor',
        receivedAt: '2026-01-01',
        expiresAt: '2099-12-31',
        status: 'REQUIRED',
        documentId: null,
      },
    ],
  };
}
