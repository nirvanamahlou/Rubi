import {
  moneyUnits,
  type SalesPaymentInput,
  type SalesContractDetail,
} from '@nora/contracts';

/** Pair by saved facts, never response row position (SQL timestamp ties are possible). */
export function createdPaymentIds(
  inputs: readonly SalesPaymentInput[],
  saved: SalesContractDetail['payments'],
): string[] {
  const remaining = [...saved];
  return inputs.map((payment) => {
    const index = remaining.findIndex(
      (p) =>
        moneyUnits(p.amount) === moneyUnits(payment.amount) &&
        p.currencyCode === payment.currencyCode &&
        p.method === payment.method &&
        Date.parse(p.dueAt) === Date.parse(payment.dueAt) &&
        (p.description || '') === (payment.description || '') &&
        (p.paymentReference || '') === (payment.paymentReference || '') &&
        (p.check?.bankId || '') === (payment.check?.bankId || '') &&
        (p.check?.secureIdentifier || '') ===
          (payment.check?.secureIdentifier || '') &&
        (p.check?.ownerName || '') === (payment.check?.ownerName || '') &&
        (p.check?.dueDate || '') === (payment.check?.dueDate || ''),
    );
    if (index < 0) throw Error('پرداخت متعلق به این قرارداد نیست.');
    return remaining.splice(index, 1)[0]!.id;
  });
}
