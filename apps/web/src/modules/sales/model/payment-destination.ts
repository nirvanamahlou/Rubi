import type {
  SalesPaymentInput,
  SalesPaymentAccountV1,
  SalesPaymentMethod,
} from '@nora/contracts';

export function paymentDestinationIsRequired(payment: {
  method?: SalesPaymentMethod | undefined;
  currencyCode: string;
}) {
  return (
    payment.method !== 'CASH' &&
    !(
      payment.method === 'BANK_TRANSFER' &&
      payment.currencyCode !== '' &&
      payment.currencyCode !== 'IRR'
    )
  );
}

export function paymentDestinationIsValid(
  payment: SalesPaymentInput,
  accounts: readonly SalesPaymentAccountV1[],
  loading: boolean,
  error: string,
) {
  if (payment.method === 'CASH') return true;
  if (!payment.destinationAccountId && !paymentDestinationIsRequired(payment))
    return true;
  return (
    !loading &&
    !error &&
    accounts.some(
      (account) =>
        account.id === payment.destinationAccountId &&
        account.currencyCode === payment.currencyCode,
    )
  );
}
