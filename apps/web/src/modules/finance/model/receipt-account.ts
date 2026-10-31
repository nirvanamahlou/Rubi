import type {
  FinanceInboxItemV1,
  FinanceSettlementAccountV1,
} from '@nora/contracts';

export function initialReceiptAccount(
  item: FinanceInboxItemV1,
  accounts: readonly FinanceSettlementAccountV1[],
) {
  const eligible = accounts.filter(
    (account) =>
      account.isActive &&
      account.branchId === item.branchReference &&
      account.currencyCode === item.amount?.currencyCode,
  );
  return item.destinationAccountId
    ? (eligible.find((account) => account.id === item.destinationAccountId)
        ?.id ?? '')
    : '';
}

export function receiptAccountLabel(
  account: Pick<
    FinanceSettlementAccountV1,
    'title' | 'bankName' | 'maskedIdentifier'
  >,
) {
  return [
    ...new Set(
      [account.title, account.bankName, account.maskedIdentifier]
        .map((value) => value?.trim())
        .filter(Boolean),
    ),
  ].join(' · ');
}
export function declaredReceiptAccountLabel(
  item: FinanceInboxItemV1,
  accounts: readonly FinanceSettlementAccountV1[],
) {
  const account = accounts.find(
    (candidate) =>
      candidate.id === item.destinationAccountId &&
      candidate.branchId === item.branchReference,
  );
  return account
    ? receiptAccountLabel(account)
    : item.destinationAccountTitle?.trim() || 'حساب ثبت‌شده در پرداخت';
}
