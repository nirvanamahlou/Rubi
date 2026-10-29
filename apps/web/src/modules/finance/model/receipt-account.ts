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
    : (eligible[0]?.id ?? '');
}
