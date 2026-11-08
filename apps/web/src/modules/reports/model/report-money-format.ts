/** Presentation only: preserve decimal digits without Number conversion or FX arithmetic. */
export function formatReportMoney(value: string | number): string {
  return String(value)
    .split(' + ')
    .map((part) => {
      const match = /^(-?)([0-9][0-9,]*)(\.[0-9]+)?(\s+[^0-9].*)?$/.exec(part);
      if (!match) return part;
      return (
        match[1] +
        match[2]!.replaceAll(',', '').replace(/\B(?=(\d{3})+(?!\d))/g, ',') +
        (match[3] ?? '') +
        (match[4] ?? '')
      );
    })
    .join(' + ');
}
export function isReportMoneyColumn(column: {
  key: string;
  kind: string;
}): boolean {
  return (
    column.kind === 'MONEY' ||
    /(?:Amount|Balance|Rate|Price|Cost)$/.test(column.key) ||
    [
      'salesAmount',
      'purchaseAmount',
      'grossProfit',
      'refundAmount',
      'settlementBalance',
      'commissionAmount',
      'settledAmount',
    ].includes(column.key)
  );
}
