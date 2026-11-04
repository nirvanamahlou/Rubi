import type { SalesPaymentInput, SalesPaymentAccountV1 } from '@nora/contracts';

export function paymentDestinationIsValid(
  payment: SalesPaymentInput,
  accounts: readonly SalesPaymentAccountV1[],
  loading: boolean,
  error: string,
) {
  if (payment.method === 'CASH') return true;
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
