const iso = (value) =>
  typeof value === 'string' &&
  /^\d{4}-\d\d-\d\dT/.test(value) &&
  Number.isFinite(Date.parse(value));
const uuid = (value) =>
  typeof value === 'string' &&
  /^[a-f0-9]{8}-(?:[a-f0-9]{4}-){3}[a-f0-9]{12}$/i.test(value);
const decimal = (value) =>
  typeof value === 'string' && /^-?\d{1,24}(?:\.\d{1,4})?$/.test(value);
const units = (value) => {
  const sign = value.startsWith('-') ? -1n : 1n;
  const [whole, fraction = ''] = value.replace(/^-/, '').split('.');
  return sign * BigInt(whole + fraction.padEnd(4, '0'));
};
const keys = ['amount', 'confirmedPaid', 'pendingFinance', 'outstanding'];
const missing = [
  'ACCOUNTING_RECEIVABLES_SOURCE_PENDING',
  'DUE_SCHEDULE_SOURCE_PENDING',
  'REFUND_ADJUSTMENT_SOURCE_PENDING',
];
function validBalances(rows) {
  return (
    Array.isArray(rows) &&
    rows.length <= 100 &&
    new Set(rows.map((row) => row?.currencyCode)).size === rows.length &&
    rows.every(
      (row) =>
        row &&
        /^[A-Z]{3}$/.test(row.currencyCode) &&
        keys.every((key) => decimal(row[key])) &&
        units(row.confirmedPaid) >= 0n &&
        units(row.pendingFinance) >= 0n &&
        units(row.amount) - units(row.confirmedPaid) === units(row.outstanding),
    )
  );
}
export function validBalanceSource(value) {
  return (
    value?.version === 1 &&
    value.source === 'sales.assistant.contract-balances.v1' &&
    value.scope === 'ALL_AUTHORIZED_SALES' &&
    iso(value.observedAt) &&
    (value.sourceUpdatedAt === null || iso(value.sourceUpdatedAt)) &&
    Number.isSafeInteger(value.contractCount) &&
    value.contractCount >= 0 &&
    value.contractCount <= 5000 &&
    validBalances(value.totals) &&
    Array.isArray(value.items) &&
    value.items.length <= 30 &&
    value.items.length <= value.contractCount &&
    new Set(value.items.map((row) => row?.contractId)).size ===
      value.items.length &&
    value.items.every(
      (row) =>
        uuid(row.contractId) &&
        typeof row.contractNumber === 'string' &&
        row.contractNumber.length > 0 &&
        row.contractNumber.length <= 40 &&
        row.href === '/sales' &&
        validBalances(row.balances) &&
        row.balances.some((balance) => units(balance.outstanding) > 0n),
    ) &&
    value.coverage?.rowLimit === 5000 &&
    value.coverage.itemLimit === 30 &&
    typeof value.coverage.itemsTruncated === 'boolean' &&
    (!value.coverage.itemsTruncated || value.items.length === 30) &&
    value.coverage.basis === 'CURRENT_CONFIRMED_CONTRACTS' &&
    value.coverage.refundsIncluded === false &&
    JSON.stringify(value.unavailable) === JSON.stringify(missing)
  );
}
export function projectBalanceSource(value) {
  const balances = (rows) =>
    rows.map((row) => ({
      currencyCode: row.currencyCode,
      ...Object.fromEntries(keys.map((key) => [key, row[key]])),
    }));
  return {
    version: 1,
    source: value.source,
    scope: value.scope,
    observedAt: value.observedAt,
    sourceUpdatedAt: value.sourceUpdatedAt,
    contractCount: value.contractCount,
    totals: balances(value.totals),
    items: value.items.map((row) => ({
      contractId: row.contractId,
      contractNumber: row.contractNumber,
      href: '/sales',
      balances: balances(row.balances),
    })),
    coverage: {
      rowLimit: 5000,
      itemLimit: 30,
      itemsTruncated: value.coverage.itemsTruncated,
      basis: 'CURRENT_CONFIRMED_CONTRACTS',
      refundsIncluded: false,
    },
    unavailable: [...missing],
  };
}
