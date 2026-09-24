import { moneyDecimal, moneyUnits, type SalesBalance } from '@nora/contracts';

export interface ContractPaymentShare {
  entered: string | null;
  percentOfTotal: string | null;
  remainingAfterConfirmation: string;
  overpayment: string;
}

const safeMoneyUnits = (value: string) => {
  try {
    return moneyUnits(value);
  } catch {
    return null;
  }
};

export function calculateContractPaymentShare(
  balance: SalesBalance,
  amount: string,
): ContractPaymentShare {
  const total = moneyUnits(balance.amount);
  const outstanding = moneyUnits(balance.outstanding);
  const entered = safeMoneyUnits(amount);
  const remaining = entered === null ? outstanding : outstanding - entered;
  const overpayment = remaining < 0n ? -remaining : 0n;
  const percentTenths =
    entered === null || total <= 0n
      ? null
      : (entered * 1000n + total / 2n) / total;

  return {
    entered: entered === null ? null : moneyDecimal(entered),
    percentOfTotal:
      percentTenths === null
        ? null
        : percentTenths % 10n === 0n
          ? (percentTenths / 10n).toString()
          : `${percentTenths / 10n}.${percentTenths % 10n}`,
    remainingAfterConfirmation: moneyDecimal(remaining > 0n ? remaining : 0n),
    overpayment: moneyDecimal(overpayment),
  };
}
