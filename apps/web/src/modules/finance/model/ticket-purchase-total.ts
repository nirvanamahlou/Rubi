/** Exact four-decimal money multiplication, matching Finance's decimal input. */
export function ticketPurchaseTotal(
  seats: string,
  unitCost: string,
): string | null {
  if (!/^[1-9]\d*$/.test(seats) || !Number.isSafeInteger(Number(seats)))
    return null;
  if (!/^(?:0|[1-9]\d*)(?:\.\d{1,4})?$/.test(unitCost)) return null;
  const [whole = '0', fraction = ''] = unitCost.split('.');
  const scaled = BigInt(whole) * 10000n + BigInt(fraction.padEnd(4, '0'));
  if (scaled <= 0n) return null;
  const total = scaled * BigInt(seats);
  const decimals = (total % 10000n)
    .toString()
    .padStart(4, '0')
    .replace(/0+$/, '');
  return (total / 10000n).toString() + (decimals ? '.' + decimals : '');
}
