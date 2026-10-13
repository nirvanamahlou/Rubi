/** Compare numeric document text exactly without changing the stored value. */
export function compareDocumentText(
  left: string,
  right: string,
  numeric: boolean,
) {
  if (
    numeric &&
    /^[+-]?\d+(\.\d+)?$/.test(left) &&
    /^[+-]?\d+(\.\d+)?$/.test(right)
  ) {
    const digits = Math.max(
      left.split('.')[1]?.length ?? 0,
      right.split('.')[1]?.length ?? 0,
    );
    const scaled = (value: string) => {
      const negative = value.startsWith('-');
      const [whole, fraction = ''] = value.replace(/^[+-]/, '').split('.');
      const result =
        BigInt(whole!) * 10n ** BigInt(digits) +
        BigInt(fraction.padEnd(digits, '0') || '0');
      return negative ? -result : result;
    };
    const a = scaled(left),
      b = scaled(right);
    return a < b ? -1 : a > b ? 1 : 0;
  }
  return left.localeCompare(right, 'fa', { numeric: true });
}
