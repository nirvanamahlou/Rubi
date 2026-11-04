export interface FinanceContractPartyV1 {
  payerId: string;
  branchId: string;
  name: string;
}
export interface FinancePartyBalanceV1 {
  party: FinanceContractPartyV1;
  revision: string;
  totals: {
    currencyCode: string;
    outstanding: string;
    confirmedPaid: string;
    total: string;
  }[];
  contracts: {
    id: string;
    number: string;
    createdAt: string;
    balances: {
      currencyCode: string;
      outstanding: string;
      pendingFinance: string;
    }[];
  }[];
}
export interface FinancePartyReceiptCommandV1 {
  operationId: string;
  branchId: string;
  payerId: string;
  revision: string;
  currencyCode: string;
  amount: string;
  accountId: string;
  reference: string;
}
export interface FinancePartyReceiptResultV1 {
  operationId: string;
  allocations: {
    contractId: string;
    contractNumber: string;
    amount: string;
    paymentId: string;
  }[];
}

/** Four-decimal fixed-point FIFO shared by the preview and persisted command. */
export function planPartyReceipt(
  context: Pick<FinancePartyBalanceV1, 'contracts'>,
  currency: string,
  amount: string,
) {
  const units = (value: string) => {
    if (!/^-?\d+(?:\.\d{1,4})?$/.test(value))
      throw new Error('Invalid receipt amount');
    const negative = value.startsWith('-');
    const [whole, fraction = ''] = value.replace(/^-/, '').split('.');
    return (
      BigInt(whole!) * (negative ? -10000n : 10000n) +
      BigInt(fraction.padEnd(4, '0')) * (negative ? -1n : 1n)
    );
  };
  const decimal = (value: bigint) =>
    `${value / 10000n}.${(value % 10000n).toString().padStart(4, '0')}`.replace(
      /\.?0+$/,
      '',
    );
  let remaining = units(amount);
  if (remaining <= 0n || !context.contracts.length)
    throw new Error('Positive receipt and contracts required');
  const parts: {
    contractId: string;
    contractNumber: string;
    amount: string;
  }[] = [];
  for (const contract of context.contracts) {
    const debt = units(
      contract.balances.find((b) => b.currencyCode === currency)?.outstanding ??
        '0',
    );
    if (debt <= 0n || remaining <= 0n) continue;
    const part = remaining < debt ? remaining : debt;
    parts.push({
      contractId: contract.id,
      contractNumber: contract.number,
      amount: decimal(part),
    });
    remaining -= part;
  }
  if (remaining > 0n) {
    const last = context.contracts.at(-1)!;
    const part = parts.find((p) => p.contractId === last.id);
    if (part) part.amount = decimal(units(part.amount) + remaining);
    else
      parts.push({
        contractId: last.id,
        contractNumber: last.number,
        amount: decimal(remaining),
      });
  }
  return parts;
}
