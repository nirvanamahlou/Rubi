import type { B2bAgreementTermsV1 } from '@rubi/contracts';

export function blankAgreementTerms(): B2bAgreementTermsV1 {
  return {
    title: '',
    agreementType: 'FRAMEWORK',
    startsAt: new Date().toISOString().slice(0, 10),
    endsAt: null,
    currencyCodes: [],
    services: ['FLIGHT'],
    paymentMethod: 'PREPAID',
    paymentMethodId: null,
    settlementCycle: 'PER_ORDER',
    settlementDays: 0,
    cutoffDay: null,
    slaHours: 24,
    cancellationTerms: '',
    refundTerms: '',
    notes: '',
    changeReason: 'ثبت اولیه قرارداد',
    documentId: null,
    creditPolicies: [],
    guarantees: [],
  };
}

/** Pick only mutable terms; review metadata must never enter the write DTO. */
export function editableAgreementTerms(
  value: B2bAgreementTermsV1,
): B2bAgreementTermsV1 {
  const {
    title,
    agreementType,
    startsAt,
    endsAt,
    currencyCodes,
    services,
    paymentMethod,
    paymentMethodId,
    settlementCycle,
    settlementDays,
    cutoffDay,
    slaHours,
    cancellationTerms,
    refundTerms,
    notes,
    changeReason,
    documentId,
    documentVersionId,
    creditPolicies,
    guarantees,
  } = value;
  return {
    title,
    agreementType,
    startsAt,
    endsAt,
    currencyCodes: [...currencyCodes],
    services: [...services],
    paymentMethod,
    ...(paymentMethodId !== undefined ? { paymentMethodId } : {}),
    settlementCycle,
    settlementDays,
    cutoffDay,
    slaHours,
    cancellationTerms,
    refundTerms,
    notes,
    changeReason,
    documentId,
    ...(documentVersionId !== undefined ? { documentVersionId } : {}),
    creditPolicies: creditPolicies.map((p) => ({ ...p })),
    guarantees: guarantees.map((g) => ({ ...g })),
  };
}
export const serviceLabels = {
  FLIGHT: 'پرواز',
  HOTEL: 'هتل',
  TOUR: 'تور',
  VISA: 'ویزا',
  INSURANCE: 'بیمه',
  RAIL: 'قطار',
  BUS: 'اتوبوس',
  OTHER: 'سایر خدمات',
} as const;
export const reviewLabels = {
  DRAFT: 'پیش‌نویس',
  PENDING: 'در انتظار تأیید',
  APPROVED: 'تأییدشده',
  REJECTED: 'ردشده',
} as const;
