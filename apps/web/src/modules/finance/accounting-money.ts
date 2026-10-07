// Display-only exact totals. Posting amounts and currency rounding remain server validated.
function scaled(value: string): bigint | null {
  const n = value
    .trim()
    .replace(/[۰-۹]/g, (d) => String('۰۱۲۳۴۵۶۷۸۹'.indexOf(d)))
    .replace(/[٠-٩]/g, (d) => String('٠١٢٣٤٥٦٧٨٩'.indexOf(d)))
    .replace(/٫/g, '.')
    .replace(/٬/g, ',');
  if (n.includes(',') && !/^\d{1,3}(,\d{3})+(\.\d{1,18})?$/.test(n))
    return null;
  const clean = n.replaceAll(',', '') || '0';
  if (!/^\d{1,20}(\.\d{1,18})?$/.test(clean)) return null;
  const [whole, fraction = ''] = clean.split('.');
  return BigInt(whole!) * 10n ** 18n + BigInt(fraction.padEnd(18, '0'));
}
const formatted = (n: bigint) => {
  const sign = n < 0n ? '-' : '';
  const value = n < 0n ? -n : n;
  const tail = (value % 10n ** 18n)
    .toString()
    .padStart(18, '0')
    .replace(/0+$/, '');
  return sign + (value / 10n ** 18n).toString() + (tail ? '.' + tail : '');
};
export function journalDisplayTotals(
  rows: { debit: string; credit: string }[],
) {
  let debit = 0n,
    credit = 0n;
  for (const row of rows) {
    const d = scaled(row.debit),
      c = scaled(row.credit);
    if (d === null || c === null)
      return {
        valid: false,
        debit: '',
        credit: '',
        difference: '',
        balanced: false,
      };
    debit += d;
    credit += c;
  }
  return {
    valid: true,
    debit: formatted(debit),
    credit: formatted(credit),
    difference: formatted(debit - credit),
    balanced: debit === credit && debit > 0n,
  };
}
